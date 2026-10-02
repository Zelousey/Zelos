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
        for b in (0, 50, 150, 10100, 100000, -500, "lots", None):
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


class BuyInLocks(unittest.TestCase):
    def test_small_buy_ins_are_open_to_everyone(self):
        for b in (100, 500, 1000):
            self.assertIsNone(m.tw_buyin_lock(b, 0))

    def test_5000_needs_gold(self):
        self.assertEqual(m.tw_buyin_lock(5000, 149), (3, 150, "Gold"))
        self.assertIsNone(m.tw_buyin_lock(5000, 150))
        self.assertEqual(m.tw_buyin_lock(2500, 0), (3, 150, "Gold"))  # custom amounts follow the tiers

    def test_10000_needs_diamond(self):
        self.assertEqual(m.tw_buyin_lock(10000, 999), (5, 1000, "Diamond"))
        self.assertIsNone(m.tw_buyin_lock(10000, 1000))
        self.assertEqual(m.tw_buyin_lock(6000, 500), (5, 1000, "Diamond"))


class ChallengeValidation(unittest.TestCase):
    ME = "me_uid_123"

    def v(self, **kw):
        d = {"to": "friend_uid_1", "buyIn": 500, "days": 7}
        d.update(kw)
        return m.tw_validate_challenge(d, self.ME)

    def test_one_friend_is_a_duel_target(self):
        targets, buy_in, days, name, squad, lms = self.v()
        self.assertIsNone(lms)
        self.assertEqual((targets, buy_in, days, squad), (["friend_uid_1"], 500, 7, None))
        self.assertEqual(name, "Head-to-head")

    def test_list_dedupes_and_drops_self(self):
        self.assertEqual(self.v(to=["a_uid_111", self.ME, "a_uid_111", "b_uid_222"])[0], ["a_uid_111", "b_uid_222"])

    def test_cannot_challenge_only_yourself(self):
        with self.assertRaises(m.TWError):
            self.v(to=self.ME)

    def test_rejects_bad_targets_and_too_many(self):
        for bad in (None, [], "x", ["../../etc"], [123], ["u" * 200]):
            with self.assertRaises(m.TWError):
                self.v(to=bad)
        with self.assertRaises(m.TWError):
            self.v(to=["uid_%04d" % i for i in range(m.TW_MAX_INVITEES + 1)])

    def test_same_buy_in_rules_as_create(self):
        for b in (150, 0, 20000):
            with self.assertRaises(m.TWError):
                self.v(buyIn=b)
        with self.assertRaises(m.TWError):
            self.v(days=2)

    def test_squad_challenge(self):
        targets, _, _, name, squad, _ = m.tw_validate_challenge({"squadId": "abcdefghijkm", "buyIn": 1000, "days": 3}, self.ME)
        self.assertEqual((targets, squad, name), ([], "abcdefghijkm", "Squad Trade War"))
        with self.assertRaises(m.TWError):
            m.tw_validate_challenge({"squadId": "bad id", "buyIn": 1000, "days": 3}, self.ME)


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


