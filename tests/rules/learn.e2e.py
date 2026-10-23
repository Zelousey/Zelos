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

# retakes (owner 2026-10-23): free 12 hours after a fail, or 10 tokens right away
ok(u["learnFailed"]["basics"] == now and r["retakeAt"] == now + main.LEARN.RETAKE_WAIT_MS, "the fail is recorded with when a free retake opens")
try:
    main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key)}, now + 500)
    ok(False, "an instant free retake must be refused")
except https_fn.HttpsError as e:
    ok(e.details == {"retakeAt": now + main.LEARN.RETAKE_WAIT_MS, "cost": 10}, "an instant retake is refused, with when it's free and the price")
db.collection("wallets").document(uid).set({"balance": 4})
try:
    main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key), "retakeNow": True}, now + 600)
    ok(False, "paying with too few tokens must be refused")
except https_fn.HttpsError as e:
    ok("need 10 tokens and have 4" in str(e.message) and "learnPassed" not in db.collection("users").document(uid).get().to_dict(), "paying with too few tokens is refused and nothing is graded")
db.collection("wallets").document(uid).set({"balance": 15})
r = main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key), "retakeNow": True}, now + 1000)
u = db.collection("users").document(uid).get().to_dict()
ok(r["passed"] and r["xp"] == 50 and u["xp"] == 50 and r["charged"] == 10, "a passed quiz pays 50 XP")
ok(db.collection("wallets").document(uid).get().to_dict()["balance"] == 5, "the retake now cost 10 tokens")
other = "learn-wait-%d" % now
main.learn_quiz_run(db, other, {"chapter": "basics", "answers": wrong}, now)
r = main.learn_quiz_run(db, other, {"chapter": "basics", "answers": list(key)}, now + main.LEARN.RETAKE_WAIT_MS + 1)
ok(r["passed"] and r["charged"] == 0, "12 hours later the retake is free")
ok(u["learnPassed"]["basics"] == now + 1000 and u["learnDone"] == ["stocks"], "and records the pass (lessons list untouched)")

r = main.learn_quiz_run(db, uid, {"chapter": "basics", "answers": list(key)}, now + 2000)
u = db.collection("users").document(uid).get().to_dict()
ok(r["passed"] and r["xp"] == 0 and u["xp"] == 50, "passing again pays nothing more")

fresh = "learn-fresh-%d" % now
try:
    main.learn_quiz_run(db, fresh, {"chapter": "charts", "answers": list(main.LEARN.CHAPTERS["charts"]["answers"])}, now)
    ok(False, "chapter 2 quiz must wait for chapter 1")
except https_fn.HttpsError as e:
    ok("Chapter 1" in str(e.message) and not db.collection("users").document(fresh).get().exists, "chapter 2 quiz refused until chapter 1 is passed")

xp_before = db.collection("users").document(uid).get().to_dict()["xp"]
r = main.learn_quiz_run(db, uid, {"chapter": "charts", "answers": list(main.LEARN.CHAPTERS["charts"]["answers"])}, now + 3000)
u = db.collection("users").document(uid).get().to_dict()
ok(r["passed"] and r["xp"] == 50 and u["xp"] >= xp_before + 50 and u["learnPassed"]["charts"] == now + 3000 and "basics" in u["learnPassed"], "chapter 2 passes on its own and pays its own 50 XP")

for bad in ({"chapter": "basics", "answers": [0, 1]}, {"chapter": "nope", "answers": list(key)}, {"answers": list(key)}, None):
    try:
        main.learn_quiz_run(db, uid, bad, now)
        ok(False, "bad input must be refused: %r" % (bad,))
    except https_fn.HttpsError:
        ok(True, "bad input refused: %r" % (bad,))

xp_before = db.collection("users").document(uid).get().to_dict()["xp"]
g = main.xp_grant(db, uid, "lesson", "prices", now)
g2 = main.xp_grant(db, uid, "lesson", "prices", now)
ok(g["awarded"] and not g2["awarded"] and db.collection("users").document(uid).get().to_dict()["xp"] == xp_before + 10, "lesson XP: 10, once")
print("\n%d Trading 101 checks passed" % passed)
