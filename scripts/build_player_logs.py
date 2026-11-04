"""Build data/raw.csv and the QB rushing supplement from nflverse weekly stats.

ESPN public gamelog JSON (site.web.api) fills QB adjQBR and longest pass only,
throttled, after the nflverse rows exist. NFL.com and ESPN HTML are not fetched.
"""
from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

from nfl_sources import (
    CSV_COLUMNS, DIV_LABEL, DIVISIONS, GAMES, OPP, PLAYERS, PLAYER_WEEK, ROSTER, SITE,
    UA, date_label, download, dump_json, now_et, num, passer_rating, read_csv, result_text,
)

GAMELOG = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{}/gamelog?season={}"


def blank():
    return {column: "" for column in CSV_COLUMNS}


def load_games(path: Path) -> dict:
    games = {}
    for row in read_csv(path):
        if row.get("game_type") not in (None, "", "REG") and row.get("game_type") != "REG":
            continue
        games[row["game_id"]] = row
    return games


def load_roster(roster_path: Path) -> dict:
    roster = {}
    for row in read_csv(roster_path):
        gsis = row.get("gsis_id") or ""
        if not gsis:
            continue
        week = int(float(row["week"])) if row.get("week") else 0
        prev = roster.get(gsis)
        if prev and prev["week"] > week:
            continue
        roster[gsis] = {
            "espn": (row.get("espn_id") or "").strip(),
            "name": row.get("full_name") or "",
            "team": row.get("team") or "",
            "week": week,
        }
    return roster


def load_crosswalk(players_path: Path) -> dict:
    """gsis -> espn id and display name. Not a roster."""
    found = {}
    for row in read_csv(players_path):
        gsis = row.get("gsis_id") or ""
        if gsis:
            found[gsis] = {"espn": (row.get("espn_id") or "").strip(), "name": row.get("display_name") or ""}
    return found


def category(row: dict) -> str | None:
    attempts, carries, receptions, targets = num(row, "attempts"), num(row, "carries"), num(row, "receptions"), num(row, "targets")
    defense = (
        num(row, "def_tackles_solo") + num(row, "def_tackle_assists") + num(row, "def_sacks")
        + num(row, "def_interceptions") + num(row, "def_pass_defended") + num(row, "def_tackles_for_loss")
        + num(row, "def_fumbles_forced") + num(row, "fumble_recovery_opp")
    )
    kicking = num(row, "fg_att") + num(row, "pat_att")
    punting = num(row, "pt_att")
    if attempts > 0:
        return "passing"
    if carries > 0 and (receptions == 0 or carries >= receptions):
        return "rushing"
    if receptions > 0 or targets > 0 or carries > 0:
        return "receiving"
    if defense > 0:
        return "defense"
    if kicking > 0:
        return "kicking"
    if punting > 0:
        return "punting"
    return None


def fill_category(out: dict, row: dict, kind: str) -> None:
    if kind == "passing":
        attempts = num(row, "attempts")
        out.update({
            "cmp": num(row, "completions"), "att": attempts, "yds": num(row, "passing_yards"),
            "td": num(row, "passing_tds"), "int": num(row, "passing_interceptions"),
            "sack": num(row, "sacks_suffered"), "car": num(row, "carries"),
        })
        out["rtg"] = passer_rating(out["cmp"], attempts, out["yds"], out["td"], out["int"])
    elif kind == "rushing":
        carries, yards = num(row, "carries"), num(row, "rushing_yards")
        out.update({
            "car": carries, "yds": yards, "td": num(row, "rushing_tds"),
            "avg": round(yards / carries, 4) if carries else "",
            "rec": num(row, "receptions"), "tgts": num(row, "targets"),
            "fum": num(row, "rushing_fumbles") + num(row, "receiving_fumbles"),
        })
    elif kind == "receiving":
        receptions, yards = num(row, "receptions"), num(row, "receiving_yards")
        out.update({
            "rec": receptions, "yds": yards, "td": num(row, "receiving_tds"),
            "avg": round(yards / receptions, 4) if receptions else "",
            "car": num(row, "carries"), "tgts": num(row, "targets"),
            "fum": num(row, "receiving_fumbles") + num(row, "rushing_fumbles"),
        })
    elif kind == "defense":
        out.update({
            "tot": num(row, "def_tackles_solo") + num(row, "def_tackle_assists"),
            "solo": num(row, "def_tackles_solo"), "sack": num(row, "def_sacks"),
            "int": num(row, "def_interceptions"), "pd": num(row, "def_pass_defended"),
            "stf": num(row, "def_tackles_for_loss"), "ff": num(row, "def_fumbles_forced"),
            "fr": num(row, "fumble_recovery_opp"),
        })
    elif kind == "kicking":
        made, att, pats_made, pats_att = num(row, "fg_made"), num(row, "fg_att"), num(row, "pat_made"), num(row, "pat_att")
        out.update({
            "fg": f"{int(made)}-{int(att)}", "pts": made * 3 + pats_made,
            "lng": num(row, "fg_long"), "xp": f"{int(pats_made)}-{int(pats_att)}",
        })
    elif kind == "punting":
        punts, yards = num(row, "pt_att"), num(row, "pt_yards")
        net = num(row, "pt_net_yards")
        out.update({
            "punts": punts, "yds": yards, "avg": round(yards / punts, 1) if punts else "",
            "in20": num(row, "pt_inside_20"), "net": round(net / punts, 1) if punts else "",
        })


