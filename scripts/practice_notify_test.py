"""Unit tests for the 2026-11-14 practice changes: "Today" options, options on the day-trading
stocks only, option move alerts (20/50/80/100% since opened) and the push notification text.
python3 scripts/practice_notify_test.py"""
import os
import sys
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import options as OPT  # noqa: E402
import practice as PR  # noqa: E402

NY = ZoneInfo("America/New_York")
FAST = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "AMD", "SPY", "QQQ"]


def at(day, hh, mm):
    return int(datetime.strptime("%s %02d:%02d" % (day, hh, mm), "%Y-%m-%d %H:%M").replace(tzinfo=NY).timestamp() * 1000)


def acct(**kw):
    a = {"cash": 10000.0, "positions": {}, "options": {}, "orders": {}, "openOrders": 0}
    a.update(kw)
    return a


class Today(unittest.TestCase):
    def test_listed_on_a_trading_day_until_30_minutes_before_the_close(self):
        self.assertEqual(PR.listed_expirations(at("2026-11-16", 10, 0))[0], "2026-11-16")  # a Monday
        self.assertEqual(PR.listed_expirations(at("2026-11-16", 15, 29))[0], "2026-11-16")
        self.assertNotIn("2026-11-16", PR.listed_expirations(at("2026-11-16", 15, 30)))
        self.assertNotIn("2026-11-15", PR.listed_expirations(at("2026-11-15", 11, 0)))  # Sunday
        self.assertNotIn("2026-11-26", PR.listed_expirations(at("2026-11-26", 11, 0)))  # Thanksgiving
        # the weekly ones are still there
        self.assertIn("2026-11-20", PR.listed_expirations(at("2026-11-16", 10, 0)))

    def test_priced_on_the_minutes_left_so_it_decays_through_the_day(self):
        day, close = "2026-11-16", PR.today_close_ms("2026-11-16")
        morning = OPT.quote("call", 100, 100, day, day, 0.4, at(day, 10, 0), close)["mid"]
        late = OPT.quote("call", 100, 100, day, day, 0.4, at(day, 15, 45), close)["mid"]
        week = OPT.quote("call", 100, 100, "2026-11-20", day, 0.4)["mid"]
        self.assertGreater(morning, late)
        self.assertGreater(week, morning)
        # without a time it falls back to the old half-day rule (the website and old callers)
        self.assertEqual(OPT.quote("call", 100, 100, day, day, 0.4)["dte"], 0)

    def test_worth_intrinsic_after_the_close(self):
        day = "2026-11-16"
        pos = {"u": "AAPL", "kind": "call", "strike": 100, "exp": day, "qty": 1, "avg": 1.0}
        self.assertEqual(OPT.value(pos, 103, 0.4, day, at(day, 16, 1), PR.today_close_ms(day)), 3)

    def test_early_close(self):
        self.assertEqual(datetime.fromtimestamp(PR.today_close_ms("2026-11-27") / 1000, NY).hour, 13)  # day after Thanksgiving


class FastOnly(unittest.TestCase):
    def req(self, u, side="buy"):
        return {"kind": "option", "u": u, "type": "call", "strike": 100.0, "exp": "2026-11-20", "side": side, "qty": 1}

    def test_buying_options_on_a_long_term_stock_is_refused(self):
        with self.assertRaises(PR.OrderError) as e:
            PR.validate_option_order(acct(), self.req("TSLA"), 100.0, 0.4, ["TSLA", "AAPL"], at("2026-11-16", 10, 0), "o1", fast=FAST)
        self.assertIn("day-trading stocks", str(e.exception))

    def test_a_fast_stock_is_fine_and_today_can_be_bought(self):
        r = dict(self.req("AAPL"), exp="2026-11-16")
        o = PR.validate_option_order(acct(), r, 100.0, 0.4, ["AAPL"], at("2026-11-16", 10, 0), "o1", fast=FAST)
        self.assertEqual(o["contract"]["exp"], "2026-11-16")
        with self.assertRaises(PR.OrderError) as e:
            PR.validate_option_order(acct(), r, 100.0, 0.4, ["AAPL"], at("2026-11-16", 15, 40), "o2", fast=FAST)
        self.assertIn("30 minutes before the close", str(e.exception))

    def test_contracts_already_held_on_other_stocks_can_still_be_sold(self):
        cid = OPT.contract_id("TSLA", "call", 100.0, "2026-11-20")
        a = acct(options={cid: {"u": "TSLA", "kind": "call", "strike": 100.0, "exp": "2026-11-20", "qty": 2, "avg": 1.0}})
        o = PR.validate_option_order(a, self.req("TSLA", "sell"), 100.0, 0.4, ["TSLA"], at("2026-11-16", 10, 0), "o1", fast=FAST)
        self.assertEqual(o["side"], "sell")