class LastManStanding(unittest.TestCase):
    def acct(self, pct, **kw):
        a = dict(m.tw_new_account("P", 1000, T0), pnlPct=pct, pnl=pct * 10)
        a.update(kw)
        return a

    def test_rules_validation(self):
        self.assertIsNone(m.tw_validate_lms({}, 7))
        self.assertIsNone(m.tw_validate_lms({"lms": {}}, 7))
        self.assertEqual(m.tw_validate_lms({"lms": {"floorPct": 10, "cutHours": 24, "maxLosses": 0}}, 7), {"floorPct": 10, "cutHours": 24})
        for bad in ({"floorPct": 11}, {"maxLosses": True}, {"cutHours": "24"}, {"floorPct": 0}, "on"):
            with self.assertRaises(m.TWError):
                m.tw_validate_lms({"lms": bad}, 7)
        with self.assertRaises(m.TWError):  # a cut every day in a 1-day match never happens
            m.tw_validate_lms({"lms": {"cutHours": 24}}, 1)
        self.assertEqual(m.tw_validate_lms({"lms": {"cutHours": 6}}, 1), {"cutHours": 6})

    def test_challenge_carries_the_rules(self):
        self.assertEqual(m.tw_validate_challenge({"to": "friend_uid_1", "buyIn": 500, "days": 3, "lms": {"maxLossPct": 5}}, "me_uid_123")[5], {"maxLossPct": 5})
        self.assertEqual(m.tw_validate_challenge({"to": "friend_uid_1", "buyIn": 500, "days": 3, "lms": {"maxLossPct": 5}}, "me_uid_123")[3], "Last Man Standing")

    def test_each_rule_knocks_you_out(self):
        self.assertEqual(m.tw_out_reason(self.acct(-10.0), {"floorPct": 10}), "floor")
        self.assertIsNone(m.tw_out_reason(self.acct(-9.99), {"floorPct": 10}))
        self.assertEqual(m.tw_out_reason(self.acct(0, worst=-51.0), {"maxLossPct": 5}), "bigLoss")
        self.assertIsNone(m.tw_out_reason(self.acct(0, worst=-50.0), {"maxLossPct": 5}))
        self.assertEqual(m.tw_out_reason(self.acct(0, losses=3), {"maxLosses": 3}), "losses")
        self.assertIsNone(m.tw_out_reason(self.acct(-50, out=True), {"floorPct": 10}))
        self.assertIsNone(m.tw_out_reason(self.acct(-50), None))

    def test_selling_tracks_the_worst_trade(self):
        a, b, _ = m.tw_apply_trade(m.tw_new_account("A", 1000, T0), m.tw_new_book(), "AAPL", "buy", 5, 100.0, T0)
        a, b, _ = m.tw_apply_trade(a, b, "AAPL", "sell", 5, 88.0, T0 + 2000)
        self.assertEqual(a["worst"], -60.0)
        self.assertEqual(m.tw_out_reason(a, {"maxLossPct": 5}), "bigLoss")

    def test_timed_cut_takes_last_place_only_when_due(self):
        accts = {"a": self.acct(3.0), "b": self.acct(-1.0), "c": self.acct(0.5)}
        self.assertEqual(m.tw_pick_outs(["a", "b", "c"], accts, {"cutHours": 6}, T0, T0 + 1), [])
        self.assertEqual(m.tw_pick_outs(["a", "b", "c"], accts, {"cutHours": 6}, T0, T0), [("b", "cut")])

    def test_cut_is_on_top_of_rule_breakers(self):
        accts = {"a": self.acct(3.0), "b": self.acct(-12.0), "c": self.acct(0.5), "d": self.acct(1.0)}
        self.assertEqual(m.tw_pick_outs(list(accts), accts, {"floorPct": 10, "cutHours": 6}, T0, T0), [("b", "floor"), ("c", "cut")])

    def test_never_knocks_out_everyone(self):
        accts = {"a": self.acct(-15.0), "b": self.acct(-11.0)}
        self.assertEqual(m.tw_pick_outs(["a", "b"], accts, {"floorPct": 10}, T0, None), [("a", "floor")])
        self.assertEqual(m.tw_pick_outs(["b"], {"b": self.acct(-11.0)}, {"floorPct": 10, "cutHours": 6}, T0, T0), [])

    def test_knock_out_sells_at_market_and_freezes(self):
        a, b, _ = m.tw_apply_trade(m.tw_new_account("A", 1000, T0), m.tw_new_book(), "AAPL", "buy", 5, 100.0, T0)
        a, b = m.tw_knock_out(a, b, {"AAPL": 80.0}, "floor", 3, T0 + 5000)
        self.assertEqual((a["cash"], a["equity"], a["pnlPct"], a["out"], a["place"], a["outReason"]), (900.0, 900.0, -10.0, True, 3, "floor"))
        self.assertEqual(b["positions"], {})
        self.assertTrue(b["fills"][-1]["auto"])

    def test_start_sets_everyone_alive_and_the_first_cut(self):
        f = m.tw_start_fields({"days": 3, "players": ["a", "b"], "lms": {"cutHours": 12}}, T0)
        self.assertEqual((f["alive"], f["outs"], f["nextCutAt"], f["endAt"]), (["a", "b"], [], T0 + 12 * 3600000, T0 + 3 * 86400000))
        self.assertNotIn("alive", m.tw_start_fields({"days": 3, "players": ["a", "b"]}, T0))

    def test_survivors_rank_above_the_knocked_out(self):
        rows = m.tw_rank([{"uid": "a", "pnlPct": -8.0, "pnl": -80}, {"uid": "b", "pnlPct": 9.0, "out": True, "place": 4},
                          {"uid": "c", "pnlPct": -2.0, "out": True, "place": 3}, {"uid": "d", "pnlPct": 1.0}])
        self.assertEqual([(r["uid"], r["rank"]) for r in rows], [("d", 1), ("a", 2), ("c", 3), ("b", 4)])


