"""Unit tests for functions/practice.py (the server-side practice account engine).
Run: python3 scripts/practice_test.py"""
import os
import re
import sys
import unittest
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import practice as P  # noqa: E402

NY = P.NY
UNI = {"AAPL", "MSFT", "SPY"}


def ms(day, hhmm):
    return int(datetime.strptime(day + " " + hhmm, "%Y-%m-%d %H:%M").replace(tzinfo=NY).timestamp() * 1000)


def bar(day, hhmm, o, h, l, c):
    return [day + " " + hhmm, o, h, l, c, 1000]


D = "2026-10-07"  # a Wednesday


def order(acct, now, **req):
    o = P.validate_order(acct, req, req.pop("_last", 100.0), UNI, now, req.pop("_id", "o%d" % (len(acct["orders"]) + now % 1000)))
    P.add_order(acct, o)
    return o


class Validation(unittest.TestCase):
    def setUp(self):
        self.a = P.new_account(ms(D, "10:00"))

    def bad(self, msg, **req):
        with self.assertRaisesRegex(P.OrderError, msg):
            P.validate_order(self.a, req, req.pop("_last", 100.0), UNI, ms(D, "10:00"), "x1abcd")

    def test_rejects_bad_input(self):
        self.bad("stock list", sym="NOPE", side="buy", qty=1)
        self.bad("stock list", sym="<script>", side="buy", qty=1)
        self.bad("Buy or Sell", sym="AAPL", side="short", qty=1)
        self.bad("whole number", sym="AAPL", side="buy", qty=1.5)
        self.bad("whole number", sym="AAPL", side="buy", qty="abc")
        self.bad("between 1", sym="AAPL", side="buy", qty=0)
        self.bad("order type", sym="AAPL", side="buy", qty=1, type="trailing")
        self.bad("valid limit", sym="AAPL", side="buy", qty=1, type="limit", limit=-5)
        self.bad("too far", sym="AAPL", side="buy", qty=1, type="limit", limit=1000)
        self.bad("no price", sym="AAPL", side="buy", qty=1, _last=None)

    def test_buying_power_includes_open_orders(self):
        order(self.a, ms(D, "10:00"), sym="AAPL", side="buy", qty=60, type="limit", limit=100)  # $6,000 reserved
        self.bad("Not enough buying power", sym="MSFT", side="buy", qty=50)  # $5,000 more
        P.validate_order(self.a, {"sym": "MSFT", "side": "buy", "qty": 40}, 100.0, UNI, ms(D, "10:00"), "x2abcd")

    def test_no_shorting_and_reserved_sells(self):
        self.bad("don't own", sym="AAPL", side="sell", qty=1)
        self.a["positions"]["AAPL"] = {"qty": 10, "avg": 100.0, "openedDay": D}
        order(self.a, ms(D, "10:00"), sym="AAPL", side="sell", qty=6, type="limit", limit=110)
        self.bad("up to 4", sym="AAPL", side="sell", qty=5)

    def test_bracket_rules(self):
        self.bad("below the entry", sym="AAPL", side="buy", qty=1, bracket={"sl": 105, "tp": 120})
        self.bad("above the entry", sym="AAPL", side="buy", qty=1, bracket={"sl": 90, "tp": 95})
        self.bad("attached to buy", sym="AAPL", side="sell", qty=1, bracket={"sl": 90})
        o = P.validate_order(self.a, {"sym": "AAPL", "side": "buy", "qty": 1, "bracket": {"sl": 95, "tp": ""}}, 100.0, UNI, ms(D, "10:00"), "x3abcd")
        self.assertEqual(o["bracket"], {"sl": 95.0, "tp": None})

    def test_after_close_order_belongs_to_next_session(self):
        o = P.validate_order(self.a, {"sym": "AAPL", "side": "buy", "qty": 1}, 100.0, UNI, ms("2026-10-09", "17:00"), "x4abcd")  # Friday evening
        self.assertEqual(o["session"], "2026-10-12")  # Monday


