"""Unit tests for the walk-forward Best Props get-better gate."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from improve_hit_params import (  # noqa: E402
    HIT_FLOOR,
    BEST_PROPS,
    FORBIDDEN_PROPS,
    clamp_params,
    diversify,
    grade_props,
    parse_log_date,
    pick_line,
    walk_forward,
    week_payload,
)


def player(name, team, cat, games, season=2026, slug=None):
    return {
        "name": name,
        "team": team,
        "cat": cat,
        "season": season,
        "slug": slug or name.lower().replace(" ", "-"),
        "games": games,
    }


class ImproveHitParamsTest(unittest.TestCase):
    def test_forbidden_props_never_in_best_props(self):
        for keys in BEST_PROPS.values():
            for key in keys:
                self.assertNotIn(key, FORBIDDEN_PROPS)

    def test_clamp_rejects_sub_60(self):
        with self.assertRaises(SystemExit):
            clamp_params({"best_props_min_rate": 0.5, "best_props_alt_rate": 0.5, "sleeper_rate": 0.75})

    def test_clamp_keeps_hit_floor(self):
        out = clamp_params(
            {
                "hit_rate_floor": 0.9,
                "best_props_min_rate": 0.8,
                "best_props_alt_rate": 0.7,
                "sleeper_rate": 0.75,
            }
        )
        self.assertEqual(out["hit_rate_floor"], HIT_FLOOR)

    def test_parse_log_date_crosses_year(self):
        self.assertEqual(parse_log_date("Sun 9/13", 2026), date(2026, 9, 13))
        self.assertEqual(parse_log_date("Sun 1/3", 2026), date(2027, 1, 3))

    def test_pick_line_steps_yards(self):
        vals = [48, 52, 55, 60, 61, 70, 80, 90, 100, 110]
        line = pick_line(vals, "recYds", 0.8, 0.7)
        self.assertEqual(line % 5, 0)
        self.assertGreaterEqual(line, 10)

    def test_walk_forward_grades_completed_week(self):
        # One WR who always clears 50 before week 6, then clears 55 in week 6.
        prior = [
            {"date": "Sun 9/13", "opp": "vsDEN", "cat": "receiving", "primYds": 60, "rec": 5},
            {"date": "Sun 9/20", "opp": "@LAR", "cat": "receiving", "primYds": 55, "rec": 5},
            {"date": "Sun 9/27", "opp": "vsSF", "cat": "receiving", "primYds": 58, "rec": 6},
            {"date": "Sun 10/4", "opp": "@ARI", "cat": "receiving", "primYds": 62, "rec": 5},
            {"date": "Sun 10/11", "opp": "vsSEA", "cat": "receiving", "primYds": 57, "rec": 5},
        ]
        week6_game = {
            "date": "Sun 10/18",
            "opp": "@GB",
            "cat": "receiving",
            "primYds": 70,
            "rec": 6,
        }
        wr = player("Test Wr", "car", "receiving", prior + [week6_game])
        # Enough other players so diversify can fill a list of 1.
        extras = []
        for i, team in enumerate(["gb", "atl", "buf"]):
            games = [
                {
                    "date": d,
                    "opp": "vsARI",
                    "cat": "passing",
                    "passYds": 260 + i,
                    "passTd": 2,
                    "primYds": 10,
                }
                for d in ("Sun 9/13", "Sun 9/20", "Sun 9/27", "Sun 10/4", "Sun 10/11")
            ]
            games.append(
                {
                    "date": "Sun 10/18",
                    "opp": "vsCAR" if team == "gb" else "@NE",
                    "cat": "passing",
                    "passYds": 250,
                    "passTd": 2,
                    "primYds": 5,
                }
            )
            extras.append(player(f"Qb {team}", team, "passing", games, slug=f"qb-{team}"))

        week = {
            "season": 2026,
            "week": 6,
            "byes": [],
            "games": [
                {
                    "away": "Panthers",
                    "home": "Packers",
                    "awayCode": "car",
                    "homeCode": "gb",
                    "kickoff": datetime(2026, 10, 18, 13, 0, tzinfo=timezone.utc),
                    "slug": "panthers-at-packers-2026-week-6",
                },
                {
                    "away": "Falcons",
                    "home": "Bills",
                    "awayCode": "atl",
                    "homeCode": "buf",
                    "kickoff": datetime(2026, 10, 18, 17, 0, tzinfo=timezone.utc),
                    "slug": "falcons-at-bills-2026-week-6",
                },
            ],
        }
        now = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)
        wf = walk_forward([wr, *extras], [week], 0.8, 0.7, now)
        self.assertGreaterEqual(wf["n"], 1)
        self.assertIsNotNone(wf["hit_rate"])
        self.assertGreaterEqual(wf["hit_rate"], 0.0)

    def test_diversify_caps_team(self):
        rows = [
            {"team": "sea", "role": "WR/TE", "score": 100 - i, "stat": "recYds", "slug": f"p{i}"}
            for i in range(5)
        ]
        team_game = {r["team"]: "g1" for r in rows}
        pick = diversify(rows, team_game, limit=5)
        self.assertLessEqual(sum(1 for r in pick if r["team"] == "sea"), 2)


if __name__ == "__main__":
    unittest.main()
