"""Unit tests for functions/scanner.py (the server-run Swing Trader and Breakout Rider).
python3 scripts/scanner_test.py"""
import os
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import scanner as SC  # noqa: E402


def series(closes, vols=None, spread=0.01):
    """Daily rows from closes: open halfway from the previous close, high/low a little around them."""
    d0 = date(2025, 1, 1)
    out, prev = [], closes[0]
    for i, c in enumerate(closes):
        o = (prev + c) / 2
        hi, lo = max(o, c) * (1 + spread), min(o, c) * (1 - spread)
        out.append([(d0 + timedelta(days=i)).isoformat(), o, hi, lo, c, (vols[i] if vols else 2_000_000)])
        prev = c
    return out


def rising(n, start=100.0, step=0.004):
    return [start * (1 + step) ** i for i in range(n)]


class Indicators(unittest.TestCase):
    def test_sma_rsi_atr(self):
        self.assertEqual(SC.sma([1, 2, 3, 4], 2), 3.5)
        self.assertIsNone(SC.sma([1], 2))
        self.assertEqual(SC.rsi(list(range(1, 40))), 100.0)  # only up days
        self.assertLess(SC.rsi(list(range(40, 1, -1))), 1)  # only down days
        rows = series(rising(60))
        _, h, l, c, _ = SC._cols(rows)
        self.assertGreater(SC.atr(h, l, c), 0)
        self.assertGreater(SC.adx(h, l, c), 20)  # a steady trend reads as trending

    def test_pivots(self):
        xs = [1, 2, 3, 9, 3, 2, 1, 2, 3, 4, 3, 2, 1]
        self.assertEqual(SC.pivots(xs, 3, True), [3, 9])
        self.assertEqual(SC.pivots(xs, 3, False), [6])


class Regime(unittest.TestCase):
    def test_moods(self):
        up, down = series(rising(120)), series(rising(120, step=-0.004))
        self.assertEqual(SC.regime(up, up)[0], "bullish")
        self.assertEqual(SC.regime(down, down)[0], "bearish")
        mood, line = SC.regime(up, down)
        self.assertEqual(mood, "neutral")
        self.assertIn("SPY", line)


def breakout_closes():
    """A rise, then ~8 weeks under a $120 ceiling (touched 3 times), then a close through it."""
    c = rising(100, 80, 0.004)                      # ~80 -> ~119
    base = []
    for i in range(42):
        base.append(112 + 6 * ((i % 14) / 13) if (i % 14) != 13 else 119.4)
    c += base
    c += [121.5, 122.0, 122.4]                       # the breakout and two closes holding above
    return c


class Breakout(unittest.TestCase):
    def market(self):
        m = series(rising(len(breakout_closes()), 400, 0.002))
        return m, m

    def test_clean_breakout_on_volume_qualifies(self):
        c = breakout_closes()
        vols = [3_000_000] * (len(c) - 3) + [7_000_000, 5_000_000, 4_000_000]
        spy, qqq = self.market()
        a = SC.scan_breakout({"TEST": series(c, vols, spread=0.004)}, spy, qqq)
        self.assertEqual(a["status"], "qualified", a.get("scanStats"))
        self.assertEqual(a["ticker"], "TEST")
        self.assertEqual(a["strategy"], "breakout-rider")
        self.assertLess(a["stop"], a["entry"])
        self.assertGreater(a["target1"], a["entry"])
        self.assertAlmostEqual((a["target1"] - a["entry"]) / (a["entry"] - a["stop"]), SC.BREAKOUT_TARGET_R, places=1)
        self.assertEqual(a["suggestedSizeNote"], SC.SIZE_NOTE)
        self.assertNotIn("your suggested size", a["reasoning"].lower())
        self.assertEqual(a["scoreMax"], 80)

    def test_light_volume_breakout_is_rejected(self):
        c = breakout_closes()
        spy, qqq = self.market()
        a = SC.scan_breakout({"TEST": series(c, [3_000_000] * len(c), spread=0.004)}, spy, qqq)
        self.assertEqual(a["status"], "no-qualifying-setup")
        self.assertIn("light volume", a["scanStats"]["rejected"][0]["reason"])

    def test_failed_breakout_is_rejected(self):
        c = breakout_closes()[:-1] + [118.0]          # closed back under the ceiling
        vols = [3_000_000] * (len(c) - 3) + [7_000_000, 5_000_000, 4_000_000]
        spy, qqq = self.market()
        a = SC.scan_breakout({"TEST": series(c, vols, spread=0.004)}, spy, qqq)
        self.assertEqual(a["status"], "no-qualifying-setup")

    def test_etfs_and_thin_or_cheap_stocks_are_skipped(self):
        c = breakout_closes()
        vols = [3_000_000] * (len(c) - 3) + [7_000_000, 5_000_000, 4_000_000]
        spy, qqq = self.market()
        a = SC.scan_breakout({"SPY": series(c, vols), "THIN": series(c, [1000] * len(c)),
                              "CHEAP": series([x / 20 for x in c], vols)}, spy, qqq)
        self.assertEqual(a["status"], "no-qualifying-setup")
        self.assertEqual(a["scanStats"]["scanned"], 2)  # SPY isn't a stock
        reasons = {r["ticker"]: r["reason"] for r in a["scanStats"]["rejected"]}
        self.assertEqual(reasons, {"CHEAP": "price under $10", "THIN": "thin volume"})


