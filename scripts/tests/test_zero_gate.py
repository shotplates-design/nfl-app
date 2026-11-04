"""Gate tests built from synthetic rows. No real player names."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nfl_sources import MissingColumn, num  # noqa: E402
from validate_refresh import CATEGORY_STATS, MIN_ROWS, check_category_stats, check_qb_rushing  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "data"
N = MIN_ROWS + 10


def games(cat, n=N, value=3.0):
    return [{"cat": cat, **{stat: value + i % 5 for stat in CATEGORY_STATS[cat]}} for i in range(n)]


def league():
    """One synthetic player per position group, each with enough rows."""
    return [
        {"id": "qb", "cat": "passing", "games": games("passing")},
        {"id": "rb", "cat": "rushing", "games": games("rushing") + games("receiving")},
        {"id": "wr", "cat": "receiving", "games": games("receiving")},
        {"id": "lb", "cat": "defense", "games": games("defense")},
        {"id": "k", "cat": "kicking", "games": games("kicking")},
        {"id": "p", "cat": "punting", "games": games("punting")},
    ]


def zero(players, position, cat, stats):
    for player in players:
        if player["cat"] == position:
            for game in player["games"]:
                if game["cat"] == cat:
                    for stat in stats:
                        game[stat] = 0


class ZeroGate(unittest.TestCase):
    def test_good_data_passes(self):
        check_category_stats(league())

    def test_minority_of_zero_rows_is_fine(self):
        players = league()
        for game in players[2]["games"][: N // 3]:
            game.update(rec=0, primYds=0)
        check_category_stats(players)

    def test_one_position_zeroed_fails_even_with_good_other_position(self):
        # WR/TE receiving zeroed; RB receiving rows stay good.
        players = league()
        zero(players, "receiving", "receiving", ("rec", "primYds"))
        with self.assertRaises(SystemExit) as caught:
            check_category_stats(players)
        self.assertIn("receiving-primary", str(caught.exception))

    def test_qb_rushing_zeroed_fails(self):
        players = league()
        zero(players, "passing", "passing", ("car", "primYds"))
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_qb_rushing_supplement_zeroed_fails(self):
        qb = {"players": {str(i): {"games": [{"car": 0, "rushYds": 0, "rushTd": 0}] * 2} for i in range(N)}}
        with self.assertRaises(SystemExit):
            check_qb_rushing(qb)

    def test_qb_rushing_supplement_good_passes(self):
        qb = {"players": {str(i): {"games": [{"car": 4, "rushYds": 12, "rushTd": 0}] * 2} for i in range(N)}}
        check_qb_rushing(qb)

    def test_every_key_stat_zeroed_fails(self):
        for cat, stats in CATEGORY_STATS.items():
            for stat in stats:
                players = league()
                for player in players:
                    for game in player["games"]:
                        if game["cat"] == cat:
                            game[stat] = 0
                with self.assertRaises(SystemExit, msg=f"{cat}.{stat}"):
                    check_category_stats(players)

    def test_sparse_stats_need_only_one_nonzero_row(self):
        for position, cat, stat in (("passing", "passing", "int"), ("passing", "passing", "car"),
                                    ("defense", "defense", "sacks"), ("kicking", "kicking", "fgm"),
                                    ("punting", "punting", "net")):
            players = league()
            zero(players, position, cat, (stat,))
            next(p for p in players if p["cat"] == position)["games"][0][stat] = 1
            check_category_stats(players)

    def test_sparse_stat_zero_in_one_position_fails(self):
        players = league()
        zero(players, "defense", "defense", ("sacks",))
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_off_position_group_skips_sparse_stats(self):
        players = league()
        players.append({"id": "wr2", "cat": "receiving", "games": games("receiving")
                        + [dict(g, sacks=0, int=0) for g in games("defense")]})
        check_category_stats(players)

    def test_core_stat_under_half_fails(self):
        players = league()
        for game in players[2]["games"][: N * 6 // 10]:
            game["rec"] = 0
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_qb_rushing_supplement_one_nonzero_passes(self):
        qb = {"players": {str(i): {"games": [{"car": 0, "rushYds": 0}]} for i in range(N)}}
        qb["players"]["0"]["games"][0] = {"car": 2, "rushYds": 5}
        check_qb_rushing(qb)

    def test_missing_stat_fails(self):
        players = league()
        for game in players[3]["games"]:
            game.pop("tackles")
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_small_groups_are_skipped(self):
        # Week-1-sized sample: every group under MIN_ROWS, even zeroed, is not judged.
        players = [{"cat": c, "games": games(c, n=MIN_ROWS - 1, value=0)} for c in CATEGORY_STATS]
        check_category_stats(players)

    def test_missing_category_fails(self):
        players = [p for p in league() if p["cat"] != "punting"]
        with self.assertRaises(SystemExit):
            check_category_stats(players)

    def test_live_data_passes(self):
        check_category_stats(json.loads((DATA / "players.json").read_text(encoding="utf-8")))
        check_qb_rushing(json.loads((DATA / "supplemental" / "qb-rushing.json").read_text(encoding="utf-8")))


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
