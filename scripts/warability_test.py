"""Tests for War abilities paid with Energy (functions/warability.py).

    python3 -I scripts/warability_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warability as AB  # noqa: E402
import warattack as A  # noqa: E402
from warmarket import WarError  # noqa: E402

T0 = 1_000_000_000_000
H = 3600000


def war():
    return {"status": "active", "phase": "holding", "startedAt": T0, "endsAt": T0 + 72 * H, "names": {"a": "Ann", "b": "Ben"},
            "map": {"tech": {"state": "owned", "owner": "b"}, "energy": {"state": "owned", "owner": "a"}, "health": {"state": "neutral"}}}


class Abilities(unittest.TestCase):
    def test_scout_shows_the_real_count_for_an_hour(self):
        intel, cost = AB.scout(war(), {"warnings": {}}, "a", "tech", 42, T0 + H)
        self.assertEqual((cost, intel["scouts"]["tech"]["n"], intel["warnings"]), (25, 42, {}))
        with self.assertRaises(WarError):
            AB.scout(war(), intel, "a", "tech", 42, T0 + H + 1000)  # once an hour per territory
        intel, _ = AB.scout(war(), intel, "a", "tech", 40, T0 + 2 * H + 1)
        self.assertEqual(intel["scouts"]["tech"]["n"], 40)
        for terr in ("energy", "health"):
            with self.assertRaises(WarError):
                AB.scout(war(), {}, "a", terr, 0, T0)  # your own land or neutral land

    def test_shield_blocks_attacks_for_six_hours_once_a_day(self):
        w, cost = AB.shield(war(), "a", "energy", T0 + H)
        self.assertEqual(cost, 60)
        with self.assertRaises(WarError) as e:
            A.check_attack(w, "b", {"territory": "energy", "sym": "VOLTX", "side": "bull"}, T0 + 2 * H, 99999, True)
        self.assertIn("shielded", str(e.exception))
        A.check_attack(w, "b", {"territory": "energy", "sym": "VOLTX", "side": "bull"}, T0 + 7 * H + 1, 99999, True)  # down after 6 hours
        with self.assertRaises(WarError):
            AB.shield(w, "a", "energy", T0 + 8 * H)  # once a War day
        AB.shield(w, "a", "energy", T0 + 25 * H)  # the next War day
        with self.assertRaises(WarError):
            AB.shield(war(), "a", "tech", T0)  # not yours

    def test_nothing_before_the_map_is_revealed(self):
        with self.assertRaises(WarError):
            AB.shield(dict(war(), phase="claiming"), "a", "energy", T0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
