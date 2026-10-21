"""Trading 101 chapters, as the server sees them (owner 2026-10-21).

Each chapter is a row of short lessons and a chapter quiz. The server pays:
  - 10 XP once per lesson (xp_award type "lesson", refId = the lesson id below);
  - 50 XP once per chapter, only when the chapter quiz is passed (learn_quiz, which
    grades the answers here, so the bonus can't be claimed from a browser).
Passing a chapter's quiz also unlocks the next chapter, so players who already know the
basics can test out. The questions and options live in webapp/src/features/learn/quizzes.json;
the answers live only here. scripts/learn_test.py checks the two stay in step.
"""

LESSON_XP = 10
CHAPTER_XP = 50

CHAPTERS = {
    "basics": {
        "lessons": ["stocks", "prices", "practice-money", "charts", "buy-sell", "stops", "take-profit", "battles"],
        "answers": [1, 0, 2, 2, 0],
        "pass": 4,
    },
    "charts": {
        "lessons": ["timeframes", "trends", "support-resistance", "moving-averages", "volume", "candle-shapes", "rsi", "chart-checklist"],
        "answers": [1, 2, 0, 1, 0],
        "pass": 4,
    },
}

LESSON_IDS = {l for c in CHAPTERS.values() for l in c["lessons"]}


def grade(chapter, answers):
    """(right, total, passed, results) for a chapter quiz, or None for an unknown chapter or
    answers of the wrong shape. results: [{"ok": bool, "answer": index of the right choice}]."""
    c = CHAPTERS.get(chapter) if isinstance(chapter, str) else None
    key = c["answers"] if c else None
    if not key or not isinstance(answers, list) or len(answers) != len(key):
        return None
    picked = []
    for a in answers:
        if isinstance(a, bool) or not isinstance(a, int) or not (-1 <= a <= 9):
            return None
        picked.append(a)
    results = [{"ok": p == k, "answer": k} for p, k in zip(picked, key)]
    right = sum(1 for r in results if r["ok"])
    return right, len(key), right >= c["pass"], results
