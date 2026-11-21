"""Unit tests for Momentum Trader (functions/momentum_scan.py) and the 10 am re-planning of alerts
at the live price (functions/live_plan.py), owner 2026-11-19.
Run: python3 scripts/momentum_live_test.py"""
import os
import sys
import unittest
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "functions"))
import live_plan as LP  # noqa: E402
import momentum_scan as MOM  # noqa: E402
import scanner as SC  # noqa: E402


def series(closes, vols=None, start=date(2025, 1, 2)):
    out = []
    for i, c in enumerate(closes):
        d = start + timedelta(days=i)
        o = closes[i - 1] if i else c
        out.append([d.isoformat(), o, max(o, c) * 1.004, min(o, c) * 0.996, c, (vols or [3_000_000] * len(closes))[i]])
    return out


def trend(n, start, step, wiggle=0.0):
    return [start * (1 + step) ** i * (1 + wiggle * ((i % 5) - 2)) for i in range(n)]


class Momentum(unittest.TestCase):
    def setUp(self):
        self.spy = series(trend(260, 400, 0.0008))

    def test_macd_matches_its_definition(self):
        m, sg, hist = MOM.macd([float(x) for x in range(1, 80)])
        self.assertGreater(m[-1], 0)  # a steady rise: the 12-day EMA is over the 26-day
        self.assertAlmostEqual(hist[-1], m[-1] - sg[-1])

    def test_a_strong_trend_with_a_strong_day_is_picked(self):
        c = trend(259, 50, 0.003, 0.004) + [0]
        c[-1] = c[-2] * 1.012
        rows = series(c, [3_000_000] * 259 + [4_000_000])
        rows[-1][3] = c[-2] * 0.999  # opened low, closed near the high
        rows[-1][1] = c[-2]
        a = MOM.scan_momentum({"TEST": rows}, self.spy, self.spy)
        self.assertEqual(a["status"], "qualified", a.get("scanStats"))
        self.assertEqual((a["strategy"], a["ticker"], a["holdDays"], a["scoreMax"]), ("momentum-trader", "TEST", 3, 13))
        self.assertGreaterEqual(a["score"], MOM.MIN_CHECKS)
        risk = a["entry"] - a["stop"]
        self.assertAlmostEqual(a["target1"] - a["entry"], 1.5 * risk, delta=0.02)
        self.assertIn("RSI", a["technicals"])
        self.assertIn("MACD", a["technicals"])

    def test_momentum_max_takes_the_most_volatile_with_a_tighter_plan(self):
        def strong(wiggle):
            c = trend(259, 50, 0.003, wiggle) + [0]
            c[-1] = c[-2] * 1.012
            rows = series(c, [3_000_000] * 259 + [4_000_000])
            rows[-1][1], rows[-1][3] = c[-2], c[-2] * 0.999
            return rows
        bars = {"CALM": strong(0.004), "WILD": strong(0.012)}
        calm = MOM.scan_momentum(bars, self.spy, self.spy)
        wild = MOM.scan_momentum_max(bars, self.spy, self.spy)
        self.assertEqual((wild["strategy"], wild["ticker"], wild["highRisk"]), ("momentum-max", "WILD", True))
        risk = wild["entry"] - wild["stop"]
        self.assertAlmostEqual(wild["target1"] - wild["entry"], 3 * risk, delta=0.02)
        self.assertFalse(calm["highRisk"])

    def test_a_downtrend_is_not_picked(self):
        rows = series(trend(260, 120, -0.003, 0.004))
        a = MOM.scan_momentum({"DOWN": rows}, self.spy, self.spy)
        self.assertEqual(a["status"], "no-qualifying-setup")
        self.assertIn("checks", a["scanStats"]["rejected"][0]["reason"])


class LivePlan(unittest.TestCase):
    STOCK = {"strategy": "momentum-trader", "status": "qualified", "ticker": "AMD", "entry": 100.0, "stop": 97.0,
             "target1": 104.5, "target2": 107.5, "holdDays": 3, "reasoning": "AMD passed 10 checks. The plan, for up to 3 days: ..."}

    def test_the_plan_moves_to_the_live_price(self):
        a = LP.adjust(self.STOCK, 101.0, [100.0] * 60, "2026-11-20")
        self.assertEqual((a["entry"], a["stop"], a["target1"], a["target2"]), (101.0, 98.0, 105.5, 108.5))
        self.assertEqual(a["signalClose"], 100.0)
        self.assertIn("Priced at about 10:00 am", a["reasoning"])
        self.assertNotIn("The plan, for up to", a["reasoning"])

    def test_gone_through_the_stop_or_target_is_no_trade(self):
        self.assertIsNone(LP.adjust(self.STOCK, 96.5, [100.0] * 60, "2026-11-20"))
        self.assertIsNone(LP.adjust(self.STOCK, 104.6, [100.0] * 60, "2026-11-20"))

    def test_a_put_plan_is_mirrored(self):
        put = dict(self.STOCK, entry=100.0, stop=103.0, target1=94.0, target2=91.0)
        a = LP.adjust(put, 99.0, [100.0] * 60, "2026-11-20")
        self.assertEqual((a["stop"], a["target1"]), (102.0, 93.0))
        self.assertIsNone(LP.adjust(put, 103.5, [100.0] * 60, "2026-11-20"))

    def test_live_price_only_from_todays_fresh_quote(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        t = int(datetime(2026, 11, 20, 10, 0, tzinfo=ZoneInfo("America/New_York")).timestamp())
        self.assertEqual(LP.live_price({"c": 12.5, "t": t}, "2026-11-20"), 12.5)
        self.assertIsNone(LP.live_price({"c": 12.5, "t": t}, "2026-11-21"))
        self.assertIsNone(LP.live_price({"c": 12.5, "t": t, "stale": True}, "2026-11-20"))
        self.assertIsNone(LP.live_price(None, "2026-11-20"))

    def test_an_options_contract_is_picked_again(self):
        alert = dict(self.STOCK, strategy="options-scanner", direction="long-call",
                     contract={"kind": "call", "strike": 100, "label": "old"})
        closes = [100 * (1 + 0.01 * ((i % 7) - 3)) for i in range(60)]
        a = LP.adjust(alert, 102.0, closes, "2026-11-20")
        self.assertNotEqual(a["contract"]["label"], "old")
        self.assertTrue(30 <= a["contract"]["dte"] <= 60)

    def test_a_butterfly_is_built_again(self):
        import three_leg_scan as TLS
        closes = [100 * (1 + 0.01 * ((i % 7) - 3)) for i in range(60)]
        t = TLS.butterfly("AMD", 100.0, 110.0, closes, "2026-11-18")
        alert = dict(t, strategy="three-leg", status="qualified", ticker="AMD", setupLabel="Butterfly toward $105 (breakout)", reasoning="x")
        a = LP.adjust(alert, 102.0, closes, "2026-11-20")
        k1, k2, k3 = (l["strike"] for l in a["legs"])
        self.assertLessEqual(abs(k1 - 102), 1.25)  # at the money at the live price
        self.assertEqual(k2 - k1, k3 - k2)
        self.assertGreater(k2, k1)
        self.assertTrue(a["setupLabel"].endswith("(breakout)"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
