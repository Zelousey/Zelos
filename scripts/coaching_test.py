"""Unit tests for functions/coaching.py (Coach / Learn rules). python3 scripts/coaching_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import coaching as C
import xp as XP

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

def raises(fn, code, needle=""):
    try:
        fn()
        return False
    except C.CoachError as e:
        return e.code == code and needle.lower() in e.message.lower()

NOW, DAY = 1_800_000_000_000, 86400000

# who may coach whom
ok(not C.can_coach(149) and C.can_coach(150), "coaching unlocks at Level 3 (150 XP)")
C.check_start("c1", "s1", 200, 4, False); ok(True, "a Gold coach with 4 students can take a 5th")
ok(raises(lambda: C.check_start("c1", "s1", 200, 5, False), "FAILED_PRECONDITION", "5 students"), "6th student refused")
ok(raises(lambda: C.check_start("c1", "s1", 100, 0, False), "FAILED_PRECONDITION", "level 3"), "coach under Level 3 refused")
ok(raises(lambda: C.check_start("c1", "s1", 200, 0, True), "FAILED_PRECONDITION", "already have a coach"), "one coach per student")
ok(raises(lambda: C.check_start("c1", "c1", 900, 0, False), "FAILED_PRECONDITION", "yourself"), "can't coach yourself")

# tasks
t = C.validate_task({"kind": "trade", "n": 3, "days": 7}, NOW)
ok(t["label"] == "Make 3 practice trades" and t["dueAt"] == NOW + 7 * DAY and t["status"] == "open", "trade task: %s" % t["label"])
ok(C.validate_task({"kind": "win", "n": 1, "days": 1}, NOW)["label"] == "Close 1 winning trade", "singular label")
c = C.validate_task({"kind": "custom", "text": "  Read the   stop-loss guide ", "days": 3}, NOW)
ok(c["label"] == "Read the stop-loss guide" and c["n"] == 1, "custom task text cleaned")
ok(raises(lambda: C.validate_task({"kind": "trade", "n": 50}, NOW), "INVALID_ARGUMENT", "1 to 10"), "too many trades refused")
ok(raises(lambda: C.validate_task({"kind": "trade", "n": 2, "days": 99}, NOW), "INVALID_ARGUMENT", "days"), "odd day count refused")
ok(raises(lambda: C.validate_task({"kind": "xp", "n": 2}, NOW), "INVALID_ARGUMENT"), "no 'earn XP' tasks (can't farm)")
ok(raises(lambda: C.validate_task({"kind": "custom", "text": "x"}, NOW), "INVALID_ARGUMENT", "3 characters"), "empty custom task refused")

# progress
t2, done = C.advance(t, "trade", 2, NOW + 1000)
ok(t2["progress"] == 2 and not done, "2 of 3 trades")
t3, done = C.advance(t2, "trade", 5, NOW + 2000)
ok(t3["progress"] == 3 and done and t3["status"] == "done", "third trade completes it (capped at 3)")
ok(C.advance(t3, "trade", 1, NOW + 3000) == (t3, False), "a done task doesn't move")
ok(C.advance(t, "win", 1, NOW)[1] is False, "other events don't count")
exp, d2 = C.advance(t, "trade", 1, NOW + 8 * DAY)
ok(exp["status"] == "expired" and not d2, "past its due date the task expires")
ok(C.advance(c, "custom", 1, NOW)[1] is False, "custom tasks never complete from events")

# notes and reactions
ok(C.validate_note({"text": " Nice exit ", "reaction": "good", "tradeId": "abc123"}, 0) == ("Nice exit", "good", "abc123"), "a reaction on a trade")
ok(C.validate_note({"reaction": "bad"}, 0)[1] == "bad", "a reaction alone is fine")
ok(raises(lambda: C.validate_note({"text": ""}, 0), "INVALID_ARGUMENT"), "empty note refused")
ok(raises(lambda: C.validate_note({"text": "hi"}, C.NOTES_PER_DAY), "RESOURCE_EXHAUSTED"), "daily note limit")
ok(raises(lambda: C.validate_note({"text": "hi", "tradeId": "../x"}, 0), "INVALID_ARGUMENT"), "bad trade id refused")
ok(len(C.validate_note({"text": "x" * 900}, 0)[0]) == C.MAX_NOTE, "notes cut at 500 characters")

# XP stays small and server-only
ok(set(XP.COACH_TASK_XP) == set(C.KINDS) and set(XP.COACH_BONUS_XP) == set(C.KINDS) - {"custom"}, "every task kind has XP; custom pays the coach nothing")
ok(max(XP.COACH_TASK_XP.values()) <= 15 and XP.DAILY_LIMIT["coach-task"] == 3 and XP.DAILY_LIMIT["coach-bonus"] == 6, "small XP, daily limits 3 / 6")
ok(XP.decide("coach-task", "trade:abcdef12", "2026-10-08")[0] == 10 and XP.decide("coach-bonus", "custom:20261008", "2026-10-08")[2] == "bad-ref", "xp.py pays coach tasks, never a coach bonus for custom tasks")
ok("coach-task" in XP.SERVER_ONLY and "coach-bonus" in XP.SERVER_ONLY, "browsers can't claim coaching XP")

# what the coach sees
s = C.summary({"xp": 420, "email": "x@y.z"}, {"level": 4, "levelName": "Platinum", "equity": 11200, "growthPct": 12},
              [{"id": "t1", "sym": "NVDA", "pnl": 120.5, "pct": 4.1, "qty": 5, "entry": 100, "exit": 104, "at": 5}, {"id": "t2", "sym": "X", "pnl": "bad"}],
              {"day": {"date": "2026-10-08", "done": {"trade": True, "news": True}}, "streak": {"days": 3, "lastDate": "2026-10-08"}}, "2026-10-08")
ok(s["xp"] == 420 and s["level"] == 4 and s["missionsToday"] == 2 and s["streak"] == 3 and "email" not in s, "summary: level, XP, missions, streak, nothing private")
ok(len(s["trades"]) == 1 and s["trades"][0]["sym"] == "NVDA" and s["trades"][0]["pnl"] == 120.5, "individual trades shown, junk rows skipped")

print("\n%s (%d failed)" % ("ALL COACHING CHECKS PASSED" if not fails else "SOME CHECKS FAILED", fails))
sys.exit(1 if fails else 0)