class SquadRules(unittest.TestCase):
    def test_copies_allowed_stocks_and_view_trades(self):
        syms = sorted(m.PRACTICE_SYMBOLS)[:2]
        self.assertEqual(m.tw_squad_rules({"symbols": [syms[0].lower(), syms[1], syms[0], "NOPE$"], "viewTrades": True, "photos": True}),
                         {"symbols": [syms[0], syms[1]], "viewTrades": True})

    def test_defaults_are_open(self):
        for c in (None, {}, "x", {"symbols": [], "viewTrades": "yes"}, {"symbols": ["NOPE$"]}):
            self.assertEqual(m.tw_squad_rules(c), {})


class AdvancedGameplay(unittest.TestCase):
    class R:  # deterministic rng
        def shuffle(self, x): x.reverse()
        def choice(self, x): return x[0]
        def random(self): return 0.0

    def test_modes_validation(self):
        self.assertEqual(m.tw_validate_modes({}, 7), {})
        self.assertEqual(m.tw_validate_modes({"modes": {"draftPicks": 3, "whaleCap": 50, "whaleShields": 2, "storms": "rare", "bounties": True}}, 7),
                         {"draft": {"picks": 3}, "whale": {"capPct": 50, "shields": 2}, "storms": "rare", "bounties": True})
        for bad in ({"draftPicks": 4}, {"whaleCap": 50}, {"whaleCap": 50, "whaleShields": 9}, {"storms": "always"}, {"bounties": "yes"}, "on"):
            with self.assertRaises(m.TWError):
                m.tw_validate_modes({"modes": bad}, 7)

    def test_snake_draft(self):
        d = m.tw_draft_new(["a", "b", "c"], 2, T0, self.R())
        self.assertEqual((d["order"], d["total"]), (["c", "b", "a"], 6))
        uni = ["AAPL", "AMZN", "MSFT", "NVDA", "TSLA", "META"]
        seq = []
        for sym in uni:
            seq.append(m.tw_draft_on_clock(d))
            d, _ = m.tw_draft_apply(d, sym, uni, T0)
        self.assertEqual(seq, ["c", "b", "a", "a", "b", "c"])
        self.assertEqual(d["picks"], {"c": ["AAPL", "META"], "b": ["AMZN", "TSLA"], "a": ["MSFT", "NVDA"]})
        with self.assertRaises(m.TWError):
            m.tw_draft_apply(d, "AAPL", uni, T0)  # draft over

    def test_draft_rejects_taken_and_unknown(self):
        uni = ["AAPL", "MSFT"]
        d = m.tw_draft_new(["a", "b"], 1, T0, self.R())
        d, _ = m.tw_draft_apply(d, "AAPL", uni, T0)
        for bad in ("AAPL", "ZZZZ"):
            with self.assertRaises(m.TWError):
                m.tw_draft_apply(d, bad, uni, T0)
        self.assertEqual(m.tw_draft_auto(d, uni, self.R()), "MSFT")

    def test_start_with_draft_and_whales(self):
        war = {"days": 3, "players": ["a", "b", "c"], "names": {}, "modes": {"draft": {"picks": 2}, "whale": {"capPct": 50, "shields": 1}}}
        f = m.tw_start_fields(war, T0, {"a": 900, "b": 10, "c": 50}, self.R())
        self.assertEqual((f["status"], f["whales"], f["shields"]), ("draft", ["a"], {"b": 1, "c": 1}))
        self.assertNotIn("startAt", f)
        with self.assertRaises(m.TWError):  # 30 players x 5 picks > the universe
            m.tw_start_fields(dict(war, players=["p%d" % i for i in range(30)], modes={"draft": {"picks": 5}}), T0)

    def test_whales_are_above_the_median(self):
        self.assertEqual(m.tw_whales(["a", "b"], {"a": 5, "b": 5}), [])
        self.assertEqual(m.tw_whales(["a", "b", "c", "d"], {"a": 1, "b": 2, "c": 3, "d": 400}), ["c", "d"])

    def test_whale_cap(self):
        a, b = m.tw_new_account("W", 1000, T0), m.tw_new_book()
        self.assertTrue(m.tw_whale_ok(a, b, {"AAPL": 100.0}, "AAPL", 5, 100.0, 50))
        self.assertFalse(m.tw_whale_ok(a, b, {"AAPL": 100.0}, "AAPL", 6, 100.0, 50))

    def test_storm_fee_and_double(self):
        a, b, _ = m.tw_apply_trade(m.tw_new_account("A", 1000, T0), m.tw_new_book(), "AAPL", "buy", 5, 100.0, T0, {"kind": "fee"})
        self.assertEqual(a["cash"], 495.0)  # 500 + 1% fee
        with self.assertRaises(m.TWError):
            m.tw_apply_trade(m.tw_new_account("A", 1000, T0), m.tw_new_book(), "AAPL", "buy", 10, 100.0, T0, {"kind": "fee"})
        a2, _, f = m.tw_apply_trade(a, b, "AAPL", "sell", 5, 110.0, T0 + 2000, {"kind": "double"})
        self.assertEqual((f["pnl"], a2["cash"], a2["realized"]), (100.0, 1095.0, 100.0))
        a3, _, f = m.tw_apply_trade(a, b, "AAPL", "sell", 5, 90.0, T0 + 2000, {"kind": "double"})
        self.assertEqual((f["pnl"], a3["cash"], a3["worst"]), (-100.0, 895.0, -100.0))

    def test_storm_roll(self):
        pick = lambda xs: xs[-1]
        st = m.tw_maybe_storm("rare", None, T0, T0 + 86400000, True, 0.0, pick, {"NVDA"})
        self.assertEqual((st["kind"], st["sym"], st["end"] - st["start"]), ("halt", "NVDA", m.TW_STORM_MS))
        self.assertIsNone(m.tw_maybe_storm("rare", None, T0, T0 + 86400000, False, 0.0, pick, set()))          # market closed
        self.assertIsNone(m.tw_maybe_storm("rare", None, T0, T0 + 86400000, True, 0.5, pick, set()))           # no luck
        self.assertIsNone(m.tw_maybe_storm(None, None, T0, T0 + 86400000, True, 0.0, pick, set()))             # storms off
        self.assertIsNone(m.tw_maybe_storm("rare", st, T0 + 60000, T0 + 86400000, True, 0.0, pick, set()))     # one at a time
        self.assertIsNone(m.tw_maybe_storm("rare", None, T0, T0 + 60000, True, 0.0, pick, set()))              # too close to the end
        self.assertIsNone(m.tw_maybe_storm("rare", st, st["end"] + 60000, T0 + 86400000, True, 0.0, pick, set()))  # calm spell
        self.assertIs(m.tw_storm_now(st, T0 + 1), st)
        self.assertIsNone(m.tw_storm_now(st, st["end"]))

    def war(self, **kw):
        w = {"players": ["s", "t", "h", "x"], "names": {"s": "Sam", "t": "Tia", "h": "Hal", "x": "Xi"}, "endAt": T0 + 3 * 86400000, "bounties": []}
        w.update(kw)
        return w

    def accts(self):
        return {u: dict(m.tw_new_account(u, 1000, T0), trades=1) for u in ("s", "t", "h", "x")}

    def test_bounty_rules(self):
        w, a = self.war(), self.accts()
        b = m.tw_new_bounty(w, a, "s", "t", 5, 6, T0, "b1")
        self.assertEqual((b["amount"], b["end"], b["status"], b["targetName"]), (50.0, T0 + 6 * 3600000, "open", "Tia"))
        bad = [("s", "s", 5, 6), ("s", "t", 3, 6), ("s", "t", 5, 12), ("s", "zz", 5, 6)]
        for by, tg, pct, hrs in bad:
            with self.assertRaises(m.TWError):
                m.tw_new_bounty(w, a, by, tg, pct, hrs, T0, "b2")
        w2 = self.war(bounties=[b])
        with self.assertRaises(m.TWError):  # one open bounty per sponsor
            m.tw_new_bounty(w2, a, "s", "h", 5, 6, T0, "b2")
        with self.assertRaises(m.TWError):  # same pair only once, even after it settles
            m.tw_new_bounty(self.war(bounties=[dict(b, status="won")]), a, "s", "t", 5, 6, T0, "b2")
        w3 = self.war(bounties=[b, dict(b, id="b3", by="h")])
        with self.assertRaises(m.TWError):  # max 2 on one target
            m.tw_new_bounty(w3, a, "x", "t", 5, 6, T0, "b4")
        with self.assertRaises(m.TWError):  # last hour
            m.tw_new_bounty(self.war(endAt=T0 + 1800000), a, "s", "t", 5, 6, T0, "b5")
        with self.assertRaises(m.TWError):  # paid from cash
            m.tw_new_bounty(w, dict(a, s=dict(a["s"], cash=10.0)), "s", "t", 5, 6, T0, "b6")

    def test_bounty_settlement(self):
        a = self.accts()
        b = m.tw_new_bounty(self.war(), a, "s", "t", 5, 6, T0, "b1")
        later = {u: dict(v) for u, v in a.items()}
        later["t"].update(equity=1010.0)
        later["h"].update(equity=1030.0, trades=2)   # beat the target and traded since: hunter
        later["x"].update(equity=1100.0)             # beat the target but never traded since: not eligible
        later["s"].update(equity=1500.0, trades=9)   # the sponsor can't claim their own bounty
        self.assertEqual(m.tw_settle_bounty(b, later), ("won", "h"))
        later["h"].update(equity=1005.0)
        self.assertEqual(m.tw_settle_bounty(b, later), ("defended", "t"))
        later["t"].update(out=True)
        self.assertEqual(m.tw_settle_bounty(b, later), ("refunded", "s"))

    def test_shield_saves_from_a_timed_cut(self):
        acc = {"a": dict(m.tw_new_account("A", 1000, T0), pnlPct=-5.0), "b": dict(m.tw_new_account("B", 1000, T0), pnlPct=-1.0),
               "c": dict(m.tw_new_account("C", 1000, T0), pnlPct=4.0)}
        used = []
        self.assertEqual(m.tw_pick_outs(["a", "b", "c"], acc, {"cutHours": 6}, T0, T0, {"a": 1}, used), [("b", "cut")])
        self.assertEqual(used, ["a"])

    def test_leader(self):
        acc = {"a": {"pnlPct": 2.0}, "b": {"pnlPct": 3.0, "out": True}, "c": {"pnlPct": -1.0}}
        self.assertEqual(m.tw_leader(acc, ["a", "b", "c"]), "a")
        self.assertIsNone(m.tw_leader({"a": {"pnlPct": 0.0}}, ["a"]))


