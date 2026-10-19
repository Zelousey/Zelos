"""Unit tests for the 3-Leg Options strategy: functions/three_leg.py (legs, cost, max profit
and loss, breakevens, the result at expiration), its 60-token pass and the outcome checker.
Run: python3 scripts/three_leg_test.py"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "functions"))
import tradewar_test  # noqa: E402,F401  (installs the firebase stubs)
import main as m  # noqa: E402
import three_leg as T  # noqa: E402
import check_alert_outcomes as C  # noqa: E402

BUTTERFLY = {"ticker": "AAPL", "entry": 180, "expiration": "2026-11-20", "kind": "bull-butterfly", "status": "qualified", "legs": [
    {"type": "call", "side": "buy", "strike": 175, "qty": 1, "price": 8.0},
    {"type": "call", "side": "sell", "strike": 185, "qty": 2, "price": 3.0},
    {"type": "call", "side": "buy", "strike": 195, "qty": 1, "price": 0.8}]}
LIZARD = {"ticker": "MSFT", "entry": 180, "expiration": "2026-11-20", "kind": "jade-lizard", "status": "qualified", "legs": [
    {"type": "call", "side": "buy", "strike": 195, "qty": 1, "price": 0.9},
    {"type": "put", "side": "sell", "strike": 170, "qty": 1, "price": 2.5},
    {"type": "call", "side": "sell", "strike": 190, "qty": 1, "price": 2.0}]}


class Numbers(unittest.TestCase):
    def test_butterfly(self):
        n = T.normalize(BUTTERFLY)
        self.assertEqual((n["netCost"], n["maxProfit"], n["maxLoss"], n["breakevens"]), (280.0, 720.0, 280.0, [177.8, 192.2]))
        self.assertEqual(n["kindLabel"], "Bull call butterfly")
        self.assertEqual([l["strike"] for l in n["legs"]], [175, 185, 195])

    def test_jade_lizard_credit_and_downside_risk(self):
        n = T.normalize(LIZARD)
        self.assertEqual(n["netCost"], -360.0)  # a credit
        self.assertEqual(n["maxProfit"], 360.0)
        self.assertEqual(n["maxLoss"], 16640.0)  # if the stock went to zero (the short put)
        self.assertEqual(n["breakevens"], [166.4, 193.6])
        self.assertEqual([l["strike"] for l in n["legs"]], [170, 190, 195])  # sorted by strike

    def test_unlimited_sides(self):
        naked = dict(BUTTERFLY, legs=[{"type": "call", "side": "sell", "strike": 100, "qty": 2, "price": 3},
                                      {"type": "call", "side": "buy", "strike": 110, "qty": 1, "price": 1},
                                      {"type": "put", "side": "buy", "strike": 90, "qty": 1, "price": 1}])
        self.assertIsNone(T.normalize(naked)["maxLoss"])
        long_calls = dict(BUTTERFLY, legs=[{"type": "call", "side": "buy", "strike": 100, "qty": 1, "price": 3}] * 3)
        self.assertIsNone(T.normalize(long_calls)["maxProfit"])

    def test_rejects_bad_trades(self):
        bad = [dict(BUTTERFLY, kind="iron-condor"), dict(BUTTERFLY, expiration="Nov 20"), dict(BUTTERFLY, entry=0),
               dict(BUTTERFLY, legs=BUTTERFLY["legs"][:2]), dict(BUTTERFLY, legs=[dict(BUTTERFLY["legs"][0], qty=0)] * 3),
               dict(BUTTERFLY, legs=[dict(BUTTERFLY["legs"][0], qty=True)] * 3), dict(BUTTERFLY, legs=[dict(BUTTERFLY["legs"][0], type="future")] * 3),
               dict(BUTTERFLY, legs=[dict(BUTTERFLY["legs"][0], strike=-5)] * 3), dict(BUTTERFLY, legs=[dict(BUTTERFLY["legs"][0], price=float("nan"))] * 3)]
        for b in bad:
            with self.assertRaises(ValueError):
                T.normalize(b)

    def test_no_setup_passes_through(self):
        self.assertEqual(T.normalize({"status": "no-qualifying-setup"}), {})


class Results(unittest.TestCase):
    def test_at_expiration(self):
        a = dict(BUTTERFLY, **T.normalize(BUTTERFLY))
        self.assertEqual(T.outcome_at_expiry(a, 185)["result"], "hit-target")
        self.assertEqual(T.outcome_at_expiry(a, 170)["result"], "stopped-out")
        self.assertIn("lost $280.00", T.outcome_at_expiry(a, 170)["notes"])
        self.assertEqual(T.outcome_at_expiry(a, 177.8)["result"], "expired")

    def test_checker_waits_for_expiration(self):
        a = dict(BUTTERFLY, strategy="three-leg", **T.normalize(BUTTERFLY))
        before = [{"date": "2026-11-18", "high": 190, "low": 180, "close": 186}]
        self.assertEqual(C.outcome_for_alert(a, before)["result"], "open")
        after = before + [{"date": "2026-11-20", "high": 186, "low": 183, "close": 184}]
        r = C.outcome_for_alert(a, after)
        self.assertEqual((r["result"], r["exitPrice"], r["closedAt"]), ("hit-target", 184.0, "2026-11-20"))


class Pass(unittest.TestCase):
    def test_sixty_tokens_for_seven_days(self):
        self.assertEqual(m.pass_price("three-leg"), 60)
        self.assertEqual(m.pass_price("swing-trader"), 40)
        w = dict(m.tk_new_wallet(0), balance=100)
        w, line = m.tk_spend(w, "pass", 0, "three-leg")
        self.assertEqual((w["balance"], line["amount"], w["passes"]["three-leg"]), (40, -60, 7 * 86400000))
        self.assertIn("3-Leg Options pass", line["note"])
        with self.assertRaises(m.TWError):
            m.tk_spend(dict(m.tk_new_wallet(0), balance=59), "pass", 0, "three-leg")


if __name__ == "__main__":
    unittest.main(verbosity=1)
