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

    def test_buy_only_in_a_territory_you_hold(self):
        war = {"status": "active", "phase": "holding", "players": ["u1", "u2"],
               "map": {"tech": {"state": "owned", "owner": "u1"}, "energy": {"state": "owned", "owner": "u2"}, "health": {"state": "contested", "contenders": ["u1", "u2"]}}}
        W.check_buy(war, "u1", "NIMBC")  # Tech is u1's
        for who, sym in (("u1", "VOLTX"), ("u1", "HELIX"), ("u3", "NIMBC")):
            with self.assertRaises(W.WarError):
                W.check_buy(war, who, sym)
        for bad in (None, dict(war, phase="claiming"), dict(war, status="ended")):
            with self.assertRaises(W.WarError):
                W.check_buy(bad, "u1", "NIMBC")
        p, f = W.apply_trade(W.new_profile(1), "NIMBC", "buy", 1, 200.0, {}, 1, "war1")
        self.assertEqual(f["warId"], "war1")

    def test_inputs_not_mutated(self):
        p = W.new_profile(0)
        before = repr(p)
        W.apply_trade(p, "VOLTX", "buy", 10, 88.0, {}, 1)
        self.assertEqual(before, repr(p))


def utc_ms(y, mo, d, h=0, mi=0):
    from datetime import datetime, timezone
    return int(datetime(y, mo, d, h, mi, tzinfo=timezone.utc).timestamp() * 1000)


class Chaos(unittest.TestCase):
    def plans(self, day_ms, n=400):
        return [W.plan_chaos(day_ms, random.Random(i)) for i in range(n)]

    def test_at_most_one_event_a_day_more_on_weekends(self):
        weekday = [p for p in self.plans(utc_ms(2026, 10, 29)) if p.get("startsAt")]  # a Thursday
        weekend = [p for p in self.plans(utc_ms(2026, 10, 31)) if p.get("startsAt")]  # a Saturday
        self.assertTrue(0.12 < len(weekday) / 400 < 0.28, len(weekday))
        self.assertTrue(0.4 < len(weekend) / 400 < 0.6, len(weekend))

    def test_event_shape_1_to_3_hours_10_to_20_percent_within_the_day(self):
        day = utc_ms(2026, 10, 31)
        for p in self.plans(day):
            if not p.get("startsAt"):
                self.assertEqual(p, {"day": "2026-10-31"})
                continue
            self.assertTrue(60 <= p["minutes"] <= 180)
            self.assertEqual(p["endsAt"] - p["startsAt"], p["minutes"] * M)
            self.assertTrue(day + 30 * M <= p["startsAt"] and p["endsAt"] <= day + 1440 * M)
            for sym, lm in p["moves"].items():
                self.assertTrue(p["scope"] in ("all", W.BY_SYM[sym][2]))
                self.assertTrue(0.079 <= abs(math.exp(lm) - 1) <= 0.241, (sym, lm))
            n = len(W.SYMS) if p["scope"] == "all" else 3
            self.assertEqual(len(p["moves"]), n)

    def test_a_late_plan_still_leaves_time_for_the_warning(self):
        now = utc_ms(2026, 10, 31, 20, 0)
        for p in self.plans(now, 200):
            if p.get("startsAt"):
                self.assertGreaterEqual(p["startsAt"] - now, 30 * M)
        self.assertTrue(all(not p.get("startsAt") for p in self.plans(utc_ms(2026, 10, 31, 23, 0), 100)))

    def test_phases_and_what_is_public(self):
        c = {"day": "2026-10-31", "startsAt": 100 * M, "endsAt": 220 * M, "minutes": 120, "scope": "energy", "moves": {"VOLTX": 0.15, "SOLRN": 0.12, "PETRA": 0.14}}
        self.assertEqual([W.chaos_phase(c, t * M) for t in (0, 69, 70, 100, 101, 219, 220)], [None, None, "warned", "warned", "live", "live", "over"])
        warned = W.chaos_public(c, "warned")
        self.assertEqual((warned["scopeName"], warned["startsAt"]), ("Energy", 100 * M))
        self.assertNotIn("endsAt", warned)
        for ph in ("warned", "live", "over"):
            self.assertNotIn("moves", W.chaos_public(c, ph))  # never the size or direction
        self.assertEqual(W.chaos_public(c, "over")["syms"], ["PETRA", "SOLRN", "VOLTX"])
        self.assertEqual(W.chaos_public(c, "over")["hotUntil"], 220 * M + 24 * 3600 * 1000)
        self.assertIsNone(W.chaos_phase({"day": "x"}, 0))

    def test_a_live_event_moves_the_hit_stocks_by_about_its_size(self):
        start = utc_ms(2026, 10, 31)
        c = {"day": "2026-10-31", "startsAt": start, "endsAt": start + 120 * M, "minutes": 120, "scope": "energy",
             "moves": {"VOLTX": math.log(1.15), "SOLRN": math.log(1.15), "PETRA": math.log(1.15)}}
        hit, calm = [], []
        for seed in range(30):
            st = dict(W.new_state(start), chaos=c)
            rng = random.Random(seed)
            for k in range(2):
                st, _, _ = W.step(st, start + (k + 1) * 60 * M, rng)
            hit.append(st["stocks"]["VOLTX"]["p"] / W.BY_SYM["VOLTX"][3] - 1)
            calm.append(abs(st["stocks"]["BRWLY"]["p"] / W.BY_SYM["BRWLY"][3] - 1))
        self.assertTrue(0.10 < statistics.median(hit) < 0.20, statistics.median(hit))
        self.assertLess(statistics.median(calm), 0.02)