class StopLossTakeProfit(unittest.TestCase):
    def test_bracket_validation(self):
        self.assertEqual(m.tw_check_bracket(100.0, 95, 110.5), (95.0, 110.5))
        self.assertEqual(m.tw_check_bracket(100.0, None, 0), (None, None))
        for sl, tp in ((100, None), (101, None), (None, 100), (None, 99), ("95", None), (True, None), (-1, None)):
            with self.assertRaises(m.TWError):
                m.tw_check_bracket(100.0, sl, tp)

    def test_hits(self):
        book = {"positions": {"AAPL": {"qty": 2, "avg": 100, "sl": 95, "tp": 110}, "MSFT": {"qty": 1, "avg": 50, "tp": 60}, "NVDA": {"qty": 1, "avg": 10}}}
        self.assertEqual(m.tw_bracket_hits(book, {"AAPL": 96, "MSFT": 59, "NVDA": 1}), [])
        self.assertEqual(m.tw_bracket_hits(book, {"AAPL": 94.5, "MSFT": 61}), [("AAPL", "sl", 94.5), ("MSFT", "tp", 61)])
        self.assertEqual(m.tw_bracket_hits(book, {"AAPL": 110}), [("AAPL", "tp", 110)])

    def test_brackets_survive_adding_and_partial_sells_and_go_with_the_position(self):
        a, b = m.tw_new_account("A", 1000, T0), {"positions": {"AAPL": {"qty": 2, "avg": 100.0, "sl": 95, "tp": 110}}, "fills": []}
        a["cash"] = 800.0
        a, b, _ = m.tw_apply_trade(a, b, "AAPL", "buy", 1, 100.0, T0)
        self.assertEqual((b["positions"]["AAPL"]["sl"], b["positions"]["AAPL"]["qty"]), (95, 3))
        a, b, _ = m.tw_apply_trade(a, b, "AAPL", "sell", 1, 100.0, T0 + 2000)
        self.assertEqual(b["positions"]["AAPL"]["tp"], 110)
        a, b, _ = m.tw_apply_trade(a, b, "AAPL", "sell", 2, 100.0, T0 + 4000)
        self.assertNotIn("AAPL", b["positions"])


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


