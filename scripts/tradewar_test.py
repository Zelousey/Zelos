"""Tests for the Trade War match engine in functions/main.py (the pure parts:
validation, trades, revaluation, ranking, price freshness).

    python3 -m unittest discover -s scripts -p "*_test.py"

firebase_functions / firebase_admin are stubbed, so no Firebase install is needed.
"""
import os
import sys
import types
import unittest
from datetime import datetime, timezone

_deco = lambda *a, **k: (lambda f: f)
_ff = types.ModuleType("firebase_functions")
_ff.https_fn = types.SimpleNamespace(on_request=_deco, on_call=_deco, Request=object, Response=object,
                                     CallableRequest=object, HttpsError=Exception,
                                     FunctionsErrorCode=types.SimpleNamespace())
_ff.scheduler_fn = types.SimpleNamespace(on_schedule=_deco, Timezone=lambda z: z, ScheduledEvent=object)
_fa = types.ModuleType("firebase_admin")
_fa.initialize_app = lambda: None
_fa.auth = None
_fa.firestore = types.SimpleNamespace(transactional=lambda f: f, client=lambda: None)
sys.modules.setdefault("firebase_functions", _ff)
sys.modules.setdefault("firebase_admin", _fa)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import main as m  # noqa: E402

T0 = 1_760_000_000_000


class CreateValidation(unittest.TestCase):
    def ok(self, **kw):
        d = {"name": "Friday Fight", "buyIn": 500, "days": 7, "maxPlayers": 4}
        d.update(kw)
        return m.tw_validate_create(d)

    def bad(self, **kw):
        with self.assertRaises(m.TWError):
            self.ok(**kw)

    def test_accepts_examples_from_spec(self):
        for b in (100, 500, 1000):
            self.assertEqual(self.ok(buyIn=b)[1], b)

    def test_rejects_bad_buy_ins(self):
        for b in (0, 50, 150, 100100, -500, "lots", None):
            self.bad(buyIn=b)

    def test_rejects_bad_lengths_and_sizes(self):
        self.bad(days=2)
        self.bad(maxPlayers=1)
        self.bad(maxPlayers=51)
        self.bad(name="   ")

    def test_strips_markup_and_trims_name(self):
        self.assertEqual(self.ok(name="<b>War</b>" + "x" * 60)[0], "bWar/b" + "x" * 34)


class Trading(unittest.TestCase):
    def setUp(self):
        self.a = m.tw_new_account("Amy", 1000, T0)
        self.b = m.tw_new_book()

    def test_everyone_starts_with_the_buy_in(self):
        for buy_in in (100, 500, 1000):
            a = m.tw_new_account("X", buy_in, T0)
            self.assertEqual((a["start"], a["cash"], a["equity"], a["pnl"]), (buy_in, buy_in, buy_in, 0.0))

    def test_buy_then_sell_for_a_win(self):
        a, b, f = m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 4, 100.0, T0)
        self.assertEqual((a["cash"], b["positions"]["AAPL"]), (600.0, {"qty": 4, "avg": 100.0}))
        a, b, f = m.tw_apply_trade(a, b, "AAPL", "sell", 4, 110.0, T0 + 5000)
        self.assertEqual((a["cash"], a["realized"], a["wins"], a["losses"], a["trades"]), (1040.0, 40.0, 1, 0, 2))
        self.assertNotIn("AAPL", b["positions"])
        self.assertEqual(f["pnl"], 40.0)

    def test_losing_sell_counts_a_loss(self):
        a, b, _ = m.tw_apply_trade(self.a, self.b, "MSFT", "buy", 2, 200.0, T0)
        a, b, _ = m.tw_apply_trade(a, b, "MSFT", "sell", 1, 150.0, T0 + 2000)
        self.assertEqual((a["losses"], a["realized"], b["positions"]["MSFT"]["qty"]), (1, -50.0, 1))

    def test_average_cost(self):
        a, b, _ = m.tw_apply_trade(self.a, self.b, "NVDA", "buy", 1, 100.0, T0)
        a, b, _ = m.tw_apply_trade(a, b, "NVDA", "buy", 3, 120.0, T0 + 2000)
        self.assertEqual(b["positions"]["NVDA"], {"qty": 4, "avg": 115.0})

    def test_cannot_spend_more_than_match_cash(self):
        with self.assertRaises(m.TWError) as e:
            m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 11, 100.0, T0)
        self.assertEqual(e.exception.code, "FAILED_PRECONDITION")

    def test_can_spend_exactly_all_cash(self):
        a, _, _ = m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 10, 100.0, T0)
        self.assertEqual(a["cash"], 0.0)

    def test_long_only_no_short_selling(self):
        with self.assertRaises(m.TWError):
            m.tw_apply_trade(self.a, self.b, "AAPL", "sell", 1, 100.0, T0)

    def test_quantity_must_be_whole_positive(self):
        for q in (0, -1, 1.5, "3", True, None, 10**7):
            with self.assertRaises(m.TWError):
                m.tw_apply_trade(self.a, self.b, "AAPL", "buy", q, 10.0, T0)

    def test_no_price_no_trade(self):
        for p in (None, 0, -5):
            with self.assertRaises(m.TWError):
                m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 1, p, T0)

    def test_one_trade_per_second(self):
        a, b, _ = m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 1, 10.0, T0)
        with self.assertRaises(m.TWError) as e:
            m.tw_apply_trade(a, b, "AAPL", "buy", 1, 10.0, T0 + 500)
        self.assertEqual(e.exception.code, "RESOURCE_EXHAUSTED")

    def test_inputs_are_not_mutated(self):
        a0, b0 = dict(self.a), {"positions": {}, "fills": []}
        m.tw_apply_trade(self.a, self.b, "AAPL", "buy", 1, 10.0, T0)
        self.assertEqual((self.a, self.b), (a0, b0))

    def test_fill_history_is_capped(self):
        a, b = self.a, self.b
        b = {"positions": {}, "fills": [{"i": i} for i in range(m.TW_MAX_FILLS)]}
        a, b, _ = m.tw_apply_trade(a, b, "AAPL", "buy", 1, 1.0, T0)
        self.assertEqual(len(b["fills"]), m.TW_MAX_FILLS)


