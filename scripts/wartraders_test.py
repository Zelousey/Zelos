"""Tests for the trading desk (functions/wartraders.py).

    python3 -I scripts/wartraders_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import wartraders as T  # noqa: E402
from warmarket import WarError  # noqa: E402

T0 = 1_000_000_000_000


def base(gold=5000):
    return {"gold": gold, "seq": 1, "buildings": {}}


def trader(**kw):
    t = {"id": "t2", "strategy": "dip", "warId": "war123", "terr": "tech", "budget": 1000, "on": True, "pos": {}, "log": []}
    t.update(kw)
    return t


class Desk(unittest.TestCase):
    def test_unlocks_at_hq3_with_more_slots_later(self):
        self.assertEqual([T.slots(n) for n in (1, 2, 3, 4, 5)], [0, 0, 1, 2, 3])
        with self.assertRaises(WarError) as e:
            T.hire(base(), 2, "dip", "war123", "tech", 1000, T0)
        self.assertIn("Headquarters level 3", str(e.exception))
        b = T.hire(base(), 3, "dip", "war123", "tech", 1000, T0)
        self.assertEqual((b["gold"], len(b["traders"]), b["tradersOn"]), (5000 - T.HIRE_GOLD, 1, 1))
        with self.assertRaises(WarError):
            T.hire(b, 3, "momentum", "war123", "tech", 1000, T0)  # one at level 3
        with self.assertRaises(WarError):
            T.hire(base(gold=100), 3, "dip", "war123", "tech", 1000, T0)

    def test_validate(self):
        self.assertEqual(T.validate({"strategy": "dip", "warId": "war123", "terr": "tech", "budget": 2500}), ("dip", "war123", "tech", 2500))
        for bad in ({"strategy": "yolo"}, {"strategy": "dip", "warId": "war123", "terr": "moon", "budget": 1000},
                    {"strategy": "dip", "warId": "war123", "terr": "tech", "budget": 999999}, {"strategy": "dip", "warId": "../x", "terr": "tech", "budget": 1000}):
            with self.assertRaises(WarError):
                T.validate(bad)

    def test_change_and_fire(self):
        b = T.hire(base(), 3, "dip", "war123", "tech", 1000, T0)
        tid = b["traders"][0]["id"]
        b = T.change(b, tid, T0, on=False, strategy="momentum", budget=5000)
        self.assertEqual((b["traders"][0]["strategy"], b["traders"][0]["budget"], b["tradersOn"]), ("momentum", 5000, 0))
        b = T.change(b, tid, T0, fire=True)
        self.assertEqual(b["traders"], [])
        with self.assertRaises(WarError):
            T.change(b, "nope", T0, on=True)


class Decide(unittest.TestCase):
    def test_dip_buyer_buys_a_dip_only_with_the_territory(self):
        q = {"NIMBC": {"p": 97.0, "ref": 100.0}, "QUBTR": {"p": 100.0, "ref": 100.0}, "SYNAP": {"p": 99.0, "ref": 100.0}}
        self.assertEqual(T.decide(trader(), q, 100000, True), [("NIMBC", "buy", 10, "signal")])
        self.assertEqual(T.decide(trader(), q, 100000, False), [])  # lost the territory: no buying
        self.assertEqual(T.decide(trader(on=False), q, 100000, True), [])  # paused
        self.assertEqual(T.decide(trader(), q, 500, True), [])  # not enough War cash

    def test_momentum_buys_strength(self):
        q = {"NIMBC": {"p": 103.0, "ref": 100.0}}
        self.assertEqual(T.decide(trader(strategy="momentum"), q, 100000, True), [("NIMBC", "buy", 9, "signal")])

    def test_take_profit_and_stop_even_after_losing_the_land(self):
        pos = {"NIMBC": {"qty": 10, "cost": 1000.0}}
        self.assertEqual(T.decide(trader(pos=pos), {"NIMBC": {"p": 101.6, "ref": 100.0}}, 0, False), [("NIMBC", "sell", 10, "take")])
        self.assertEqual(T.decide(trader(pos=pos), {"NIMBC": {"p": 96.9, "ref": 100.0}}, 0, False), [("NIMBC", "sell", 10, "stop")])
        self.assertEqual(T.decide(trader(pos=pos), {"NIMBC": {"p": 100.5, "ref": 100.0}}, 0, False), [])

    def test_record(self):
        t = T.record(trader(), "NIMBC", "buy", 10, 97.0, "signal", T0)
        self.assertEqual(t["pos"]["NIMBC"], {"qty": 10, "cost": 970.0})
        t = T.record(t, "NIMBC", "sell", 10, 99.0, "take", T0 + 1)
        self.assertEqual((t["pos"], t["log"][0]["why"], len(t["log"])), ({}, "take", 2))


if __name__ == "__main__":
    unittest.main(verbosity=1)
