"""Unit tests for functions/minds.py (Hall of Minds) and its content file.
python3 scripts/minds_test.py"""
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import minds as M  # noqa: E402
import xp as XP  # noqa: E402

DAY = 86400000


class Content(unittest.TestCase):
    def test_server_copy_matches_the_app_file(self):
        with open(os.path.join(ROOT, "data", "minds.json"), encoding="utf-8") as a, open(os.path.join(ROOT, "functions", "minds.json"), encoding="utf-8") as b:
            self.assertEqual(json.load(a), json.load(b), "run python3 scripts/build_practice.py")

    def test_every_figure_is_complete(self):
        self.assertGreaterEqual(len(M.FIGURES), 11)
        for f in M.FIGURES.values():
            self.assertTrue(f["lessons"] and f["quotes"], f["id"])
            for l in f["lessons"]:
                self.assertTrue(l["title"] and l["text"] and l["trading"], (f["id"], l["id"]))
            for q in f["quotes"]:
                # every quote says where it comes from, and what it means
                self.assertTrue(q["text"] and q["source"] and q["plain"] and q["trading"], (f["id"], q["id"]))

    def test_order_and_links_name_real_figures(self):
        # owner 2026-10-23: head-to-head pairs removed; "who they learned from" links instead
        self.assertEqual(set(M.DATA["order"]), set(M.FIGURES))
        self.assertFalse(M.PAIRS)
        for f in M.FIGURES.values():
            self.assertIn(f["group"], ("markets", "history"))
            for x in f["studied"]:
                self.assertTrue(x["text"] and x["source"], f["id"])
                for other in x["figures"]:
                    self.assertIn(other, M.FIGURES, (f["id"], other))

    def test_market_legends(self):
        self.assertEqual({f for f, v in M.FIGURES.items() if v["group"] == "markets"}, {"livermore", "dow", "newton", "morgan"})

    def test_modern_people_in_words_only(self):
        # owner 2026-10-22/23: every figure and picture is historical; modern people appear only
        # in a figure's words-only "then & now", never as a figure, a card or a picture
        everything_but_then_now = json.dumps([{k: v for k, v in f.items() if k != "thenNow"} for f in M.FIGURES.values()])
        for name in ("Elon", "Musk", "Jobs", "Bezos", "Buffett", "Munger"):
            self.assertNotIn(name, everything_but_then_now)
        for f in M.FIGURES.values():
            tn = f.get("thenNow")
            if tn:
                self.assertEqual(set(tn), {"modern", "text", "trading"}, "no image or anything else")
        self.assertIn("aren't connected to Zelos", M.DATA["modernNote"])

    def test_story_and_accounts_with_sources(self):
        for f in M.FIGURES.values():
            self.assertGreaterEqual(len(f["story"]), 5, f["id"])
            self.assertGreaterEqual(len(f["carried"]), 3, f["id"])
            for c in f["carried"]:
                self.assertTrue(c["title"] and c["text"] and c["source"], (f["id"], c["title"]))


class Follow(unittest.TestCase):
    def test_15_tokens_for_30_days_and_renewing_adds_30(self):
        w, cost = M.follow({"balance": 40}, "napoleon", 1000)
        self.assertEqual((cost, w["balance"]), (15, 25))
        self.assertEqual(w["mindQuotes"]["napoleon"], 1000 + 30 * DAY)
        w, _ = M.follow(w, "napoleon", 2000)
        self.assertEqual(w["mindQuotes"]["napoleon"], 1000 + 60 * DAY)
        self.assertEqual(w["balance"], 10)

    def test_refused(self):
        with self.assertRaisesRegex(ValueError, "need 15 tokens and have 14"):
            M.follow({"balance": 14}, "napoleon", 0)
        with self.assertRaisesRegex(ValueError, "isn't in the Hall"):
            M.follow({"balance": 99}, "elon", 0)

    def test_expired_ones_dont_count(self):
        self.assertEqual(M.active({"tesla": 5000, "napoleon": 100, "nobody": 9e15}, 1000), ["tesla"])


class Quote(unittest.TestCase):
    def test_one_quote_rotating_over_days_and_figures(self):
        figs = ["napoleon", "tesla"]
        days = ["2026-10-%02d" % d for d in range(1, 21)]
        picks = [M.pick_quote(figs, "user1", d) for d in days]
        self.assertEqual({p[0] for p in picks}, set(figs), "rotates through the figures followed")
        self.assertTrue(all(picks[i] != picks[i + 1] for i in range(len(picks) - 1)), "never the same quote two days running")
        self.assertIsNone(M.pick_quote([], "user1", days[0]))


class Xp(unittest.TestCase):
    def test_lessons_pay_10_once_each(self):
        self.assertEqual(XP.decide("mind", "napoleon:speed", "2026-10-22")[0], 10)
        self.assertEqual(XP.decide("mind", "livermore:sit", "2026-10-22")[0], 10)
        self.assertEqual(XP.decide("mind", "vs:edison-tesla", "2026-10-22")[2], "bad-ref")  # pairs are gone
        self.assertEqual(XP.decide("mind", "napoleon:nope", "2026-10-22")[2], "bad-ref")
        self.assertEqual(XP.decide("mind", "napoleon:speed", "2026-10-22", {"mind": 20})[2], "daily-limit")


if __name__ == "__main__":
    unittest.main(verbosity=2)