class MarkAndRank(unittest.TestCase):
    def test_mark_uses_live_prices_then_cost(self):
        a = m.tw_new_account("A", 1000, T0)
        a, b, _ = m.tw_apply_trade(a, m.tw_new_book(), "AAPL", "buy", 5, 100.0, T0)
        a, b, _ = m.tw_apply_trade(a, b, "MSFT", "buy", 1, 200.0, T0 + 2000)
        a = m.tw_mark(a, b, {"AAPL": 110.0}, T0 + 9000)  # no MSFT price: valued at cost
        self.assertEqual((a["equity"], a["pnl"], a["pnlPct"]), (1050.0, 50.0, 5.0))

    def test_rank_by_percent(self):
        rows = m.tw_rank([{"uid": "a", "pnlPct": 1.0, "pnl": 10}, {"uid": "b", "pnlPct": 5.0, "pnl": 25},
                          {"uid": "c", "pnlPct": -2.0, "pnl": -20}])
        self.assertEqual([(r["uid"], r["rank"]) for r in rows], [("b", 1), ("a", 2), ("c", 3)])


class Prices(unittest.TestCase):
    class DB:
        def __init__(self, doc):
            self.doc = doc

        def collection(self, _):
            return self

        def document(self, _):
            return self

        def get(self):
            d = self.doc
            return types.SimpleNamespace(exists=d is not None, to_dict=lambda: d)

    def doc(self, age_s, open_=True):
        now = datetime(2026, 10, 1, 15, 0, tzinfo=timezone.utc)
        upd = datetime.fromtimestamp(now.timestamp() - age_s, timezone.utc).isoformat()
        return now.timestamp(), {"updatedAt": upd, "marketOpen": open_, "quotes": {"AAPL": {"c": 101.5}, "BAD": {"c": None}}}

    def test_fresh_open_market_is_tradable(self):
        now, d = self.doc(30)
        prices, ok, _ = m._tw_prices(self.DB(d), now)
        self.assertTrue(ok)
        self.assertEqual(prices, {"AAPL": 101.5})

    def test_closed_or_stale_is_not_tradable(self):
        now, d = self.doc(30, open_=False)
        self.assertFalse(m._tw_prices(self.DB(d), now)[1])
        now, d = self.doc(m.TW_QUOTE_MAX_AGE_S + 60)
        self.assertFalse(m._tw_prices(self.DB(d), now)[1])
        self.assertFalse(m._tw_prices(self.DB(None), now)[1])


if __name__ == "__main__":
    unittest.main()
