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

# ---- private War deadlines (W3): the same job starts or cancels lobbies at their deadline, and ends Wars
WL = main.WL
now = B + 301 * M
base = dict(WL.new_war("warAwake01", "Ann", {"name": "Deadline War", "days": 1, "lobbyHours": 1, "maxPlayers": 4}, now - 2 * 3600 * 1000))
w1 = WL.open_lobby(base, "warAwake01", now - 2 * 3600 * 1000)
w1 = dict(w1, players=["warAwake01", "warSleep01", "warLate01"], ready={"warAwake01": True, "warSleep01": True, "warLate01": False})
w2 = WL.open_lobby(base, "warAwake01", now - 2 * 3600 * 1000)
db.collection("wars").document("deadlineWar01").set(WL.stored(w1))
db.collection("wars").document("deadlineWar02").set(WL.stored(w2))
main.war_market_pass(db, now, random.Random(11))
a = db.collection("wars").document("deadlineWar01").get().to_dict()
ok(a["status"] == "active" and a["players"] == ["warAwake01", "warSleep01"] and a["dropped"] == ["warLate01"],
   "at the lobby deadline a War starts with the players who are ready")
ok(a["phase"] == "claiming" and a["due"] == a["claimEnds"] and len(a["territories"]) == 6, "on a 6-territory map, with an hour of claiming")
b = db.collection("wars").document("deadlineWar02").get().to_dict()
ok(b["status"] == "cancelled" and b["why"] == "not-enough-players" and "due" not in b, "and one without 2 ready players is cancelled")
ok(any(n["title"] == "Deadline War has started" for n in inbox("warAwake01")), "the players are told it started")
main.war_market_pass(db, a["claimEnds"], random.Random(12))
a = db.collection("wars").document("deadlineWar01").get().to_dict()
p1 = db.collection("wars").document("deadlineWar01").collection("placements").document("warAwake01").get().to_dict()
ok(a["phase"] == "holding" and a["due"] == min(WL.WB.due(b) for b in a["battles"].values()) and p1["auto"] and sum(p1["soldiers"].values()) == 100,
   "when claiming time is up, anyone who didn't lock in gets an even spread and the map is revealed")
ok(sum(1 for v in a["map"].values() if v["state"] == "contested") == 5 and sum(1 for v in a["map"].values() if v["state"] == "neutral") == 1,
   "(two even spreads tie on 5 territories and leave one neutral)")
ok(len(a["battles"]) == 5 and all(b["kind"] == "duel" for b in a["battles"].values()), "each contested territory gets a battle")
main.war_market_pass(db, a["endsAt"] + M, random.Random(13))
ok(db.collection("wars").document("deadlineWar01").get().to_dict()["status"] == "ended", "and it ends after its days")

# ---- contested battles (W4b): picks time out to a random side; a finished battle settles the territory
WB = main.WB
now2 = a["endsAt"] + 2 * M
bw = dict(WL.new_war("warAwake01", "Ann", {"name": "Battle War", "days": 1, "lobbyHours": 1, "maxPlayers": 4}, now2 - 3 * 3600 * 1000))
bw = dict(bw, status="active", stage=None, phase="holding", players=["warAwake01", "warSleep01"], names={"warAwake01": "Ann", "warSleep01": "Ben"},
          territories=["tech", "energy"], startedAt=now2 - 2 * 3600 * 1000, endsAt=now2 + 20 * 3600 * 1000,
          map={"tech": {"state": "contested", "contenders": ["warAwake01", "warSleep01"]}, "energy": {"state": "contested", "contenders": ["warAwake01", "warSleep01"]}})
q = db.collection("warMarket").document("quotes").get().to_dict()["prices"]
tech = WB.new_battle("tech", ["warAwake01", "warSleep01"], {"warAwake01": 40, "warSleep01": 40}, now2 - 20 * M, random.Random(1), 0)  # its 10 minutes are up
energy = WB.start(dict(WB.new_battle("energy", ["warAwake01", "warSleep01"], {"warAwake01": 50, "warSleep01": 41}, now2 - 90 * M, random.Random(2), 0), sides={"warAwake01": "bull"}),
                  {}, {s: v["p"] for s, v in q.items()}, now2 - 80 * M, random.Random(3))  # its hour is up
bw["battles"] = {"tech": tech, "energy": energy}
db.collection("wars").document("battleWar01").set(WL.stored(bw))
db.collection("wars").document("battleWar01").collection("placements").document("warAwake01").set({"soldiers": {"energy": 50, "tech": 40}, "camo": [], "locked": True})
db.collection("wars").document("battleWar01").collection("placements").document("warSleep01").set({"soldiers": {"energy": 41, "tech": 40}, "camo": [], "locked": True})
main.war_market_pass(db, now2, random.Random(14))
bw2 = db.collection("wars").document("battleWar01").get().to_dict()
t2 = bw2["battles"]["tech"]
ok(t2["stage"] == "running" and t2["randomSide"] and set(t2["sides"].values()) == {"bull", "bear"}, "when Command doesn't pick in 10 minutes, a side is picked at random and the battle runs")
e2 = bw2["battles"]["energy"]
won = e2["winner"]
moved = e2["end"][e2["sym"]] - e2["start"][e2["sym"]]
ok(e2["stage"] == "done" and won == (("warAwake01" if moved >= 0 else "warSleep01") if moved else "warAwake01"),
   "after its hour the side that matched the price move wins (Command on no move)")
