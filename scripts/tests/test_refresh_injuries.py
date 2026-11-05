"""Unit tests for ESPN-only injury refresh. No network."""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import refresh_injuries as ri  # noqa: E402


def espn_payload():
    """Minimal ESPN injuries shape with enough teams/rows to pass gates."""
    teams = []
    names = [
        ("ARI", "Arizona Cardinals"), ("ATL", "Atlanta Falcons"), ("BAL", "Baltimore Ravens"),
        ("BUF", "Buffalo Bills"), ("CAR", "Carolina Panthers"), ("CHI", "Chicago Bears"),
        ("CIN", "Cincinnati Bengals"), ("CLE", "Cleveland Browns"), ("DAL", "Dallas Cowboys"),
        ("DEN", "Denver Broncos"),
    ]
    for abbr, display in names:
        teams.append({
            "id": abbr,
            "displayName": display,
            "injuries": [
                {
                    "status": "Out",
                    "shortComment": f"Star ({abbr}) did not practice Wednesday.",
                    "athlete": {
                        "displayName": f"Player {abbr} Out",
                        "position": {"abbreviation": "WR"},
                        "team": {"abbreviation": abbr},
                    },
                    "details": {"type": "Ankle"},
                },
                {
                    "status": "Questionable",
                    "shortComment": f"Backup ({abbr}) was limited Wednesday.",
                    "athlete": {
                        "displayName": f"Player {abbr} Q",
                        "position": {"abbreviation": "RB"},
                        "team": {"abbreviation": abbr},
                    },
                    "details": {"type": "Hamstring"},
                },
                {
                    "status": "Active",
                    "shortComment": f"Healthy ({abbr}) was a full participant.",
                    "athlete": {
                        "displayName": f"Player {abbr} Active",
                        "position": {"abbreviation": "QB"},
                        "team": {"abbreviation": abbr},
                    },
                    "details": {"type": "None"},
                },
            ],
        })
    return {"injuries": teams}


