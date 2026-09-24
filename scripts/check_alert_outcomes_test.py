#!/usr/bin/env python3
"""Unit tests for check_alert_outcomes.py — run with:
   python3 scripts/check_alert_outcomes_test.py
No network, no Firestore, no Robinhood — pure logic against synthetic bars.
"""
import sys
import unittest

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from check_alert_outcomes import determine_outcome, outcome_for_alert  # noqa: E402


def bar(date, high, low):
    return {"date": date, "high": high, "low": low}


class LongTrades(unittest.TestCase):
    def test_hits_target_first(self):
        bars = [
            bar("2026-09-10", 28.00, 27.50),   # neither
            bar("2026-09-11", 29.25, 28.50),   # hits target1 (29.21)
        ]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertEqual(r["closedAt"], "2026-09-11")
        self.assertEqual(r["exitPrice"], 29.21)
        self.assertIn("2 sessions later", r["notes"])

    def test_stopped_out_first(self):
        bars = [
            bar("2026-09-10", 27.60, 27.20),   # low 27.20 <= stop 27.35
        ]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "stopped-out")
        self.assertEqual(r["exitPrice"], 27.35)
        self.assertIn("1 session later", r["notes"])

    def test_still_open_within_window(self):
        bars = [bar("2026-09-10", 28.00, 27.50)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars, max_hold_sessions=10)
        self.assertEqual(r["result"], "open")
        self.assertIsNone(r["closedAt"])

    def test_expires_after_max_hold(self):
        bars = [bar("2026-09-%02d" % d, 28.00, 27.50) for d in range(10, 20)]  # 10 flat sessions
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars, max_hold_sessions=10)
        self.assertEqual(r["result"], "expired")
        self.assertIsNone(r["exitPrice"])

    def test_ambiguous_session_resolves_conservatively_to_stop(self):
        # One wild session that touches both the stop and the target.
        bars = [bar("2026-09-10", 29.50, 27.00)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "stopped-out")
        self.assertIn("can't tell which was hit first", r["notes"])

    def test_boundary_equals_counts_as_hit(self):
        # high exactly equal to target1 should count as a hit (>=), not a miss.
        bars = [bar("2026-09-10", 29.21, 28.00)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")

    def test_missing_bar_fields_are_skipped_not_crashed(self):
        bars = [{"date": "2026-09-10"}, bar("2026-09-11", 29.30, 28.50)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertEqual(r["closedAt"], "2026-09-11")


class Target2Runner(unittest.TestCase):
    def test_runner_reaches_target2(self):
        bars = [
            bar("2026-09-11", 29.30, 28.50),   # hits target1 (29.21)
            bar("2026-09-12", 29.60, 29.00),   # neither yet
            bar("2026-09-15", 30.10, 29.50),   # hits target2 (30.00)
        ]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertTrue(r["target2Hit"])
        self.assertEqual(r["target2ResolvedAt"], "2026-09-15")
        self.assertIn("Also ran to target 2", r["notes"])

    def test_runner_falls_back_to_breakeven(self):
        bars = [
            bar("2026-09-11", 29.30, 28.50),   # hits target1 (29.21)
            bar("2026-09-12", 29.00, 27.60),   # low falls back to entry (27.72)
        ]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertFalse(r["target2Hit"])
        self.assertEqual(r["target2ResolvedAt"], "2026-09-12")
        self.assertIn("Gave the runner back to breakeven", r["notes"])

    def test_runner_still_undetermined_with_no_bars_yet(self):
        bars = [bar("2026-09-11", 29.30, 28.50)]   # hits target1, nothing after yet
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertIsNone(r["target2Hit"])
        self.assertIsNone(r["target2ResolvedAt"])

    def test_ambiguous_runner_session_resolves_conservatively_to_false(self):
        bars = [
            bar("2026-09-11", 29.30, 28.50),   # hits target1
            bar("2026-09-12", 30.50, 27.00),   # touches both target2 and breakeven
        ]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertFalse(r["target2Hit"])

    def test_short_runner_reaches_target2(self):
        bars = [
            bar("2026-09-11", 99.00, 94.50),   # hits target1 (95.0)
            bar("2026-09-12", 92.00, 89.50),   # hits target2 (90.0)
        ]
        r = determine_outcome("short", 100.0, 103.0, 95.0, 90.0, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertTrue(r["target2Hit"])

    def test_no_target2_on_alert_leaves_it_none(self):
        bars = [bar("2026-09-11", 29.30, 28.50)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, None, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertIsNone(r["target2Hit"])

    def test_stopped_out_trade_has_no_target2_tracking(self):
        bars = [bar("2026-09-10", 27.60, 27.20)]
        r = determine_outcome("long", 27.72, 27.35, 29.21, 30.00, bars)
        self.assertEqual(r["result"], "stopped-out")
        self.assertIsNone(r["target2Hit"])
        self.assertIsNone(r["target2ResolvedAt"])


class ShortTrades(unittest.TestCase):
    def test_hits_target_first(self):
        # short: entry 100, stop 103, target1 95 — wins when LOW <= 95
        bars = [bar("2026-09-10", 99.00, 94.50)]
        r = determine_outcome("short", 100.0, 103.0, 95.0, 90.0, bars)
        self.assertEqual(r["result"], "hit-target")
        self.assertEqual(r["exitPrice"], 95.0)

    def test_stopped_out_first(self):
        bars = [bar("2026-09-10", 103.50, 101.00)]
        r = determine_outcome("short", 100.0, 103.0, 95.0, 90.0, bars)
        self.assertEqual(r["result"], "stopped-out")
        self.assertEqual(r["exitPrice"], 103.0)


class OptionsDirections(unittest.TestCase):
    def test_long_call_behaves_like_long_with_caveat_note(self):
        bars = [bar("2026-09-10", 55.00, 53.00)]
        r = determine_outcome("long-call", 50.0, 48.0, 54.0, 58.0, bars, strategy="options-scanner")
        self.assertEqual(r["result"], "hit-target")
        self.assertIn("options caveat", r["notes"])

    def test_long_put_behaves_like_short(self):
        bars = [bar("2026-09-10", 51.00, 45.00)]
        r = determine_outcome("long-put", 50.0, 53.0, 46.0, 42.0, bars, strategy="options-scanner")
        self.assertEqual(r["result"], "hit-target")


class NoTradePublished(unittest.TestCase):
    def test_watching_status_is_no_trade_immediately(self):
        alert = {"status": "watching", "direction": "long", "entry": 27.72,
                  "stop": 27.35, "target1": 29.21}
        r = outcome_for_alert(alert, bars=[])
        self.assertEqual(r["result"], "no-trade")

    def test_no_qualifying_setup_is_no_trade(self):
        alert = {"status": "no-qualifying-setup"}
        r = outcome_for_alert(alert, bars=[])
        self.assertEqual(r["result"], "no-trade")

    def test_qualified_alert_delegates_to_determine_outcome(self):
        alert = {"status": "qualified", "direction": "long", "entry": 27.72,
                  "stop": 27.35, "target1": 29.21, "target2": 30.00,
                  "strategy": "swing-trader"}
        bars = [bar("2026-09-10", 29.30, 28.50)]
        r = outcome_for_alert(alert, bars)
        self.assertEqual(r["result"], "hit-target")


class InputValidation(unittest.TestCase):
    def test_unknown_direction_raises(self):
        with self.assertRaises(ValueError):
            determine_outcome("sideways", 1, 2, 3, 4, [])

    def test_missing_trade_plan_returns_open_not_crash(self):
        r = determine_outcome("long", None, None, None, None, [bar("2026-09-10", 1, 1)])
        self.assertEqual(r["result"], "open")


if __name__ == "__main__":
    unittest.main(verbosity=2)
