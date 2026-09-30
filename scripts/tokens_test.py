"""Tests for the token wallet, alert locking and the Stripe webhook check in
functions/main.py (the pure parts).

    python3 -m unittest discover -s scripts -p "*_test.py"
"""
import hmac
import hashlib
import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tradewar_test  # noqa: E402,F401  (installs the firebase stubs)
import main as m  # noqa: E402

T0 = 1_760_000_000_000


class Wallet(unittest.TestCase):
    def test_welcome_once_and_only_verified(self):
        w = m.tk_new_wallet(T0)
        self.assertEqual(m.tk_welcome(w, False, T0), (w, None))
        w2, line = m.tk_welcome(w, True, T0)
        self.assertEqual((w2["balance"], w2["welcomed"], line["amount"], line["type"]), (75, True, 75, "welcome"))
        self.assertIsNone(m.tk_welcome(w2, True, T0 + 1)[1])

    def test_pass_extends_and_charges(self):
        w = dict(m.tk_new_wallet(T0), balance=100)
        w, line = m.tk_spend(w, "pass", T0, "swing-trader")
        self.assertEqual((w["balance"], line["amount"], w["passes"]["swing-trader"]), (60, -40, T0 + 7 * 86400000))
        w, _ = m.tk_spend(w, "pass", T0 + 1000, "swing-trader")  # stacks on the remaining time
        self.assertEqual((w["balance"], w["passes"]["swing-trader"]), (20, T0 + 14 * 86400000))
        with self.assertRaises(m.TWError):
            m.tk_spend(w, "pass", T0, "swing-trader")  # 20 < 40
        with self.assertRaises(m.TWError):
            m.tk_spend(dict(w, balance=999), "pass", T0, "crypto-bot")

    def test_unlock(self):
        locked = {"strategy": "breakout-rider", "released": False}
        w = dict(m.tk_new_wallet(T0), balance=15)
        w, line = m.tk_spend(w, "unlock", T0, alert_id="breakout-rider-2026-09-30", locked=locked)
        self.assertEqual((w["balance"], w["unlocked"], line["amount"]), (5, ["breakout-rider-2026-09-30"], -10))
        w2, line = m.tk_spend(w, "unlock", T0, alert_id="breakout-rider-2026-09-30", locked=locked)
        self.assertEqual((w2["balance"], line), (5, None))  # already yours: free
        with self.assertRaises(m.TWError):
            m.tk_spend(w, "unlock", T0, alert_id="x", locked={"strategy": "swing-trader", "released": True})
        with self.assertRaises(m.TWError):
            m.tk_spend(w, "unlock", T0, alert_id="x", locked=None)

    def test_pass_covers_unlocks_for_free(self):
        w = dict(m.tk_new_wallet(T0), balance=10, passes={"options-scanner": T0 + 5})
        w2, line = m.tk_spend(w, "unlock", T0, alert_id="options-scanner-2026-09-30", locked={"strategy": "options-scanner", "released": False})
        self.assertEqual((w2["balance"], line), (10, None))
        self.assertTrue(m.tk_has_access(w, "options-scanner", "a", T0))
        self.assertFalse(m.tk_has_access(w, "options-scanner", "a", T0 + 5))


class AlertLocking(unittest.TestCase):
    FULL = {"strategy": "swing-trader", "ticker": "PFE", "status": "qualified", "direction": "long", "score": 59, "scoreMax": 80,
            "setupLabel": "Pullback", "marketRegime": "Neutral", "entry": 27.72, "stop": 27.35, "target1": 29.21, "reasoning": "why",
            "scanStats": {"scanned": 3120, "passedFilters": 41, "qualified": [{"ticker": "PFE"}], "rejected": [{"ticker": "XYZ"}]}}

    def test_teaser_hides_the_trade(self):
        t = m.alert_teaser(self.FULL)
        self.assertEqual(sorted(t), ["direction", "marketRegime", "scanStats", "score", "scoreMax", "setupLabel", "status", "strategy"])
        self.assertEqual(t["scanStats"], {"scanned": 3120, "passedFilters": 41})
        self.assertNotIn("PFE", str(t))

    def test_only_real_setups_are_locked(self):
        self.assertTrue(m.alert_has_trade(self.FULL))
        self.assertFalse(m.alert_has_trade({"strategy": "swing-trader", "status": "no-qualifying-setup", "ticker": "PFE"}))
        self.assertFalse(m.alert_has_trade({"strategy": "swing-trader", "status": "qualified"}))

    def test_lock_until_next_close(self):
        ny = lambda s: datetime.fromisoformat(s).astimezone(timezone.utc)
        close = lambda s: int(datetime.fromisoformat(s).timestamp() * 1000)
        self.assertEqual(m.alert_lock_until(ny("2026-09-30T09:00:00-04:00")), close("2026-09-30T16:00:00-04:00"))
        self.assertEqual(m.alert_lock_until(ny("2026-09-30T17:00:00-04:00")), close("2026-10-01T16:00:00-04:00"))
        self.assertEqual(m.alert_lock_until(ny("2026-10-02T18:00:00-04:00")), close("2026-10-05T16:00:00-04:00"))  # Fri eve -> Mon
        self.assertEqual(m.alert_lock_until(ny("2026-10-03T12:00:00-04:00")), close("2026-10-05T16:00:00-04:00"))  # Sat -> Mon


class Stripe(unittest.TestCase):
    SECRET = "whsec_test"

    def sig(self, payload, ts, secret=None):
        return "t=%d,v1=%s" % (ts, hmac.new((secret or self.SECRET).encode(), b"%d." % ts + payload, hashlib.sha256).hexdigest())

    def test_signature(self):
        body, now = b'{"id":"evt_1"}', 1_760_000_000
        self.assertTrue(m.stripe_verify(body, self.sig(body, now), self.SECRET, now))
        self.assertFalse(m.stripe_verify(body + b" ", self.sig(body, now), self.SECRET, now))       # tampered body
        self.assertFalse(m.stripe_verify(body, self.sig(body, now, "whsec_other"), self.SECRET, now))  # wrong secret
        self.assertFalse(m.stripe_verify(body, self.sig(body, now - 600), self.SECRET, now))       # replayed later
        self.assertFalse(m.stripe_verify(body, "", self.SECRET, now))
        self.assertFalse(m.stripe_verify(body, self.sig(body, now), "", now))

    def test_session_credit_checks_the_amount(self):
        ok = {"payment_status": "paid", "amount_total": 300, "client_reference_id": "u1", "metadata": {"uid": "u1", "pack": "p100", "tokens": "100"}}
        self.assertEqual(m.tk_session_credit(ok), ("u1", "p100", 100, 300))
        self.assertIsNone(m.tk_session_credit(dict(ok, payment_status="unpaid")))
        self.assertIsNone(m.tk_session_credit(dict(ok, amount_total=1)))
        self.assertIsNone(m.tk_session_credit(dict(ok, metadata={"uid": "u1", "pack": "p100", "tokens": "99999"})))
        self.assertIsNone(m.tk_session_credit(dict(ok, metadata={"uid": "u1", "pack": "free", "tokens": "100"})))


if __name__ == "__main__":
    unittest.main()