class Moves(unittest.TestCase):
    def pos(self, avg, exp="2026-11-20"):
        return {"u": "NVDA", "kind": "call", "strike": 200.0, "exp": exp, "qty": 2, "avg": avg, "label": "NVDA $200 Call 11/20"}

    def test_each_level_once_and_only_the_furthest_when_it_jumps(self):
        now = at("2026-11-16", 11, 0)
        mark = OPT.value(self.pos(1), 200, 0.4, "2026-11-16", now, PR.today_close_ms("2026-11-16"))
        a = acct(options={"X": self.pos(mark / 1.25)})  # up 25%: the 20% level
        m = PR.option_moves(a, {"NVDA": 200}, {"NVDA": 0.4}, now)
        self.assertEqual([x["level"] for x in m], [20])
        self.assertEqual(PR.option_moves(a, {"NVDA": 200}, {"NVDA": 0.4}, now), [])  # not again
        a["options"]["X"]["avg"] = mark / 2.2  # now up 120%: only "up 100%" is sent
        self.assertEqual([x["level"] for x in PR.option_moves(a, {"NVDA": 200}, {"NVDA": 0.4}, now)], [100])
        self.assertEqual(a["options"]["X"]["moves"], [20, 50, 80, 100])

    def test_losses(self):
        now = at("2026-11-16", 11, 0)
        a = acct(options={"X": self.pos(50.0)})  # far out of the money: nearly worthless
        m = PR.option_moves(a, {"NVDA": 150}, {"NVDA": 0.4}, now)
        self.assertEqual(m[0]["level"], -100)
        self.assertLess(m[0]["pct"], -99)


class Notes(unittest.TestCase):
    def test_buy_confirmation_has_the_entry(self):
        t, b, p = PR.fill_note({"kind": "fill", "side": "buy", "sym": "AAPL", "qty": 5, "price": 187.2, "orderId": "o1"})
        self.assertEqual(t, "Bought 5 AAPL at $187.20")
        self.assertIn("Your entry: $187.20 a share, $936.00 in all", b)
        self.assertEqual(p, "app/practice/trade/AAPL")
        t, b, p = PR.fill_note({"kind": "fill", "side": "buy", "sym": "NVDA", "opt": "NVDA|20261120|C|20000", "label": "NVDA $200 Call 11/20", "qty": 2, "price": 3.2})
        self.assertEqual(t, "Bought 2 NVDA $200 Call 11/20 at $3.20")
        self.assertIn("$640.00 for 2 contracts", b)
        self.assertEqual(p, "app/options/NVDA?pos=NVDA%7C20261120%7CC%7C20000")
        self.assertIsNone(PR.fill_note({"kind": "fill", "side": "sell", "sym": "AAPL", "qty": 1, "price": 1}))

    def test_closed_trade_opens_its_card(self):
        t, b, p = PR.trade_note({"kind": "trade", "hid": "h123", "trade": {"sym": "AAPL", "pnl": 84.2, "pct": 5.23, "entry": 180, "exit": 189.47, "openDay": "2026-11-10", "closeDay": "2026-11-13"}})
        self.assertEqual(t, "Closed AAPL: +$84.20 (+5.2%)")
        self.assertIn("held 3 days", b)
        self.assertEqual(p, "app/dashboard?share=h123")

    def test_move_text(self):
        t, b, p = PR.move_note({"cid": "X|1", "label": "NVDA $200 Call 11/20", "u": "NVDA", "level": -50, "pct": -52.4, "avg": 4.0, "mark": 1.9, "qty": 2})
        self.assertEqual(t, "NVDA $200 Call 11/20 is down 50%")
        self.assertIn("$4.00 → $1.90 a share (-52%), -$420.00 on 2 contracts", b)


if __name__ == "__main__":
    unittest.main()
