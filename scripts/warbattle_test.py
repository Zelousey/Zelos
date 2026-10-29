"""Tests for contested battles on the War map (functions/warbattle.py).

    python3 -I scripts/warbattle_test.py
"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warbattle as B  # noqa: E402
from warmarket import WarError  # noqa: E402

M = 60000
P = {s: 100.0 for s in ("NIMBC", "QUBTR", "SYNAP")}


def duel(now=0, awake=0, soldiers=None, seed=1):
    return B.new_battle("tech", ["a", "b"], soldiers or {"a": 50, "b": 41}, now, random.Random(seed), awake)


class Setup(unittest.TestCase):
    def test_command_goes_to_more_soldiers_or_a_coin_flip(self):
        self.assertEqual(duel()["command"], "a")
        flips = {duel(soldiers={"a": 40, "b": 40}, seed=i)["command"] for i in range(30)}
        self.assertEqual(flips, {"a", "b"})
        three = B.new_battle("tech", ["a", "b", "c"], {"a": 40, "b": 36, "c": 33}, 0, random.Random(1), 0)
        self.assertEqual((three["kind"], three["command"]), ("best", "a"))

    def test_waits_for_quiet_hours_but_never_more_than_a_day(self):
        b = duel(now=0, awake=5 * 3600000)
        self.assertEqual((b["stage"], b["wakeAt"], B.due(b)), ("waiting", 5 * 3600000, 5 * 3600000))
        self.assertEqual(B.wake(b, 5 * 3600000, 5 * 3600000)["stage"], "picking")
        self.assertEqual(B.wake(b, 5 * 3600000, 9 * 3600000)["stage"], "waiting")   # they changed their quiet hours
        self.assertEqual(B.wake(b, 24 * 3600000, 30 * 3600000)["stage"], "picking")  # a day is the limit
        p = duel()
        self.assertEqual((p["stage"], p["pickBy"], B.due(p)), ("picking", 10 * M, 10 * M))


class Picks(unittest.TestCase):
    def test_only_command_picks_the_side_in_a_duel(self):
        b = duel()
        self.assertEqual(B.validate_pick(b, "a", {"side": "bear"}), ("bear", None))
        for uid, data in (("b", {"side": "bull"}), ("x", {"side": "bull"}), ("a", {"side": "up"})):
            with self.assertRaises(WarError):
                B.validate_pick(b, uid, data)
        with self.assertRaises(WarError):
            B.validate_pick(dict(b, stage="running"), "a", {"side": "bull"})

    def test_best_pick_needs_a_stock_from_the_territory(self):
        b = B.new_battle("tech", ["a", "b", "c"], {"a": 40, "b": 36, "c": 33}, 0, random.Random(1), 0)
        self.assertEqual(B.validate_pick(b, "c", {"side": "bull", "sym": "SYNAP"}), ("bull", "SYNAP"))
        with self.assertRaises(WarError):
            B.validate_pick(b, "c", {"side": "bull", "sym": "VOLTX"})  # an Energy stock

    def test_starts_when_picks_are_in_or_time_is_up(self):
        b = duel()
        self.assertFalse(B.ready_to_start(b, {}, 5 * M))
        self.assertTrue(B.ready_to_start(dict(b, sides={"a": "bull"}), {}, 5 * M))
        self.assertTrue(B.ready_to_start(b, {}, 10 * M))
        best = B.new_battle("tech", ["a", "b", "c"], {"a": 40, "b": 36, "c": 33}, 0, random.Random(1), 0)
        self.assertFalse(B.ready_to_start(best, {"a": {}, "b": {}}, 5 * M))
        self.assertTrue(B.ready_to_start(best, {"a": {}, "b": {}, "c": {}}, 5 * M))


class Results(unittest.TestCase):
    def test_duel_side_matching_the_move_wins_unchanged_goes_to_command(self):
        b = B.start(dict(duel(), sides={"a": "bear"}), {}, P, 3 * M, random.Random(2))
        self.assertEqual((b["stage"], b["sides"], b["endsAt"], b["randomSide"]), ("running", {"a": "bear", "b": "bull"}, 3 * M + 3600000, False))
        sym = b["sym"]
        self.assertIn(sym, P)
        self.assertEqual(B.finish(b, dict(P, **{sym: 100.01}), 0)["winner"], "b")   # up, even a tiny move: Bull wins
        self.assertEqual(B.finish(b, dict(P, **{sym: 99.0}), 0)["winner"], "a")
        self.assertEqual(B.finish(b, P, 0)["winner"], "a")                            # unchanged: Command
        auto = B.start(duel(), {}, P, 10 * M, random.Random(3))
        self.assertTrue(auto["randomSide"])
        self.assertEqual(set(auto["sides"].values()), {"bull", "bear"})

    def test_best_pick_biggest_move_your_way_wins_ties_to_command(self):
        b = B.new_battle("tech", ["a", "b", "c"], {"a": 40, "b": 36, "c": 33}, 0, random.Random(1), 0)
        picks = {"a": {"side": "bull", "sym": "NIMBC"}, "b": {"side": "bear", "sym": "QUBTR"}}
        self.assertTrue(B.start(b, picks, P, 10 * M, random.Random(4))["picks"]["c"]["random"])  # c didn't pick
        r = B.start(b, dict(picks, c={"side": "bull", "sym": "SYNAP"}), P, 10 * M, random.Random(4))
        self.assertEqual(set(r["start"]), {"NIMBC", "QUBTR", "SYNAP"})
        done = B.finish(r, dict(P, NIMBC=103.0, QUBTR=95.0, SYNAP=100.0), 0)
        self.assertEqual(done["winner"], "b")  # -5% picked Bear beats +3% picked Bull
        tie = B.finish(r, dict(P, NIMBC=103.0, QUBTR=97.0, SYNAP=103.0), 0)
        self.assertEqual(tie["winner"], "a")  # a, b and c all +3% their way: Command

    def test_the_winner_takes_the_territory_losers_get_a_redeploy_pass(self):
        war = {"map": {"tech": {"state": "contested", "contenders": ["a", "b"]}}, "bonusPoints": {"a": 1}}
        b = dict(B.finish(B.start(duel(), {}, P, 0, random.Random(5)), P, 0))
        out = B.apply_result(war, b, 9)
        self.assertEqual(out["map"]["tech"], {"state": "owned", "owner": "a", "how": "contested-battle", "since": 9})
        self.assertEqual((out["bonusPoints"], out["redeployPasses"]), ({"a": 2}, {"b": 1}))
        self.assertIn("won the battle for Tech", B.result_line(b, {"a": "Ann"}))


if __name__ == "__main__":
    unittest.main()
