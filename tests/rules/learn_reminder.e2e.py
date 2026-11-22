"""Runs the learning streak reminder (main.learn_reminder_pass) against the Firestore emulator:
only a streak kept yesterday and not today gets one, at most once a day; switching "Learning
streak" off stops it completely, and the reminder mentions free review when
questions are due. Started by run-functions-e2e.sh."""
import os
import sys
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


NOW = datetime(2026, 11, 24, 19, 0, tzinfo=main.NY)
ms = int(NOW.timestamp() * 1000)
today, yesterday, before = "2026-11-24", "2026-11-23", "2026-11-22"


def loop(days, last):
    return {"streak": {"days": days, "best": days, "last": last}, "day": {"date": last, "xp": 10}, "week": {"key": "2026-W48", "xp": 10}}


db.collection("users").document("streakAtRisk").set({"learnLoop": loop(5, yesterday), "review": {"c:stocks": {"box": 0, "due": today}, "c:rsi": {"box": 1, "due": "2026-12-01"}}})
db.collection("users").document("streakSafe").set({"learnLoop": loop(5, today)})
db.collection("users").document("streakGone").set({"learnLoop": loop(5, before)})
db.collection("users").document("streakQuiet").set({"learnLoop": loop(2, yesterday), "notificationPrefs": {"types": {"learn": False}}})
inbox = lambda uid: [d.to_dict() for d in db.collection("users").document(uid).collection("inbox").stream()]  # noqa: E731

n = main.learn_reminder_pass(db, ms)
ok(n >= 1, "the reminder pass ran (%d)" % n)
at_risk = inbox("streakAtRisk")
ok(len(at_risk) == 1 and at_risk[0]["kind"] == "learn" and at_risk[0]["link"] == "/app/learn", "a streak kept yesterday gets one reminder that opens Trading 101")
ok(at_risk[0]["title"] == "Keep your 5-day learning streak" and "1 question from your review is waiting" in at_risk[0]["body"] and "free" in at_risk[0]["body"],
   "it names the streak and the free review that's due (%s / %s)" % (at_risk[0]["title"], at_risk[0]["body"]))
ok(not inbox("streakSafe"), "someone who already learned today gets nothing")
ok(not inbox("streakGone"), "a streak that already broke gets nothing")
ok(not inbox("streakQuiet"), "with Learning streak switched off nothing is sent, not even the bell")
ok(db.collection("users").document("streakAtRisk").get().to_dict()["learnRemindedOn"] == today, "the day it went out is recorded")
main.learn_reminder_pass(db, ms + 3600_000)
ok(len(inbox("streakAtRisk")) == 1, "a second run the same evening sends nothing")
nxt = int((NOW + timedelta(days=1)).timestamp() * 1000)
db.collection("users").document("streakAtRisk").update({"learnLoop": loop(6, today)})
main.learn_reminder_pass(db, nxt)
ok(len(inbox("streakAtRisk")) == 2, "the next evening, with the streak at risk again, sends one more")
print("\n%d learning reminder checks passed" % passed)
