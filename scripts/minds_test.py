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
        self.assertEqual(XP.decide("mind", "edison:work", "2026-10-22")[0], 10)
        self.assertEqual(XP.decide("mind", "livermore:sit", "2026-10-22")[0], 10)
        self.assertEqual(XP.decide("mind", "vs:edison-tesla", "2026-10-22")[2], "bad-ref")  # pairs are gone
        self.assertEqual(XP.decide("mind", "napoleon:nope", "2026-10-22")[2], "bad-ref")
        self.assertEqual(XP.decide("mind", "edison:work", "2026-10-22", {"mind": 20})[2], "daily-limit")

    def test_scroll_lessons_pay_2_a_step_about_10_a_lesson(self):
        # owner 2026-10-23: a little XP for each task, about the same 10 per lesson
        self.assertEqual(XP.decide("mind-step", "napoleon:speed:march", "2026-10-23")[0], 2)
        self.assertEqual(XP.decide("mind-step", "napoleon:speed:march", "2026-10-23", boosted=True)[0], 4)
        self.assertEqual(XP.decide("mind", "napoleon:speed", "2026-10-23")[2], "bad-ref")  # not paid twice
        self.assertEqual(XP.decide("mind-step", "napoleon:speed:nope", "2026-10-23")[2], "bad-ref")
        self.assertEqual(XP.decide("mind-step", "napoleon:study:march", "2026-10-23")[2], "bad-ref")
        self.assertEqual(XP.decide("mind-step", "napoleon:speed:ready", "2026-10-23", {"mind-step": 100})[2], "daily-limit")
        self.assertEqual(XP.decide("mind", "caesar:rubicon", "2026-10-24")[2], "bad-ref")
        for lesson in ("napoleon:speed", "napoleon:study", "napoleon:concentrate", "napoleon:mind",
                       "caesar:rubicon", "caesar:believe", "caesar:small", "caesar:record",
                       "alexander:study", "alexander:speed", "alexander:knot", "alexander:front",
                       "aristotle:habits", "aristotle:mean", "aristotle:one-swallow", "aristotle:anger",
                       "franklin:compound", "franklin:time", "franklin:virtues", "franklin:haste"):
            tasks = [r for r in M.STEP_REFS if r.startswith(lesson + ":")]
            self.assertEqual(len(tasks) * M.STEP_XP, 10, lesson)

    def test_scroll_lessons_are_well_formed(self):
        kinds = {"hold", "quiz", "drag", "level", "collect", "tap", "target", "pick"}
        for f in M.FIGURES.values():
            for l in f["lessons"]:
                sc = l.get("scroll")
                if not sc:
                    continue
                self.assertTrue(os.path.exists(os.path.join(ROOT, "webapp", "public", "minds", sc["image"])), sc["image"])
                self.assertIn("Public domain", sc["credit"])
                ids = [s["task"]["id"] for s in sc["slides"] if s.get("task")]
                self.assertEqual(len(ids), len(set(ids)), l["id"])
                for s in sc["slides"]:
                    self.assertTrue(s["lines"])
                    t = s.get("task")
                    if not t:
                        continue
                    self.assertIn(t["kind"], kinds)
                    if t["kind"] == "quiz":
                        self.assertLess(t["answer"], len(t["options"]))
                        self.assertTrue(t["why"])
                    else:
                        self.assertTrue(t["label"])
                    if t["kind"] in ("drag", "level"):
                        self.assertTrue(t["tap"], "a tap alternative to dragging (WCAG 2.5.7)")
                    if t["kind"] == "collect":
                        self.assertTrue(any(not i.get("wrong") for i in t["items"]))
                    if t["kind"] == "tap":
                        self.assertTrue(os.path.exists(os.path.join(ROOT, "webapp", "public", "minds", t["image"])), t["image"])
                        self.assertIn("Public domain", t["credit"])
                        self.assertTrue(any(sp.get("right") for sp in t["spots"]))
                        for sp in t["spots"]:
                            self.assertTrue(0 <= sp["x"] and sp["x"] + sp["w"] <= 1.001 and 0 <= sp["y"] and sp["y"] + sp["h"] <= 1.001, sp)
                    if t["kind"] == "target":
                        self.assertEqual(sum(1 for z in t["zones"] if z.get("right")), 1)
                    if t["kind"] == "pick":
                        self.assertGreaterEqual(sum(1 for o in t["options"] if o.get("right")), t["need"])
                for s in sc["slides"]:
                    if isinstance(s.get("image"), str):
                        self.assertTrue(os.path.exists(os.path.join(ROOT, "webapp", "public", "minds", s["image"])), s["image"])
                        self.assertIn("Public domain", s["credit"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
