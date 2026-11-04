"""Season-to-date team stats in the nfl_weekly_matchups.py row shape.

Counting stats come from nflverse team weeks. Third-down made/attempts, which
that file does not publish, come from ESPN's public team statistics JSON.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

from nfl_sources import NICK, TEAM_WEEK, UA, download, dump_json, num, passer_rating, read_csv

ESPN_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32"
ESPN_STATS = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{}/statistics"


def fetch_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(request, timeout=25))


def third_downs(delay: float) -> dict:
    """abbr -> (made, attempts). ESPN abbreviations are mapped onto nflverse codes."""
    listing = fetch_json(ESPN_TEAMS)
    teams = listing["sports"][0]["leagues"][0]["teams"]
    found = {}
    alias = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX"}
    for index, entry in enumerate(teams):
        team = entry["team"]
        abbr = alias.get(team.get("abbreviation"), team.get("abbreviation"))
        if index:
            time.sleep(delay)
        try:
            payload = fetch_json(ESPN_STATS.format(team["id"]))
        except Exception as exc:
            print(f"  third down skip {abbr}: {exc}")
            continue
        stats = {}

        def walk(node):
            if isinstance(node, dict):
                if node.get("displayName") and ("value" in node or "displayValue" in node):
                    stats[node["displayName"]] = node.get("value")
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk((payload.get("results") or {}).get("stats"))
        made, attempts = stats.get("Third Down Conversions"), stats.get("Third Down Attempts")
        if made is not None and attempts is not None:
            found[abbr] = (made, attempts)
    return found


def aggregate(path: Path, season: int, before_week: int) -> dict:
    offense = defaultdict(lambda: defaultdict(float))
    allowed = defaultdict(lambda: defaultdict(float))
    for row in read_csv(path):
        if str(row.get("season")) != str(season) or row.get("season_type") != "REG":
            continue
        week = int(float(row["week"]))
        if week >= before_week:
            continue
        team, opponent = row["team"], row["opponent_team"]
        for bucket, owner in ((offense, team), (allowed, opponent)):
            for column in (
                "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
                "sacks_suffered", "carries", "rushing_yards", "rushing_tds", "rushing_fumbles",
                "rushing_first_downs", "receptions", "receiving_yards", "receiving_fumbles",
                "receiving_first_downs",
            ):
                bucket[owner][column] += num(row, column)
        offense[team]["def_sacks"] += num(row, "def_sacks")
        offense[team]["def_int"] += num(row, "def_interceptions")
        offense[team]["def_ff"] += num(row, "def_fumbles_forced")
        offense[team]["def_fr"] += num(row, "fumble_recovery_opp")
    return {"offense": offense, "allowed": allowed}


def row(season: int, team: str, unit: str, category: str, fields: dict) -> dict:
    record = {"season": season, "season_type": "reg", "Team": NICK[team], "unit": unit, "category": category,
              "source_url": "https://github.com/nflverse/nflverse-data/releases/tag/stats_team"}
    record.update(fields)
    return record


def safe_div(numer, denom):
    return round(numer / denom, 4) if denom else None


def build(season: int, before_week: int, cache: Path, dest: Path, use_espn: bool, delay: float) -> None:
    path = download(TEAM_WEEK.format(season=season), cache / f"stats_team_week_{season}.csv")
    data = aggregate(path, season, before_week)
    teams = sorted(set(data["offense"]) & set(NICK))
    if len(teams) < 32:
        raise SystemExit(f"only {len(teams)} teams in nflverse team stats before week {before_week}")
    downs = third_downs(delay) if use_espn else {}
    records = []
    for team in teams:
        off, opp = data["offense"][team], data["allowed"][team]
        records.append(row(season, team, "offense", "passing", {
            "Yds/Att": safe_div(off["passing_yards"], off["attempts"]),
            "Rate": passer_rating(off["completions"], off["attempts"], off["passing_yards"], off["passing_tds"], off["passing_interceptions"]),
            "TD": off["passing_tds"], "INT": off["passing_interceptions"], "Sck": off["sacks_suffered"],
        }))
        records.append(row(season, team, "offense", "rushing", {
            "YPC": safe_div(off["rushing_yards"], off["carries"]),
            "Rush 1st%": safe_div(off["rushing_first_downs"] * 100, off["carries"]),
            "Rush FUM": off["rushing_fumbles"],
        }))
        records.append(row(season, team, "offense", "receiving", {
            "Yds/Rec": safe_div(off["receiving_yards"], off["receptions"]),
            "Rec 1st%": safe_div(off["receiving_first_downs"] * 100, off["receptions"]),
            "Rec FUM": off["receiving_fumbles"],
        }))
        records.append(row(season, team, "defense", "passing", {
            "Yds/Att": safe_div(opp["passing_yards"], opp["attempts"]),
            "Rate": passer_rating(opp["completions"], opp["attempts"], opp["passing_yards"], opp["passing_tds"], opp["passing_interceptions"]),
            "TD": opp["passing_tds"],
        }))
        records.append(row(season, team, "defense", "interceptions", {"INT": off["def_int"]}))
        records.append(row(season, team, "defense", "rushing", {
            "YPC": safe_div(opp["rushing_yards"], opp["carries"]), "TD": opp["rushing_tds"],
        }))
        records.append(row(season, team, "defense", "tackles", {"Sck": off["def_sacks"]}))
        records.append(row(season, team, "defense", "fumbles", {"FF": off["def_ff"], "FR": off["def_fr"]}))
        if team in downs:
            made, attempts = downs[team]
            records.append(row(season, team, "offense", "downs", {"3rd Md": made, "3rd Att": attempts}))
    dump_json(dest, records)
    print(f"team stat rows {len(records)} for weeks before {before_week}; third downs {len(downs)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument("--before-week", type=int, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--skip-espn", action="store_true")
    parser.add_argument("--espn-delay", type=float, default=0.4)
    args = parser.parse_args()
    build(args.season, args.before_week, args.cache, args.out, not args.skip_espn, args.espn_delay)


if __name__ == "__main__":
    main()
