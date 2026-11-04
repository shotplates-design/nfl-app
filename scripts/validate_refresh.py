"""Check a temp refresh before it replaces the live data files.

A failure exits before anything is copied. Targets and tackles may exist as
game-log stats. They must not be props, and the 60% hit floor must stay.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from nfl_sources import BETTING_KEYS, reject_betting

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path} is not valid JSON: {exc}") from exc


def count_games(players) -> int:
    return sum(len(player.get("games") or []) for player in players)


def check_counts(candidate: list, baseline: list, label: str) -> None:
    if not baseline:
        raise SystemExit(f"baseline {label} is empty")
    floor = 0.9 * len(baseline)
    if len(candidate) < floor:
        raise SystemExit(f"{label} count {len(candidate)} is under 90% of {len(baseline)}")


# Key stats per game-log category, with the share of rows that must be non-zero.
# Floors sit well under live rates (2026 wk1-8): passing int is ~49%, so it gets 25%.
# Rushing/receiving lng is not listed: nflverse has no per-game long, so it is always 0.
# passing car/primYds are QB rushing (primYds comes from the ESPN supplement).
DEFAULT_FLOOR = 0.5
CATEGORY_STATS = {
    "passing": {"cmp": 0.5, "att": 0.5, "passYds": 0.5, "passTd": 0.5, "int": 0.25,
                "rtg": 0.5, "qbr": 0.5, "lng": 0.5, "car": 0.5, "primYds": 0.5},
    "rushing": {"car": 0.5, "primYds": 0.5},
    "receiving": {"rec": 0.5, "primYds": 0.5, "tgts": 0.5},
    "defense": {"tackles": 0.5, "solo": 0.5},
    "kicking": {"fgm": 0.5, "fga": 0.5, "pts": 0.5},
    "punting": {"punts": 0.5, "puntYds": 0.5, "net": 0.5},
}
QB_RUSHING_STATS = {"car": 0.5, "rushYds": 0.5}
# Groups smaller than this are skipped: week 1 and odd buckets (a punter's
# trick-play pass) are too noisy to judge. A whole category with no rows still fails.
MIN_ROWS = 30


def _nonzero(value) -> bool:
    try:
        return float(value) != 0
    except (TypeError, ValueError):
        return False


def _check_group(label: str, games: list, stats: dict, min_rows: int) -> None:
    if len(games) < min_rows:
        return
    for stat, floor in stats.items():
        hits = sum(_nonzero(game.get(stat)) for game in games)
        if hits < floor * len(games):
            raise SystemExit(
                f"{label} stat {stat}: {hits}/{len(games)} rows non-zero, under the {floor:.0%} floor"
            )


def check_category_stats(players: list, min_rows: int = MIN_ROWS) -> None:
    """Check each category overall and per position group.

    players.json has no position field, so a player's primary category
    (player["cat"]) stands in for position: receiving games from receiving-
    primary players are WR/TE, from rushing-primary players RB, and so on.
    A zeroed position cannot hide behind good rows from another position.
    """
    groups: dict[tuple, list] = {}
    for player in players:
        position = player.get("cat") or "unknown"
        for game in player.get("games") or []:
            cat = game.get("cat")
            if cat in CATEGORY_STATS:
                groups.setdefault((cat, "all"), []).append(game)
                groups.setdefault((cat, position), []).append(game)
    for cat, stats in CATEGORY_STATS.items():
        if not groups.get((cat, "all")):
            raise SystemExit(f"no {cat} game logs in the refresh")
    for (cat, position), games in sorted(groups.items()):
        label = f"{cat} (all players)" if position == "all" else f"{cat} by {position}-primary players"
        _check_group(label, games, CATEGORY_STATS[cat], min_rows)


def check_qb_rushing(qb: dict, min_rows: int = MIN_ROWS) -> None:
    games = [game for entry in (qb.get("players") or {}).values() for game in entry.get("games") or []]
    if not games:
        raise SystemExit("QB rushing supplement has no games")
    _check_group("QB rushing supplement", games, QB_RUSHING_STATS, min_rows)


def check_week(path: Path) -> None:
    week = load(path)
    reject_betting(week)
    games = week.get("games") or []
    if not 13 <= len(games) <= 16:
        raise SystemExit(f"{path.name} has {len(games)} games; expected 13-16")
    expected_byes = 32 - 2 * len(games)
    if len(week.get("byes") or []) != expected_byes:
        raise SystemExit(f"{path.name} byes {week.get('byes')} do not match {len(games)} games")
    for game in games:
        for key in ("away", "home", "kickoff"):
            if not game.get(key):
                raise SystemExit(f"{path.name} game missing {key}")
        blob = json.dumps(game).lower()
        if any(name in blob for name in ("draftkings", "fanduel", "betmgm", "sportsbook", "moneyline")):
            raise SystemExit(f"{path.name} contains a betting value")


def check_rules() -> None:
    streaks = (ROOT / "lib" / "streaks.mjs").read_text(encoding="utf-8")
    best = (ROOT / "lib" / "bestprops.ts").read_text(encoding="utf-8")
    if "export const HIT_RATE = 0.6" not in streaks:
        raise SystemExit("the 60% hit threshold is missing from lib/streaks.mjs")
    if "key==='tgts'||key==='tackles'" not in streaks:
        raise SystemExit("bestHitProp must skip targets and tackles")
    match = re.search(r"const BEST_PROPS:Record<string,string\[\]>=\{([^}]+)\}", best)
    if not match:
        raise SystemExit("BEST_PROPS was not found")
    body = match.group(1)
    if "tackles" in body or "tgts" in body:
        raise SystemExit("BEST_PROPS includes a target or tackle prop")
    for word in BETTING_KEYS:
        if re.search(rf"\b{word}\b", body):
            raise SystemExit(f"BEST_PROPS mentions {word}")


def stage(candidate: Path, dest: Path) -> None:
    players = candidate / "players.json"
    qb = candidate / "supplemental" / "qb-rushing.json"
    weeks = sorted((candidate / "matchups").glob("week-*.json"))
    if not players.exists() or not qb.exists() or not weeks:
        raise SystemExit(f"{candidate} is missing players, qb rushing, or week files")
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(players, dest / "players.json")
    supplemental = dest / "supplemental"
    supplemental.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(qb, supplemental / "qb-rushing.json")
    matchups = dest / "matchups"
    matchups.mkdir(parents=True, exist_ok=True)
    for week in weeks:
        shutil.copyfile(week, matchups / week.name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, default=ROOT / "data")
    parser.add_argument("--stage", type=Path, help="Copy validated files here. Omit to check only.")
    args = parser.parse_args()
    candidate_players = load(args.candidate / "players.json")
    baseline_players = load(args.baseline / "players.json")
    if not isinstance(candidate_players, list) or not isinstance(baseline_players, list):
        raise SystemExit("players.json must be a list")
    reject_betting(candidate_players)
    check_counts(candidate_players, baseline_players, "players")
    check_category_stats(candidate_players)
    candidate_games = count_games(candidate_players)
    baseline_games = count_games(baseline_players)
    if candidate_games < 0.9 * baseline_games:
        raise SystemExit(f"game logs {candidate_games} are under 90% of {baseline_games}")
    qb = load(args.candidate / "supplemental" / "qb-rushing.json")
    reject_betting(qb)
    check_qb_rushing(qb)
    baseline_qb = load(args.baseline / "supplemental" / "qb-rushing.json")
    if len(qb.get("players") or {}) < 0.9 * len(baseline_qb.get("players") or {}):
        raise SystemExit("QB rushing supplement shrank by more than 10%")
    weeks = sorted((args.candidate / "matchups").glob("week-*.json"))
    if not weeks:
        raise SystemExit("no week matchup file was produced")
    for week in weeks:
        check_week(week)
    check_rules()
    print(f"valid: {len(candidate_players)} players, {candidate_games} game logs, {len(weeks)} week file(s)")
    if args.stage:
        stage(args.candidate, args.stage)
        print(f"staged into {args.stage}")


if __name__ == "__main__":
    main()