class Fills(unittest.TestCase):
    def setUp(self):
        self.a = P.new_account(ms(D, "09:00"))

    def test_market_order_fills_after_it_was_placed_never_before(self):
        order(self.a, ms(D, "10:05"), sym="AAPL", side="buy", qty=10, _id="mkt001")
        bars = {"AAPL": [bar(D, "09:45", 90, 91, 89, 90), bar(D, "10:00", 100, 101, 99, 100.5), bar(D, "10:15", 102, 103, 101, 102)]}
        # at 10:10 the 10:00 bar is still in progress: nothing fills
        self.assertEqual(P.process_orders(self.a, {}, bars, ms(D, "10:10")), [])
        # at 10:16: the order arrived mid 10:00 bar -> fills at that bar's close (100.5), never the 09:45 price
        ev = P.process_orders(self.a, {}, bars, ms(D, "10:16"))
        self.assertEqual(self.a["positions"]["AAPL"]["qty"], 10)
        self.assertAlmostEqual(self.a["positions"]["AAPL"]["avg"], 100.5)
        self.assertAlmostEqual(self.a["cash"], 10000 - 1005)
        self.assertEqual([e["kind"] for e in ev], ["order", "fill"])

    def test_limit_needs_a_later_bar_to_touch(self):
        order(self.a, ms(D, "10:05"), sym="AAPL", side="buy", qty=1, type="limit", limit=95, _id="lim001")
        # the 10:00 bar's low (94) may have happened before 10:05: it must not fill from it
        bars = {"AAPL": [bar(D, "10:00", 100, 101, 94, 99), bar(D, "10:15", 99, 99.5, 96, 97)]}
        P.process_orders(self.a, {}, bars, ms(D, "10:31"))
        self.assertEqual(self.a["positions"], {})
        bars["AAPL"].append(bar(D, "10:30", 96, 97, 94.5, 95.5))
        P.process_orders(self.a, {}, bars, ms(D, "10:46"))
        self.assertAlmostEqual(self.a["positions"]["AAPL"]["avg"], 95.0)

    def test_gap_fills_at_the_open(self):
        order(self.a, ms(D, "10:05"), sym="AAPL", side="buy", qty=1, type="limit", limit=95, _id="lim002")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:15", 93, 94, 92, 93)]}, ms(D, "10:31"))
        self.assertAlmostEqual(self.a["positions"]["AAPL"]["avg"], 93.0)

    def test_bracket_take_profit_then_stop_cancelled(self):
        order(self.a, ms(D, "09:40"), sym="AAPL", side="buy", qty=10, bracket={"sl": 95, "tp": 110}, _id="brk001")
        bars = {"AAPL": [bar(D, "09:45", 100, 101, 99, 100), bar(D, "10:00", 100, 111, 99, 110.5)]}
        ev = P.process_orders(self.a, {}, bars, ms(D, "10:16"))
        self.assertEqual(self.a["positions"], {})
        self.assertAlmostEqual(self.a["cash"], 10000 + 10 * (110 - 100))
        self.assertEqual(self.a["orders"], {})
        cancelled = [e["order"] for e in ev if e["kind"] == "order" and e["order"]["status"] == "cancelled"]
        self.assertEqual([o["role"] for o in cancelled], ["sl"])
        self.assertEqual(self.a["life"]["tpExits"], 1)
        self.assertEqual(self.a["stats"]["wins"], 1)

    def test_stop_loss_fills_at_stop_or_gap(self):
        self.a["positions"]["AAPL"] = {"qty": 5, "avg": 100.0, "openedDay": D}
        self.a["cash"] = 9500.0
        order(self.a, ms(D, "10:05"), sym="AAPL", side="sell", qty=5, type="stop", stop=95, _id="stp001")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:15", 94, 94.5, 90, 91)]}, ms(D, "10:31"))
        self.assertAlmostEqual(self.a["cash"], 9500 + 5 * 94)  # gapped below the stop: fills at the open
        self.assertEqual(self.a["stats"]["losses"], 1)

    def test_manual_sell_shrinks_bracket(self):
        order(self.a, ms(D, "09:40"), sym="AAPL", side="buy", qty=10, bracket={"sl": 90, "tp": 120}, _id="brk002")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "09:45", 100, 101, 99, 100)]}, ms(D, "10:01"))
        self.assertEqual(len(self.a["orders"]), 2)
        order(self.a, ms(D, "10:02"), sym="AAPL", side="sell", qty=4, _id="sel001")  # allowed: bracket exits don't block it
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:15", 101, 102, 100, 101)]}, ms(D, "10:31"))
        self.assertEqual(self.a["positions"]["AAPL"]["qty"], 6)
        self.assertEqual(sorted(o["qty"] for o in self.a["orders"].values()), [6, 6])

    def test_insufficient_cash_at_trigger_is_rejected(self):
        order(self.a, ms(D, "10:05"), sym="AAPL", side="buy", qty=99, type="stop", stop=101, _id="stp002")
        P.process_orders(self.a, {}, {"AAPL": [bar(D, "10:15", 150, 151, 149, 150)]}, ms(D, "10:31"))  # gaps to 150: 99*150 > cash
        self.assertEqual(self.a["positions"], {})
        self.assertAlmostEqual(self.a["cash"], 10000)
        self.assertEqual(self.a["orders"], {})

    def test_day_order_expires_gtc_survives(self):
        order(self.a, ms(D, "15:00"), sym="AAPL", side="buy", qty=1, type="limit", limit=50, tif="day", _id="day001")
        order(self.a, ms(D, "15:00"), sym="MSFT", side="buy", qty=1, type="limit", limit=50, tif="gtc", _id="gtc001")
        ev = P.process_orders(self.a, {}, {}, ms(D, "16:06"))
        self.assertEqual(list(self.a["orders"]), ["gtc001"])
        self.assertEqual(ev[0]["order"]["status"], "expired")

    def test_after_hours_market_order_waits_for_the_open(self):
        order(self.a, ms(D, "18:00"), sym="AAPL", side="buy", qty=1, _id="mkt002")
        nxt = "2026-10-08"
        bars = {"AAPL": [bar(D, "15:45", 80, 81, 79, 80), bar(nxt, "09:30", 105, 106, 104, 105.5)]}
        P.process_orders(self.a, {}, bars, ms(nxt, "09:46"))
        self.assertAlmostEqual(self.a["positions"]["AAPL"]["avg"], 105.0)

    def test_quote_fallback_only_if_newer_than_order(self):
        order(self.a, ms(D, "10:05"), sym="SPY", side="buy", qty=1, _id="mkt003")
        P.process_orders(self.a, {"SPY": {"c": 500, "t": ms(D, "10:00") // 1000}}, {}, ms(D, "10:20"))
        self.assertEqual(self.a["positions"], {})
        P.process_orders(self.a, {"SPY": {"c": 501, "t": ms(D, "10:15") // 1000}}, {}, ms(D, "10:20"))
        self.assertAlmostEqual(self.a["positions"]["SPY"]["avg"], 501)


class AccountLifecycle(unittest.TestCase):
    def test_cancel_and_reset(self):
        a = P.new_account(ms(D, "09:00"))
        order(a, ms(D, "10:00"), sym="AAPL", side="buy", qty=1, type="limit", limit=90, _id="can001")
        P.cancel_order(a, "can001", ms(D, "10:01"))
        self.assertEqual(a["openOrders"], 0)
        with self.assertRaises(P.OrderError):
            P.cancel_order(a, "can001", ms(D, "10:01"))
        with self.assertRaisesRegex(P.OrderError, "below"):
            P.reset_account(a, 9000, ms(D, "10:01"))
        a["stats"]["trades"] = 7
        b, _ = P.reset_account(a, 2000, ms(D, "10:02"))
        self.assertEqual((b["cash"], b["resets"], b["epoch"], b["stats"]["trades"]), (10000, 1, 1, 7))
        self.assertEqual(b["resetHistory"][-1]["equityBefore"], 2000)
        self.assertAlmostEqual(P.net_pnl(b, 10000), -8000)  # the loss before the reset still counts

    def test_profile_shape_and_periods(self):
        a = P.new_account(ms(D, "09:00"))
        order(a, ms(D, "09:40"), sym="AAPL", side="buy", qty=10, bracket={"tp": 110}, _id="pro001")
        P.process_orders(a, {}, {"AAPL": [bar(D, "09:45", 100, 101, 99, 100), bar(D, "10:00", 100, 111, 99, 110)]}, ms(D, "10:16"))
        P.mark(a, P.equity(a, {}), ms(D, "10:16"), 120)
        prof = P.build_profile(a, P.equity(a, {}), ms(D, "10:16"), {"name": "Ada", "username": "ada", "photo": None}, 120, {"achievements": ["first-win", 5], "streak": 3})
        for k in ("name", "equity", "growthPct", "trades", "wins", "winRate", "bestTrades", "topStocks", "p", "h", "xp", "level", "netPnl", "tradeStreak"):
            self.assertIn(k, prof)
        self.assertEqual((prof["equity"], prof["trades"], prof["winRate"], prof["level"], prof["source"]), (10100, 1, 100, 2, "server"))
        self.assertEqual(prof["achievements"], ["first-win"])
        self.assertIn("w2026_41", prof["p"])
        self.assertIn("s1", prof["p"])
        self.assertEqual(prof["tradeStreak"], 1)

    def test_archive_is_sanitised(self):
        arc = P.archive_classic({"cash": 1e9, "summary": {"equity": 1e9}, "trades": [{"sym": "AAPL", "pnl": "x"}, {"sym": "MSFT", "pnl": 5, "qty": 1}, "junk"]})
        self.assertFalse(arc["verified"])
        self.assertEqual([t["sym"] for t in arc["trades"]], ["MSFT"])
        self.assertIsNone(P.archive_classic("nope"))


class MatchesTheBrowser(unittest.TestCase):
    def read(self, rel):
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            return f.read()

    def test_seasons_match_zelos_progress(self):
        src = self.read("zelos-progress.js")
        for sid, a, b in P.SEASONS:
            self.assertRegex(src, r"id: '%s'[^}]*start: '%s', end: '%s'" % (sid, a, b))

    def test_levels_match_zelos_levels(self):
        src = self.read("zelos-levels.js")
        for lvl, xp, name in P.LEVELS:
            self.assertRegex(src, r"level: %d, xp: %d,\s+name: '%s'" % (lvl, xp, re.escape(name)))

    def test_constants_match_classic_page(self):
        src = self.read("practice/practice.js")
        self.assertIn("START_CASH = 10000, RESET_BELOW = 2500", src)


if __name__ == "__main__":
    unittest.main()
