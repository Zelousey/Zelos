"""Runs learn_quiz_run (Trading 101 chapter quizzes) from functions/main.py against the
Firestore emulator: a pass records users/{uid}.learnPassed and pays 50 XP once; a fail pays
nothing; lesson XP is 10 once per known lesson. Started by run-functions-e2e.sh."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402
from firebase_functions import https_fn  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


uid = "learner1"
db.collection("users").document(uid).set({"xp": 0, "learnDone": ["stocks"]})
key = main.LEARN.CHAPTERS["basics"]["answers"]
now = 1_792_600_000_000

wrong = [(a + 1) % 3 for a in key]
r = main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": wrong}, now)
u = db.collection("users").document(uid).get().to_dict()
ok(not r["passed"] and r["right"] == 0 and r["xp"] == 0 and u["xp"] == 0 and "learnPassed" not in u, "a failed quiz pays nothing and unlocks nothing")
ok([x["answer"] for x in r["results"]] == key, "the results show the right answers to learn from")

r = main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key)}, now + 1000)
u = db.collection("users").document(uid).get().to_dict()
ok(r["passed"] and r["xp"] == 50 and u["xp"] == 50, "a passed quiz pays 50 XP")
ok(u["learnPassed"]["basics"] == now + 1000 and u["learnDone"] == ["stocks"], "and records the pass (lessons list untouched)")

r = main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key)}, now + 2000)
u = db.collection("users").document(uid).get().to_dict()
ok(r["passed"] and r["xp"] == 0 and u["xp"] == 50, "passing again pays nothing more")

for bad in ({"chapter": "basics", "answers": [0, 1]}, {"chapter": "nope", "answers": list(key)}, {"answers": list(key)}, None):
    try:
        main.learn_quiz_run(db, uid, bad, now)
        ok(False, "bad input must be refused: %r" % (bad,))
    except https_fn.HttpsError:
        ok(True, "bad input refused: %r" % (bad,))

g = main.xp_grant(db, uid, "lesson", "prices", now)
g2 = main.xp_grant(db, uid, "lesson", "prices", now)
ok(g["awarded"] and not g2["awarded"] and db.collection("users").document(uid).get().to_dict()["xp"] == 60, "lesson XP: 10, once")
print("\n%d Trading 101 checks passed" % passed)
