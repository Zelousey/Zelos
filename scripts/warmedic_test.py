"""Tests for wounded soldiers and the Medical Station (functions/warmedic.py).

    python3 -I scripts/warmedic_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warbase as B  # noqa: E402
import warmedic as M  # noqa: E402

T0 = 1_000_000_000_000
H = 3600000


class Medical(unittest.TestCase):
    def test_station_unlocks_at_hq3(self):
        self.assertEqual(B.unlock_level("medical"), 3)
        base = B.new_base("2026-11-02", T0)
        self.assertEqual(B.medical_level(base), 0)

    def test_no_station_no_healing(self):
        p = M.record_loss({"reserve": 10}, 10, T0)
        p, n = M.heal(p, 0, T0 + 5 * H)
        self.assertEqual((n, p["reserve"]), (0, 10))

    def test_level_one_saves_30_percent_at_2_an_hour(self):
        p = M.record_loss({"reserve": 0}, 10, T0)
        self.assertEqual(M.waiting(p, 1), 3)
        p, n = M.heal(p, 1, T0 + H)
        self.assertEqual((n, p["reserve"]), (2, 2))
        p, n = M.heal(p, 1, T0 + H + 20 * 60000)  # 20 minutes: not a whole soldier yet
        self.assertEqual(n, 0)
        p, n = M.heal(p, 1, T0 + 5 * H)
        self.assertEqual((n, p["reserve"], M.waiting(p, 1)), (1, 3, 0))

    def test_upgrading_saves_more_of_the_same_losses(self):
        p = M.record_loss({}, 10, T0)
        p, _ = M.heal(p, 1, T0 + 10 * H)
        self.assertEqual(p["healed"], 3)
        self.assertEqual(M.waiting(p, 5), 4)  # 70% of 10, 3 already back
        p, n = M.heal(p, 5, T0 + 10 * H + H)
        self.assertEqual(n, 4)

    def test_idle_time_does_not_bank(self):
        p = M.record_loss({}, 10, T0)
        p, _ = M.heal(p, 1, T0 + 10 * H)  # all 3 back
        p = M.record_loss(p, 10, T0 + 20 * H)  # the clock restarts at the new loss
        p, n = M.heal(p, 1, T0 + 20 * H + 1000)
        self.assertEqual(n, 0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
