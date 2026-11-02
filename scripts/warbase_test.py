"""Tests for the War base (functions/warbase.py).

    python3 -I scripts/warbase_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warbase as B  # noqa: E402
from warmarket import WarError  # noqa: E402

T0 = 1_000_000_000_000
MIN = 60000
H = 3600000


def fresh():
    return B.new_base("2026-11-02", T0)


class Build(unittest.TestCase):
    def test_new_base(self):
        b = fresh()
        self.assertEqual(b["gold"], B.START_GOLD)
        self.assertEqual(B.hq_level(b), 1)
        self.assertEqual(list(b["buildings"]), ["hq1"])

    def test_place_pays_and_builds_in_minutes(self):
        b, bid = B.place(fresh(), "mine", 2, 2, T0)
        self.assertEqual(b["gold"], B.START_GOLD - B.CONFIG["mine"]["cost"][0])
        self.assertEqual(b["buildings"][bid]["busyUntil"], T0 + B.CONFIG["mine"]["time"][0] * 1000)
        self.assertEqual(B.busy_count(b), 1)
        b, done = B.settle(b, T0 + 2 * MIN)
        self.assertEqual(done, [bid])
        self.assertEqual(b["buildings"][bid]["level"], 1)
        self.assertEqual(B.busy_count(b), 0)

    def test_no_overlap_or_off_the_land(self):
        b, _ = B.place(fresh(), "mine", 2, 2, T0)
        for x, y in ((3, 3), (B.HQ_AT[0] + 1, B.HQ_AT[1]), (B.GRID - 2, 0), (-1, 0)):
            with self.assertRaises(WarError):
                B.place(b, "barracks", x, y, T0)
        with self.assertRaises(WarError):
            B.place(b, "mine", True, 2, T0)  # not a number

    def test_count_limits_by_headquarters(self):
        b, _ = B.place(fresh(), "mine", 0, 0, T0)
        with self.assertRaises(WarError):
            B.place(b, "mine", 0, 5, T0)  # HQ 1 allows one Gold Mine
        with self.assertRaises(WarError):
            B.place(b, "hq", 0, 5, T0)

    def test_three_builders_at_once(self):
        b = dict(fresh(), gold=99999)
        b, _ = B.place(b, "mine", 0, 0, T0)
        b, _ = B.place(b, "barracks", 0, 5, T0)
        b = B.upgrade(b, "hq1", T0)
        with self.assertRaises(WarError) as e:
            B.place(b, "barracks", 0, 15, T0)
        self.assertIn("builders are busy", str(e.exception))

    def test_not_enough_gold(self):
        with self.assertRaises(WarError) as e:
            B.place(dict(fresh(), gold=10), "mine", 0, 0, T0)
        self.assertEqual(e.exception.details["reason"], "base-gold")

    def test_upgrade_times_and_hq_cap(self):
        b = dict(fresh(), gold=99999)
        b, m = B.place(b, "mine", 0, 0, T0)
        b, _ = B.settle(b, T0 + MIN)
        b = B.upgrade(b, m, T0 + MIN)
        self.assertEqual(b["buildings"][m]["busyUntil"], T0 + MIN + 120 * 1000)  # level 1 -> 2: 2 minutes
        b, _ = B.settle(b, T0 + 4 * MIN)
        with self.assertRaises(WarError):
            B.upgrade(b, m, T0 + 4 * MIN)  # level 3 needs Headquarters level 2
        b = B.upgrade(b, "hq1", T0 + 4 * MIN)
        self.assertEqual(b["buildings"]["hq1"]["busyUntil"], T0 + 4 * MIN + 300 * 1000)
        with self.assertRaises(WarError):
            B.upgrade(b, "hq1", T0 + 5 * MIN)  # already building

    def test_move(self):
        b, m = B.place(fresh(), "mine", 0, 0, T0)
        b = B.move(b, m, 5, 0, T0)
        self.assertEqual((b["buildings"][m]["x"], b["buildings"][m]["y"]), (5, 0))
        with self.assertRaises(WarError):
            B.move(b, m, B.HQ_AT[0], B.HQ_AT[1], T0)


class Gold(unittest.TestCase):
    def test_mine_produces_offline_up_to_its_store_and_collects(self):
        b, m = B.place(fresh(), "mine", 0, 0, T0)
        b, _ = B.settle(b, T0 + MIN)  # built
        b, _ = B.settle(b, T0 + MIN + H)  # an hour later
        self.assertAlmostEqual(b["buildings"][m]["stored"], B.CONFIG["mine"]["rate"][0], places=3)
        b, _ = B.settle(b, T0 + 10 * H)  # the store fills up and stops
        self.assertEqual(b["buildings"][m]["stored"], B.CONFIG["mine"]["store"][0])
        gold = b["gold"]
        b, got = B.collect(b, None, T0 + 10 * H)
        self.assertEqual(got, B.CONFIG["mine"]["store"][0])
        self.assertEqual(b["gold"], gold + got)
        b, got = B.collect(b, None, T0 + 10 * H)
        self.assertEqual(got, 0)  # nothing twice

    def test_no_production_while_upgrading(self):
        b = dict(fresh(), gold=99999)
        b, m = B.place(b, "mine", 0, 0, T0)
        b, _ = B.settle(b, T0 + MIN)
        b = B.upgrade(b, m, T0 + MIN)
        b, _ = B.settle(b, T0 + 2 * MIN)
        self.assertEqual(b["buildings"][m]["stored"], 0)
        b, done = B.settle(b, T0 + 3 * MIN + H)  # done at 3 min, then an hour at level 2
        self.assertEqual(done, [m])
        self.assertAlmostEqual(b["buildings"][m]["stored"], B.CONFIG["mine"]["rate"][1], places=3)


class Barracks(unittest.TestCase):
    def test_soldiers_bonus_once_built(self):
        b, k = B.place(fresh(), "barracks", 0, 0, T0)
        self.assertEqual(B.soldiers_bonus(b), 0)
        b, _ = B.settle(b, T0 + MIN)
        self.assertEqual(B.soldiers_bonus(b), B.CONFIG["barracks"]["soldiers"][0])

    def test_next_done(self):
        b = dict(fresh(), gold=99999)
        self.assertIsNone(B.next_done(b))
        b, _ = B.place(b, "mine", 0, 0, T0)
        b = B.upgrade(b, "hq1", T0)
        self.assertEqual(B.next_done(b), T0 + 60 * 1000)


if __name__ == "__main__":
    unittest.main(verbosity=1)
