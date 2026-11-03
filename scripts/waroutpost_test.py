"""Tests for territory outposts (functions/waroutpost.py).

    python3 -I scripts/waroutpost_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import waroutpost as O  # noqa: E402
from warmarket import WarError  # noqa: E402

T0 = 1_000_000_000_000
MIN = 60000
H = 3600000


def war():
    return {"status": "active", "outposts": {}}


class Outposts(unittest.TestCase):
    def test_build_costs_gold_and_takes_ten_minutes(self):
        w, cost = O.build(war(), "a", "tech", "fort", 2, 5000, T0)
        self.assertEqual(cost, 1000)
        self.assertEqual(O.fort_wins(w, "tech", T0 + 9 * MIN), 0)  # still building
        self.assertEqual(O.fort_wins(w, "tech", T0 + 10 * MIN), 1)

    def test_rules(self):
        with self.assertRaises(WarError):
            O.build(war(), "a", "tech", "fort", 1, 5000, T0)  # Headquarters level 2 first
        with self.assertRaises(WarError):
            O.build(war(), "a", "tech", "castle", 2, 5000, T0)
        with self.assertRaises(WarError) as e:
            O.build(war(), "a", "tech", "fort", 2, 500, T0)
        self.assertEqual(e.exception.details["reason"], "base-gold")
        w, _ = O.build(war(), "a", "tech", "fort", 2, 5000, T0)
        with self.assertRaises(WarError):
            O.build(w, "a", "tech", "camp", 2, 5000, T0)  # one per territory
        w, _ = O.build(w, "a", "energy", "camp", 2, 5000, T0)
        with self.assertRaises(WarError) as e:
            O.build(w, "a", "health", "camp", 2, 5000, T0)  # HQ 2: two in this War
        self.assertIn("2 outposts in each War", str(e.exception))
        O.build(w, "b", "health", "camp", 2, 5000, T0)  # another player's count is their own

    def test_upgrade_to_level_three(self):
        w, _ = O.build(war(), "a", "tech", "fort", 3, 99999, T0)
        with self.assertRaises(WarError):
            O.upgrade(w, "a", "tech", 99999, T0 + MIN)  # still building
        with self.assertRaises(WarError):
            O.upgrade(w, "b", "tech", 99999, T0 + 11 * MIN)  # not yours
        w, cost = O.upgrade(w, "a", "tech", 99999, T0 + 11 * MIN)
        self.assertEqual(cost, 2500)
        self.assertEqual(O.fort_wins(w, "tech", T0 + 20 * MIN), 1)  # level 1 holds while upgrading
        self.assertEqual(O.fort_wins(w, "tech", T0 + 41 * MIN), 2)
        w, cost = O.upgrade(w, "a", "tech", 99999, T0 + 41 * MIN)
        self.assertEqual(cost, 5000)
        self.assertEqual(O.fort_wins(w, "tech", T0 + 2 * H), 3)
        with self.assertRaises(WarError):
            O.upgrade(w, "a", "tech", 99999, T0 + 2 * H)

    def test_camp_makes_gold_up_to_eight_hours_and_collects(self):
        w, _ = O.build(war(), "a", "energy", "camp", 2, 5000, T0)
        w, got = O.collect(w, "a", "energy", T0 + 10 * MIN + H)
        self.assertEqual(got, 150)
        w, got = O.collect(w, "a", "energy", T0 + 10 * MIN + 30 * H)
        self.assertEqual(got, 150 * 8)  # it holds 8 hours' worth
        with self.assertRaises(WarError):
            O.collect(w, "b", "energy", T0 + 31 * H)

    def test_no_gold_after_the_war(self):
        w, _ = O.build(war(), "a", "energy", "camp", 2, 5000, T0)
        w = O.settle_all(w, T0 + 10 * MIN + H)
        w = dict(w, status="ended")
        w, got = O.collect(w, "a", "energy", T0 + 20 * H)
        self.assertEqual(got, 150)

    def test_capture_one_level_lower_with_its_gold(self):
        w, _ = O.build(war(), "a", "energy", "camp", 3, 99999, T0)
        w, _ = O.upgrade(w, "a", "energy", 99999, T0 + 10 * MIN)
        w = O.capture(w, "energy", "b", T0 + 3 * H)
        o = w["outposts"]["energy"]
        self.assertEqual((o["owner"], o["level"]), ("b", 1))
        w, got = O.collect(w, "b", "energy", T0 + 4 * H)
        self.assertEqual(got, 700 + 150)  # 2h20m at level 2 (300 an hour) kept in the camp, then 1 hour at level 1
        w, _ = O.build(war(), "a", "tech", "fort", 2, 5000, T0)
        w = O.capture(w, "tech", "b", T0 + H)
        self.assertNotIn("tech", w["outposts"])  # level 1 is destroyed


if __name__ == "__main__":
    unittest.main(verbosity=1)
