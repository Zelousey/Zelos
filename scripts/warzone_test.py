"""Tests for open War zones (functions/warzone.py).

    python3 -I scripts/warzone_test.py
"""
import os
import sys
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warmap as M  # noqa: E402
import warzone as Z  # noqa: E402

ET = ZoneInfo("America/New_York")
H = 3600000


def ms(*a):
    return int(datetime(*a, tzinfo=ET).timestamp() * 1000)


class Seasons(unittest.TestCase):
    def test_monday_9am_et_to_the_next(self):
        start = ms(2026, 11, 2, 9)  # a Monday
        self.assertEqual(Z.season_start(ms(2026, 11, 4, 15)), start)
        self.assertEqual(Z.season_start(start), start)
        self.assertEqual(Z.season_start(start - 1), ms(2026, 10, 26, 9))  # Monday 8:59 is still last season
        self.assertEqual(Z.season_end(start), ms(2026, 11, 9, 9))
        self.assertEqual(Z.season_key(start), "2026-11-02")
        self.assertEqual(Z.zone_id("2026-11-02", True, 7), "z20261102r007")

    def test_daylight_saving_week_still_ends_at_9am(self):
        start = ms(2026, 10, 26, 9)  # clocks go back on Sunday 1 November
        self.assertEqual(Z.season_end(start), ms(2026, 11, 2, 9))
        self.assertEqual(Z.season_end(start) - start, 7 * 24 * H + H)


class Armies(unittest.TestCase):
    def test_smaller_army_later_in_the_season(self):
        s = ms(2026, 11, 2, 9)
        self.assertEqual(Z.army(0, s, s + 30 * 60000), 100)            # claiming hour: full army
        self.assertEqual([Z.army(0, s, s + 2 * H + d * 24 * H) for d in range(7)], [100, 90, 80, 70, 60, 50, 50])
        self.assertEqual(Z.army(300, s, s + 5 * 24 * H + H), 100)      # a General: 150, 50 fewer by day 6
        self.assertEqual(Z.army(9999, s, s + 2 * H), 150)

    def test_rookies_are_recruits_and_soldiers(self):
        self.assertEqual([Z.is_rookie(p) for p in (0, 19, 20, 59, 60)], [True, True, True, True, False])


class Zones(unittest.TestCase):
    def setUp(self):
        self.s = ms(2026, 11, 2, 9)

    def test_a_zone_made_in_the_claiming_hour_claims_in_secret(self):
        z = Z.new_zone("2026-11-02", False, 1, self.s, self.s + 60000)
        self.assertEqual((z["phase"], z["claimEnds"], z["name"]), ("claiming", self.s + H, "Open zone 1"))
        z, place = Z.add_player(z, "a", "Ann", 110, 100000.0, self.s + 60000)
        self.assertIsNone(place)
        self.assertEqual((z["troops"], z["shieldUntil"], z["open"]), ({"a": 110}, {}, True))
        self.assertFalse(M.claiming_over(z, {"a": {"locked": True}}, self.s + 120000))  # others can still drop in
        self.assertTrue(M.claiming_over(z, {}, self.s + H))

    def test_drop_in_after_the_hour_lands_in_reserve_with_a_shield(self):
        now = self.s + 3 * 24 * H
        z = Z.new_zone("2026-11-02", True, 2, self.s, now)
        self.assertEqual(z["phase"], "holding")
        self.assertTrue(all(c["state"] == "neutral" for c in z["map"].values()))
        z, place = Z.add_player(z, "b", "Bo", 70, 90000.0, now)
        self.assertEqual(place["reserve"], 70)
        self.assertEqual((z["shieldUntil"]["b"], z["startEquity"]["b"], Z.since(z, "b")), (now + 24 * H, 90000.0, now))
        self.assertTrue(Z.shielded(z, "b", now + 23 * H))
        self.assertFalse(Z.shielded(z, "b", now + 24 * H))
        self.assertFalse(Z.shielded(Z.end_shield(z, "b"), "b", now + H))

    def test_full_or_last_hour(self):
        z = Z.new_zone("2026-11-02", False, 1, self.s, self.s + 2 * H)
        for i in range(Z.SIZE):
            z, _ = Z.add_player(z, "p%d" % i, "P", 100, 1.0, self.s + 2 * H)
        self.assertFalse(z["open"])
        with self.assertRaises(Exception):
            Z.add_player(z, "x", "X", 100, 1.0, self.s + 2 * H)
        z2 = Z.new_zone("2026-11-02", False, 2, self.s, self.s + 2 * H)
        with self.assertRaises(Exception):
            Z.add_player(z2, "x", "X", 100, 1.0, z2["endsAt"] - 30 * 60000)

    def test_leaving_frees_your_land_but_not_mid_battle(self):
        z = Z.new_zone("2026-11-02", False, 1, self.s, self.s + 2 * H)
        z, _ = Z.add_player(z, "a", "Ann", 100, 1.0, self.s + 2 * H)
        z["map"]["tech"] = {"state": "owned", "owner": "a", "how": "neutral"}
        z["attacks"] = {"x": {"stage": "answering", "attacker": "c", "defender": "a"}}
        with self.assertRaises(Exception):
            Z.leave(z, "a", self.s + 3 * H)
        z["attacks"]["x"]["stage"] = "done"
        out = Z.leave(z, "a", self.s + 3 * H)
        self.assertEqual((out["players"], out["map"]["tech"]["state"], out["left"], out["open"]), ([], "neutral", ["a"], True))

    def test_who_carries_over(self):
        rows = [{"uid": "a", "points": 3, "ret": 0.0}, {"uid": "b", "points": 0, "ret": -1.2}, {"uid": "c", "points": 0, "ret": 0.0}]
        self.assertEqual(Z.carried(rows), ["a", "b"])

    def test_level_armies_on_the_map(self):
        fin = M.final_placements(["a", "b"], list(M.TERRITORIES), {"a": 110, "b": 100}, {"a": {"soldiers": {"tech": 50, "energy": 50, "health": 10}}}, spread=False)
        self.assertEqual(fin["a"]["soldiers"]["health"], 10)
        self.assertEqual((fin["b"]["soldiers"], fin["b"]["reserve"]), ({}, 100))  # never placed: all in reserve, no land


