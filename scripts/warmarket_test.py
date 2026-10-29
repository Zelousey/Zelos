"""Tests for the War zone's simulated market and War profiles (functions/warmarket.py).

    python3 -I scripts/warmarket_test.py
"""
import math
import os
import random
import statistics
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warmarket as W  # noqa: E402

M = 60000


class Universe(unittest.TestCase):
    def test_made_up_companies_under_real_sectors(self):
        sectors = {s for s, _ in W.SECTORS}
        self.assertEqual(len(W.SYMS), len(set(W.SYMS)))
        for sym, name, sec, start, vol in W.COMPANIES:
            self.assertRegex(sym, r"^[A-Z]{5}$")
            self.assertIn(sec, sectors)
            self.assertTrue(start > 0 and 0 < vol < 0.05)
        self.assertTrue(all(sum(1 for c in W.COMPANIES if c[2] == s) >= 3 for s in sectors))


class Engine(unittest.TestCase):
    def test_one_step_a_minute_with_catch_up_capped(self):
        st = W.new_state(0)
        st2, n, _ = W.step(st, 30 * 1000, random.Random(1))
        self.assertEqual((n, st2["t"]), (0, 0))  # not a minute yet
        st2, n, _ = W.step(st, 5 * M + 10, random.Random(1))
        self.assertEqual((n, st2["t"]), (5, 5 * M))
        st3, n, _ = W.step(st2, 5 * M + 10 * 3600 * 1000, random.Random(1))
        self.assertEqual(n, W.MAX_CATCH_UP)
        self.assertNotEqual(st2["stocks"]["NIMBC"]["p"], W.BY_SYM["NIMBC"][3])

    def test_realistic_daily_moves_and_no_runaway(self):
        st, rng, t = W.new_state(0), random.Random(7), 0
        prev, daily = {s: v["p"] for s, v in st["stocks"].items()}, []
        for _ in range(60):
            for _ in range(24):
                t += 3600 * 1000
                st, _, _ = W.step(st, t, rng)
            cur = {s: v["p"] for s, v in st["stocks"].items()}
            daily.append(math.log(cur["NIMBC"] / prev["NIMBC"]))
            prev = cur
        self.assertTrue(0.012 < statistics.pstdev(daily) < 0.04)
        for sym, *_ in W.COMPANIES:
            self.assertTrue(0.3 < st["stocks"][sym]["p"] / W.BY_SYM[sym][3] < 3, sym)

    def test_five_minute_bars_and_closed_bars(self):
        st = W.new_state(0)
        st, _, closed = W.step(st, 12 * M, random.Random(2))
        self.assertEqual([b[0] for b in closed["NIMBC"]], [0, 5 * M])  # 0-5 and 5-10 finished
        bar = st["stocks"]["NIMBC"]["bar"]
        self.assertEqual(bar[0], 10 * M)
        self.assertTrue(bar[3] <= min(bar[1], bar[4]) and bar[2] >= max(bar[1], bar[4]))

    def test_bar_history_and_day_reference(self):
        bars = []
        for i in range(W.BARS_KEPT + 10):
            bars = W.append_bar(bars, [i * 5 * M, 1, 2, 0.5, 100 + i])
        self.assertEqual(len(bars), W.BARS_KEPT)
        bars = W.append_bar(bars, [bars[-1][0], 1, 3, 0.5, 9])
        self.assertEqual(bars[-1][4], 9)
        now = bars[-1][0]
        self.assertEqual(W.ref_price(bars, now), [b for b in bars if b[0] <= now - 1440 * M][-1][4])
        self.assertIsNone(W.ref_price([], now))
        self.assertEqual(W.bars_in(W.bars_out(bars)), bars)  # stored as maps (no lists in lists)
        self.assertEqual(W.bars_in([{"t": 1}, "x", {"t": 1, "o": 1, "h": 2, "l": 0, "c": 1}]), [[1, 1, 2, 0, 1]])


class Profiles(unittest.TestCase):
    def test_starts_with_100000(self):
        p = W.new_profile(5)
        self.assertEqual((p["cash"], p["equity"], p["positions"], p["chart"]), (100000.0, 100000.0, {}, [{"t": 5, "eq": 100000.0}]))

    def test_buy_then_sell_with_pnl(self):
        p = W.new_profile(0)
        p, f = W.apply_trade(p, "NIMBC", "buy", 100, 200.0, {}, 1)
        self.assertEqual((p["cash"], p["positions"]["NIMBC"]), (80000.0, {"qty": 100, "avg": 200.0}))
        p, f = W.apply_trade(p, "NIMBC", "buy", 100, 220.0, {}, 2)
        self.assertEqual(p["positions"]["NIMBC"]["avg"], 210.0)
        p, f = W.apply_trade(p, "NIMBC", "sell", 50, 230.0, {"NIMBC": 230.0}, 3)
        self.assertEqual((f["pnl"], p["positions"]["NIMBC"]["qty"]), (1000.0, 150))
        self.assertEqual((p["equity"], p["pnl"], p["pnlPct"]), (104000.0, 4000.0, 4.0))  # 69,500 cash + 150 x 230
        p, _ = W.apply_trade(p, "NIMBC", "sell", 150, 200.0, {}, 4)
        self.assertNotIn("NIMBC", p["positions"])
        self.assertEqual(p["trades"], 4)
        self.assertEqual(len(p["chart"]), 5)

    def test_refused(self):
        p = W.new_profile(0)
        with self.assertRaises(W.WarError):
            W.apply_trade(p, "NIMBC", "buy", 1000, 200.0, {}, 1)  # $200,000 > $100,000
        with self.assertRaises(W.WarError):
            W.apply_trade(p, "NIMBC", "sell", 1, 200.0, {}, 1)  # nothing held: no short selling
        for bad in ({"sym": "AAPL", "side": "buy", "qty": 1}, {"sym": "NIMBC", "side": "short", "qty": 1},
                    {"sym": "NIMBC", "side": "buy", "qty": 0}, {"sym": "NIMBC", "side": "buy", "qty": 1.5},
                    {"sym": "NIMBC", "side": "buy", "qty": True}, None):
            with self.assertRaises(W.WarError, msg=repr(bad)):
                W.validate_trade(bad)
        self.assertEqual(W.validate_trade({"sym": "NIMBC", "side": "buy", "qty": 3.0}), ("NIMBC", "buy", 3))

    def test_inputs_not_mutated(self):
        p = W.new_profile(0)
        before = repr(p)
        W.apply_trade(p, "VOLTX", "buy", 10, 88.0, {}, 1)
        self.assertEqual(before, repr(p))


if __name__ == "__main__":
    unittest.main()