class Quiet(unittest.TestCase):
    def test_default_10pm_to_8am_in_your_time_zone(self):
        q = W.default_quiet("America/New_York")
        self.assertEqual(q, {"start": 1320, "end": 480, "tz": "America/New_York"})
        self.assertEqual(W.default_quiet("Mars/Base")["tz"], "UTC")
        # 2026-10-29 03:00 UTC = 23:00 in New York (EDT): quiet, ends 08:00 EDT = 12:00 UTC
        now = utc_ms(2026, 10, 29, 3)
        self.assertTrue(W.in_quiet(q, now))
        self.assertEqual(W.quiet_ends_at(q, now), utc_ms(2026, 10, 29, 12))
        self.assertFalse(W.in_quiet(q, utc_ms(2026, 10, 29, 12)))
        self.assertIsNone(W.quiet_ends_at(q, utc_ms(2026, 10, 29, 15)))

    def test_same_day_window_and_off(self):
        q = {"start": 60, "end": 360, "tz": "UTC"}
        self.assertTrue(W.in_quiet(q, utc_ms(2026, 10, 29, 2)))
        self.assertEqual(W.quiet_ends_at(q, utc_ms(2026, 10, 29, 2)), utc_ms(2026, 10, 29, 6))
        self.assertFalse(W.in_quiet({"start": 60, "end": 60, "tz": "UTC"}, utc_ms(2026, 10, 29, 1)))

    def test_capped_at_10_hours_and_checked(self):
        ok = W.validate_quiet({"start": 1380, "end": 540, "tz": "Europe/London"})
        self.assertEqual(ok["end"], 540)
        self.assertEqual(W.validate_quiet({"start": 0, "end": 0, "tz": "UTC"})["start"], 0)
        for bad in ({"start": 1320, "end": 555, "tz": "UTC"}, {"start": 1320, "end": 545, "tz": "UTC"}, {"start": 1320, "end": 480, "tz": "Nowhere/X"},
                    {"start": True, "end": 480, "tz": "UTC"}, {"start": 1440, "end": 480, "tz": "UTC"}, None):
            with self.assertRaises(W.WarError):
                W.validate_quiet(bad)

    def test_morning_summary_text(self):
        self.assertEqual(W.summary_body([]), "")
        lines = ["Chaos hit Energy in the War zone.", "Chaos hit Energy in the War zone."] + ["L%d." % i for i in range(10)]
        body = W.summary_body(lines)
        self.assertTrue(body.startswith("While you slept: "))
        self.assertNotIn("Chaos", body)  # only the newest 8, duplicates once
        self.assertIn("L9.", body)
        self.assertEqual(W.new_profile(0, "Asia/Tokyo")["quiet"]["tz"], "Asia/Tokyo")


if __name__ == "__main__":
    unittest.main()
