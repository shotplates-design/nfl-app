"""Unit tests for injury refresh + Kenzie import. No network."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import import_kenzie_feed as kenzie  # noqa: E402
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
        # 10 teams * 2 kept + 1 WAS = 21; Active full dropped
        self.assertEqual(sum(len(v) for v in by_team.values()), 21)
        self.assertTrue(all(r["status"] != "Active" for rows in by_team.values() for r in rows))
        was = by_team["WAS"][0]
        self.assertEqual(was["practice_latest"], "Did Not Participate In Practice")
        self.assertEqual(was["injury"], "Knee")

    def test_fail_closed_on_empty_espn(self):
        with mock.patch.object(ri, "http_json", return_value={"injuries": []}):
            with self.assertRaises(ri.FailClosed):
                ri.fetch_espn_injuries()

    def test_apply_preserves_weather_and_with_without(self):
        current = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "kickoff_et": "2026-11-05T20:15:00-05:00",
                "weather": {"indoor": False, "temp_f": 68, "impact": "none"},
                "injuries": [{"team": "JAX", "player": "Old", "status": "Out"}],
                "with_without": [{"player": "Keeper", "note": "keep me"}],
            }],
        }
        by_team = {
            "JAX": [{"team": "JAX", "player": "New", "position": "G", "status": "Questionable",
                     "injury": "Ankle", "source_url": ri.SOURCE_URL}],
            "BAL": [{"team": "BAL", "player": "Raven", "position": "CB", "status": "Out",
                     "injury": "Foot", "source_url": ri.SOURCE_URL}],
        }
        updated = ri.apply_injuries(current, by_team)
        game = updated["games"][0]
        self.assertEqual(game["weather"]["temp_f"], 68)
        self.assertEqual(game["with_without"][0]["player"], "Keeper")
        self.assertEqual(game["kickoff_et"], "2026-11-05T20:15:00-05:00")
        players = {r["player"] for r in game["injuries"]}
        # Existing Kenzie/prior row kept; ESPN may only add newcomers.
        self.assertEqual(players, {"Old", "New", "Raven"})

    def test_espn_never_overwrites_kenzie_injury_or_game_fields(self):
        """Jim: ESPN is baseline only; Kenzie entries and game fields stay exact."""
        kenzie_ezra = {
            "team": "JAX",
            "player": "Ezra Cleveland",
            "position": "G",
            "status": None,
            "injury": None,
            "practice_latest": "Limited Participation in Practice",
            "note": "Kenzie: expected to play through the ankle; watch snaps.",
            "key_player_watch": True,
            "source_url": "https://www.nfl.com/injuries",
        }
        current = {
            "week": 9,
            "updated": "kenzie-stamp",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "kickoff_et": "2026-11-05T20:15:00-05:00",
                "weather": {"indoor": False, "temp_f": 54, "wind_mph": 12, "impact": "wind",
                            "note": "Kenzie weather note"},
                "with_without": [{"player": "Lamar Jackson", "takeaway": "Kenzie WW analysis"}],
                "inactives": {"BAL": ["Someone"]},
                "inactives_note": "Kenzie inactives note — do not touch",
                "inactives_posted": True,
                "injuries": [kenzie_ezra],
            }],
        }
        prior_game_keys = set(current["games"][0].keys())
        prior_top_keys = set(current.keys())
        by_team = {
            "JAX": [{
                "team": "JAX",
                "player": "Ezra Cleveland",
                "position": "G",
                "status": "Out",  # ESPN wants Out — must NOT win
                "injury": "Ankle",
                "practice_latest": "Did Not Participate In Practice",
                "note": "ESPN shortComment that must not overwrite Kenzie",
                "source_url": ri.SOURCE_URL,
                "espn_only_extra": "must-not-land-on-kenzie-row",
            }, {
                "team": "JAX",
                "player": "Brand New",
                "position": "WR",
                "status": "Questionable",
                "injury": "Shoulder",
                "practice_latest": "Limited Participation in Practice",
                "note": "ESPN baseline note",
                "source_url": ri.SOURCE_URL,
                "espn_only_extra": "must-not-appear",
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

        # Game fields survive byte-for-byte (aside from injuries list growth).
        self.assertEqual(game["weather"], current["games"][0]["weather"])
        self.assertEqual(game["with_without"], current["games"][0]["with_without"])
        self.assertEqual(game["kickoff_et"], current["games"][0]["kickoff_et"])
        self.assertEqual(game["inactives"], current["games"][0]["inactives"])
        self.assertEqual(game["inactives_note"], current["games"][0]["inactives_note"])
        self.assertEqual(game["inactives_posted"], current["games"][0]["inactives_posted"])

        # No new game-level or top-level keys.
        self.assertEqual(set(game.keys()), prior_game_keys)
        self.assertEqual(set(updated.keys()), prior_top_keys)  # only updated value changes

        ezra = next(r for r in game["injuries"] if r["player"] == "Ezra Cleveland")
        self.assertEqual(ezra, kenzie_ezra)  # exact Kenzie entry

        brand = next(r for r in game["injuries"] if r["player"] == "Brand New")
        self.assertEqual(brand["status"], "Questionable")
        self.assertEqual(brand["note"], "ESPN baseline note")
        self.assertNotIn("espn_only_extra", brand)
        self.assertEqual(set(brand.keys()) <= set(ri.ESPN_INJURY_KEYS), True)

        players = {r["player"] for r in game["injuries"]}
        self.assertEqual(players, {"Ezra Cleveland", "Brand New", "Raven Rookie"})

    def test_espn_baseline_does_not_invent_schema_keys(self):
        current = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX",
                "home": "BAL",
                "weather": {"impact": "none"},
                "injuries": [],
                "with_without": [],
            }],
        }
        by_team = {
            "JAX": [{"team": "JAX", "player": "A", "position": "QB", "status": "Out",
                     "injury": "Knee", "source_url": ri.SOURCE_URL, "secret_key": 1}],
            "BAL": [{"team": "BAL", "player": "B", "position": "WR", "status": "Out",
                     "injury": "Ankle", "source_url": ri.SOURCE_URL}],
        }
        updated = ri.apply_injuries(current, by_team)
        game = updated["games"][0]
        self.assertEqual(set(game.keys()), {"away", "home", "weather", "injuries", "with_without"})
        self.assertEqual(set(updated.keys()), {"week", "updated", "games"})
        for row in game["injuries"]:
            self.assertTrue(set(row.keys()) <= set(ri.ESPN_INJURY_KEYS))
            self.assertNotIn("secret_key", row)


class ImportKenzie(unittest.TestCase):
    def test_kenzie_rows_win_and_fail_closed_on_sparse(self):
        site = {
            "week": 9,
            "updated": "old",
            "games": [{
                "away": "JAX", "home": "BAL",
                "weather": {"indoor": False, "temp_f": 60, "impact": "none"},
                "injuries": [
                    {"team": "JAX", "player": "Ezra Cleveland", "status": "Out", "injury": "Old"},
                    {"team": "BAL", "player": "Only Site", "status": "Questionable", "injury": "Keep"},
                ],
                "with_without": [],
            }],
        }
        kenzie_rows = [
            {"team": "JAX", "player": "Ezra Cleveland", "status": None, "injury": None,
             "practice_latest": "Limited Participation in Practice", "source_url": "https://www.nfl.com/injuries"},
        ]
        # Pad to pass MIN_TOTAL_INJURIES on validate_kenzie for the feed itself.
        for i in range(25):
            kenzie_rows.append({
                "team": "BAL", "player": f"Pad {i}", "status": "Out", "injury": "Test",
                "source_url": "https://www.nfl.com/injuries",
            })
        feed = {
            "week": 9,
            "updated": "kenzie",
            "games": [{
                "away": "JAX", "home": "BAL",
                "weather": {"indoor": False, "temp_f": 68, "impact": "none"},
                "injuries": kenzie_rows,
                "with_without": [{"takeaway": "Kenzie WW"}],
                "kickoff_et": "2026-11-05T20:15:00-05:00",
            }],
        }
        kenzie.validate_kenzie(feed, Path("feed.json"))
        merged = kenzie.merge_feeds(site, feed)
        game = merged["games"][0]
        ezra = next(r for r in game["injuries"] if r["player"] == "Ezra Cleveland")
        self.assertIsNone(ezra["status"])
        self.assertEqual(ezra["practice_latest"], "Limited Participation in Practice")
        self.assertEqual(game["weather"]["temp_f"], 68)  # Kenzie weather wins
        self.assertEqual(game["with_without"][0]["takeaway"], "Kenzie WW")
        self.assertTrue(any(r["player"] == "Only Site" for r in game["injuries"]))

        sparse = {"week": 9, "games": [{"away": "JAX", "home": "BAL", "injuries": []}]}
        with self.assertRaises(kenzie.FailClosed):
            kenzie.validate_kenzie(sparse, Path("sparse.json"))

    def test_import_writes_atomically(self):
        with tempfile.TemporaryDirectory() as tmp:
            feeds = Path(tmp) / "feeds"
            data = Path(tmp) / "data"
            feeds.mkdir(); data.mkdir()
            rows = [{"team": "JAX", "player": f"P{i}", "status": "Out", "injury": "X",
                     "source_url": "https://www.nfl.com/injuries"} for i in range(25)]
            feed = {
                "week": 9, "updated": "t",
                "games": [{"away": "JAX", "home": "BAL", "weather": {"impact": "none"},
                           "injuries": rows, "with_without": []}],
            }
            (feeds / "week-9-conditions.json").write_text(json.dumps(feed), encoding="utf-8")
            rc = kenzie.main(["--feeds-dir", str(feeds), "--data-dir", str(data), "--week", "9"])
            self.assertEqual(rc, 0)
            written = json.loads((data / "week-9-conditions.json").read_text(encoding="utf-8"))
            self.assertEqual(len(written["games"][0]["injuries"]), 25)


if __name__ == "__main__":
    unittest.main()
