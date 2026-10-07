"""Unit tests for functions/xp.py (server-decided XP awards). Run: python3 scripts/xp_test.py"""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import xp as XP

T = "2026-10-07"  # a Wednesday; ISO week 2026_41
Y = "2026-10-06"


class Decide(unittest.TestCase):
    def ok(self, kind, ref, amount, **kw):
        a, _, why = XP.decide(kind, ref, T, **kw)
        self.assertIsNone(why, (kind, ref))
        self.assertEqual(a, amount)

    def no(self, kind, ref, reason="bad-ref", **kw):
        a, _, why = XP.decide(kind, ref, T, **kw)
        self.assertEqual((a, why), (0, reason), (kind, ref))

    def test_fixed_amounts_come_from_the_server(self):
        self.ok("daily-checkin", None, 3)
        self.ok("daily-checkin", T, 3)
        self.ok("arcade-play", "", 5)
        self.ok("alert-open", "swing-trader-2026-10-07", 5)

    def test_day_stamped_refs_only_today_or_yesterday(self):
        self.ok("trading-tools", Y, 5)
        self.no("trading-tools", "2026-09-01")
        self.no("share", "2027-01-01")

    def test_counted_refs(self):
        self.ok("practice-trade", T + ":10", 5)
        self.no("practice-trade", T + ":11")
        self.no("practice-trade", T + ":0")
        self.ok("real-trade", T + ":3", 10)
        self.no("real-trade", T + ":4")
        self.ok("grade-setup", Y + ":5", 10)
        self.no("grade-setup", "2026-10-01:1")

    def test_missions_use_table_amounts(self):
        self.ok("mission", "d:%s:xp" % T, 20)
        self.no("mission", "d:%s:made-up" % T)
        self.no("mission", "d:2026-09-01:trade")
        self.ok("mission", "w:w2026_41:days5", 75)
        self.ok("mission", "w:w2026_40:wins3", 50)
        self.no("mission", "w:w2026_30:wins3")
        # a 7-day streak that started 2026-10-01 ends today
        self.ok("mission", "streak:2026-10-01:7", 75)
        self.no("mission", "streak:2026-09-01:7")
        self.no("mission", "streak:2026-10-01:8")

    def test_achievements_and_onboarding(self):
        self.ok("achievement", "club-100k", 500)
        self.ok("achievement", "season-s1-green", 100)
        self.no("achievement", "free-money")
        self.ok("onboard", "notify", 50)
        self.no("onboard", "anything")

    def test_unknown_types_and_retired_ones(self):
        self.no("free-xp", "x", "bad-type")
        self.no("challenge-win", "x", "bad-type")

    def test_referrals(self):
        self.ok("referral", "AbCdEfGhIjKlMnOpQrSt1234", 50)
        self.no("referral", "../../etc")
        self.ok("referral-welcome", "welcome", 50)
        self.no("referral-welcome", "again")

    def test_daily_limits(self):
        self.no("alert-open", "a1", "daily-limit", counts={"alert-open": 50})
        self.ok("alert-open", "a1", 5, counts={"alert-open": 49})
        self.no("achievement", "club-100k", "daily-limit", xp_today=XP.DAILY_XP_CEILING - 100)
        self.no("practice-trade", T + ":1", "daily-limit", counts={"practice-trade": 10})

    def test_long_ref_rejected(self):
        self.no("alert-open", "a" * 200)


class Streak(unittest.TestCase):
    def test_streak(self):
        self.assertEqual(XP.streak_update({}, T, Y), {"streakDays": 1, "lastAlertOpenDate": T})
        self.assertEqual(XP.streak_update({"lastAlertOpenDate": Y, "streakDays": 4}, T, Y), {"streakDays": 5, "lastAlertOpenDate": T})
        self.assertEqual(XP.streak_update({"lastAlertOpenDate": T, "streakDays": 4}, T, Y), {})
        self.assertEqual(XP.streak_update({"lastAlertOpenDate": "2026-10-01", "streakDays": 9}, T, Y)["streakDays"], 1)


class TablesMatchTheBrowser(unittest.TestCase):
    """The pages show XP amounts; the server tables must agree with them."""
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def read(self, name):
        with open(os.path.join(self.ROOT, name), encoding="utf-8") as f:
            return f.read()

    def test_progress_tables(self):
        import re
        src = self.read("zelos-progress.js")
        for mid, xp in list(XP.DAILY_MISSIONS.items()) + list(XP.WEEKLY_MISSIONS.items()):
            self.assertRegex(src, r"id: '%s',[^}]*xp: %d," % (re.escape(mid), xp))
        for aid, xp in XP.ACHIEVEMENTS.items():
            self.assertRegex(src, r"\['%s', '[^']*', '[^']*', '[^']*', %d," % (re.escape(aid), xp))
        self.assertIn("STREAK_REWARDS = [[3, 25], [7, 75], [14, 150], [30, 300]]", src)

    def test_points_table(self):
        src = self.read("zelos-xp.js")
        for k, v in XP.FIXED.items():
            self.assertIn("'%s': %d" % (k, v), src)


if __name__ == "__main__":
    unittest.main()