class Season2(unittest.TestCase):
    def test_rookies_choose_open_zones_sergeants_must(self):
        self.assertEqual([Z.plays_rookie(0, None), Z.plays_rookie(0, "open"), Z.plays_rookie(0, "rookie"), Z.plays_rookie(60, "rookie")],
                         [True, False, True, False])

    def test_going_broke_reset(self):
        now = ms(2026, 11, 4, 12)
        prof = {"cash": 5000.0, "held": 0, "positions": {"NIMBC": {"qty": 1, "avg": 10}}, "chart": [{"t": 1, "eq": 5000.0}]}
        with self.assertRaises(Exception):
            Z.check_reset(prof, 10000.0, now)                              # not broke enough
        with self.assertRaises(Exception):
            Z.check_reset(dict(prof, held=5000), 5000.0, now)              # stakes held
        Z.check_reset(prof, 5010.0, now)
        out = Z.reset_profile(prof, now)
        self.assertEqual((out["cash"], out["positions"], out["start"], out["lastResetAt"], out["chart"][-1]), (100000.0, {}, 100000.0, now, {"t": now, "eq": 100000.0, "reset": True}))
        with self.assertRaises(Exception) as e:
            Z.check_reset(dict(out, cash=1000.0), 1000.0, now + 6 * 24 * H)  # once a week
        self.assertEqual(e.exception.details["next"], now + 7 * 24 * H)
        Z.check_reset(dict(out, cash=1000.0), 1000.0, now + 7 * 24 * H)

    def test_forfeit_and_season_records(self):
        w = {"players": ["a", "b"], "season": "2026-11-02", "name": "Rookie zone 1", "rookie": True}
        f = Z.forfeit(w, "a", 5)
        self.assertEqual(f["forfeits"], {"a": 5})
        self.assertIs(Z.forfeit(f, "a", 6), f)
        rec = Z.season_record(w, {"rank": 2, "score": 61.5}, 8)
        self.assertEqual(rec, {"season": "2026-11-02", "zone": "Rookie zone 1", "rookie": True, "rank": 2, "of": 8, "score": 61.5, "forfeit": False})
        prof = {"seasons": [rec] * 10}
        self.assertEqual(len(Z.add_season(prof, dict(rec, rank=1))), 10)
        self.assertEqual(Z.add_season(prof, dict(rec, rank=1))[-1]["rank"], 1)


if __name__ == "__main__":
    unittest.main()
