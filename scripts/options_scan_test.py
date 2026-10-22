"""Unit tests for functions/options_scan.py (the server-run Options Scanner).
python3 scripts/options_scan_test.py"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import options as OPT  # noqa: E402
import options_scan as OS  # noqa: E402
from scanner_test import rising, series, swing_rows  # noqa: E402

TODAY = "2026-10-22"


def put_rows():
    """A downtrend, a bounce up to the 20-day average, then a day that pokes it and closes back under."""
    import scanner as SC
    c = rising(240, 200, -0.0025)
    while c[-1] < SC.sma(c, 20) * 1.02:
        c.append(c[-1] * 1.015)
    rows = series(c, [3_000_000] * len(c), spread=0.003)
    s20 = SC.sma(c, 20)
    rows.append([rows[-1][0], c[-1], s20 * 1.004, s20 * 0.99, s20 * 0.997, 2_000_000])
    from datetime import date, timedelta
    rows[-1][0] = (date.fromisoformat(rows[-2][0]) + timedelta(days=1)).isoformat()
    return rows


class Contract(unittest.TestCase):
    def test_30_to_60_days_and_delta_near_065(self):
        closes = rising(60, 100, 0.002)
        for kind in ("call", "put"):
            c = OS.pick_contract("AAPL", kind, closes[-1], closes, TODAY)
            self.assertTrue(30 <= c["dte"] <= 60, c)
            self.assertLess(abs(abs(c["delta"]) - 0.65), 0.1, c)
            self.assertEqual(OPT.parse_contract(c["id"])["kind"], kind)
            self.assertGreater(c["estMid"], 0)
            self.assertEqual(c["estCost"], round(c["estMid"] * 100, 2))
        call = OS.pick_contract("AAPL", "call", closes[-1], closes, TODAY)
        put = OS.pick_contract("AAPL", "put", closes[-1], closes, TODAY)
        self.assertLess(call["strike"], closes[-1])  # in the money: below the price for a call...
        self.assertGreater(put["strike"], closes[-1])  # ...above it for a put

    def test_volatility_context(self):
        calm_then_wild = [100 + (0.2 if i % 2 else -0.2) for i in range(250)] + [100 + (4 if i % 2 else -4) for i in range(25)]
        pct, line = OS.vol_context(calm_then_wild)
        self.assertGreater(pct, 70)
        self.assertIn("elevated", line)


class Scan(unittest.TestCase):
    def market(self, n, step):
        m = series(rising(n, 400, step))
        return m, m

    def test_a_call_from_the_swing_pullback(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows), 0.0005)
        a = OS.scan_options({"TEST": rows}, spy, qqq, TODAY)
        self.assertEqual((a["status"], a["direction"], a["strategy"]), ("qualified", "long-call", "options-scanner"), a.get("scanStats"))
        self.assertLess(a["stop"], a["entry"])
        self.assertGreater(a["target1"], a["entry"])
        self.assertEqual(a["contract"]["kind"], "call")
        self.assertIn("estimate", a["riskNotes"])
        self.assertIn("premium", a["suggestedSizeNote"])

    def test_a_put_from_a_failed_rally(self):
        rows = put_rows()
        spy, qqq = self.market(len(rows), -0.001)
        a = OS.scan_options({"TEST": rows}, spy, qqq, TODAY)
        self.assertEqual((a["status"], a["direction"], a["setupLabel"]), ("qualified", "long-put", "Failed rally"), a.get("scanStats"))
        self.assertGreater(a["stop"], a["entry"])   # a put is wrong above the entry...
        self.assertLess(a["target1"], a["entry"])   # ...and right below it
        self.assertEqual(a["contract"]["kind"], "put")

    def test_linked_breakout_comes_first(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows), 0.0005)
        e = rows[-1][4]
        linked = {"strategy": "breakout-rider", "ticker": "LINK", "status": "qualified", "setupLabel": "Flat base breakout",
                  "entry": round(e, 2), "stop": round(e - 5, 2), "target1": round(e + 10, 2), "target2": round(e + 15, 2)}
        a = OS.scan_options({"TEST": rows, "LINK": rows}, spy, qqq, TODAY, [linked])
        self.assertEqual((a["ticker"], a["linkedTo"], a["entry"]), ("LINK", "breakout-rider", linked["entry"]))

    def test_cheap_or_thin_stocks_are_skipped(self):
        rows = swing_rows()
        spy, qqq = self.market(len(rows), 0.0005)
        cheap = [[r[0], r[1] / 20, r[2] / 20, r[3] / 20, r[4] / 20, r[5]] for r in rows]
        thin = [r[:5] + [500_000] for r in rows]
        a = OS.scan_options({"CHEAP": cheap, "THIN": thin}, spy, qqq, TODAY)
        self.assertEqual(a["status"], "no-qualifying-setup")
        reasons = {r["ticker"]: r["reason"] for r in a["scanStats"]["rejected"]}
        self.assertIn("under $15", reasons["CHEAP"])
        self.assertIn("1M shares", reasons["THIN"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
