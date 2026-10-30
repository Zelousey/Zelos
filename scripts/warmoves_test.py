"""Tests for neutral claims, Reinforce, Rally and Hot zones (functions/warmoves.py).

    python3 -I scripts/warmoves_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warattack as A  # noqa: E402
import warmoves as V  # noqa: E402
from warmarket import WarError  # noqa: E402

H = 3600000
D = 24 * H


def war(**kw):
    w = {"status": "active", "phase": "holding", "startedAt": 0, "endsAt": 3 * D, "names": {"a": "Ann", "b": "Ben"},
         "map": {"tech": {"state": "owned", "owner": "a"}, "energy": {"state": "owned", "owner": "b"}, "health": {"state": "neutral"}, "comms": {"state": "neutral"}}}
    w.update(kw)
    return w


class Claims(unittest.TestCase):
    def test_once_a_war_day_with_the_performance_check(self):
        w = V.claim(war(), "a", "health", H, True, False)
        self.assertEqual(w["map"]["health"], {"state": "owned", "owner": "a", "how": "neutral", "since": H})
        with self.assertRaises(WarError) as e:
            V.claim(w, "a", "comms", 2 * H, True, False)
        self.assertEqual(e.exception.details["reason"], "war-claimed")
        self.assertEqual(V.claim(w, "a", "comms", D + 1, True, False)["map"]["comms"]["owner"], "a")  # a new War day
        with self.assertRaises(WarError):
            V.claim(war(), "a", "comms", H, False, False)  # below 0% and no qualifying sale
        for t in ("tech", "energy", "mars"):
            with self.assertRaises(WarError):
                V.claim(war(), "a", t, H, True, False)  # only neutral land

    def test_a_redeploy_pass_gives_an_extra_claim(self):
        w = V.claim(war(redeployPasses={"a": 1}, passExpiry={"a": 2 * H}), "a", "health", H, True, False)
        w2 = V.claim(w, "a", "comms", H, False, True)
        self.assertEqual((w2["map"]["comms"]["owner"], w2["redeployPasses"]["a"]), ("a", 0))
        with self.assertRaises(WarError):
            V.claim(war(redeployPasses={"a": 1}, passExpiry={"a": H}), "a", "comms", 2 * H, True, True)  # expired


class Reinforce(unittest.TestCase):
    def test_from_reserve_to_your_own_land_once_a_day(self):
        place = {"soldiers": {"tech": 30}, "reserve": 15}
        w, p = V.reinforce(war(), "a", place, {"soldiers": {"tech": 10}}, H)
        self.assertEqual((p["soldiers"]["tech"], p["reserve"]), (40, 5))
        with self.assertRaises(WarError):
            V.reinforce(w, "a", p, {"soldiers": {"tech": 1}}, 2 * H)  # once a War day
        for bad in ({"soldiers": {"energy": 5}}, {"soldiers": {"tech": 16}}, {"soldiers": {"tech": 0}}, {"soldiers": {}}):
            with self.assertRaises(WarError):
                V.reinforce(war(), "a", place, bad, H)
        with self.assertRaises(WarError):
            V.reinforce(war(), "a", {"soldiers": {"tech": 45}, "reserve": 15}, {"soldiers": {"tech": 10}}, H)  # 50 at most


class Rally(unittest.TestCase):
    def test_15_reserve_soldiers_for_one_extra_attack_today(self):
        w, p = V.rally(war(), "a", {"reserve": 20}, H)
        self.assertEqual(p["reserve"], 5)
        self.assertEqual((V.extra_attacks(w, "a", 2 * H), V.extra_attacks(w, "a", D + 1)), (1, 0))
        with self.assertRaises(WarError):
            V.rally(w, "a", {"reserve": 20}, 2 * H)
        with self.assertRaises(WarError):
            V.rally(war(), "a", {"reserve": 14}, H)
        # with Rally, a second attack can be open at the same time
        base = war(map={"tech": {"state": "owned", "owner": "b"}, "energy": {"state": "owned", "owner": "b"}})
        w1 = A.new_attack(base, "x1", "a", "tech", "NIMBC", "bull", H, H, False)
        with self.assertRaises(WarError):
            A.check_attack(w1, "a", {"territory": "energy", "sym": "VOLTX", "side": "bull"}, H, 9000, True)
        w2, _ = V.rally(w1, "a", {"reserve": 20}, H)
        self.assertEqual(A.check_attack(w2, "a", {"territory": "energy", "sym": "VOLTX", "side": "bull"}, H, 9000, True)[0], "energy")


class Hot(unittest.TestCase):
    Q = {"NIMBC": {"p": 105, "ref": 100}, "QUBTR": {"p": 104, "ref": 100}, "VOLTX": {"p": 97, "ref": 100}, "HELIX": {"p": 100.5, "ref": 100}, "SIGNL": {"p": 99, "ref": 100}}

    def test_the_two_biggest_movers_chaos_first(self):
        hot = V.pick_hot(["tech", "energy", "health", "comms"], self.Q)
        self.assertEqual(list(hot), ["tech", "energy"])
        self.assertEqual(hot["tech"], "Hot zone: Tech +4.5% in 24 hours")
        hot2 = V.pick_hot(["tech", "energy", "health", "comms"], self.Q, chaos_syms=["HELIX"])
        self.assertEqual(list(hot2), ["health", "tech"])
        self.assertIn("Chaos", hot2["health"])

    def test_holding_at_the_day_end_and_winning_there_earn_points(self):
        w = war(hot={"tech": "x", "health": "y"}, hotDay=0)
        self.assertEqual(V.next_day_at(w), D)
        w2, held = V.day_change(w, D, {"energy": "z"})
        self.assertEqual((held, w2["hotPoints"], list(w2["hot"]), w2["hotDay"], V.next_day_at(w2)), ({"tech": "a"}, {"a": 1}, ["energy"], 1, 2 * D))
        self.assertEqual(V.hot_win(w2, "energy", "b")["hotPoints"], {"a": 1, "b": 1})
        self.assertIs(V.hot_win(w2, "tech", "b"), w2)  # not Hot any more
        self.assertIsNone(V.next_day_at(war()))


if __name__ == "__main__":
    unittest.main()