def cell(value):
    if value == "" or value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def standings(games: dict, season: int) -> dict:
    record = {abbr: {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0} for teams in DIVISIONS.values() for abbr in teams}
    for game in games.values():
        if str(game.get("season")) != str(season) or game.get("game_type") != "REG":
            continue
        if game.get("home_score") in (None, ""):
            continue
        away, home = game["away_team"], game["home_team"]
        away_score, home_score = int(float(game["away_score"])), int(float(game["home_score"]))
        for abbr, pf, pa in ((away, away_score, home_score), (home, home_score, away_score)):
            if abbr not in record:
                continue
            record[abbr]["pf"] += pf
            record[abbr]["pa"] += pa
            if pf > pa:
                record[abbr]["w"] += 1
            elif pf < pa:
                record[abbr]["l"] += 1
            else:
                record[abbr]["t"] += 1
    by_team = {}
    for teams in DIVISIONS.values():
        ordered = sorted(teams, key=lambda abbr: (record[abbr]["w"], record[abbr]["pf"] - record[abbr]["pa"]), reverse=True)
        rows = [{"team": DIV_LABEL[abbr], **record[abbr]} for abbr in ordered]
        for abbr in teams:
            by_team[abbr] = rows
    return by_team


def enrich_qbr(rows: list[dict], season: int, delay: float) -> None:
    by_player = defaultdict(list)
    for row in rows:
        if row.get("cmp") not in ("", None) and str(row["player_id"]).isdigit():
            by_player[row["player_id"]].append(row)
    print(f"ESPN gamelog JSON for {len(by_player)} passers, {delay}s apart")
    for index, (player_id, player_rows) in enumerate(by_player.items(), 1):
        url = GAMELOG.format(player_id, season)
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            payload = json.load(urllib.request.urlopen(request, timeout=20))
        except Exception as exc:
            print(f"  qbr skip {player_id}: {exc}")
            time.sleep(delay)
            continue
        names = payload.get("names") or []
        index_of = {name: pos for pos, name in enumerate(names)}
        events = payload.get("events") or {}
        stats = {}
        for season_type in payload.get("seasonTypes") or []:
            label = season_type.get("displayName") or ""
            if "Regular" not in label and "Post" not in label:
                continue
            for category in season_type.get("categories") or []:
                for event in category.get("events") or []:
                    stats[event["eventId"]] = event.get("stats") or []
        by_key = {}
        if "adjQBR" in index_of and "longPassing" in index_of:
            for event_id, values in stats.items():
                event = events.get(event_id) or {}
                game_date = event.get("gameDate")
                opponent = ((event.get("opponent") or {}).get("abbreviation") or "").upper()
                if not game_date or not opponent:
                    continue
                when = date_label(game_date[:10], "")
                # date_label needs a real YYYY-MM-DD; gameDate is ISO.
                try:
                    from datetime import datetime
                    from zoneinfo import ZoneInfo
                    parsed = datetime.fromisoformat(game_date.replace("Z", "+00:00")).astimezone(ZoneInfo("America/New_York"))
                    when = f"{parsed.strftime('%a')} {parsed.month}/{parsed.day}"
                except Exception:
                    continue
                opponent = {"LA": "LAR", "WAS": "WSH", "WSH": "WSH", "JAC": "JAX"}.get(opponent, opponent)

                def read(name):
                    raw = values[index_of[name]] if name in index_of else ""
                    if raw in ("", "-", "--", None):
                        return None
                    try:
                        return float(str(raw).replace(",", ""))
                    except ValueError:
                        return None

                by_key[(when.split()[-1], opponent)] = {"qbr": read("adjQBR"), "lng": read("longPassing"), "cmp": read("completions")}
        for row in player_rows:
            key = (row["date"].split()[-1], row["opp"].replace("@", "").replace("vs", ""))
            match = by_key.get(key)
            if not match:
                continue
            try:
                csv_cmp = float(row["cmp"])
            except (TypeError, ValueError):
                csv_cmp = None
            if match["cmp"] is not None and csv_cmp is not None and match["cmp"] != csv_cmp:
                continue
            if match["qbr"] is not None:
                row["qbr"] = match["qbr"]
            if match["lng"] is not None:
                row["lng"] = match["lng"]
        if index % 15 == 0:
            print(f"  {index}/{len(by_player)}")
        time.sleep(delay)


