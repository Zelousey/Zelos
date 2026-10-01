"""Tests for the token wallet, alert locking and the Square payment checks in
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
        locked = {"strategy": "breakout-rider", "released": False, "lockedUntil": T0 + 3600000}
        w = dict(m.tk_new_wallet(T0), balance=15)
        w, line = m.tk_spend(w, "unlock", T0, alert_id="breakout-rider-2026-09-30", locked=locked)
        self.assertEqual((w["balance"], w["unlocked"], line["amount"]), (5, ["breakout-rider-2026-09-30"], -10))
        w2, line = m.tk_spend(w, "unlock", T0, alert_id="breakout-rider-2026-09-30", locked=locked)
        self.assertEqual((w2["balance"], line), (5, None))  # already yours: free
        with self.assertRaises(m.TWError):
            m.tk_spend(w, "unlock", T0, alert_id="x", locked={"strategy": "swing-trader", "released": True, "public": True})
        with self.assertRaises(m.TWError):
            m.tk_spend(w, "unlock", T0, alert_id="x", locked=None)

    def test_after_close_is_cheaper(self):
        w = dict(m.tk_new_wallet(T0), balance=5)
        closed = {"strategy": "swing-trader", "released": True, "lockedUntil": T0 - 1}
        w2, line = m.tk_spend(w, "unlock", T0, alert_id="swing-trader-2026-09-29", locked=closed)
        self.assertEqual((w2["balance"], line["amount"]), (2, -3))
        # past the close but the release job hasn't run yet: still the after-close price
        w3, line = m.tk_spend(w, "unlock", T0, alert_id="y", locked=dict(closed, released=False))
        self.assertEqual(line["amount"], -3)
        self.assertLess(m.TOKENS["unlockClosed"], m.TOKENS["unlock"])

    def test_pass_covers_unlocks_for_free(self):
        w = dict(m.tk_new_wallet(T0), balance=10, passes={"options-scanner": T0 + 5})
        w2, line = m.tk_spend(w, "unlock", T0, alert_id="options-scanner-2026-09-30", locked={"strategy": "options-scanner", "released": False, "lockedUntil": T0 + 1})
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


class Square(unittest.TestCase):
    KEY, URL = "sq_sig_key_test", "https://us-central1-leaderboard-agentictrading.cloudfunctions.net/squareWebhook"

    def sig(self, body, key=None, url=None):
        import base64
        return base64.b64encode(hmac.new((key or self.KEY).encode(), (url or self.URL).encode() + body, hashlib.sha256).digest()).decode()

    def test_signature(self):
        body = b'{"event_id":"e1"}'
        self.assertEqual(m.SQUARE_WEBHOOK_URL, self.URL)
        self.assertTrue(m.square_verify(body, self.sig(body), self.KEY))
        self.assertFalse(m.square_verify(body + b" ", self.sig(body), self.KEY))                        # tampered body
        self.assertFalse(m.square_verify(body, self.sig(body, key="other"), self.KEY))                 # wrong key
        self.assertFalse(m.square_verify(body, self.sig(body, url="https://evil.example/x"), self.KEY))  # signed for another URL
        self.assertFalse(m.square_verify(body, "", self.KEY))
        self.assertFalse(m.square_verify(body, self.sig(body), ""))

    def test_webhook_urls(self):
        urls = m.square_webhook_urls({"Host": "squarewebhook-abc123-uc.a.run.app"}, "/")
        self.assertEqual(urls[0], self.URL)
        self.assertIn("https://squarewebhook-abc123-uc.a.run.app/", urls)
        body = b'{"event_id":"e2"}'
        run_sig = self.sig(body, url="https://squarewebhook-abc123-uc.a.run.app/")
        self.assertTrue(any(m.square_verify(body, run_sig, self.KEY, u) for u in urls))     # signed for the run.app address
        self.assertEqual(m.square_webhook_urls({"Host": "evil host/<x>"}, "/"), [self.URL])  # junk Host ignored
        self.assertEqual(len(m._key_print("abc")), 8)
        self.assertEqual(m._key_print(""), "missing")

    def test_credit_decision(self):
        co = {"uid": "u1", "pack": "p100", "tokens": 100, "amountCents": 300, "currency": "USD", "status": "pending"}
        paid = {"id": "pay1", "order_id": "o1", "status": "COMPLETED", "amount_money": {"amount": 300, "currency": "USD"}}
        self.assertIsNone(m.square_payment_credit(paid, co))
        self.assertEqual(m.square_payment_credit(dict(paid, status="APPROVED"), co), "status APPROVED")
        self.assertEqual(m.square_payment_credit(paid, dict(co, status="credited")), "already credited")
        self.assertEqual(m.square_payment_credit(dict(paid, amount_money={"amount": 1, "currency": "USD"}), co), "amount mismatch")
        self.assertEqual(m.square_payment_credit(dict(paid, amount_money={"amount": 300, "currency": "CAD"}), co), "amount mismatch")
        self.assertEqual(m.square_payment_credit(paid, None), "not one of our checkouts")

    def test_link_body_prices_come_from_the_server(self):
        b = m.square_link_body("u1", "p350", "a@b.co", "LOC1", "idem-1")
        self.assertEqual(b["quick_pay"]["price_money"], {"amount": 1000, "currency": "USD"})
        self.assertEqual((b["quick_pay"]["location_id"], b["idempotency_key"], b["pre_populated_data"]["buyer_email"]), ("LOC1", "idem-1", "a@b.co"))
        self.assertIn("350", b["quick_pay"]["name"])
        self.assertTrue(b["checkout_options"]["redirect_url"].startswith("https://agentictrading.info/"))
        self.assertNotIn("pre_populated_data", m.square_link_body("u1", "p100", None, "LOC1", "i"))
        with self.assertRaises(m.TWError):
            m.square_link_body("u1", "free", None, "LOC1", "i")

    def test_ready_and_environment(self):
        import os
        old = dict(os.environ)
        try:
            os.environ["SQUARE_ACCESS_TOKEN"] = "none"
            self.assertFalse(m._square_ready())
            os.environ["SQUARE_ACCESS_TOKEN"] = "EAAAEXAMPLE_sandbox_token_long_enough"
            self.assertTrue(m._square_ready())
            os.environ.pop("SQUARE_ENVIRONMENT", None)
            self.assertEqual(m._square_base(), "https://connect.squareupsandbox.com")
            os.environ["SQUARE_ENVIRONMENT"] = "production"
            self.assertEqual(m._square_base(), "https://connect.squareup.com")
        finally:
            os.environ.clear(); os.environ.update(old)


class Earning(unittest.TestCase):
    def test_checkin_streak_and_bonus(self):
        w = dict(m.tk_new_wallet(T0), balance=0)
        w, line, c = m.tk_checkin(w, "2026-10-01", "2026-09-30", T0)
        self.assertEqual((w["balance"], c["streak"], c["days"], line["type"]), (2, 1, 1, "checkin"))
        self.assertIsNone(m.tk_checkin(w, "2026-10-01", "2026-09-30", T0 + 5)[1])  # same day: nothing
        for i, day in enumerate(["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]):
            prev = "2026-10-0%d" % (i + 1)
            w, line, c = m.tk_checkin(w, day, prev, T0)
        self.assertEqual((c["streak"], w["balance"]), (6, 12))
        w, line, c = m.tk_checkin(w, "2026-10-07", "2026-10-06", T0)  # 7th day in a row: bonus
        self.assertEqual((c["streak"], line["amount"], w["balance"]), (7, 12, 24))
        w, line, c = m.tk_checkin(w, "2026-10-09", "2026-10-08", T0)  # missed a day: back to 1
        self.assertEqual((c["streak"], c["days"], line["amount"]), (1, 8, 2))

    def test_trade_war_rewards(self):
        rows = lambda n, **kw: [dict({"uid": "u%d" % i, "trades": 1, "rank": i + 1}, **kw) for i in range(n)]
        everyone = {"u%d" % i for i in range(9)}
        self.assertEqual(m.tw_rewards(rows(5), None, everyone), [("u0", 25, "Trade War: 1st place"), ("u1", 15, "Trade War: 2nd place"), ("u2", 10, "Trade War: 3rd place")])
        self.assertEqual(m.tw_rewards(rows(2), None, everyone), [("u0", 15, "Trade War: 1st place")])
        self.assertEqual(m.tw_rewards(rows(1), None, everyone), [])                     # alone: nothing
        self.assertEqual(m.tw_rewards(rows(2), None, {"u0"}), [])                        # opponent not verified
        r = rows(4); r[1]["trades"] = 0                                                  # no trades: not counted
        self.assertEqual([x[0] for x in m.tw_rewards(r, None, everyone)], ["u0"])
        lms = m.tw_rewards(rows(4), {"cutHours": 1}, everyone)
        self.assertEqual(lms[0], ("u0", 35, "Last Man Standing: survived and won"))
        out = rows(2); out[0]["out"] = True
        self.assertEqual(m.tw_rewards(out, {"cutHours": 1}, everyone), [("u0", 15, "Trade War: 1st place")])


class Cosmetics(unittest.TestCase):
    def test_buy(self):
        w = dict(m.tk_new_wallet(T0), balance=100)
        w, line = m.cosmetic_buy(w, "color", "gold", T0)
        self.assertEqual((w["balance"], w["owned"], line["amount"]), (40, ["color:gold"], -60))
        self.assertEqual(m.cosmetic_buy(w, "color", "gold", T0)[1], None)  # owned: free
        with self.assertRaises(m.TWError):
            m.cosmetic_buy(w, "banner", "gold", T0)  # 150 > 40
        with self.assertRaises(m.TWError):
            m.cosmetic_buy(w, "color", "plaid", T0)


class Founder(unittest.TestCase):
    def test_slug(self):
        self.assertEqual(m.community_slug("  Zelos   Clan ", "ct"), ("Zelos Clan", "CT", "zelos-clan-ct"))
        self.assertEqual(m.community_slug("Bulls & Bears", "NY")[2], "bulls-bears-ny")
        for bad in [("Zelos Clan", "ZZ"), ("ab", "CT"), ("x" * 31, "CT"), ("<script>", "CT"), ("Shit Traders", "CT")]:
            with self.assertRaises(m.TWError):
                m.community_slug(*bad)

    def test_milestones(self):
        self.assertEqual(m.founder_due(4, []), [])
        self.assertEqual([t[0] for t in m.founder_due(5, [])], [5])
        self.assertEqual([t[0] for t in m.founder_due(12, [5])], [10])
        self.assertEqual([t[0] for t in m.founder_due(30, [])], [5, 10, 25])
        self.assertEqual(m.founder_due(5, [5]), [])
        self.assertEqual(m.founder_title(26)[2], "Community Builder")
        self.assertIsNone(m.founder_title(4))

    def test_who_counts(self):
        good = {"activeDays": 2, "ipHash": "aaa"}
        priv = {"founderIps": ["fff"], "countedIps": ["ccc"]}
        self.assertEqual(m.member_counts(good, priv, "F", "U", True, "aaa"), (True, "ok"))
        self.assertEqual(m.member_counts(good, priv, "U", "U", True, "aaa")[1], "founder")
        self.assertEqual(m.member_counts(good, priv, "F", "U", False, "aaa")[1], "not verified")
        self.assertEqual(m.member_counts(dict(good, activeDays=1), priv, "F", "U", True, "aaa")[1], "not active enough yet")
        self.assertEqual(m.member_counts(dict(good, countedFor="other-ct"), priv, "F", "U", True, "aaa")[1], "counted before")
        self.assertEqual(m.member_counts(good, priv, "F", "U", True, "fff")[1], "same network")         # founder's network today
        self.assertEqual(m.member_counts(dict(good, ipHash="ccc"), priv, "F", "U", True, "bbb")[1], "same network")  # joined on a counted member's
        self.assertEqual(m.member_counts(dict(good, counted=True), priv, "F", "U", True, "aaa")[1], "already counted")

    def test_client_ip(self):
        class R:
            def __init__(self, xff, addr="10.0.0.1"):
                self.headers, self.remote_addr = {"X-Forwarded-For": xff} if xff else {}, addr
        class Q:
            def __init__(self, raw): self.raw_request = raw
        self.assertEqual(m._client_ip(Q(R("1.1.1.1, 2.2.2.2"))), "2.2.2.2")  # a spoofed first hop is ignored
        self.assertEqual(m._client_ip(Q(R(None))), "10.0.0.1")
        self.assertNotEqual(m._ip_hash("1.1.1.1"), m._ip_hash("1.1.1.2"))
        self.assertEqual(m._ip_hash(""), "")


class Push(unittest.TestCase):
    def test_wants(self):
        self.assertTrue(m.push_wants(None, "swing-trader"))                       # never touched: all on
        self.assertTrue(m.push_wants({"strategies": ["swing-trader"]}, "swing-trader"))
        self.assertFalse(m.push_wants({"strategies": ["swing-trader"]}, "options-scanner"))
        self.assertFalse(m.push_wants({"strategies": []}, "swing-trader"))

    def test_message_is_a_teaser(self):
        a = dict(AlertLocking.FULL, strategy="breakout-rider")
        title, body, link, image = m.push_alert_message("breakout-rider-2026-10-01", a)
        self.assertEqual(title, "New Breakout Rider alert")
        self.assertIn("score 59/80", body)
        self.assertNotIn("PFE", title + body)       # never the ticker
        self.assertNotIn("27.72", body)             # or the levels
        self.assertEqual(link, "https://agentictrading.info/alert.html?id=breakout-rider-2026-10-01")
        self.assertTrue(image.endswith("/images/alert-breakout-rider.png"))

    def test_send_drops_dead_tokens(self):
        import types
        fake = types.ModuleType("firebase_admin.messaging")
        class UnregisteredError(Exception): pass
        class R:
            def __init__(self, ok, exc=None): self.success, self.exception = ok, exc
        sent_msgs = []
        fake.Message = lambda **kw: kw
        fake.WebpushConfig = lambda **kw: kw
        fake.WebpushNotification = lambda **kw: kw
        fake.WebpushFCMOptions = lambda **kw: kw
        def send_each(msgs):
            sent_msgs.extend(msgs)
            return types.SimpleNamespace(responses=[R(True) if x["token"] != "dead" else R(False, UnregisteredError()) for x in msgs])
        fake.send_each = send_each
        old = sys.modules.get("firebase_admin.messaging")
        sys.modules["firebase_admin.messaging"] = fake
        import firebase_admin
        had = getattr(firebase_admin, "messaging", None)
        firebase_admin.messaging = fake
        try:
            sent, dead = m._push_send([("a", "tok1"), ("b", "dead"), ("c", "tok3")], "T", "B", "https://x/l", "https://x/i.png", "tag1")
        finally:
            if old is None: sys.modules.pop("firebase_admin.messaging", None)
            else: sys.modules["firebase_admin.messaging"] = old
            if had is None:
                try: del firebase_admin.messaging
                except AttributeError: pass
            else: firebase_admin.messaging = had
        self.assertEqual((sent, dead), (2, ["b"]))
        self.assertEqual(sent_msgs[0]["webpush"]["fcm_options"]["link"], "https://x/l")


if __name__ == "__main__":
    unittest.main()