def swing_rows():
    """A steady uptrend, a few red days back to the 20-day average, then a day that dips to it
    and closes back above it."""
    c = rising(240, 50, 0.005)
    while c[-1] > SC.sma(c, 20) * 1.003:
        c.append(c[-1] * 0.99)
    rows = series(c, [3_000_000] * len(c), spread=0.003)
    s20 = SC.sma(c, 20)
    rows.append([rows[-1][0][:8] + "28", c[-1], s20 * 1.015, s20 * 0.998, s20 * 1.01, 2_000_000])
    rows[-1][0] = (date.fromisoformat(rows[-2][0]) + timedelta(days=1)).isoformat()
    return rows


class Swing(unittest.TestCase):
    def market(self, n, step=0.0005):
        m = series(rising(n, 400, step))
        return m, m

    def test_dip_to_the_20_day_in_an_uptrend_qualifies(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows))
        a = SC.scan_swing({"TEST": rows}, spy, qqq)
        self.assertEqual(a["status"], "qualified", a.get("scanStats"))
        self.assertEqual((a["strategy"], a["ticker"], a["setupLabel"]), ("swing-trader", "TEST", "Pullback in an uptrend"))
        risk = a["entry"] - a["stop"]
        self.assertAlmostEqual(a["target1"] - a["entry"], 2 * risk, delta=0.02)
        self.assertGreaterEqual(a["score"], SC.PASS_SCORE)

    def test_not_in_a_falling_market(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows), step=-0.002)
        a = SC.scan_swing({"TEST": rows}, spy, qqq)
        self.assertEqual(a["status"], "no-qualifying-setup")

    def test_a_stock_lagging_the_market_is_skipped(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows), step=0.004)  # SPY up faster than the stock this month
        a = SC.scan_swing({"TEST": rows}, spy, qqq)
        self.assertEqual(a["status"], "no-qualifying-setup")
        self.assertIn("lagging SPY", a["scanStats"]["rejected"][0]["reason"])

    def test_still_falling_through_the_average_is_skipped(self):
        rows = swing_rows()
        rows[-1][4] = SC.sma([r[4] for r in rows[:-1]], 20) * 0.97  # closed under the 20-day
        rows[-1][3] = rows[-1][4] * 0.99
        spy, qqq = self.market(len(rows))
        self.assertEqual(SC.scan_swing({"TEST": rows}, spy, qqq)["status"], "no-qualifying-setup")


class NoSetup(unittest.TestCase):
    def test_nothing_found_is_a_normal_result(self):
        flat = series([50.0] * 150)
        a = SC.scan_breakout({"FLAT": flat}, flat, flat)
        self.assertEqual(a["status"], "no-qualifying-setup")
        self.assertNotIn("ticker", a)
        self.assertIn("No qualifying setup today", a["reasoning"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
