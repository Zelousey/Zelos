"""A whole War Zone week, every feature together (the War launch check, owner 2026-11-04).

Four players share one Open zone for a season: they place in the secret claiming hour, build their
bases, trade, hire a trader, build outposts, attack and defend, Scout, Shield, heal with a Medical
Station, and the season ends and the next one starts. The real minute job (war_market_tick's passes)
runs every hour of the week, with nothing swallowed: any error in a pass fails this script. After
every simulated day the invariants are checked (no negative money, gold or soldiers; each War's books
add up to the real positions). Run by run-functions-e2e.sh against the Firestore emulator.
"""
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402

WM, WZ, WA, WB = main.WM, main.WZ, main.WA, main.WBASE
db = firestore.client()
M = 60000
H = 60 * M
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


RNG = random.Random(11)


def tick(t):
    """The minute job at time t, every pass, with nothing swallowed."""
    main.war_market_pass(db, t, RNG)
    main._war_base_pass(db, t)
    main._war_traders_pass(db, t)
    main._war_medic_pass(db, t)
    main._war_board_pass(db, t)


def run_hours(t0, hours):
    """The job at :07 (leaderboard) and :10 (traders, healing) of every hour from t0."""
    base, last = t0 - t0 % H, t0
    for h in range(hours + 1):
        for minute in (7, 10):
            t = base + h * H + minute * M
            if t0 <= t <= t0 + hours * H:
                tick(t)
                last = t
    return last + M  # players act just after the job, while its prices are fresh


def war(wid):
    return db.collection("wars").document(wid).get().to_dict()


def place_of(wid, uid):
    return db.collection("wars").document(wid).collection("placements").document(uid).get().to_dict() or {}


def check_invariants(wid, players, label):
    for u in players:
        p = db.collection("warProfiles").document(u).get().to_dict()
        assert p["cash"] >= -0.01, "%s: %s has negative War cash" % (label, u)
        pos = {s: v["qty"] for s, v in (p.get("positions") or {}).items() if v.get("qty")}
        booked = {}
        for b in (p.get("books") or {}).values():
            for s, v in (b.get("pos") or {}).items():
                booked[s] = booked.get(s, 0) + (v.get("qty") or 0)
        booked = {s: q for s, q in booked.items() if q}
        assert booked == pos, "%s: %s's War books %s don't add up to positions %s" % (label, u, booked, pos)
        b = db.collection("warBases").document(u).get().to_dict() or {}
        for res in ("gold", "crystals", "energy"):
            assert (b.get(res) or 0) >= 0, "%s: %s has negative %s" % (label, u, res)
        pl = place_of(wid, u)
        assert (pl.get("reserve") or 0) >= 0 and all(n >= 0 for n in (pl.get("soldiers") or {}).values()), "%s: %s has negative soldiers" % (label, u)
    ok(True, "%s: money, books, base resources and soldiers all consistent" % label)


# ---------------------------------------------------------------- the season starts
S = WZ.season_start(1_900_000_000_000)  # a Monday 9 am ET far from the other tests' seasons
P = ["wkAnn01", "wkBen01", "wkCat01", "wkDan01"]
NAMES = dict(zip(P, ["Ann", "Ben", "Cat", "Dan"]))
for u in P:
    db.collection("warProfiles").document(u).set(WM.new_profile(S - H, "UTC"))
tick(S - 30 * M)  # the engine is running and prices are fresh
zid = None
for i, u in enumerate(P):
    r = main._zone_join(db, u, NAMES[u], S + (2 + i) * M, True)
    zid = zid or r["warId"]
    assert r["warId"] == zid, "everyone lands in the same zone"
w = war(zid)
ok(w["phase"] == "claiming" and set(w["players"]) == set(P), "four players join Open zone 1 in its secret claiming hour")
T = sorted(w["territories"])
main._war_place(db, zid, "wkAnn01", {"soldiers": {T[0]: 50, T[1]: 50}, "lock": True}, S + 10 * M)
main._war_place(db, zid, "wkBen01", {"soldiers": {T[2]: 50, T[3]: 50}, "lock": True}, S + 11 * M)
main._war_place(db, zid, "wkCat01", {"soldiers": {T[4]: 50, T[5]: 50}, "lock": True}, S + 12 * M)
# Dan never places: his army waits in reserve
t = run_hours(S + 13 * M, 2)
w = war(zid)
own = {x: (w["map"].get(x) or {}).get("owner") for x in T}
ok(w["phase"] == "holding" and own[T[0]] == "wkAnn01" and own[T[2]] == "wkBen01" and own[T[4]] == "wkCat01",
   "after the hour the map is revealed: each player holds what they placed on")
