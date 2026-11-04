"""Turn weekly_matchups.json into data/matchups/week-N.json.

The site shape is nicknames, site bye codes, kickoff, network, venue, analysis,
and strength/weakness lists. Categories with no edge are omitted so a missing
stat is not shown as a tie.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from nfl_sources import NICK_CODE, dump_json, now_et


def code_for(value: str) -> str:
    if value in NICK_CODE:
        return NICK_CODE[value]
    lowered = value.lower()
    if lowered in set(NICK_CODE.values()):
        return lowered
    return lowered


def adapt(source: Path, dest: Path) -> None:
    payload = json.loads(source.read_text(encoding="utf-8"))
    games = []
    for game in payload.get("matchups") or []:
        analysis = game.get("analysis")
        if isinstance(analysis, dict):
            categories = {
                key: value for key, value in (analysis.get("categories") or {}).items()
                if isinstance(value, dict) and value.get("edge") is not None
            }
            analysis = {**analysis, "categories": categories} if categories else None
        games.append({
            "away": game["away_team"],
            "home": game["home_team"],
            "kickoff": game.get("kickoff"),
            "network": game.get("network"),
            "venue": game.get("venue"),
            "analysis": analysis,
            "away_strengths": game.get("away_strengths") or [],
            "away_weaknesses": game.get("away_weaknesses") or [],
            "home_strengths": game.get("home_strengths") or [],
            "home_weaknesses": game.get("home_weaknesses") or [],
        })
    games.sort(key=lambda game: game.get("kickoff") or "")
    week = {
        "season": int(payload["season"]),
        "week": int(payload["week"]),
        "schedule_source": payload.get("schedule_source"),
        "schedule_checked": now_et().date().isoformat(),
        "byes": sorted({code_for(bye) for bye in (payload.get("byes") or [])}),
        "notes": "Kickoffs from the ESPN public scoreboard (nflverse schedule if ESPN is unavailable). Team edges from nflverse season stats entering this week. No betting lines.",
        "games": games,
    }
    dump_json(dest, week)
    print(f"wrote {dest} ({len(games)} games, byes {week['byes']})")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weekly", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    adapt(args.weekly, args.out)


if __name__ == "__main__":
    main()
