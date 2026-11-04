"""Gate tests built from synthetic rows. No real player names."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nfl_sources import MissingColumn, num  # noqa: E402
from validate_refresh import CATEGORY_STATS, check_category_stats  # noqa: E402


def synthetic(value=3.0):
    games = []
    for cat, stats in CATEGORY_STATS.items():
        for i in range(4):
            games.append({"cat": cat, **{stat: value + i for stat in stats}})
    return [{"id": "p1", "name": "Player A", "games": games[: len(games) // 2]},
            {"id": "p2", "name": "Player B", "games": games[len(games) // 2:]}]


class ZeroGate(unittest.TestCase):
    def test_real_looking_data_passes(self):
        check_category_stats(synthetic())

    def test_some_zero_rows_are_fine(self):
        players = synthetic()
        players[0]["games"][0].update({k: 0 for k in players[0]["games"][0] if k != "cat"})
        check_category_stats(players)

    def test_every_zeroed_stat_fails(self):
        for cat, stats in CATEGORY_STATS.items():
            for stat in stats:
                players = synthetic()
                for p in players:
                    for g in p["games"]:
                        if g["cat"] == cat:
                            g[stat] = 0
                with self.assertRaises(SystemExit, msg=f"{cat}.{stat}"):
                    check_category_stats(players)

    def test_missing_stat_fails(self):
        players = synthetic()
        for p in players:
            for g in p["games"]:
                if g["cat"] == "defense":
                    g.pop("tackles")
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_fully_zeroed_scrape_fails(self):
        with self.assertRaises(SystemExit):
            check_category_stats([
                {"games": [{"cat": c, **{s: 0 for s in st}} for c, st in CATEGORY_STATS.items()]}])

    def test_missing_category_fails(self):
        players = synthetic()
        for p in players:
            p["games"] = [g for g in p["games"] if g["cat"] != "punting"]
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_live_data_passes(self):
        import json
        data = Path(__file__).resolve().parents[2] / "data" / "players.json"
        check_category_stats(json.loads(data.read_text(encoding="utf-8")))


class ColumnMapping(unittest.TestCase):
    def test_missing_column_raises(self):
        with self.assertRaises(MissingColumn):
            num({"passing_yards": "10"}, "passing_yds")

    def test_blank_value_is_zero(self):
        self.assertEqual(num({"carries": ""}, "carries"), 0.0)
        self.assertEqual(num({"carries": None}, "carries"), 0.0)

    def test_value_parses(self):
        self.assertEqual(num({"carries": "12"}, "carries"), 12.0)


if __name__ == "__main__":
    unittest.main()
