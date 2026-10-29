"""Tests for private War lobbies (functions/warlobby.py).

    python3 -I scripts/warlobby_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warlobby as L  # noqa: E402
from warmarket import WarError  # noqa: E402

H = 3600000
CFG = {"name": "Sector clash", "days": 3, "lobbyHours": 6, "maxPlayers": 3}


def lobby(players=("org",), invited=("bob", "cat", "dan")):
    w = L.open_lobby(L.new_war("org", "Org", dict(CFG), 0), "org", 10)
    w = dict(w, invited=list(invited))
    for p in players[1:]:
        w = L.join(w, p, p.title(), 20)
    return w


class Config(unittest.TestCase):
    def test_settings_are_checked(self):
        self.assertEqual(L.validate_config(dict(CFG, name="  Sector   clash ")), CFG)
        self.assertEqual(L.validate_config(dict(CFG, days=7.0))["days"], 7)
        for bad in (dict(CFG, name="x"), dict(CFG, days=4), dict(CFG, days=14), dict(CFG, lobbyHours=72), dict(CFG, maxPlayers=11),
                    dict(CFG, maxPlayers=1), dict(CFG, days=True), None):
            with self.assertRaises(WarError):
                L.validate_config(bad)

    def test_map_size_by_players(self):
        self.assertEqual([L.map_size(n) for n in (2, 3, 4, 6, 7, 10)], [6, 6, 8, 8, 10, 10])

    def test_draft_then_open(self):
        w = L.new_war("org", "Org", dict(CFG), 0)
        self.assertEqual((w["status"], w["stage"], w["players"], w["soldiers"], w["armies"]), ("lobby", "configuring", ["org"], 100, "equal"))
        self.assertEqual(L.due_at(w), L.DRAFT_MS)
        w = L.configure(w, "org", dict(CFG, days=1), 5)
        self.assertEqual(w["days"], 1)
        with self.assertRaises(WarError):
            L.configure(w, "bob", CFG, 5)  # only the organizer
        with self.assertRaises(WarError):
            L.invite(w, "org", "bob", 5)  # not open yet
        w = L.open_lobby(w, "org", 10)
        self.assertEqual((w["stage"], w["deadline"]), ("recruiting", 10 + 6 * H))
        with self.assertRaises(WarError):
            L.configure(w, "org", CFG, 11)  # settings are fixed once it's open


class Recruiting(unittest.TestCase):
    def test_invite_join_ready_start(self):
        w = lobby(invited=())
        w = L.invite(w, "org", "bob", 30)
        for bad in ("org", "bob"):
            with self.assertRaises(WarError):
                L.invite(w, "org", bad, 31)  # yourself, or twice
        with self.assertRaises(WarError):
            L.join(w, "eve", "Eve", 31)  # invite only
        w = L.join(w, "bob", "Bob", 40)
        self.assertEqual((w["players"], w["invited"], w["stage"]), (["org", "bob"], [], "recruiting"))
        with self.assertRaises(WarError):
            L.start(w, "org", 41)  # Bob isn't ready
        w = L.set_ready(w, "bob", True, 50)
        self.assertEqual(w["stage"], "ready")
        with self.assertRaises(WarError):
            L.start(w, "bob", 51)  # only the organizer starts
        w = L.start(w, "org", 60)
        self.assertEqual((w["status"], w["mapSize"], w["startedAt"], w["endsAt"], w["dropped"]), ("active", 6, 60, 60 + 3 * 24 * H, []))
        self.assertEqual((w["phase"], L.due_at(w)), ("claiming", 60 + 3600000))  # claiming first (W4)
        with self.assertRaises(WarError):
            L.start(w, "org", 61)  # starts once
        with self.assertRaises(WarError):
            L.cancel(w, "org", 61)

    def test_full_lobby_and_new_joiner_unlocks_ready(self):
        w = lobby(players=("org", "bob"))
        w = L.set_ready(w, "bob", True, 30)
        self.assertEqual(w["stage"], "ready")
        w = L.join(w, "cat", "Cat", 31)
        self.assertEqual(w["stage"], "recruiting")  # someone new hasn't locked in
        with self.assertRaises(WarError):
            L.join(w, "dan", "Dan", 32)  # 3 is the max here
        self.assertEqual(L.join(w, "cat", "Cat", 33), w)  # joining twice changes nothing

    def test_leave_decline_cancel(self):
        w = lobby(players=("org", "bob"))
        with self.assertRaises(WarError):
            L.leave(w, "org", 30)
        with self.assertRaises(WarError):
            L.set_ready(w, "org", False, 30)
        w2 = L.leave(w, "bob", 30)
        self.assertEqual((w2["players"], "bob" in w2["names"]), (["org"], False))
        w3 = L.decline(w, "cat", 30)
        self.assertNotIn("cat", w3["invited"])
        with self.assertRaises(WarError):
            L.cancel(w, "bob", 30)
        c = L.cancel(w, "org", 30)
        self.assertEqual((c["status"], L.due_at(c)), ("cancelled", None))
        self.assertNotIn("due", L.stored(c))

    def test_nothing_after_the_deadline(self):
        w = lobby(players=("org", "bob"))
        for fn in (lambda: L.join(w, "cat", "Cat", w["deadline"]), lambda: L.set_ready(w, "bob", True, w["deadline"])):
            with self.assertRaises(WarError):
                fn()


class Deadlines(unittest.TestCase):
    def test_starts_with_who_is_ready(self):
        w = lobby(players=("org", "bob", "cat"))
        w = L.set_ready(w, "bob", True, 30)
        self.assertIs(L.at_deadline(w, w["deadline"] - 1), w)
        s = L.at_deadline(w, w["deadline"])
        self.assertEqual((s["status"], s["players"], s["dropped"], s["mapSize"]), ("active", ["org", "bob"], ["cat"], 6))
        self.assertEqual(set(s["names"]), {"org", "bob"})

    def test_cancels_without_two_ready_players_or_if_never_opened(self):
        w = lobby(players=("org", "bob"))
        self.assertEqual(L.at_deadline(w, w["deadline"])["why"], "not-enough-players")
        d = L.new_war("org", "Org", dict(CFG), 0)
        self.assertEqual(L.at_deadline(d, L.DRAFT_MS)["why"], "never-opened")

    def test_ends_after_its_days(self):
        w = L.start(L.set_ready(lobby(players=("org", "bob")), "bob", True, 30), "org", 40)
        self.assertIs(L.at_end(w, w["endsAt"] - 1), w)
        e = L.at_end(w, w["endsAt"])
        self.assertEqual((e["status"], L.due_at(e)), ("ended", None))


if __name__ == "__main__":
    unittest.main()
