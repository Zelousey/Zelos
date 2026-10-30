"""Tests for Battle Level (functions/warlevel.py).

    python3 -I scripts/warlevel_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warlevel as L  # noqa: E402


class Ranks(unittest.TestCase):
    def test_ranks_and_the_next_one(self):
        self.assertEqual([L.rank(p) for p in (0, 19, 20, 59, 60, 120, 200, 299, 300, 5000)],
                         ["Recruit", "Recruit", "Soldier", "Soldier", "Sergeant", "Captain", "Commander", "Commander", "General", "General"])
        self.assertEqual(L.next_rank(50), ("Sergeant", 10))
        self.assertIsNone(L.next_rank(300))
        self.assertEqual(L.rank(None), "Recruit")

    def test_level_armies_100_plus_10_a_rank_at_most_150(self):
        self.assertEqual([L.army(p) for p in (0, 20, 60, 120, 200, 300, 9999)], [100, 110, 120, 130, 140, 150, 150])


class Awards(unittest.TestCase):
    def test_battles(self):
        self.assertEqual(L.attack_awards({"result": "attacker", "attacker": "a", "defender": "b"}), [("a", 3, "battle")])
        self.assertEqual(L.attack_awards({"result": "attacker", "attacker": "a", "defender": "b", "captured": True, "slayer": True}),
                         [("a", 3, "battle"), ("a", 5, "capture"), ("a", 2, "slayer")])
        self.assertEqual(L.attack_awards({"result": "defender", "attacker": "a", "defender": "b"}), [("b", 3, "defence")])
        for r in ("draw", "declined", "conceded", "cancelled"):
            self.assertEqual(L.attack_awards({"result": r, "attacker": "a", "defender": "b", "captured": True}), [])  # nothing for concessions
        self.assertEqual(L.battle_awards({"winner": "c", "slayer": True}), [("c", 3, "battle"), ("c", 2, "slayer")])

    def test_war_results(self):
        rows = [{"uid": u, "rank": i + 1} for i, u in enumerate("abcd")]
        self.assertEqual(L.result_awards(rows), [("a", 10, "warWin"), ("b", 5, "top3"), ("c", 5, "top3")])
        self.assertEqual(L.result_awards(rows[:1]), [])  # a War of one isn't a result


if __name__ == "__main__":
    unittest.main()