check_invariants(zid, P, "day 1, after the reveal")

# ---------------------------------------------------------------- bases (a week of play, sped up)
for u, kit in zip(P, ["investor", "commander", "research", "investor"]):
    main._war_base(db, u, {"action": "baseOpen"}, t)
    main._war_base(db, u, {"action": "baseKit", "kit": kit}, t)
    main._war_base(db, u, {"action": "basePlace", "kind": "mine", "x": 1, "y": 1}, t)
# the days of collecting that get a Headquarters to level 4, given here as gold and crystals
for u in P:
    db.collection("warBases").document(u).update({"gold": 60000, "crystals": 200})
for u in ("wkAnn01", "wkBen01", "wkCat01"):
    for _ in range(3):
        main._war_base(db, u, {"action": "baseUpgrade", "id": "hq1"}, t)
        main._war_base(db, u, {"action": "baseSpeed", "id": "hq1"}, t + M)
    b = db.collection("warBases").document(u).get().to_dict()
    assert WB.hq_level(b) == 4, "%s reached Headquarters level 4" % u
ok(True, "three players get their Headquarters to level 4 (upgrades finished early with crystals)")
main._war_base(db, "wkAnn01", {"action": "basePlace", "kind": "wizard", "x": 10, "y": 1}, t + 2 * M)
main._war_base(db, "wkAnn01", {"action": "basePlace", "kind": "medical", "x": 1, "y": 10}, t + 2 * M)
main._war_base(db, "wkBen01", {"action": "basePlace", "kind": "wizard", "x": 10, "y": 1}, t + 2 * M)
main._war_base(db, "wkBen01", {"action": "basePlace", "kind": "medical", "x": 1, "y": 10}, t + 2 * M)
t = run_hours(t + 3 * M, 6)  # built while they're away; the Towers make Energy
for u in ("wkAnn01", "wkBen01"):
    r = main._war_base(db, u, {"action": "baseCollect"}, t)
    assert r["base"]["energy"] >= 25, "%s collected Energy" % u
ok(True, "the Wizard's Towers and Medical Stations finish while their owners are away, and the Towers make Energy")

# ---------------------------------------------------------------- trading, the desk, outposts
syms = {x: [s for s, c in WM.BY_SYM.items() if c[2] == x] for x in T}
q = db.collection("warMarket").document("quotes").get().to_dict()["prices"]
for u, terr in (("wkAnn01", T[0]), ("wkBen01", T[2]), ("wkCat01", T[4])):
    r = main._war_trade(db, u, {"sym": sorted(syms[terr])[0], "side": "buy", "qty": 50, "warId": zid}, t)
    assert r["fill"]["warId"] == zid
try:
    main._war_trade(db, "wkDan01", {"sym": sorted(syms[T[0]])[0], "side": "buy", "qty": 5, "warId": zid}, t)
    ok(False, "Dan holds nothing")
except WM.WarError:
    ok(True, "each player buys a company in a territory they hold; Dan, holding nothing, can't")
main._war_base(db, "wkAnn01", {"action": "baseHire", "strategy": "dip", "warId": zid, "terr": T[1], "budget": 2500}, t)
main._war_outpost(db, zid, "wkAnn01", "outpostBuild", {"terr": T[0], "kind": "fort"}, t)
main._war_outpost(db, zid, "wkCat01", "outpostBuild", {"terr": T[4], "kind": "camp"}, t)
t = run_hours(t, 4)
w = main.WO.settle_all(war(zid), t)  # outposts finish lazily, like base buildings: as the game reads them
ok(w["outposts"][T[0]]["level"] == 1 and w["outposts"][T[4]]["level"] == 1 and main.WO.fort_wins(war(zid), T[0], t) == 1,
   "Ann's Fort and Cat's Supply camp are built; the Fort adds a win to take her land")
r = main._war_outpost(db, zid, "wkCat01", "outpostCollect", {"terr": T[4]}, t)
ok(r["collected"] >= 150 * 3, "Cat's camp has made gold for her base (%d)" % r["collected"])
check_invariants(zid, P, "day 1, after trading and building")