class NotifySurrender(unittest.TestCase):
    def test_notify_wants_defaults_on(self):
        self.assertTrue(m.notify_wants(None, "battles"))
        self.assertTrue(m.notify_wants({"types": {"friends": False}}, "battles"))
        self.assertFalse(m.notify_wants({"types": {"friends": False}}, "friends"))

    def test_record_counts_surrender_as_loss(self):
        r = m.tw_record_update(None, {"uid": "a", "rank": 1, "pnlPct": 4.0}, 3, "Fight", "w1", T0)
        self.assertEqual((r["played"], r["wins"], r["losses"], r["surrenders"]), (1, 1, 0, 0))
        r = m.tw_record_update(r, {"uid": "a", "rank": 3, "pnlPct": -2.0, "out": True, "outReason": "surrender"}, 3, "Duel", "w2", T0 + 1)
        self.assertEqual((r["played"], r["wins"], r["losses"], r["surrenders"]), (2, 1, 1, 1))
        self.assertEqual([x["w"] for x in r["recent"]], ["w2", "w1"])
        self.assertTrue(r["recent"][0]["surrendered"])
        r2 = m.tw_record_update(r, {"uid": "a", "rank": 3, "outReason": "surrender"}, 3, "Duel", "w2", T0 + 2)
        self.assertEqual(len(r2["recent"]), 2)  # same match never listed twice

    def test_surrender_forfeits_rewards(self):
        res = [{"uid": "a", "rank": 1, "trades": 2}, {"uid": "b", "rank": 2, "trades": 2, "out": True, "outReason": "surrender"}]
        self.assertEqual(m.tw_rewards(res, None, {"a", "b"}), [])  # only one eligible finisher left: no duel prize
        res4 = [{"uid": u, "rank": i + 1, "trades": 1} for i, u in enumerate("abcd")] + [{"uid": "e", "rank": 5, "trades": 3, "out": True, "outReason": "surrender"}]
        res4[0], res4[4] = res4[0], res4[4]
        paid = m.tw_rewards(res4, None, set("abcde"))
        self.assertNotIn("e", [p[0] for p in paid])
