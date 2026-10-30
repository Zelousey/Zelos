"""Tests for the War Score and the comeback rules (functions/warscore.py).

    python3 -I scripts/warscore_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warattack as A  # noqa: E402
import warscore as S  # noqa: E402


def war(**kw):
    w = {"players": ["a", "b", "c"], "map": {
        "tech": {"state": "owned", "owner": "a", "how": "claimed"},      # 2
        "energy": {"state": "owned", "owner": "b", "how": "captured"},   # 3
        "health": {"state": "owned", "owner": "b", "how": "neutral"},    # 1
        "comms": {"state": "owned", "owner": "b", "how": "defended"},    # 3
        "finance": {"state": "contested", "contenders": ["a", "c"]},
        "consumer": {"state": "neutral"}}}
    w.update(kw)
    return w


class Score(unittest.TestCase):
    def test_trading_scale(self):
        self.assertEqual([S.trading(x) for x in (-15, -10, -2, 0, 6, 10, 25)], [0, 0, 40, 50, 80, 100, 100])

    def test_the_design_examples(self):
        # a +6% trader holding half the leader's land: 68; a -2% trader holding the most land: 64
        w = war(map={"tech": {"state": "owned", "owner": "a", "how": "claimed"}, "energy": {"state": "owned", "owner": "b", "how": "claimed"},
                     "health": {"state": "owned", "owner": "b", "how": "claimed"}}, players=["a", "b"])
        rows = S.standings(w, {"a": 6.0, "b": -2.0})
        self.assertEqual([(r["uid"], r["score"], r["rank"]) for r in rows], [("a", 68.0, 1), ("b", 64.0, 2)])

    def test_points_with_every_bonus(self):
        w = war(hotPoints={"a": 2}, bonusPoints={"c": 1}, slayerPoints={"c": 2})
        self.assertEqual(S.points(w), {"a": 4, "b": 7, "c": 3})

    def test_ties_go_to_the_higher_return_then_more_battle_wins(self):
        w = {"players": ["a", "b", "c"], "map": {}, "battleWins": {"c": 2}}
        rows = S.standings(w, {"a": 1.0, "b": 1.0, "c": 1.0})
        self.assertEqual(rows[0]["uid"], "c")
        rows2 = S.standings({"players": ["a", "b"], "map": {}}, {"a": 0.0, "b": 0.0})
        self.assertEqual([r["rank"] for r in rows2], [1, 2])


class Comeback(unittest.TestCase):
    def test_the_leader_has_no_free_decline(self):
        w = war(standings=[{"uid": "b"}, {"uid": "a"}], startedAt=0, endsAt=10 ** 9, status="active", phase="holding")
        self.assertEqual(S.leader(w), "b")
        w = A.new_attack(w, "x1", "a", "energy", "VOLTX", "bull", 0, 0, False)
        w = dict(w, noFreeDecline={S.leader(w): True})
        _, _, kind = A.answer(w, "x1", "b", {"accept": False}, 1)
        self.assertEqual(kind, "conceded")
        self.assertIsNone(S.leader(war(standings=[{"uid": "a"}])))  # alone: no leader yet

    def test_giant_slayer(self):
        w = war(standings=[{"uid": "b"}, {"uid": "a"}])
        self.assertEqual(S.slayer(w, "a", "b", False)["slayerPoints"], {"a": 1})
        self.assertEqual(S.slayer(w, "a", "b", True)["slayerPoints"], {"a": 2})
        self.assertIs(S.slayer(w, "a", "c", True), w)   # c isn't the leader
        self.assertIs(S.slayer(w, "b", "a", True), w)   # the leader winning isn't giant-slaying
        self.assertEqual(S.add_win(S.add_win(w, "a"), "a")["battleWins"], {"a": 2})


if __name__ == "__main__":
    unittest.main()