# ---------------------------------------------------------------- abilities and an attack
r = main._war_ability(db, zid, "wkBen01", "scout", {"terr": T[0]}, t)
ok(r["scout"]["n"] == place_of(zid, "wkAnn01")["soldiers"][T[0]], "Ben scouts Ann's land and sees her real soldier count")
main._war_ability(db, zid, "wkCat01", "shield", {"terr": T[4]}, t) if (db.collection("warBases").document("wkCat01").get().to_dict().get("energy") or 0) >= 60 else None
db.collection("warBases").document("wkCat01").update({"energy": 100})  # bought in the shop
main._war_ability(db, zid, "wkCat01", "shield", {"terr": T[4]}, t)
try:
    main._war_attack(db, zid, "wkBen01", {"territory": T[4], "sym": sorted(syms[T[4]])[0], "side": "bull"}, t + M)
    ok(False, "shielded")
except WM.WarError as e:
    ok("shielded" in str(e), "Cat's Shield stops Ben's attack on her land")
# Ben's War return is below 0% after his trade, so the rules don't let him attack; Dan (0%, no trades) can
try:
    main._war_attack(db, zid, "wkBen01", {"territory": T[0], "sym": sorted(syms[T[0]])[0], "side": "bull"}, t + 2 * M)
except WM.WarError as e:
    print("       (Ben can't attack: %s)" % e)
a = main._war_attack(db, zid, "wkDan01", {"territory": T[0], "sym": sorted(syms[T[0]])[0], "side": "bull"}, t + 2 * M)
aid = a.get("attackId") or next(iter((war(zid).get("attacks") or {})))
tick(t + 3 * M)  # the job runs every minute live; here just before each answer, for fresh prices
main._war_answer(db, zid, "wkAnn01", {"attackId": aid, "accept": True}, t + 3 * M)
t = run_hours(t + 4 * M, 3)  # the hour-long battle runs and the job settles it
w = war(zid)
done = db.collection("wars").document(zid).collection("attacks").document(aid).get().to_dict()
ok(done and done["stage"] == "done" and aid not in (w.get("attacks") or {}), "Dan's attack on Ann's Fort runs for an hour and is settled (%s)" % done["result"])
loser = {"attacker": "wkAnn01", "defender": "wkDan01"}.get(done["result"])
if loser:
    ok((place_of(zid, loser).get("downed") or 0) >= 5, "the loser's lost soldiers are counted as wounded")
ok(w["map"][T[0]]["owner"] == "wkAnn01", "one win isn't enough to take a territory behind a Fort")
check_invariants(zid, P, "day 1, after the battle")

# ---------------------------------------------------------------- the rest of the week
for day in range(2, 8):
    t = run_hours(t, 24)
    if day == 2:
        b = db.collection("warMarket").document("board").get().to_dict()
        ok(b["season"] == WZ.season_key(S) and b["open"]["total"] >= 4 and all(u in b["open"]["ranks"] for u in P),
           "the weekly leaderboard ranks all four players")
    if day < 7:
        check_invariants(zid, P, "day %d" % day)
end = war(zid)["endsAt"]
t = run_hours(t, max(1, -(-(end + H - t) // H)))  # through the season's end (Monday 9 am ET)
w = war(zid)
ok(w["status"] == "ended" and len(w["results"]["standings"]) == 4, "the season ends with final results for all four")
nxt = WZ.zone_id(WZ.season_key(w["endsAt"]), False, 1)
n2 = war(nxt) or {}
ok(set(n2.get("players") or []) >= {"wkAnn01", "wkBen01", "wkCat01"} and not n2.get("outposts"),
   "the players who held land are carried into next season's zone, which starts with no outposts")
nb = main._war_base(db, "wkAnn01", {"action": "baseOpen"}, t)["base"]
ok(nb["gold"] == WB.START_GOLD and list(nb["buildings"]) == ["hq1"] and not nb.get("traders"), "and a fresh base for the new season")
tick(t + 7 * M - t % H)
ok(db.collection("warMarket").document("board").get().to_dict()["season"] == WZ.season_key(w["endsAt"]), "the leaderboard moves to the new season")
print("\n%d War week checks passed" % passed)
