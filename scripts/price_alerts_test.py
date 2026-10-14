"""Unit tests for functions/price_alerts.py (price alerts that fire with the app closed).
Run: python3 scripts/price_alerts_test.py"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import price_alerts as PA  # noqa: E402

SYMS = {"AAPL", "MSFT"}


def al(i="abcd1234", sym="AAPL", price=200, dirn="above", status="active", upd=1000):
    return {"id": i, "sym": sym, "price": price, "dir": dirn, "status": status, "createdAt": 1, "updatedAt": upd}


class Clean(unittest.TestCase):
    def test_keeps_valid_alerts(self):
        out = PA.clean([al()], SYMS)
        self.assertEqual(out, [{"id": "abcd1234", "sym": "AAPL", "price": 200.0, "dir": "above", "status": "active", "updatedAt": 1000}])

    def test_drops_anything_malformed(self):
        bad = [al(i="x"), al(i="ABC/../1"), al(sym="ZZZZ"), al(price=0), al(price=-5), al(price=float("nan")), al(price=float("inf")),
               al(price="200"), al(price=True), al(dirn="sideways"), "nope", None, 5]
        self.assertEqual(PA.clean(bad, SYMS), [])
        self.assertEqual(PA.clean("not a list", SYMS), [])
        self.assertEqual(PA.clean(None, SYMS), [])

    def test_only_the_first_fifty(self):
        self.assertEqual(len(PA.clean([al(i="id%04d" % n) for n in range(80)], SYMS)), PA.MAX)

    def test_anything_but_active_counts_as_triggered(self):
        self.assertEqual(PA.clean([al(status="weird")], SYMS)[0]["status"], "triggered")


class Hits(unittest.TestCase):
    def test_above_and_below(self):
        alerts = PA.clean([al("aaaa1111", price=200, dirn="above"), al("bbbb2222", price=150, dirn="below"), al("cccc3333", sym="MSFT", price=400)], SYMS)
        got = PA.hits(alerts, {"AAPL": 200.0, "MSFT": 399.99})
        self.assertEqual([(a["id"], p) for a, p in got], [("aaaa1111", 200.0)])
        got = PA.hits(alerts, {"AAPL": 149.5})
        self.assertEqual([(a["id"], p) for a, p in got], [("bbbb2222", 149.5)])

    def test_triggered_and_unpriced_alerts_never_fire(self):
        alerts = PA.clean([al(status="triggered", price=1), al("dddd4444", sym="MSFT", price=1)], SYMS)
        self.assertEqual(PA.hits(alerts, {"AAPL": 500.0}), [])


class Mark(unittest.TestCase):
    def test_marks_only_the_same_waiting_alert(self):
        raw = [al("aaaa1111", upd=10), al("bbbb2222", upd=20), al("cccc3333", upd=30)]
        fired = {"aaaa1111": (10, 201.0), "bbbb2222": (19, 201.0)}  # bbbb2222 was moved since we read it
        new, waiting, marked = PA.mark(raw, fired, 5000)
        self.assertEqual(marked, ["aaaa1111"])
        self.assertEqual(waiting, 2)
        self.assertEqual(new[0]["status"], "triggered")
        self.assertEqual((new[0]["hitPrice"], new[0]["triggeredAt"], new[0]["updatedAt"]), (201.0, 5000, 5000))
        self.assertEqual(new[1], raw[1])
        self.assertEqual(raw[0]["status"], "active", "the input list isn't changed")

    def test_already_triggered_is_left_alone(self):
        new, waiting, marked = PA.mark([al(status="triggered")], {"abcd1234": (1000, 300.0)}, 5000)
        self.assertEqual((marked, waiting, new[0]["status"]), ([], 0, "triggered"))


class Words(unittest.TestCase):
    def test_message(self):
        a = PA.clean([al(price=1200)], SYMS)[0]
        self.assertEqual(PA.message(a, 1203.456), ("AAPL hit $1,200.00", "AAPL is at $1,203.46, above your $1,200.00 alert. Tap to see the chart.", "app/markets/AAPL"))
        b = PA.clean([al(price=150, dirn="below")], SYMS)[0]
        self.assertIn("below your $150.00 alert", PA.message(b, 149)[1])
        self.assertIn("at your $150.00 alert", PA.message(b, 150)[1])

    def test_guard_changes_when_the_alert_moves(self):
        self.assertNotEqual(PA.guard_id("u1", al(upd=1)), PA.guard_id("u1", al(upd=2)))
        self.assertEqual(PA.guard_id("u1", al(upd=1)), "u1_abcd1234_1")


if __name__ == "__main__":
    unittest.main(verbosity=1)
