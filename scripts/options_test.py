"""Unit tests for practice-account options (functions/options.py + practice.py).
Run: python3 scripts/options_test.py"""
import json
import os
import subprocess
import sys
import unittest
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import options as O  # noqa: E402
import practice as P  # noqa: E402

NY = P.NY
UNI = {"AAPL", "MSFT"}
D = "2026-10-07"  # a Wednesday
VOLS = {"AAPL": 0.3}


def ms(day, hhmm):
    return int(datetime.strptime(day + " " + hhmm, "%Y-%m-%d %H:%M").replace(tzinfo=NY).timestamp() * 1000)


def bar(day, hhmm, o, h, l, c):
    return [day + " " + hhmm, o, h, l, c, 1000]


def opt(acct, now, _id, **req):
    req = dict({"kind": "option", "u": "AAPL", "type": "call", "exp": "2026-11-20", "strike": 250, "side": "buy", "qty": 1}, **req)
    o = P.validate_option_order(acct, req, 250.0, 0.3, UNI, now, _id)
    P.add_order(acct, o)
    return o


class Model(unittest.TestCase):
    def test_same_numbers_as_the_website(self):
        """practice/practice-options.js and options.py must price every contract identically."""
        js = ("global.window={};require('./practice/practice-options.js');const O=window.ZelosOptions;"
              "const out=[];for(const [t,S,K,e,d,v] of %s){const q=O.quote(t,S,K,e,d,v);out.push([q.mid,q.bid,q.ask,+q.delta.toFixed(6),q.dte]);}"
              "console.log(JSON.stringify({q:out,e:O.expirations('2026-10-07'),s:O.strikes(252.3,15),v:+O.histVol([100,101,99,102,103,101,104,106,105,107,108,106,109]).toFixed(6)}))")
        cases = [["call", 250, 250, "2026-11-20", D, 0.3], ["put", 250, 240, "2026-10-16", D, 0.45], ["call", 18.4, 20, "2026-12-18", D, 0.9],
                 ["put", 612, 700, "2027-01-15", D, 0.2], ["call", 100, 80, D, D, 0.3]]
        try:
            out = json.loads(subprocess.run(["node", "-e", js % json.dumps(cases)], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            self.skipTest("node not available: %s" % e)
        for c, want in zip(cases, out["q"]):
            q = O.quote(*c)
            self.assertEqual([q["mid"], q["bid"], q["ask"], round(q["delta"], 6), q["dte"]], want, c)
        self.assertEqual(O.expirations(D), out["e"])
        self.assertEqual(O.strikes(252.3, 15), out["s"])
        self.assertAlmostEqual(O.hist_vol([100, 101, 99, 102, 103, 101, 104, 106, 105, 107, 108, 106, 109]), out["v"], places=6)

    def test_contract_ids(self):
        cid = O.contract_id("AAPL", "put", 22.5, "2026-11-20")
        self.assertEqual(cid, "AAPL|20261120|P|2250")
        self.assertEqual(O.parse_contract(cid), {"u": "AAPL", "exp": "2026-11-20", "kind": "put", "strike": 22.5})
        self.assertIsNone(O.parse_contract("AAPL|2026|P|1"))
        self.assertEqual(O.label({"u": "AAPL", "kind": "call", "strike": 250.0, "exp": "2026-11-20"}), "AAPL $250 Call 11/20")


class Orders(unittest.TestCase):
    def setUp(self):
        self.a = P.new_account(ms(D, "10:00"))

    def bad(self, msg, **req):
        req = dict({"kind": "option", "u": "AAPL", "type": "call", "exp": "2026-11-20", "strike": 250, "side": "buy", "qty": 1}, **req)
        with self.assertRaisesRegex(P.OrderError, msg):
            P.validate_option_order(self.a, req, 250.0, 0.3, UNI, ms(D, "10:00"), "x1abcd")

    def test_rejects_bad_input(self):
        self.bad("stock list", u="NOPE")
        self.bad("call or a put", type="straddle")
        self.bad("listed expiration", exp="2026-11-21")
        self.bad("listed expiration", exp="2026-10-02")
        self.bad("listed strike", strike=251)
        self.bad("whole number", qty=1.5)
        self.bad("between 1", qty=0)
        self.bad("between 1", qty=101)
        self.bad("don't hold", side="sell")
        self.bad("Not enough buying power", qty=20)  # ~$1,092 a contract

    def test_buy_fills_on_the_next_price_at_the_ask(self):
        o = opt(self.a, ms(D, "10:00"), "o1abcd", qty=2)
        self.assertAlmostEqual(P.reserved_cash(self.a, {"AAPL": 250}), o["est"])
        ev = P.process_orders(self.a, {}, {"AAPL": [bar(D, "09:59", 250, 250, 250, 250), bar(D, "10:01", 252, 253, 251, 252.5)]}, ms(D, "10:05"), 1, VOLS)
        fill = next(e for e in ev if e["kind"] == "fill")
        want = O.quote("call", 252, 250, "2026-11-20", D, 0.3)["ask"]  # the next bar's open, not the old price
        self.assertEqual(fill["price"], want)
        pos = self.a["options"]["AAPL|20261120|C|25000"]
        self.assertEqual((pos["qty"], pos["avg"]), (2, want))
        self.assertAlmostEqual(self.a["cash"], round(10000 - want * 200, 2))
        self.assertEqual(self.a["life"]["optionFills"], 1)
        # the account's value counts the contracts at the model mid
        eq = P.equity(self.a, {"AAPL": 252}, VOLS, ms(D, "10:05"))
        self.assertAlmostEqual(eq, round(self.a["cash"] + 200 * O.quote("call", 252, 250, "2026-11-20", D, 0.3)["mid"], 2))

    def test_sell_to_close_at_the_bid_records_the_trade(self):
        opt(self.a, ms(D, "10:00"), "o1abcd")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:01", 250, 250, 250, 250)]}, ms(D, "10:05"), 1, VOLS)
        buy = self.a["options"]["AAPL|20261120|C|25000"]["avg"]
        opt(self.a, ms(D, "11:00"), "o2abcd", side="sell")
        self.bad("up to 0", side="sell")  # the open sell order holds it
        ev = P.process_orders(self.a, {}, {"AAPL": [bar(D, "11:01", 260, 261, 259, 260)]}, ms(D, "11:05"), 1, VOLS)
        trade = next(e["trade"] for e in ev if e["kind"] == "trade")
        bid = O.quote("call", 260, 250, "2026-11-20", D, 0.3)["bid"]
        self.assertEqual((trade["kind"], trade["exit"], trade["label"]), ("option", bid, "AAPL $250 Call 11/20"))
        self.assertAlmostEqual(trade["pnl"], round((bid - buy) * 100, 2))
        self.assertEqual(self.a["options"], {})
        self.assertEqual(self.a["stats"]["wins"], 1)

    def test_stock_sells_leave_option_orders_alone(self):
        opt(self.a, ms(D, "10:00"), "o1abcd")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:01", 250, 250, 250, 250)]}, ms(D, "10:05"), 1, VOLS)
        o = opt(self.a, ms(D, "10:30"), "o2abcd", side="sell")
        self.a["positions"]["AAPL"] = {"qty": 5, "avg": 240.0, "openedDay": D}
        so = P.validate_order(self.a, {"sym": "AAPL", "side": "sell", "qty": 5, "type": "limit", "limit": 999}, 250.0, UNI, ms(D, "10:30"), "s1abcd")
        P.add_order(self.a, so)
        P.fill(self.a, so, 251.0, ms(D, "10:31"), [])
        self.assertIn(o["id"], self.a["orders"])  # the option sell is still open

    def test_expiry_settles_at_intrinsic_value(self):
        a = P.new_account(ms(D, "10:00"))
        o = P.validate_option_order(a, {"kind": "option", "u": "AAPL", "type": "put", "exp": "2026-10-09", "strike": 250, "side": "buy", "qty": 1}, 250.0, 0.3, UNI, ms(D, "10:00"), "p1abcd")
        P.add_order(a, o)
        P.process_orders(a, {}, {"AAPL": [bar(D, "10:01", 250, 250, 250, 250)]}, ms(D, "10:05"), 1, VOLS)
        paid = a["options"]["AAPL|20261009|P|25000"]["avg"]
        self.assertEqual(P.settle_expired(a, {"AAPL": 240}, ms("2026-10-09", "15:00")), [])  # not until the close
        ev = P.settle_expired(a, {"AAPL": 240}, ms("2026-10-09", "16:10"))
        trade = next(e["trade"] for e in ev if e["kind"] == "trade")
        self.assertEqual((trade["exit"], trade["role"]), (10.0, "expired"))  # $250 put, stock at $240
        self.assertAlmostEqual(trade["pnl"], round((10 - paid) * 100, 2))
        self.assertEqual(a["options"], {})


if __name__ == "__main__":
    unittest.main()
