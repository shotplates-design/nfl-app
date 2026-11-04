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


# Stats that must not all be zero across every game log of a category.
# Counting fields (attempts, punts) are left out on purpose: a zeroed scrape
# often keeps them, so the real yards, catches, and tackles are what we test.
CATEGORY_STATS = {
    "passing": ("cmp", "att", "passYds", "passTd"),
    "rushing": ("car", "primYds"),
    "receiving": ("rec", "primYds", "tgts"),
    "defense": ("tackles", "solo"),
    "kicking": ("fgm", "fga", "pts"),
    "punting": ("punts", "puntYds"),
}


def _nonzero(value) -> bool:
    try:
        return float(value) != 0
    except (TypeError, ValueError):
        return False


def check_category_stats(players: list) -> None:
    """Fail if any stat in a category is zero or missing across all of its rows."""
    rows: dict[str, list] = {cat: [] for cat in CATEGORY_STATS}
    for player in players:
        for game in player.get("games") or []:
            cat = game.get("cat")
            if cat in rows:
                rows[cat].append(game)
    for cat, stats in CATEGORY_STATS.items():
        games = rows[cat]
        if not games:
            raise SystemExit(f"no {cat} game logs in the refresh")
        for stat in stats:
            if not any(_nonzero(game.get(stat)) for game in games):
                raise SystemExit(f"{cat} stat {stat} is zero or missing in all {len(games)} rows")


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
