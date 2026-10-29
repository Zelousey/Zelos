"""Tests for the War map: placement, warnings, Camouflage and the reveal (functions/warmap.py).

    python3 -I scripts/warmap_test.py
"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warmap as W  # noqa: E402
from warmarket import WarError  # noqa: E402

T6 = ["tech", "finance", "health", "energy", "consumer", "comms"]


class Map(unittest.TestCase):
    def test_ten_sectors_and_maps_of_6_8_10(self):
        self.assertEqual(len(W.TERRITORIES), 10)
        self.assertIn("realestate", W.TERRITORIES)
        for n in (6, 8, 10):
            m = W.pick_territories(n, random.Random(n))
            self.assertEqual(len(m), n)
            self.assertEqual(m, [t for t in W.TERRITORIES if t in m])  # usual order, no repeats
        self.assertGreater(len({tuple(W.pick_territories(6, random.Random(i))) for i in range(20)}), 1)  # not always the same 6


class Placement(unittest.TestCase):
    def test_all_soldiers_max_50_one_empty(self):
        ok = W.validate_placement({"soldiers": {"tech": 50, "energy": 30, "health": 20}}, T6, 100)
        self.assertEqual(ok, {"soldiers": {"tech": 50, "energy": 30, "health": 20}, "camo": []})
        bad = [
            {"soldiers": {"tech": 50, "energy": 30}},                         # 20 not placed
            {"soldiers": {"tech": 60, "energy": 40}},                         # over 50
            {"soldiers": {"tech": 50, "mars": 50}},                           # not on the map
            {"soldiers": {"tech": 50.5, "energy": 49.5}},
            {"soldiers": {"tech": True, "energy": 99}},
            {"soldiers": {t: 17 for t in T6[:5]} | {"comms": 15}},           # no empty territory
        ]
        for b in bad:
            with self.assertRaises(WarError):
                W.validate_placement(b, T6, 100)

    def test_camouflage_costs_5_soldiers_each_max_2_on_your_own_land(self):
        ok = W.validate_placement({"soldiers": {"tech": 50, "energy": 40}, "camo": ["tech", "energy"]}, T6, 100)
        self.assertEqual(ok["camo"], ["energy", "tech"])
        for b in ({"soldiers": {"tech": 50, "energy": 50}, "camo": ["tech"]},                    # didn't pay for it
                  {"soldiers": {"tech": 50, "energy": 45}, "camo": ["health"]},                  # nothing to hide there
                  {"soldiers": {"tech": 45, "energy": 40}, "camo": ["tech", "energy", "tech"]},
                  {"soldiers": {"tech": 30, "energy": 30, "health": 25}, "camo": ["tech", "energy", "health"]}):
            with self.assertRaises(WarError):
                W.validate_placement(b, T6, 100)

    def test_even_spread_for_a_player_who_never_locked_in(self):
        p = W.even_spread(T6, 100)
        self.assertEqual(sum(p["soldiers"].values()), 100)
        self.assertNotIn("comms", p["soldiers"])
        self.assertEqual(W.validate_placement(p, T6, 100), p)
        fin = W.final_placements(["a", "b"], T6, 100, {"a": {"soldiers": {"tech": 50, "energy": 50}}, "b": {"soldiers": {"tech": 1}}})
        self.assertEqual(fin["a"]["soldiers"], {"tech": 50, "energy": 50})  # a saved placement is used
        self.assertEqual(fin["b"], dict(W.even_spread(T6, 100), locked=True))  # an invalid one isn't


class Warnings(unittest.TestCase):
    def test_only_locked_in_opponents_count_and_camouflage_hides(self):
        places = {
            "me": {"soldiers": {"tech": 50, "energy": 50}, "locked": True},
            "ann": {"soldiers": {"tech": 20, "health": 50, "energy": 30}, "camo": [], "locked": True},
            "bob": {"soldiers": {"tech": 15, "consumer": 50, "finance": 25}, "camo": ["consumer"], "locked": True},
            "cat": {"soldiers": {"comms": 50, "finance": 50}, "locked": False},   # still deciding: no warning
        }
        w = W.warnings_for("me", places)
        self.assertEqual(w, {"tech": "heavy", "health": "heavy", "energy": "heavy", "finance": "enemy"})  # tech 20+15
        self.assertNotIn("consumer", w)   # Camouflaged
        self.assertNotIn("comms", w)      # not locked in
        self.assertEqual(W.warnings_for("ann", places)["tech"], "heavy")  # me 50 + bob 15; no names or numbers anywhere


class Reveal(unittest.TestCase):
    def test_clear_wins_contested_and_neutral(self):
        places = {
            "a": {"soldiers": {"tech": 40, "energy": 32, "health": 28}},
            "b": {"soldiers": {"tech": 31, "energy": 40, "health": 29}},
            "c": {"soldiers": {"health": 30, "finance": 50, "consumer": 20}},
        }
        board, lines = W.resolve(T6, places, {"a": "Ann", "b": "Bob", "c": "Cat"}, 7)
        self.assertEqual(board["tech"], {"state": "owned", "owner": "a", "how": "claimed", "since": 7})  # 40 vs 31: more than 25% more
        self.assertEqual(board["energy"]["state"], "contested")  # 40 vs 32: 80%
        self.assertEqual(set(board["energy"]["contenders"]), {"a", "b"})
        self.assertEqual(set(board["health"]["contenders"]), {"a", "b", "c"})  # 3 within the margin: a best-pick battle
        self.assertEqual(board["finance"]["owner"], "c")
        self.assertEqual(board["comms"], {"state": "neutral", "since": 7})
        self.assertIn("Ann took Tech.", lines)
        self.assertIn("Communication stays neutral.", lines)
        self.assertFalse(any(str(n) in " ".join(lines) for n in (40, 31, 32)))  # no soldier counts in the log

    def test_claiming_ends_when_all_locked_or_at_the_deadline(self):
        war = {"phase": "claiming", "claimEnds": 100, "players": ["a", "b"]}
        self.assertFalse(W.claiming_over(war, {"a": {"locked": True}}, 50))
        self.assertTrue(W.claiming_over(war, {"a": {"locked": True}, "b": {"locked": True}}, 50))
        self.assertTrue(W.claiming_over(war, {}, 100))
        self.assertFalse(W.claiming_over(dict(war, phase="holding"), {}, 100))


if __name__ == "__main__":
    unittest.main()
