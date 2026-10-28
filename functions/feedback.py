"""Help & feedback (owner 2026-10-28: feedback is saved in the app).

feedback/{id}        one message: uid, topic, text, page, createdAt, status ('new' | 'done').
                     Server only (rules deny the browser); admins read it through feedback_list.
feedbackLimits/{uid} {day, count}: at most MAX_PER_DAY messages a day per account.

Pure helpers here (unit tests: scripts/feedback_test.py); the callables live in main.py.
"""
import re

TOPICS = ("idea", "problem", "question", "other")
MAX_TEXT = 1000
MIN_TEXT = 5
MAX_PER_DAY = 5
_PAGE = re.compile(r"^/[A-Za-z0-9/_?=&.-]{0,79}$")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class FeedbackError(ValueError):
    pass


def validate(data):
    """{topic, text, page?} from the browser -> the clean fields, or FeedbackError."""
    if not isinstance(data, dict):
        raise FeedbackError("Write a message first.")
    topic = data.get("topic")
    if topic not in TOPICS:
        topic = "other"
    text = data.get("text")
    if not isinstance(text, str):
        raise FeedbackError("Write a message first.")
    text = _CTRL.sub("", text).strip()
    if len(text) < MIN_TEXT:
        raise FeedbackError("Write a little more (at least %d characters)." % MIN_TEXT)
    if len(text) > MAX_TEXT:
        raise FeedbackError("That's too long (up to %d characters)." % MAX_TEXT)
    page = data.get("page")
    page = page if isinstance(page, str) and _PAGE.match(page) else None
    return {"topic": topic, "text": text, "page": page}


def take_slot(limit, day):
    """(allowed, new limit doc) for one more message on `day` (YYYY-MM-DD, New York)."""
    limit = limit if isinstance(limit, dict) else {}
    count = limit.get("count") if limit.get("day") == day and isinstance(limit.get("count"), int) else 0
    if count >= MAX_PER_DAY:
        return False, {"day": day, "count": count}
    return True, {"day": day, "count": count + 1}
