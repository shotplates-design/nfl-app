"""Refresh player logs and one or more week matchup files into a temp directory.

Nothing here writes the live data/ tree. validate_refresh.py copies files only
after the checks pass.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from nfl_sources import UA

ROOT = Path(__file__).resolve().parents[1]
SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"


def current_week() -> tuple[int, int]:
    request = urllib.request.Request(SCOREBOARD, headers={"User-Agent": UA})
    payload = json.load(urllib.request.urlopen(request, timeout=25))
    # The scoreboard also carries sportsbook objects. Only the week number is kept.
    return int(payload["season"]["year"]), int(payload["week"]["number"])


def run(cmd: list[str], env: dict | None = None) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True, env=env)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--season", type=int)
    parser.add_argument("--week", type=int, action="append", dest="weeks")
    parser.add_argument("--skip-espn-qbr", action="store_true")
    parser.add_argument("--skip-espn-team", action="store_true")
    args = parser.parse_args()
    if args.season and args.weeks:
        season, weeks = args.season, args.weeks
    else:
        detected_season, detected_week = current_week()
        season = args.season or detected_season
        weeks = args.weeks or [detected_week]
    out = args.out.resolve()
    cache = out / "cache"
    out.mkdir(parents=True, exist_ok=True)
    python = sys.executable
    run([python, "scripts/build_player_logs.py", "--season", str(season), "--cache", str(cache), "--out", str(out)]
        + (["--skip-espn-qbr"] if args.skip_espn_qbr else []))
    env = os.environ.copy()
    env["NFL_DATA_DIR"] = str(out)
    run([python, "scripts/prepare_data.py"], env)
    matchup_dir = out / "matchups"
    matchup_dir.mkdir(parents=True, exist_ok=True)
    for week in weeks:
        stats = out / f"all_team_stats_before_{week}.json"
        run([python, "scripts/build_team_stats.py", "--season", str(season), "--before-week", str(week),
             "--cache", str(cache), "--out", str(stats)] + (["--skip-espn"] if args.skip_espn_team or week != max(weeks) else []))
        work = out / f"matchup-work-{week}"
        run([python, "scripts/nfl_weekly_matchups.py", "--stats", str(stats), "--season", str(season),
             "--week", str(week), "--out", str(work)])
        run([python, "scripts/adapt_matchups.py", "--weekly", str(work / "weekly_matchups.json"),
             "--out", str(matchup_dir / f"week-{week}.json")])
    print(f"refresh wrote {out}")


if __name__ == "__main__":
    main()
