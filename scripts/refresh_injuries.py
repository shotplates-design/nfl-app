#!/usr/bin/env python3
"""Refresh injuries in data/week-N-conditions.json from ESPN's public site API.

ESPN is the only injury source. Each scheduled run writes the full injury list
for every game so ESPN statuses update existing players too. Required game keys
weather, with_without, and inactives stay present (empty defaults when missing).
Fail closed on fetch/parse failure, a suspiciously empty result, or a relative
drop below ~50% of the previous file's injury row count. No odds or bet fields.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import math
import re
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ET = ZoneInfo("America/New_York")
UA = {"User-Agent": "Mozilla/5.0"}
ESPN_INJURIES = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"
ESPN_SCOREBOARD = (
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    "?week={week}&seasontype=2&dates={year}"
)
ESPN_CURRENT = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
SOURCE_URL = "https://www.espn.com/nfl/injuries"

# ESPN uses WSH; the conditions feed uses WAS (see data/feeds/README.md).
ABBR_NORMALIZE = {"WSH": "WAS", "AZ": "ARI", "ARZ": "ARI", "LA": "LAR", "JAC": "JAX"}
STATUS_NORMALIZE = {
    "Injured Reserve": "IR",
    "Injury Reserve": "IR",
    "Physically Unable to Perform": "PUP",
    "Non Football Injury": "NFI",
}
PRACTICE_PATTERNS = [
    (re.compile(r"did not practice|DNP", re.I), "Did Not Participate In Practice"),
    (re.compile(r"limited (participation|practice)|was limited", re.I), "Limited Participation in Practice"),
    (re.compile(r"full (participation|practice)|practiced fully|was a full participant", re.I), "Full Participation in Practice"),
]
SKIP_ACTIVE_UNLESS_PRACTICE = True
MIN_TEAMS_WITH_INJURIES = 8
MIN_TOTAL_INJURIES = 20
# Fail closed if the new write has fewer than this share of the previous file's rows.
RELATIVE_DROP_FLOOR = 0.5
ESPN_INJURY_KEYS = (
    "team",
    "player",
    "position",
    "status",
    "injury",
    "practice_latest",
    "note",
    "source_url",
)
# Always present on every game (empty OK). Schema keys Best Props / Sleepers read.
REQUIRED_GAME_KEYS = ("weather", "with_without", "inactives")


class FailClosed(RuntimeError):
    """Any failure that must leave the on-disk file untouched."""


def http_json(url: str, timeout: int = 45) -> Any:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise FailClosed(f"GET failed for {url}: {exc}") from exc
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FailClosed(f"Invalid JSON from {url}: {exc}") from exc


def norm_abbr(abbr: str | None) -> str:
    if not abbr:
        return ""
    a = str(abbr).strip().upper()
    return ABBR_NORMALIZE.get(a, a)


def norm_status(status: str | None) -> str | None:
    if status is None or status == "":
        return None
    s = str(status).strip()
    return STATUS_NORMALIZE.get(s, s)


def practice_from_comment(comment: str | None) -> str | None:
    if not comment:
        return None
    for pattern, label in PRACTICE_PATTERNS:
        if pattern.search(comment):
            return label
    return None


def detect_week(payload: dict | None = None) -> tuple[int, int]:
    data = payload or http_json(ESPN_CURRENT)
    try:
        year = int(data["season"]["year"])
        week = int(data["week"]["number"])
    except (KeyError, TypeError, ValueError) as exc:
        raise FailClosed(f"Cannot read season/week from ESPN scoreboard: {exc}") from exc
    if year < 2020 or week < 1 or week > 22:
        raise FailClosed(f"Implausible season/week from ESPN: {year}/{week}")
    return year, week


def fetch_espn_injuries() -> dict[str, list[dict[str, Any]]]:
    """Return {TEAM_ABBR: [injury dicts]} for non-empty, validated ESPN rows."""
    data = http_json(ESPN_INJURIES)
    teams = data.get("injuries")
    if not isinstance(teams, list) or not teams:
        raise FailClosed("ESPN injuries payload missing injuries[]")
    by_team: dict[str, list[dict[str, Any]]] = {}
    for team_block in teams:
        if not isinstance(team_block, dict):
            continue
        rows_in = team_block.get("injuries") or []
        if not isinstance(rows_in, list):
            continue
        for row in rows_in:
            if not isinstance(row, dict):
                continue
            athlete = row.get("athlete") or {}
            if not isinstance(athlete, dict):
                continue
            player = (athlete.get("displayName") or "").strip()
            if not player:
                continue
            team = norm_abbr(
                (athlete.get("team") or {}).get("abbreviation")
                if isinstance(athlete.get("team"), dict)
                else None
            )
            if not team:
                continue
            pos = ""
            position = athlete.get("position")
            if isinstance(position, dict):
                pos = (position.get("abbreviation") or "").strip()
            status_raw = row.get("status")
            status = norm_status(status_raw if isinstance(status_raw, str) else None)
            details = row.get("details") if isinstance(row.get("details"), dict) else {}
            injury = details.get("type") or details.get("detail") or details.get("location") or None
            if isinstance(injury, str):
                injury = injury.strip() or None
            else:
                injury = None
            short = row.get("shortComment") if isinstance(row.get("shortComment"), str) else None
            practice = practice_from_comment(short)
            if status == "Active" and SKIP_ACTIVE_UNLESS_PRACTICE:
                if not practice or practice.startswith("Full"):
                    continue
                status = None
            out = {
                "team": team,
                "player": player,
                "position": pos or None,
                "status": status,
                "injury": injury,
                "source_url": SOURCE_URL,
            }
            if practice:
                out["practice_latest"] = practice
            if short and status in (None, "Questionable", "Doubtful", "Out"):
                note = short.strip()
                if len(note) > 240:
                    note = note[:237] + "..."
                out["note"] = note
            by_team.setdefault(team, []).append(out)
    if len(by_team) < MIN_TEAMS_WITH_INJURIES:
        raise FailClosed(
            f"ESPN injuries too sparse after filter: {len(by_team)} teams "
            f"(need >= {MIN_TEAMS_WITH_INJURIES})"
        )
    total = sum(len(v) for v in by_team.values())
    if total < MIN_TOTAL_INJURIES:
        raise FailClosed(
            f"ESPN injuries too sparse after filter: {total} rows "
            f"(need >= {MIN_TOTAL_INJURIES})"
        )
    return by_team


def scoreboard_games(year: int, week: int) -> list[dict[str, Any]]:
    data = http_json(ESPN_SCOREBOARD.format(week=week, year=year))
    events = data.get("events")
    if not isinstance(events, list) or not events:
        raise FailClosed(f"ESPN scoreboard returned no events for {year} week {week}")
    games: list[dict[str, Any]] = []
    for event in events:
        comps = event.get("competitions") or []
        if not comps:
            continue
        comp = comps[0]
        competitors = comp.get("competitors") or []
        home = away = None
        for c in competitors:
            abbr = norm_abbr((c.get("team") or {}).get("abbreviation"))
            if c.get("homeAway") == "home":
                home = abbr
            elif c.get("homeAway") == "away":
                away = abbr
        if not home or not away:
            continue
        kickoff = event.get("date")
        kickoff_et = None
        if isinstance(kickoff, str) and kickoff:
            try:
                when = dt.datetime.fromisoformat(kickoff.replace("Z", "+00:00")).astimezone(ET)
                kickoff_et = when.replace(microsecond=0).isoformat()
            except ValueError:
                kickoff_et = None
        games.append({"away": away, "home": home, "kickoff_et": kickoff_et})
    if len(games) < 8:
        raise FailClosed(f"Only {len(games)} games on ESPN scoreboard for week {week}")
    return games


def placeholder_weather() -> dict[str, Any]:
    return {
        "indoor": False,
        "temp_f": None,
        "wind_mph": None,
        "precip_pct": None,
        "impact": "none",
        "note": "Weather not set by the injury refresh.",
    }


def empty_inactives() -> dict[str, Any]:
    return {}


def load_or_seed_conditions(path: Path, week: int, year: int) -> dict[str, Any]:
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise FailClosed(f"Cannot read {path}: {exc}") from exc
        if not isinstance(data, dict) or not isinstance(data.get("games"), list):
            raise FailClosed(f"{path} is missing a games array")
        if int(data.get("week") or 0) not in (0, week):
            if int(data.get("week") or 0) != week:
                raise FailClosed(f"{path} is week {data.get('week')}, expected {week}")
        return data
    schedule = scoreboard_games(year, week)
    return {
        "week": week,
        "updated": None,
        "games": [
            {
                "away": g["away"],
                "home": g["home"],
                "kickoff_et": g.get("kickoff_et"),
                "weather": placeholder_weather(),
                "injuries": [],
                "with_without": [],
                "inactives": empty_inactives(),
            }
            for g in schedule
        ],
    }


def count_injuries(data: dict[str, Any] | None) -> int:
    if not data or not isinstance(data.get("games"), list):
        return 0
    total = 0
    for game in data["games"]:
        if isinstance(game, dict) and isinstance(game.get("injuries"), list):
            total += len(game["injuries"])
    return total


def assert_relative_drop_ok(previous: dict[str, Any] | None, updated: dict[str, Any]) -> None:
    """Fail closed when the new file drops below ~50% of the previous injury count."""
    prior = count_injuries(previous)
    if prior <= 0:
        return
    new = count_injuries(updated)
    floor = max(1, math.ceil(prior * RELATIVE_DROP_FLOOR))
    if new < floor:
        raise FailClosed(
            f"Relative drop gate: new injury count {new} is below "
            f"{RELATIVE_DROP_FLOOR:.0%} of previous {prior} (floor {floor})"
        )


def validate_conditions(data: dict[str, Any]) -> None:
    if not isinstance(data.get("week"), int):
        raise FailClosed("conditions.week must be an int")
    if not data.get("updated"):
        raise FailClosed("conditions.updated missing")
    games = data.get("games")
    if not isinstance(games, list) or not games:
        raise FailClosed("conditions.games must be a non-empty list")
    total = 0
    teams_with = 0
    for i, game in enumerate(games):
        if not isinstance(game, dict):
            raise FailClosed(f"games[{i}] is not an object")
        for key in ("away", "home", "weather", "injuries", "with_without", "inactives"):
            if key not in game:
                raise FailClosed(f"games[{i}] missing {key}")
        injuries = game["injuries"]
        if not isinstance(injuries, list):
            raise FailClosed(f"games[{i}].injuries must be a list")
        if injuries:
            teams_with += 1
        for j, row in enumerate(injuries):
            if not isinstance(row, dict):
                raise FailClosed(f"games[{i}].injuries[{j}] is not an object")
            for key in ("team", "player"):
                if not row.get(key):
                    raise FailClosed(f"games[{i}].injuries[{j}] missing {key}")
            for bad in ("odds", "spread", "moneyline", "sportsbook", "parlay"):
                if bad in row:
                    raise FailClosed(f"games[{i}].injuries[{j}] has forbidden key {bad}")
            total += 1
    if total < MIN_TOTAL_INJURIES:
        raise FailClosed(f"Refusing to write sparse injuries: {total} rows")
    if teams_with < max(4, len(games) // 3):
        raise FailClosed(f"Refusing to write: only {teams_with} games have injuries")


def injury_key(row: dict[str, Any]) -> tuple[str, str]:
    return (
        norm_abbr(str(row.get("team") or "")),
        str(row.get("player") or "").strip().lower(),
    )


def espn_injury_row(row: dict[str, Any]) -> dict[str, Any]:
    """Baseline injury shape only — never invent keys outside ESPN_INJURY_KEYS."""
    out: dict[str, Any] = {}
    for key in ESPN_INJURY_KEYS:
        if key in row:
            out[key] = copy.deepcopy(row[key])
    out["team"] = norm_abbr(out.get("team"))
    out["player"] = str(out.get("player") or "").strip()
    if not out["team"] or not out["player"]:
        raise FailClosed("ESPN injury row missing team/player after normalize")
    if "source_url" not in out:
        out["source_url"] = SOURCE_URL
    return out


def full_game_injuries(espn_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Write the full ESPN list for the game (statuses update existing players)."""
    rank = {"Out": 0, "IR": 1, "Doubtful": 2, "Questionable": 3, "PUP": 4, "NFI": 5}
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []
    for row in espn_rows:
        key = injury_key(row)
        if not key[0] or not key[1] or key in seen:
            continue
        out.append(espn_injury_row(row))
        seen.add(key)
    out.sort(key=lambda r: (rank.get(str(r.get("status") or ""), 9), str(r.get("player") or "")))
    return out


