"""Unit tests for functions/achievements.py (server-granted achievements, owner 2026-11-14).
python3 scripts/achievements_test.py"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import achievements as A  # noqa: E402
import learn as L  # noqa: E402
import xp as XP  # noqa: E402

IDS = ["student-market", "market-scholar", "historic-expert", "first-post", "first-victory", "honest-trader", "first-friend",
       "squad-talk", "conversationalist", "strategist", "multi-strategist", "strategy-regular", "round-trip"]


class Rules(unittest.TestCase):
    def test_every_new_achievement_pays_xp_once(self):
        for i in IDS:
            self.assertIn(i, XP.ACHIEVEMENTS)
            self.assertEqual(XP.decide("achievement", i, "2026-11-14")[2], None)

    def test_learning(self):
        self.assertEqual(A.learn_awards({}, L.ORDER), [])
        self.assertEqual(A.learn_awards({"basics": 1, "risk": 1}, L.ORDER), [])
        self.assertEqual(A.learn_awards({"basics": 1, "risk": 1, "charts": 1}, L.ORDER), ["student-market"])
        self.assertEqual(A.learn_awards({c: 1 for c in L.ORDER}, L.ORDER), ["student-market", "market-scholar"])
        # a chapter id that isn't in the curriculum doesn't count
        self.assertEqual(A.learn_awards({"basics": 1, "risk": 1, "old": 1}, L.ORDER), [])

    def test_minds_needs_every_lesson(self):
        allr = {"a:1", "a:2", "b:1"}
        self.assertEqual(A.minds_award(["a:1", "a:2"], allr), [])
        self.assertEqual(A.minds_award(["a:1", "a:2", "b:1", "x:9"], allr), ["historic-expert"])
        self.assertEqual(A.minds_award(None, allr), [])
        self.assertEqual(A.minds_award(["a:1"], set()), [])

    def test_posts(self):
        self.assertEqual(A.post_awards({"pnl": 84.2}), ["first-post", "first-victory"])
        self.assertEqual(A.post_awards({"pnl": -12.0}), ["first-post", "honest-trader"])
        self.assertEqual(A.post_awards({"pnl": 0}), ["first-post"])
        self.assertEqual(A.post_awards({}), ["first-post"])

    def test_squad_and_strategies(self):
        self.assertEqual(A.squad_awards(0), [])
        self.assertEqual(A.squad_awards(1), ["squad-talk"])
        self.assertEqual(A.squad_awards(25), ["squad-talk", "conversationalist"])
        self.assertEqual(A.strategy_awards([], 0), [])
        self.assertEqual(A.strategy_awards(["swing-trader"], 1), ["strategist"])
        self.assertEqual(A.strategy_awards(["a", "b", "c"], 3), ["strategist", "multi-strategist"])
        self.assertEqual(A.strategy_awards(["a"], 10), ["strategist", "strategy-regular"])

    def test_gave_it_all_back(self):
        self.assertTrue(A.round_trip(16000, 9999.99))
        self.assertFalse(A.round_trip(15999, 9000))  # never reached +60%
        self.assertFalse(A.round_trip(17000, 10000))  # still at even
        self.assertFalse(A.round_trip(None, 5000))


if __name__ == "__main__":
    unittest.main()
