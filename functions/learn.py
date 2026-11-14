"""Trading 101 chapters, as the server sees them (owner 2026-10-21; ten chapters since 2026-11-14:
fundamentals, risk, charts & P&L, indicators & alerts, patterns, options basics, managing options,
advanced stocks, advanced options, and The mental game, which is always open).

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
        "lessons": ["stocks", "market-works", "prices", "buy-sell", "order-types", "practice-money", "buying-power", "portfolio-words", "what-moves", "trading-words", "battles"],
        "answers": [1, 0, 1, 2, 0],
        "pass": 4,
    },
    "risk": {
        "lessons": ["position", "entry", "exit-plan", "stops", "stop-limits", "take-profit", "risk-reward", "sizing", "one-basket", "emotions-plan"],
        "answers": [1, 2, 0, 1, 1],
        "pass": 4,
    },
    "charts": {
        "lessons": ["charts", "candle-shapes", "timeframes", "trends", "volume", "pnl-real", "pnl-percent", "account-effect", "manage-trade", "reconsider", "up-not-profit"],
        "answers": [2, 1, 1, 1, 1],
        "pass": 4,
    },
    "signals": {
        "lessons": ["indicators-what", "moving-averages", "rsi", "macd", "volume-tools", "combine", "forecasts", "alerts-why", "alert-vs-order"],
        "answers": [1, 0, 0, 1, 1],
        "pass": 4,
    },
    "patterns": {
        "lessons": ["support-resistance", "pat-hs", "pat-ihs", "pat-double", "pat-triple", "pat-triangles", "pat-flags", "pat-wedges", "pat-cup", "pat-confirm", "chart-checklist"],
        "answers": [1, 1, 0, 0, 1],
        "pass": 4,
    },
    "options": {
        "lessons": ["opt-what", "opt-call", "opt-put", "opt-strike-exp", "opt-premium", "opt-moneyness", "opt-pricing", "opt-vs-stock", "opt-risk"],
        "answers": [2, 0, 0, 1, 1],
        "pass": 4,
    },
    "options-manage": {
        "lessons": ["om-performance", "om-decay", "om-iv", "om-expiry", "om-profits-losses", "om-contracts", "om-overlap", "om-reversal"],
        "answers": [0, 1, 0, 1, 1],
        "pass": 4,
    },
    "adv-stocks": {
        "lessons": ["as-entries", "as-risk", "as-combine", "as-scaling", "as-hedging", "as-portfolio"],
        "answers": [0, 0, 0, 0, 0],
        "pass": 4,
    },
    "adv-options": {
        "lessons": ["ao-combine", "ao-protective-put", "ao-covered-call", "ao-cash-secured", "ao-hedge", "ao-runner", "ao-runner-plan"],
        "answers": [0, 0, 0, 1, 0],
        "pass": 4,
    },
    "mind": {
        "lessons": ["mg-revenge", "mg-fomo", "mg-overconfidence", "mg-losses", "mg-overtrading", "mg-discipline", "mg-money", "mg-breaks", "mg-colors", "mg-virtual-real"],
        "answers": [1, 1, 1, 0, 1],
        "pass": 4,
        "open": True,  # always unlocked (owner 2026-11-14)
    },
}

LESSON_IDS = {l for c in CHAPTERS.values() for l in c["lessons"]}
ORDER = list(CHAPTERS)  # chapters open in this order (owner 2026-10-21: no Chapter 2 before Chapter 1)


def lesson_chapter(lesson_id):
    """The chapter a lesson belongs to, or None."""
    return next((ch for ch, c in CHAPTERS.items() if lesson_id in c["lessons"]), None)


def chapter_open(chapter, passed):
    """A chapter is open once the chapter before it is passed (Chapter 1 always is, and so is any
    chapter marked "open", like The mental game). passed: users/{uid}.learnPassed ({chapter: ms})."""
    if chapter not in CHAPTERS:
        return False
    if CHAPTERS[chapter].get("open"):
        return True
    i = ORDER.index(chapter)
    passed = passed if isinstance(passed, dict) else {}
    return i == 0 or bool(passed.get(ORDER[i - 1])) or bool(passed.get(chapter))


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


# Retakes (owner 2026-10-23): after a failed chapter quiz the next try is free 12 hours later,
# or RETAKE_COST tokens right away. The results show the right answers, so an instant free
# retake would just be copying them. users/{uid}.learnFailed {chapter: ms} is server-only.
RETAKE_WAIT_MS = 12 * 3600 * 1000
RETAKE_COST = 10


def retake_at(chapter, failed, passed, now_ms):
    """When a free retake opens (ms), or None if the quiz can be taken free now: it was never
    failed, its wait is over, or the chapter is already passed."""
    failed = failed if isinstance(failed, dict) else {}
    passed = passed if isinstance(passed, dict) else {}
    last = failed.get(chapter)
    if passed.get(chapter) or not isinstance(last, (int, float)):
        return None
    free = int(last) + RETAKE_WAIT_MS
    return free if free > now_ms else None