def ensure_required_game_keys(game: dict[str, Any]) -> None:
    """Keep weather, with_without, and inactives on every game (empty OK)."""
    if "weather" not in game or game["weather"] is None:
        game["weather"] = placeholder_weather()
    if "with_without" not in game:
        game["with_without"] = []
    if "inactives" not in game or game["inactives"] is None:
        game["inactives"] = empty_inactives()


def apply_injuries(data: dict[str, Any], by_team: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Replace each game's injuries with the full ESPN list; keep required keys."""
    out = copy.deepcopy(data)
    prior_top_keys = set(out.keys())
    for game in out["games"]:
        prior_game_keys = set(game.keys())
        away = norm_abbr(game.get("away"))
        home = norm_abbr(game.get("home"))
        game["away"] = away
        game["home"] = home
        espn_rows = list(by_team.get(away, [])) + list(by_team.get(home, []))
        game["injuries"] = full_game_injuries(espn_rows)
        ensure_required_game_keys(game)
        # Do not invent unrelated game-level keys.
        allowed_new = {"weather", "with_without", "inactives", "away", "home", "injuries"}
        invented = set(game.keys()) - prior_game_keys - allowed_new
        if invented:
            raise FailClosed(f"ESPN apply would invent game keys: {sorted(invented)}")
    out["updated"] = dt.datetime.now(ET).replace(microsecond=0).isoformat()
    invented_top = set(out.keys()) - prior_top_keys - {"updated"}
    if invented_top:
        raise FailClosed(f"ESPN apply would invent top-level keys: {sorted(invented_top)}")
    return out


def atomic_write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=str(path.parent), delete=False) as tmp:
        tmp.write(text)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--week", type=int, help="NFL week (default: ESPN current)")
    parser.add_argument("--season", type=int, help="Season year (default: ESPN current)")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print counts; do not write")
    args = parser.parse_args(argv)

    try:
        year, week = detect_week()
        if args.season:
            year = args.season
        if args.week:
            week = args.week
        by_team = fetch_espn_injuries()
        path = args.data_dir / f"week-{week}-conditions.json"
        current = load_or_seed_conditions(path, week, year)
        previous = copy.deepcopy(current) if path.exists() else None
        current["week"] = week
        updated = apply_injuries(current, by_team)
        validate_conditions(updated)
        assert_relative_drop_ok(previous, updated)
    except FailClosed as exc:
        print(f"FAIL CLOSED: {exc}", file=sys.stderr)
        return 1

    total = sum(len(g.get("injuries") or []) for g in updated["games"])
    print(
        f"week {week}: {len(updated['games'])} games, {total} injuries "
        f"across {sum(1 for g in updated['games'] if g.get('injuries'))} games "
        f"(source ESPN {SOURCE_URL})"
    )
    if args.dry_run:
        print("dry-run: no write")
        return 0
    atomic_write(path, updated)
    print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
