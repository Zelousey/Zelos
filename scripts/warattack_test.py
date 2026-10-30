"""Tests for attacks on owned territory (functions/warattack.py).

    python3 -I scripts/warattack_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warattack as A  # noqa: E402
from warmarket import WarError  # noqa: E402

H = 3600000
D = 24 * H


def war(**kw):
    w = {"status": "active", "phase": "holding", "startedAt": 0, "endsAt": 3 * D, "names": {"a": "Ann", "b": "Ben", "c": "Cat"},
         "map": {"tech": {"state": "owned", "owner": "b", "how": "claimed"}, "energy": {"state": "owned", "owner": "a", "how": "claimed"},
                 "health": {"state": "neutral"}, "finance": {"state": "owned", "owner": "b", "how": "claimed"}}}
    w.update(kw)
    return w


GO = {"territory": "tech", "sym": "NIMBC", "side": "bull"}


class Eligibility(unittest.TestCase):
    def test_return_or_a_1_percent_sale_in_the_last_2_days(self):
        sale = {"side": "sell", "at": 2 * D, "qty": 10, "price": 101.0, "pnl": 10.0}   # avg 100: +1%
        small = dict(sale, pnl=5.0)                                                     # +0.5%
        self.assertTrue(A.eligible(0.0, [], 3 * D, 0))
        self.assertFalse(A.eligible(-0.01, [small], 3 * D, 0))
        self.assertTrue(A.eligible(-0.01, [sale], 3 * D, 0))
        self.assertFalse(A.eligible(-0.01, [sale], 5 * D, 0))      # more than 2 days ago
        self.assertFalse(A.eligible(-0.01, [sale], 3 * D, 2 * D + 1))  # before this War started
        self.assertFalse(A.eligible(-0.01, [dict(sale, side="buy")], 3 * D, 0))

    def test_stake_and_performance_or_a_redeploy_pass(self):
        self.assertEqual(A.check_attack(war(), "a", GO, H, 5000, True), ("tech", "NIMBC", "bull", False))
        with self.assertRaises(WarError):
            A.check_attack(war(), "a", GO, H, 4999, True)
        with self.assertRaises(WarError) as e:
            A.check_attack(war(), "a", GO, H, 9000, False)
        self.assertIn("0% or better", str(e.exception))
        w = war(redeployPasses={"a": 1}, passExpiry={"a": 2 * H})
        self.assertEqual(A.check_attack(w, "a", dict(GO, usePass=True), H, 9000, False)[3], True)
        with self.assertRaises(WarError):
            A.check_attack(w, "a", dict(GO, usePass=True), 3 * H, 9000, False)  # the pass expired


class Limits(unittest.TestCase):
    def test_what_can_be_attacked(self):
        for data, why in ((dict(GO, territory="energy"), "your own"), (dict(GO, territory="health"), "neutral"),
                          (dict(GO, sym="VOLTX"), "another sector's stock"), (dict(GO, side="up"), "side")):
            with self.assertRaises(WarError, msg=why):
                A.check_attack(war(), "a", data, H, 9000, True)
        with self.assertRaises(WarError):
            A.check_attack(war(), "a", GO, 3 * D - H + 1, 9000, True)  # the last hour
        with self.assertRaises(WarError):
            A.check_attack(war(phase="claiming"), "a", GO, H, 9000, True)

    def test_one_open_attack_two_incoming_one_battle_per_territory_three_a_day(self):
        w = A.new_attack(war(), "x1", "a", "tech", "NIMBC", "bull", H, H, False)
        with self.assertRaises(WarError):
            A.check_attack(w, "a", dict(GO, territory="finance", sym="VAULT"), H, 9000, True)  # a's one open attack
        with self.assertRaises(WarError):
            A.check_attack(w, "c", GO, H, 9000, True)  # tech already has a battle
        w2 = A.new_attack(w, "x2", "c", "finance", "VAULT", "bull", H, H, False)
        w2 = dict(w2, map=dict(w2["map"], health={"state": "owned", "owner": "b"}))
        with self.assertRaises(WarError) as e:
            A.check_attack(dict(w2, names={}), "d", {"territory": "health", "sym": "HELIX", "side": "bull"}, H, 9000, True)
        self.assertIn("defending 2", str(e.exception))
        w3 = war(pairs={"a>b:0": 3})
        with self.assertRaises(WarError):
            A.check_attack(w3, "a", GO, H, 9000, True)
        self.assertTrue(A.check_attack(w3, "a", GO, D + 1, 9000, True))  # a new War day

    def test_the_one_day_wait_on_land_you_lost(self):
        w = war(lostAt={"a": {"tech": H}})
        with self.assertRaises(WarError) as e:
            A.check_attack(w, "a", GO, 2 * H, 9000, True)
        self.assertEqual((str(e.exception)[:8], e.exception.details["cost"]), ("You lost", 100))
        self.assertTrue(A.check_attack(w, "a", GO, H + D, 9000, True))


class Answers(unittest.TestCase):
    def setUp(self):
        self.w = A.new_attack(war(), "x1", "a", "tech", "NIMBC", "bull", H, H, False)

    def test_two_hours_to_answer_from_the_end_of_quiet_hours(self):
        a = self.w["attacks"]["x1"]
        self.assertEqual((a["defender"], a["answerBy"], A.due(a)), ("b", 3 * H, 3 * H - 30 * 60000))
        late = A.new_attack(war(), "x9", "a", "tech", "NIMBC", "bull", H, 5 * H, False)["attacks"]["x9"]
        self.assertEqual(late["answerBy"], 7 * H)
        self.assertEqual(self.w["pairs"], {"a>b:0": 1})

    def test_accept_with_counter_pick_once_a_day(self):
        w, a, kind = A.answer(self.w, "x1", "b", {"accept": True, "counter": "SYNAP"}, 2 * H)
        self.assertEqual((kind, a["sym"], a["counterPicked"]), ("accepted", "SYNAP", True))
        w2 = A.new_attack(dict(w, attacks={}), "x2", "c", "tech", "NIMBC", "bull", 2 * H, 2 * H, False)
        with self.assertRaises(WarError):
            A.answer(w2, "x2", "b", {"accept": True, "counter": "QUBTR"}, 2 * H)  # second Counter-pick today
        with self.assertRaises(WarError):
            A.answer(self.w, "x1", "a", {"accept": True}, 2 * H)  # only the defender answers

    def test_first_decline_free_then_concede(self):
        w, a, kind = A.answer(self.w, "x1", "b", {"accept": False}, 2 * H)
        self.assertEqual((kind, a["result"]), ("declined", "declined"))
        w2 = A.new_attack(dict(w, attacks={}), "x2", "c", "tech", "NIMBC", "bull", 2 * H, 2 * H, False)
        _, _, kind2 = A.answer(w2, "x2", "b", {"accept": False}, 2 * H)
        self.assertEqual(kind2, "conceded")

    def test_no_answer_is_accepted(self):
        a = self.w["attacks"]["x1"]
        self.assertIs(A.auto_accept(a, 3 * H - 1), a)
        self.assertEqual(A.auto_accept(a, 3 * H)["accepted"], "auto")


class Results(unittest.TestCase):
    def run_to(self, price, side="bull", defender_cash=9000):
        w = A.new_attack(war(), "x1", "a", "tech", "NIMBC", side, 0, 0, False)
        a = A.start(w["attacks"]["x1"], {"NIMBC": 100.0}, defender_cash, H)
        return w, a, A.result(a, price)

    def test_draw_band_and_sides(self):
        self.assertEqual(self.run_to(100.09)[2], "draw")
        self.assertEqual(self.run_to(100.2)[2], "attacker")
        self.assertEqual(self.run_to(99.8)[2], "defender")
        self.assertEqual(self.run_to(99.8, "bear")[2], "attacker")
        _, a, _ = self.run_to(100, defender_cash=1200)
        self.assertEqual(a["stakes"], {"a": 5000.0, "b": 1200.0})  # nobody risks more than they have
        self.assertEqual((a["endsAt"] - a["startsAt"]), H)

    def test_wins_add_progress_and_capture_needs_1_plus_soldiers_over_20(self):
        w, a, _ = self.run_to(101)
        self.assertEqual([A.needed_wins(n) for n in (0, 19, 20, 45, 50)], [1, 1, 2, 3, 3])
        w1, done, fx = A.settle(w, a, "attacker", 45, 2 * H)   # 45 - 5 = 40 left: 3 wins needed
        self.assertEqual((fx["captured"], w1["progress"]["tech"]["a"], fx["cash"]), (False, 1, {"a": 10000.0}))
        self.assertEqual(fx["soldiers"], [("b", "tech", -5)])
        self.assertNotIn("x1", w1["attacks"])
        self.assertEqual(done["result"], "attacker")
        w2 = dict(w1, progress={"tech": {"a": 2}})
        w3, _, fx3 = A.settle(w2, a, "attacker", 25, 3 * H)     # 20 left: 2 needed, has 3
        self.assertTrue(fx3["captured"])
        self.assertEqual(w3["map"]["tech"], {"state": "owned", "owner": "a", "how": "captured", "since": 3 * H})
        self.assertEqual((fx3["retreat"], w3["progress"]["tech"], w3["lostAt"]["b"]["tech"]), (("b", "tech"), {}, 3 * H))
        self.assertIn(("a", None, 10), fx3["soldiers"])

    def test_a_loss_keeps_progress_and_costs_soldiers(self):
        w, a, _ = self.run_to(99)
        w = dict(w, progress={"tech": {"a": 1}})
        w1, done, fx = A.settle(w, a, "defender", 45, 2 * H)
        self.assertEqual((w1["progress"]["tech"]["a"], fx["cash"]), (1, {"b": 10000.0}))  # owner 2026-10-30: wins are kept
        self.assertEqual(fx["soldiers"], [("b", None, 3), ("a", "tech", -5)])
        self.assertEqual(w1["map"]["tech"]["how"], "defended")

    def test_draw_and_concession(self):
        w, a, _ = self.run_to(100)
        _, _, fx = A.settle(w, a, "draw", 45, 2 * H)
        self.assertEqual((fx["cash"], fx["soldiers"], fx["captured"]), ({"a": 5000.0, "b": 5000.0}, [], False))
        w0 = A.new_attack(war(), "x1", "a", "tech", "NIMBC", "bull", 0, 0, False)
        w1, done, fx = A.settle(w0, dict(w0["attacks"]["x1"], result="conceded"), "conceded", 0, H)
        self.assertEqual((fx["captured"], fx["cash"], w1["map"]["tech"]["how"]), (True, {"a": 5000.0}, "conceded"))  # land by concession: worth less
        self.assertIn("conceded", A.line(done, {"a": "Ann", "b": "Ben"}))


if __name__ == "__main__":
    unittest.main()
