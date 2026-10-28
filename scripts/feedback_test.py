"""Unit tests for functions/feedback.py (message checks, daily limit). python3 scripts/feedback_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import feedback as F

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

def err(data, needle):
    try:
        F.validate(data)
        return False
    except F.FeedbackError as e:
        return needle.lower() in str(e).lower()

v = F.validate({"topic": "idea", "text": "  Dark charts please \x07 ", "page": "/dashboard?p=market"})
ok(v == {"topic": "idea", "text": "Dark charts please", "page": "/dashboard?p=market"}, "clean message: %s" % v)
ok(F.validate({"topic": "nope", "text": "hello there"})["topic"] == "other", "unknown topic -> other")
ok(F.validate({"text": "hello there", "page": "javascript:alert(1)"})["page"] is None, "odd page dropped")
ok(F.validate({"text": "hello there", "page": "/" + "a" * 200})["page"] is None, "long page dropped")
ok(err({"text": "hey"}, "a little more"), "too short rejected")
ok(err({"text": "x" * 1001}, "too long"), "too long rejected")
ok(F.validate({"text": "x" * 1000})["text"] == "x" * 1000, "1,000 characters ok")
ok(err({"text": 5}, "message"), "not text rejected")
ok(err(None, "message"), "no data rejected")

day = "2026-10-28"
lim = None
for i in range(F.MAX_PER_DAY):
    allowed, lim = F.take_slot(lim, day)
    ok(allowed and lim == {"day": day, "count": i + 1}, "message %d allowed" % (i + 1))
allowed, lim2 = F.take_slot(lim, day)
ok(not allowed and lim2 == lim, "message %d refused the same day" % (F.MAX_PER_DAY + 1))
allowed, lim3 = F.take_slot(lim, "2026-10-29")
ok(allowed and lim3 == {"day": "2026-10-29", "count": 1}, "next day starts over")
ok(F.take_slot({"day": day, "count": "lots"}, day) == (True, {"day": day, "count": 1}), "junk count treated as 0")

print("\n%d failure(s)" % fails)
sys.exit(1 if fails else 0)
