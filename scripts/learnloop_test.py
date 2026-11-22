"""The learning loop rules (functions/learnloop.py) and the review XP in functions/xp.py.
Run: functions/venv/bin/python -I scripts/learnloop_test.py"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "functions"))
import learn as LEARN  # noqa: E402
import learnloop as L  # noqa: E402
import xp as XP  # noqa: E402

T = "2026-11-23"  # a Monday


class Questions(unittest.TestCase):
    def test_every_lesson_has_a_check_answer(self):
        self.assertEqual({k.split(":")[0] for k in L.CHECKS}, LEARN.LESSON_IDS)
        self.assertTrue(all(":" not in k or k.endswith(":2") for k in L.CHECKS))  # a second check is "<lesson>:2"
        self.assertEqual(len(L.QIDS), len(L.CHECKS) + sum(len(c["answers"]) for c in LEARN.CHAPTERS.values()))

    def test_new_question_types(self):
        # a put-in-order question's answer is the steps in order; a tap-the-level answer is a number
        self.assertEqual(L.answer_of("c:exit-plan:2"), [0, 1, 2, 3, 4])
        self.assertIsInstance(L.answer_of("c:stops:2"), int)
        self.assertEqual(L.check_qid("stops", 2), "c:stops:2")
        self.assertEqual(L.check_qid("stops", None), "c:stops")
        self.assertEqual(L.check_qid("stops", 7), "c:stops")
        for good in (0, 9, [0], [3, 1, 2, 0, 4]):
            self.assertTrue(L.valid_pick(good), good)
        for bad in (True, -1, 10, "1", [], [0] * 9, [0, "1"], [True], None, 1.5):
            self.assertFalse(L.valid_pick(bad), bad)
        r = L.miss({}, "c:exit-plan:2", T)
        self.assertIn("c:exit-plan:2", r)

    def test_answers(self):
        self.assertEqual(L.answer_of("c:stocks"), L.CHECKS["stocks"])
        self.assertEqual(L.answer_of("q:basics:0"), LEARN.CHAPTERS["basics"]["answers"][0])
        for bad in ("c:nope", "q:basics:9", "q:x:0", "stocks", ""):
            self.assertIsNone(L.answer_of(bad))


class Review(unittest.TestCase):
    def test_a_miss_comes_back_tomorrow(self):
        r = L.miss({}, "c:stocks", T)
        self.assertEqual(r, {"c:stocks": {"box": 0, "due": "2026-11-24"}})
        self.assertEqual(L.due(r, T), [])
        self.assertEqual(L.due(r, "2026-11-24"), ["c:stocks"])
        # missing it again in a lesson doesn't reset a question already in the queue
        r2 = {"c:stocks": {"box": 3, "due": "2026-12-01"}}
        self.assertEqual(L.miss(r2, "c:stocks", T), r2)
        self.assertEqual(L.miss({}, "c:made-up", T), {})

    def test_spacing_then_mastered(self):
        r, day = L.miss({}, "q:risk:2", T), "2026-11-24"
        gaps = []
        while "q:risk:2" in r:
            r = L.answer(r, "q:risk:2", True, day)
            if "q:risk:2" in r:
                nxt = r["q:risk:2"]["due"]
                gaps.append((L.date.fromisoformat(nxt) - L.date.fromisoformat(day)).days)
                day = nxt
        self.assertEqual(gaps, [3, 7, 14, 30])  # then it's mastered and leaves the queue

    def test_wrong_starts_over(self):
        r = {"c:rsi": {"box": 3, "due": T}}
        self.assertEqual(L.answer(r, "c:rsi", False, T), {"c:rsi": {"box": 0, "due": "2026-11-24"}})

    def test_queue_is_capped(self):
        r = {"c:%d" % i: {"box": 0, "due": T} for i in range(L.REVIEW_MAX)}
        self.assertNotIn("c:stocks", L.miss(r, "c:stocks", T))

    def test_due_oldest_first(self):
        r = {"c:a": {"box": 0, "due": "2026-11-20"}, "c:b": {"box": 0, "due": "2026-11-18"}, "c:c": {"box": 0, "due": "2026-11-30"}}
        self.assertEqual(L.due(r, T), ["c:b", "c:a"])


class Streak(unittest.TestCase):
    def test_streak_goal_and_week(self):
        loop = L.progress(None, 10, T)
        self.assertEqual(loop, {"streak": {"days": 1, "best": 1, "last": T}, "day": {"date": T, "xp": 10}, "week": {"key": "2026-W48", "xp": 10}})
        loop = L.progress(loop, 2, T)  # same day: XP adds up, the streak doesn't
        self.assertEqual((loop["streak"]["days"], loop["day"]["xp"], loop["week"]["xp"]), (1, 12, 12))
        loop = L.progress(loop, 0, "2026-11-24")  # a wrong review answer still keeps the streak
        self.assertEqual((loop["streak"]["days"], loop["day"]["xp"], loop["week"]["xp"]), (2, 0, 12))
        loop = L.progress(loop, 5, "2026-11-30")  # missed days: back to 1, best kept; new week
        self.assertEqual((loop["streak"], loop["week"]), ({"days": 1, "best": 2, "last": "2026-11-30"}, {"key": "2026-W49", "xp": 5}))

    def test_view(self):
        loop = L.progress(L.progress(None, 10, "2026-11-22"), 10, T)
        self.assertEqual(L.view(loop, T), {"streak": 2, "best": 2, "today": 10, "week": 10})
        self.assertEqual(L.view(loop, "2026-11-24")["streak"], 2)  # not lost until a whole day is missed
        self.assertEqual(L.view(loop, "2026-11-25"), {"streak": 0, "best": 2, "today": 0, "week": 10})  # Sunday 11-22 was last week
        self.assertEqual(L.view(None, T), {"streak": 0, "best": 0, "today": 0, "week": 0})


class ReviewXp(unittest.TestCase):
    def test_paid_by_the_server_only(self):
        self.assertIn("review", XP.SERVER_ONLY)
        self.assertEqual(XP.decide("review", "%s:c:stocks" % T, T)[0], L.REVIEW_XP)
        self.assertEqual(XP.decide("review", "%s:c:nope" % T, T)[2], "bad-ref")
        self.assertEqual(XP.decide("review", "2026-11-01:c:stocks", T)[2], "bad-ref")
        self.assertEqual(XP.decide("review", "%s:c:stocks" % T, T, {"review": L.REVIEW_DAILY})[2], "daily-limit")

    def test_trading_is_not_learning(self):
        for k in ("practice-trade", "practice-win", "mission", "alert-open"):
            self.assertNotIn(k, L.LEARN_KINDS)


class Reminder(unittest.TestCase):
    def test_only_a_streak_about_to_break(self):
        kept_yesterday = L.progress(None, 10, "2026-11-22")
        self.assertTrue(L.reminder_due(kept_yesterday, T, None))
        self.assertFalse(L.reminder_due(kept_yesterday, T, T))  # once a day
        self.assertFalse(L.reminder_due(L.progress(kept_yesterday, 10, T), T, None))  # already learned today
        self.assertFalse(L.reminder_due(L.progress(None, 10, "2026-11-21"), T, None))  # already broken (missed the 22nd)
        self.assertFalse(L.reminder_due(None, T, None))

    def test_text(self):
        self.assertEqual(L.reminder_text(5, 0), ("Keep your 5-day learning streak", "One short Trading 101 lesson keeps it going."))
        self.assertEqual(L.reminder_text(1, 3)[0], "Keep your learning streak going")
        self.assertIn("3 questions from your review are waiting. Reviewing is free", L.reminder_text(2, 3)[1])
        for days in (1, 9):
            for due in (0, 1, 4):
                self.assertNotRegex(" ".join(L.reminder_text(days, due)).lower(), r"trade now|profit|buy|sell")


if __name__ == "__main__":
    unittest.main(verbosity=2)