ok(bw2["map"]["energy"] == {"state": "owned", "owner": won, "how": "contested-battle", "since": now2}, "and takes the territory")
lost = "warSleep01" if won == "warAwake01" else "warAwake01"
ok(bw2["bonusPoints"] == {won: 1} and bw2["redeployPasses"] == {lost: 1}, "the winner gets +1 point, the loser a Redeploy pass")
ok(db.collection("wars").document("battleWar01").collection("placements").document(won).get().to_dict()["reserve"] == 5, "and +5 soldiers to the winner's reserve")
ok(bw2["due"] == t2["endsAt"], "the War is next due when the running battle ends")
ok(any("won the battle for Energy" in d.to_dict()["text"] for d in db.collection("wars").document("battleWar01").collection("log").stream()), "the map log says who won")

# ---- attacks (W5a): an unanswered attack starts by itself; a finished one moves money, soldiers and progress
WA = main.WA
now3 = now2 + 5 * M
aw = dict(bw2, battles={}, attacks={}, map={"tech": {"state": "owned", "owner": "warSleep01", "how": "claimed"}, "energy": {"state": "owned", "owner": "warAwake01", "how": "claimed"}},
          startEquity={"warAwake01": 100000, "warSleep01": 100000})
q = {s: v["p"] for s, v in db.collection("warMarket").document("quotes").get().to_dict()["prices"].items()}
waiting = WA.new_attack(dict(aw, map=dict(aw["map"])), "atkWait01", "warAwake01", "tech", "NIMBC", "bull", now3 - 3 * 3600 * 1000, now3 - 3 * 3600 * 1000, False)["attacks"]["atkWait01"]
ran = WA.start(dict(WA.new_attack(aw, "atkRun01", "warSleep01", "energy", "VOLTX", "bear", now3 - 2 * 3600 * 1000, 0, False)["attacks"]["atkRun01"]),
               {"VOLTX": q["VOLTX"] * 1.05}, 50000, now3 - 70 * M)  # it started 5% higher than now: Bear wins
aw["attacks"] = {"atkWait01": waiting, "atkRun01": ran}
db.collection("wars").document("attackWar01").set(WL.stored(aw))
for uid, place in (("warAwake01", {"soldiers": {"energy": 45}, "reserve": 0}), ("warSleep01", {"soldiers": {"tech": 50}, "reserve": 5})):
    db.collection("wars").document("attackWar01").collection("placements").document(uid).set(dict(place, camo=[], locked=True))
for uid, held in (("warAwake01", 10000), ("warSleep01", 5000)):
    db.collection("warProfiles").document(uid).update({"cash": 50000.0, "held": float(held)})
main.war_market_pass(db, now3, random.Random(15))
aw2 = db.collection("wars").document("attackWar01").get().to_dict()
ok(aw2["attacks"]["atkWait01"]["stage"] == "running" and aw2["attacks"]["atkWait01"]["accepted"] == "auto", "an attack nobody answered in 2 hours is accepted and starts")
done = db.collection("wars").document("attackWar01").collection("attacks").document("atkRun01").get().to_dict()
ok(done and done["result"] == "attacker" and "atkRun01" not in aw2["attacks"], "a finished battle is archived: the attacker's Bear call won")
ok(aw2["progress"]["energy"]["warSleep01"] == 1 and aw2["map"]["energy"]["owner"] == "warAwake01", "+1 progress; 45 - 5 = 40 soldiers need 3 wins, so the land holds for now")
pa = db.collection("warProfiles").document("warAwake01").get().to_dict()
pb = db.collection("warProfiles").document("warSleep01").get().to_dict()
# Ben: 50,000 - 5,000 (his stake as defender of the auto-accepted attack) + 10,000 (both stakes he won) = 55,000; 5,000 still held
# Ann: her 5,000 stake on the lost battle is gone; her 5,000 for the new attack stays held
ok(pb["cash"] == 55000.0 and pb["held"] == 5000 and pa["held"] == 5000 and pa["cash"] == 50000.0,
   "the winner takes both $5,000 stakes, and each side of the new battle has its stake held")
pl = db.collection("wars").document("attackWar01").collection("placements").document("warAwake01").get().to_dict()
ok(pl["soldiers"]["energy"] == 40, "and the defender loses 5 soldiers there")
ok(any("won a battle for Energy" in d.to_dict()["text"] for d in db.collection("wars").document("attackWar01").collection("log").stream()), "the map log says so")

# ---- Hot zones (W5b): at the end of a War day the holder of each Hot zone gets +1 point, then new Hot zones
WMV = main.WMV
now4 = now3 + 10 * M
hw = dict(aw, attacks={}, battles={}, startedAt=now4 - 25 * 3600 * 1000, endsAt=now4 + 40 * 3600 * 1000, hot={"tech": "x", "energy": "y"}, hotDay=0)
db.collection("wars").document("hotWar01").set(WL.stored(hw))
ok(WL.stored(hw)["due"] == hw["startedAt"] + 24 * 3600 * 1000, "the War is due when its first War day ends")
main.war_market_pass(db, now4, random.Random(16))
hw2 = db.collection("wars").document("hotWar01").get().to_dict()
ok(hw2["hotPoints"] == {"warSleep01": 1, "warAwake01": 1} and hw2["hotDay"] == 1 and len(hw2["hot"]) == 2,
   "each Hot zone's holder gets +1 point at the end of the day, and the new day gets 2 Hot zones")
ok(sum(1 for d in db.collection("wars").document("hotWar01").collection("log").stream() if "Hot zone" in d.to_dict()["text"]) == 2, "the map log records it")
ok(any(n["title"].startswith("Hot zones today:") for n in inbox("warAwake01")), "players are told the new Hot zones")
print("\n%d War zone market checks passed" % passed)