def build(season: int, cache: Path, out: Path, skip_qbr: bool, delay: float) -> None:
    week_path = download(PLAYER_WEEK.format(season=season), cache / f"stats_player_week_{season}.csv")
    roster_path = download(ROSTER.format(season=season), cache / f"roster_{season}.csv")
    players_path = download(PLAYERS, cache / "players.csv")
    games_path = download(GAMES, cache / "games.csv")
    roster = load_roster(roster_path)
    crosswalk = load_crosswalk(players_path)
    games = load_games(games_path)
    used_ids = {}
    latest = {}
    rows = []
    qb = {"source": "nflverse stats_player week (QB rushing on the passing row)", "fetched": now_et().isoformat(timespec="seconds"), "players": {}, "mismatches": [], "unmatched": []}

    for raw in read_csv(week_path):
        if raw.get("season_type") != "REG" or str(raw.get("season")) != str(season):
            continue
        gsis = raw.get("player_id") or ""
        if not gsis:
            continue
        game = games.get(raw.get("game_id") or "")
        if not game or game.get("home_score") in (None, ""):
            continue
        kind = category(raw)
        if not kind:
            continue
        team = raw.get("team") or ""
        home, away = game.get("home_team"), game.get("away_team")
        if team == home:
            opp = "vs" + OPP.get(away, away)
            mine, theirs = int(float(game["home_score"])), int(float(game["away_score"]))
        else:
            opp = "@" + OPP.get(home, home)
            mine, theirs = int(float(game["away_score"])), int(float(game["home_score"]))
        identity = roster.get(gsis) or {}
        extra = crosswalk.get(gsis) or {}
        player_id = identity.get("espn") or extra.get("espn") or gsis
        owner = used_ids.setdefault(player_id, gsis)
        if owner != gsis:
            player_id = gsis
        name = raw.get("player_display_name") or identity.get("name") or extra.get("name") or gsis
        week = int(float(raw["week"]))
        prev = latest.get(gsis)
        if not prev or week >= prev[0]:
            latest[gsis] = (week, name, SITE.get(team, team.lower()), player_id)
        record = blank()
        record.update({
            "player_id": player_id,
            "player_name": name,
            "current_team": SITE.get(team, team.lower()),
            "season": season,
            "date": date_label(game["gameday"], game.get("weekday") or ""),
            "opp": opp,
            "result": result_text(mine, theirs, game.get("overtime") or ""),
        })
        fill_category(record, raw, kind)
        rows.append(record)
        if kind == "passing":
            qb["players"].setdefault(player_id, {"name": name, "games": []})
            qb["players"][player_id]["games"].append({
                "date": record["date"], "opp": opp, "car": num(raw, "carries"),
                "rushYds": num(raw, "rushing_yards"), "rushTd": num(raw, "rushing_tds"),
                "eventId": raw.get("game_id"),
            })

    if not skip_qbr:
        enrich_qbr(rows, season, delay)

    board = standings(games, season)
    seen_players = {row["player_id"] for row in rows}
    for gsis, identity in roster.items():
        player_id = identity["espn"] or crosswalk.get(gsis, {}).get("espn") or gsis
        if player_id in seen_players or gsis in seen_players:
            continue
        team = identity["team"]
        if team not in board or team not in SITE:
            continue
        name = identity["name"] or gsis
        for standing in board[team]:
            record = blank()
            record.update({
                "player_id": player_id, "player_name": name, "current_team": SITE[team],
                "season": season, "team": standing["team"], "w": standing["w"], "l": standing["l"],
                "t": standing["t"], "pf": standing["pf"], "pa": standing["pa"],
            })
            rows.append(record)
        seen_players.add(player_id)

    # current_team follows the latest game, not the first row written.
    current = {item[3]: item[2] for item in latest.values()}
    names = {item[3]: item[1] for item in latest.values()}
    for row in rows:
        if row["player_id"] in current and row["date"]:
            row["current_team"] = current[row["player_id"]]
            row["player_name"] = names.get(row["player_id"], row["player_name"])

    out.mkdir(parents=True, exist_ok=True)
    with (out / "raw.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: cell(row.get(key, "")) for key in CSV_COLUMNS})
    dump_json(out / "supplemental" / "qb-rushing.json", qb)
    print(f"raw rows {len(rows)}; QBs {len(qb['players'])}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--skip-espn-qbr", action="store_true")
    parser.add_argument("--espn-delay", type=float, default=1.2)
    args = parser.parse_args()
    build(args.season, args.cache, args.out, args.skip_espn_qbr, args.espn_delay)


if __name__ == "__main__":
    main()
