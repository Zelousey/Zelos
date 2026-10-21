"""Unit tests for functions/learn.py (Trading 101) and its XP rules. python3 scripts/learn_test.py"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import learn as L
import xp as XP

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

# the app's questions and the server's answers stay in step
with open(os.path.join(ROOT, "webapp", "src", "features", "learn", "quizzes.json"), encoding="utf-8") as f:
    QZ = json.load(f)
for ch, c in L.CHAPTERS.items():
    qs = QZ.get(ch) or []
    ok(len(qs) == len(c["answers"]), "%s: %d questions in the app, %d answers on the server" % (ch, len(qs), len(c["answers"])))
    ok(all(0 <= a < len(q["opts"]) for q, a in zip(qs, c["answers"])), "%s: every answer is one of the question's choices" % ch)
    ok(all("answer" not in q and "right" not in q for q in qs), "%s: the app's file holds no answers" % ch)
    ok(0 < c["pass"] <= len(c["answers"]), "%s: pass mark %d of %d" % (ch, c["pass"], len(c["answers"])))
ok(set(QZ) - {"_note"} == set(L.CHAPTERS), "every chapter in the app has a quiz on the server")
# ...and the app's lessons are the ones the server pays XP for
import re
with open(os.path.join(ROOT, "webapp", "src", "features", "learn", "chapters.ts"), encoding="utf-8") as f:
    APP_LESSONS = re.findall(r"^    id: '([a-z0-9-]+)',$", f.read(), re.M)
ok(sorted(APP_LESSONS) == sorted(L.LESSON_IDS), "the app's lessons match the server's (%d)" % len(APP_LESSONS))

key = L.CHAPTERS["basics"]["answers"]
r = L.grade("basics", list(key))
ok(r[0] == 5 and r[2] and all(x["ok"] for x in r[3]), "all right: passed")
one_off = list(key); one_off[0] = (key[0] + 1) % 3
r = L.grade("basics", one_off)
ok(r[0] == 4 and r[2] and not r[3][0]["ok"] and r[3][0]["answer"] == key[0], "4 of 5 passes and shows the right answer for the miss")
two_off = list(one_off); two_off[1] = (key[1] + 1) % 3
ok(not L.grade("basics", two_off)[2], "3 of 5 does not pass")
ok(L.grade("basics", [-1] * 5)[0] == 0, "skipped answers count as wrong")
for bad in (None, [], [0, 1], [0, 0, 0, 0, "1"], [0, 0, 0, 0, True], [0, 0, 0, 0, 99], "01234"):
    ok(L.grade("basics", bad) is None, "bad answers refused: %r" % (bad,))
ok(L.grade("nope", list(key)) is None and L.grade(None, list(key)) is None, "unknown chapter refused")

# XP: 10 a lesson (known lessons only), 50 a chapter (server only)
ok(XP.decide("lesson", "stocks", "2026-10-21") == (10, "stocks", None), "lesson XP")
ok(XP.decide("lesson", "made-up", "2026-10-21")[2] == "bad-ref", "unknown lesson: no XP")
ok(XP.decide("lesson", "rsi", "2026-10-21") == (10, "rsi", None), "chapter 2 lesson XP")
ok(XP.decide("chapter", "charts", "2026-10-21") == (50, "charts", None), "chapter 2 XP")
ok(XP.decide("chapter", "basics", "2026-10-21") == (50, "basics", None) and "chapter" in XP.SERVER_ONLY, "chapter XP, paid only by the server")
ok(len(L.LESSON_IDS) == sum(len(c["lessons"]) for c in L.CHAPTERS.values()), "lesson ids are unique across chapters")

print("\n%s" % ("ALL CHECKS PASSED" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
