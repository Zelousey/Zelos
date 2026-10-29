"""Runs the War zone market job (war_market_pass) against the Firestore emulator:
- the first run starts the engine and publishes prices for every made-up company;
- one step per minute, with catch-up capped after a gap; nothing when less than a minute passed;
- 5-minute bars are saved complete once they finish, plus the bar in progress;
- the engine state stays on the server (warEngine), the prices and bars are public reads;
- Chaos (W2): today's plan is made once and kept secret; warMarket/chaos goes warned -> live ->
  over; every War player is told once, except players in quiet hours, whose line waits for one
  morning summary when their quiet hours end.
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

# ---- Chaos events, quiet hours and the morning summary
B = T0 + 12 * M + 10 * 3600 * 1000
st = db.collection("warEngine").document("state").get().to_dict()
ok(st["chaos"]["day"] == WM.day_key(B), "today's Chaos plan is made on the server")
EV = {"day": WM.day_key(B), "startsAt": B + 40 * M, "endsAt": B + 100 * M, "minutes": 60, "scope": "energy",
      "moves": {"VOLTX": 0.13, "SOLRN": 0.13, "PETRA": 0.13}}
db.collection("warEngine").document("state").update({"chaos": EV, "chaosShown": None})  # a known event instead of the random plan
db.collection("warMarket").document("chaos").delete()
main.war_market_pass(db, B + 5 * M, random.Random(5))
ok(not db.collection("warMarket").document("chaos").get().exists, "nothing about an event is public before its warning")
sm = ((B // M) % 1440) // 15 * 15
for uid, quiet in (("warAwake01", {"start": 0, "end": 0, "tz": "UTC"}), ("warSleep01", {"start": sm, "end": (sm + 180) % 1440, "tz": "UTC"})):
    db.collection("warProfiles").document(uid).set(dict(WM.new_profile(B, "UTC"), quiet=quiet))
    for d in db.collection("users").document(uid).collection("inbox").stream():
        d.reference.delete()


def inbox(uid):
    return [d.to_dict() for d in db.collection("users").document(uid).collection("inbox").stream()]


main.war_market_pass(db, B + 10 * M, random.Random(6))
c = db.collection("warMarket").document("chaos").get().to_dict()
ok(c["phase"] == "warned" and c["scopeName"] == "Energy" and c["startsAt"] == B + 40 * M, "30 minutes before, the warning is public: Energy at its start time")
ok("moves" not in c and "endsAt" not in c, "but not its size, direction or end")
aw = inbox("warAwake01")
ok(len(aw) == 1 and aw[0]["kind"] == "war" and aw[0]["title"] == "Chaos incoming: Energy in 30 min" and "Simulated" in aw[0]["body"] and aw[0]["link"] == "app/war",
   "a player who's awake is told: Chaos incoming: Energy in 30 min (simulated)")
sp = db.collection("warProfiles").document("warSleep01").get().to_dict()
ok(inbox("warSleep01") == [] and sp["overnight"] == ["Chaos hit Energy in the War zone."], "a player in quiet hours gets nothing now; it waits for their morning summary")
ok(sp["summaryAt"] == B - B % (1440 * M) + (sm + 180) * M, "their summary is due when their quiet hours end")
main.war_market_pass(db, B + 41 * M, random.Random(7))
c = db.collection("warMarket").document("chaos").get().to_dict()
ok(c["phase"] == "live" and c["endsAt"] == B + 100 * M and c["syms"] == ["PETRA", "SOLRN", "VOLTX"], "when it starts: live, with its end and the stocks it hits")
ok(len(inbox("warAwake01")) == 1, "players are told once, not again when it starts")
main.war_market_pass(db, B + 101 * M, random.Random(8))
c = db.collection("warMarket").document("chaos").get().to_dict()
ok(c["phase"] == "over" and c["hotUntil"] == B + 100 * M + 24 * 3600 * 1000, "when it ends: over, and its stocks stay Hot for a day")
main.war_market_pass(db, sp["summaryAt"] + M, random.Random(9))
sl = inbox("warSleep01")
sp = db.collection("warProfiles").document("warSleep01").get().to_dict()
ok(len(sl) == 1 and sl[0]["title"] == "Your War zone morning summary" and sl[0]["body"].startswith("While you slept: Chaos hit Energy"),
   "when their quiet hours end: one morning summary of what happened")
ok("overnight" not in sp and "summaryAt" not in sp, "and the summary is cleared")
main.war_market_pass(db, B + 300 * M, random.Random(10))
ok(len(inbox("warSleep01")) == 1, "it isn't sent twice")
print("\n%d War zone market checks passed" % passed)
