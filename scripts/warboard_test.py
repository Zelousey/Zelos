"""Tests for the weekly War Zone leaderboards (functions/warboard.py).

    python3 -I scripts/warboard_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import warboard as B  # noqa: E402


def zone(name, rookie, rows):
    return {"name": name, "rookie": rookie, "names": {u: u.upper() for u, *_ in rows},
            "standings": [{"uid": u, "score": s, "ret": r, **({"forfeit": True} if f else {})} for u, s, r, f in rows]}


class Board(unittest.TestCase):
    def test_ranks_across_zones_open_and_rookie_apart(self):
        b = B.board([("z1", zone("Open zone 1", False, [("a", 80, 5, False), ("b", 40, 1, False)])),
                     ("z2", zone("Open zone 2", False, [("c", 90, 2, False), ("d", 80, 6, False), ("e", 99, 9, True)])),
                     ("z3", zone("Rookie zone 1", True, [("f", 10, 0, False)]))])
        self.assertEqual([r["uid"] for r in b["open"]["top"]], ["c", "d", "a", "b", "e"])  # ties by return; forfeits last
        self.assertEqual((b["open"]["ranks"]["a"], b["open"]["total"]), (3, 5))
        self.assertEqual(b["open"]["top"][0]["zone"], "Open zone 2")
        self.assertEqual((b["rookie"]["total"], b["rookie"]["top"][0]["name"]), (1, "F"))
        self.assertNotIn("forfeit", b["open"]["top"][-1])

    def test_top_ten_but_every_rank_kept(self):
        rows = [("u%02d" % i, 100 - i, 0, False) for i in range(25)]
        b = B.board([("z", zone("Open zone 1", False, rows))])
        self.assertEqual((len(b["open"]["top"]), b["open"]["ranks"]["u24"], b["open"]["total"]), (10, 25, 25))
        self.assertEqual(B.board([])["open"], {"top": [], "ranks": {}, "total": 0})


if __name__ == "__main__":
    unittest.main(verbosity=1)