class RefreshInjuries(unittest.TestCase):
    def test_fetch_filters_active_full_and_normalizes_wsh(self):
        payload = espn_payload()
        payload["injuries"].append({
            "id": "wsh",
            "displayName": "Washington Commanders",
            "injuries": [{
                "status": "Doubtful",
                "shortComment": "Starter did not practice.",
                "athlete": {
                    "displayName": "Commanders Star",
                    "position": {"abbreviation": "TE"},
                    "team": {"abbreviation": "WSH"},
                },
                "details": {"type": "Knee"},
            }],
        })
        with mock.patch.object(ri, "http_json", return_value=payload):
            by_team = ri.fetch_espn_injuries()
        self.assertIn("WAS", by_team)
        self.assertNotIn("WSH", by_team)
        self.assertEqual(sum(len(v) for v in by_team.values()), 21)
        self.assertTrue(all(r["status"] != "Active" for rows in by_team.values() for r in rows))
        was = by_team["WAS"][0]
        self.assertEqual(was["practice_latest"], "Did Not Participate In Practice")
        self.assertEqual(was["injury"], "Knee")

    def test_fail_closed_on_empty_espn(self):
        with mock.patch.object(ri, "http_json", return_value={"injuries": []}):
            with self.assertRaises(ri.FailClosed):
                ri.fetch_espn_injuries()

    def test_apply_replaces_injuries_and_keeps_required_keys(self):
        current = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "kickoff_et": "2026-11-05T20:15:00-05:00",
                "weather": {"indoor": False, "temp_f": 68, "impact": "none"},
                "injuries": [{
                    "team": "JAX",
                    "player": "Old Player",
                    "status": "Out",
                    "note": "stale status that ESPN must overwrite or drop",
                }],
                "with_without": [{"player": "Keeper", "note": "keep me"}],
            }],
        }
        by_team = {
            "JAX": [{"team": "JAX", "player": "Old Player", "position": "G", "status": "Questionable",
                     "injury": "Ankle", "note": "ESPN update", "source_url": ri.SOURCE_URL},
                    {"team": "JAX", "player": "New", "position": "G", "status": "Questionable",
                     "injury": "Ankle", "source_url": ri.SOURCE_URL}],
            "BAL": [{"team": "BAL", "player": "Raven", "position": "CB", "status": "Out",
                     "injury": "Foot", "source_url": ri.SOURCE_URL}],
        }
        updated = ri.apply_injuries(current, by_team)
        game = updated["games"][0]
        self.assertEqual(game["weather"]["temp_f"], 68)
        self.assertEqual(game["with_without"][0]["player"], "Keeper")
        self.assertEqual(game["kickoff_et"], "2026-11-05T20:15:00-05:00")
        self.assertIn("inactives", game)
        self.assertEqual(game["inactives"], {})
        by_name = {r["player"]: r for r in game["injuries"]}
        self.assertEqual(set(by_name), {"Old Player", "New", "Raven"})
        self.assertEqual(by_name["Old Player"]["status"], "Questionable")
        self.assertEqual(by_name["Old Player"]["note"], "ESPN update")
        self.assertNotIn("Old Player" and "stale", by_name["Old Player"].get("note", ""))

    def test_espn_full_write_updates_status_and_does_not_invent_keys(self):
        current = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "weather": {"indoor": False, "temp_f": 54, "impact": "wind", "note": "kept"},
                "with_without": [{"player": "Lamar Jackson", "takeaway": "kept"}],
                "inactives": {"BAL": ["Someone"]},
                "inactives_note": "kept note",
                "injuries": [{
                    "team": "JAX",
                    "player": "Ezra Cleveland",
                    "position": "G",
                    "status": None,
                    "injury": None,
                    "practice_latest": "Limited Participation in Practice",
                    "note": "old note",
                    "key_player_watch": True,
                    "source_url": "https://example.com",
                }],
            }],
        }
        prior_game_keys = set(current["games"][0].keys())
        prior_top_keys = set(current.keys())
        by_team = {
            "JAX": [{
                "team": "JAX",
                "player": "Ezra Cleveland",
                "position": "G",
                "status": "Out",
                "injury": "Ankle",
                "practice_latest": "Did Not Participate In Practice",
                "note": "ESPN shortComment",
                "source_url": ri.SOURCE_URL,
                "espn_only_extra": "must-not-appear",
            }, {
                "team": "JAX",
                "player": "Brand New",
                "position": "WR",
                "status": "Questionable",
                "injury": "Shoulder",
                "source_url": ri.SOURCE_URL,
            }],
            "BAL": [{
                "team": "BAL",
                "player": "Raven Rookie",
                "position": "CB",
                "status": "Doubtful",
                "injury": "Foot",
                "source_url": ri.SOURCE_URL,
            }],
        }
        updated = ri.apply_injuries(current, by_team)
        game = updated["games"][0]
        self.assertEqual(game["weather"], current["games"][0]["weather"])
        self.assertEqual(game["with_without"], current["games"][0]["with_without"])
        self.assertEqual(game["inactives"], current["games"][0]["inactives"])
        self.assertEqual(game["inactives_note"], current["games"][0]["inactives_note"])
        self.assertEqual(set(game.keys()), prior_game_keys)
        self.assertEqual(set(updated.keys()), prior_top_keys)

        ezra = next(r for r in game["injuries"] if r["player"] == "Ezra Cleveland")
        self.assertEqual(ezra["status"], "Out")
        self.assertEqual(ezra["injury"], "Ankle")
        self.assertEqual(ezra["note"], "ESPN shortComment")
        self.assertNotIn("key_player_watch", ezra)
        self.assertNotIn("espn_only_extra", ezra)
        self.assertTrue(set(ezra.keys()) <= set(ri.ESPN_INJURY_KEYS))
        self.assertEqual({r["player"] for r in game["injuries"]}, {"Ezra Cleveland", "Brand New", "Raven Rookie"})

    def test_required_keys_seeded_when_absent(self):
        current = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "injuries": [],
            }],
        }
        by_team = {
            "JAX": [{"team": "JAX", "player": "A", "position": "QB", "status": "Out",
                     "injury": "Knee", "source_url": ri.SOURCE_URL}],
            "BAL": [{"team": "BAL", "player": "B", "position": "WR", "status": "Out",
                     "injury": "Ankle", "source_url": ri.SOURCE_URL}],
        }
        updated = ri.apply_injuries(current, by_team)
        game = updated["games"][0]
        for key in ri.REQUIRED_GAME_KEYS:
            self.assertIn(key, game)
        self.assertEqual(game["with_without"], [])
        self.assertEqual(game["inactives"], {})
        self.assertIsInstance(game["weather"], dict)
        for row in game["injuries"]:
            self.assertTrue(set(row.keys()) <= set(ri.ESPN_INJURY_KEYS))

    def test_relative_drop_gate_fails_closed(self):
        previous = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX", "home": "BAL",
                "weather": {}, "with_without": [], "inactives": {},
                "injuries": [{"team": "JAX", "player": f"P{i}"} for i in range(40)],
            }],
        }
        updated_ok = {
            "week": 9,
            "updated": "new",
            "games": [{
                "away": "JAX", "home": "BAL",
                "weather": {}, "with_without": [], "inactives": {},
                "injuries": [{"team": "JAX", "player": f"P{i}"} for i in range(20)],
            }],
        }
        updated_bad = {
            "week": 9,
            "updated": "new",
            "games": [{
                "away": "JAX", "home": "BAL",
                "weather": {}, "with_without": [], "inactives": {},
                "injuries": [{"team": "JAX", "player": f"P{i}"} for i in range(19)],
            }],
        }
        ri.assert_relative_drop_ok(previous, updated_ok)
        with self.assertRaises(ri.FailClosed) as ctx:
            ri.assert_relative_drop_ok(previous, updated_bad)
        self.assertIn("Relative drop gate", str(ctx.exception))
        floor = max(1, math.ceil(40 * ri.RELATIVE_DROP_FLOOR))
        self.assertEqual(floor, 20)
        # No prior file: gate is a no-op.
        ri.assert_relative_drop_ok(None, updated_bad)
        ri.assert_relative_drop_ok({"week": 9, "games": []}, updated_bad)


if __name__ == "__main__":
    unittest.main()
