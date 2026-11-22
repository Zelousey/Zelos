"""The learning loop (research review 2026-11-22: "Zelos should win on learning, not trading").

Rewards learning only, never trades or profits:
  - a learning streak: a New York day counts when you finish a lesson, pass a chapter quiz,
    finish a Hall of Minds step or answer a review question. Separate from the mission streak.
  - a daily goal: learning XP today against the goal you chose (GOALS); nothing is paid for it.
  - spaced review of the questions you missed: a missed quick check or chapter-quiz question
    comes back the next day, then after 3, 7, 14 and 30 days while you keep getting it right,
    and drops out once mastered. A wrong answer starts it over. Review is always free.
  - a weekly learning league: learning XP this week (Monday to Sunday, New York), public.

Pure functions; functions/main.py does the reads and writes:
  users/{uid}.learnLoop  {streak: {days, best, last}, day: {date, xp}, week: {key, xp}}  server-only
  users/{uid}.review     {qid: {box, due}}                                               server-only
  users/{uid}.learnGoal  10 | 20 | 30 | 50 (yours to set)
  learnLeague/{week}/rows/{uid}  {name, xp, updatedAt}  public, server-written

Question ids: "c:<lesson id>" (a lesson's quick check), "q:<chapter id>:<n>" (chapter quiz question n).
"""
import json
import os
from datetime import date, timedelta

import learn as LEARN

LEARN_KINDS = ("lesson", "chapter", "mind", "mind-step", "review")
GOALS = (10, 20, 30, 50)
DEFAULT_GOAL = 20
INTERVALS = (1, 3, 7, 14, 30)  # days until a question comes back, by box (0 = just missed)
REVIEW_XP = 2
REVIEW_DAILY = 25  # paid review answers a day (50 XP); answering more still counts for the streak
REVIEW_BATCH = 10
REVIEW_MAX = 300  # questions kept in your queue

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "learn_checks.json"), encoding="utf-8") as _f:
    CHECKS = json.load(_f)  # {lesson id: right option of its quick check}; webapp checks.test.ts keeps it in step


def qids():
    """Every question that can be reviewed."""
    out = {"c:" + l for l in CHECKS}
    for ch, c in LEARN.CHAPTERS.items():
        out.update("q:%s:%d" % (ch, i) for i in range(len(c["answers"])))
    return out


QIDS = frozenset(qids())


def answer_of(qid):
    """The right option of a question, or None for an unknown id."""
    if qid not in QIDS:
        return None
    if qid.startswith("c:"):
        return CHECKS[qid[2:]]
    _, ch, n = qid.split(":")
    return LEARN.CHAPTERS[ch]["answers"][int(n)]


def add_day(day, n):
    return (date.fromisoformat(day) + timedelta(days=n)).isoformat()


def week_key(day):
    y, w, _ = date.fromisoformat(day).isocalendar()
    return "%d-W%02d" % (y, w)


def miss(review, qid, today):
    """review after a first-time miss: the question comes back tomorrow (box 0). A question
    already in the queue is left where it is (missing it in a lesson again isn't a review)."""
    review = dict(review or {})
    if qid in QIDS and qid not in review and len(review) < REVIEW_MAX:
        review[qid] = {"box": 0, "due": add_day(today, INTERVALS[0])}
    return review


def due(review, today):
    """Question ids due today or earlier, oldest first."""
    rows = [(v.get("due") or "", q) for q, v in (review or {}).items() if isinstance(v, dict) and (v.get("due") or "") <= today]
    return [q for _, q in sorted(rows)]


def answer(review, qid, ok, today):
    """review after answering a due question: right moves it up a box (out of the queue after the
    last one), wrong starts it over tomorrow."""
    review = dict(review or {})
    cur = review.get(qid)
    if not isinstance(cur, dict):
        return review
    if not ok:
        review[qid] = {"box": 0, "due": add_day(today, INTERVALS[0])}
        return review
    box = int(cur.get("box") or 0) + 1
    if box >= len(INTERVALS):
        review.pop(qid)
    else:
        review[qid] = {"box": box, "due": add_day(today, INTERVALS[box])}
    return review


def progress(loop, xp, today):
    """learnLoop after a learning action worth xp (0 still keeps the streak)."""
    loop = loop if isinstance(loop, dict) else {}
    st = dict(loop.get("streak") or {})
    if st.get("last") != today:
        days = int(st.get("days") or 0) + 1 if st.get("last") == add_day(today, -1) else 1
        st = {"days": days, "best": max(days, int(st.get("best") or 0)), "last": today}
    day = loop.get("day") or {}
    day_xp = (int(day.get("xp") or 0) if day.get("date") == today else 0) + int(xp)
    wk = week_key(today)
    week = loop.get("week") or {}
    week_xp = (int(week.get("xp") or 0) if week.get("key") == wk else 0) + int(xp)
    return {"streak": st, "day": {"date": today, "xp": day_xp}, "week": {"key": wk, "xp": week_xp}}


def view(loop, today):
    """What the app shows: the streak (0 once a day is missed), today's and this week's learning XP."""
    loop = loop if isinstance(loop, dict) else {}
    st = loop.get("streak") or {}
    alive = st.get("last") in (today, add_day(today, -1))
    day = loop.get("day") or {}
    week = loop.get("week") or {}
    return {
        "streak": int(st.get("days") or 0) if alive else 0,
        "best": int(st.get("best") or 0),
        "today": int(day.get("xp") or 0) if day.get("date") == today else 0,
        "week": int(week.get("xp") or 0) if week.get("key") == week_key(today) else 0,
    }
