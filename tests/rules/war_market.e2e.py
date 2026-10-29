"""Runs the War zone market job (war_market_pass) against the Firestore emulator:
- the first run starts the engine and publishes prices for every made-up company;
- one step per minute, with catch-up capped after a gap; nothing when less than a minute passed;
- 5-minute bars are saved complete once they finish, plus the bar in progress;
- the engine state stays on the server (warEngine), the prices and bars are public reads.
Started by run-functions-e2e.sh inside `firebase emulators:exec`."""
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402

WM = main.WM
db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


M = 60000
T0 = 1_800_000_000_000 - 1_800_000_000_000 % (5 * M)  # on a 5-minute boundary
db.collection("warEngine").document("state").delete()
for s in WM.SYMS:
    db.collection("warMarket").document("bars_" + s).delete()

n = main.war_market_pass(db, T0, random.Random(3))
q = db.collection("warMarket").document("quotes").get().to_dict()
ok(n == 1 and set(q["prices"]) == set(WM.SYMS) and q["updatedAt"] == T0, "the first run publishes a price for every War zone company")
ok("Simulated" in q["note"], "and says the prices are simulated")
ok(main.war_market_pass(db, T0 + 20000, random.Random(3)) == 0, "less than a minute later: nothing changes")
ok(main.war_market_pass(db, T0 + 12 * M, random.Random(4)) == 12, "a run after 12 minutes makes 12 one-minute steps")
bars = WM.bars_in(db.collection("warMarket").document("bars_NIMBC").get().to_dict()["bars"])
starts = [b[0] for b in bars]
ok(starts[-3:] == [T0 + 0 * M, T0 + 5 * M, T0 + 10 * M], "finished 5-minute bars are saved, plus the one in progress")
ok(all(b[3] <= min(b[1], b[4]) and b[2] >= max(b[1], b[4]) for b in bars), "every bar's high and low hold its open and close")
st = db.collection("warEngine").document("state").get().to_dict()
ok(st["t"] == T0 + 12 * M and st["stocks"]["NIMBC"]["p"] == db.collection("warMarket").document("quotes").get().to_dict()["prices"]["NIMBC"]["p"], "the engine and the published price agree")
ok(main.war_market_pass(db, T0 + 12 * M + 10 * 3600 * 1000, random.Random(5)) == WM.MAX_CATCH_UP, "after a long gap it makes up at most an hour")
print("\n%d War zone market checks passed" % passed)
