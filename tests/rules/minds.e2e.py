"""Runs the Hall of Minds daily quote (main.minds_quote_pass) against the Firestore emulator:
each follower gets ONE quote a day in the bell, however many figures they follow; expired
follows get nothing; a second run the same day sends nothing. Started by run-functions-e2e.sh."""
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


NOW = datetime(2026, 10, 23, 9, 5, tzinfo=main.NY)
ms = int(NOW.timestamp() * 1000)
day = 86400000
db.collection("wallets").document("mindFanA").set({"balance": 0, "mindQuotes": {"napoleon": ms + 10 * day, "tesla": ms + 5 * day}, "mindQuotesUntil": ms + 10 * day})
db.collection("wallets").document("mindFanB").set({"balance": 0, "mindQuotes": {"caesar": ms - day}, "mindQuotesUntil": ms - day})

inbox_a = lambda: [d.to_dict() for d in db.collection("users").document("mindFanA").collection("inbox").stream()]  # noqa: E731
n = main.minds_quote_pass(db, NOW)  # (other tests' followers may get one too)
inbox = inbox_a()
ok(n >= 1 and len(inbox) == 1, "one quote a day, even when following two figures")
note = inbox[0]
ok(note["kind"] == "minds" and note["title"] in ("Napoleon Bonaparte", "Nikola Tesla") and note["link"].startswith("/app/minds/"), "it names the figure and opens their page on that quote")
ok(not list(db.collection("users").document("mindFanB").collection("inbox").stream()), "an expired follow gets nothing")
main.minds_quote_pass(db, NOW + timedelta(hours=1))
ok(len(inbox_a()) == 1, "a second run the same day sends nothing")
main.minds_quote_pass(db, NOW + timedelta(days=1))
ok(len(inbox_a()) == 2, "and the next day brings the next quote")
print("\n%d Hall of Minds checks passed" % passed)
