"""Territory outposts (owner 2026-11-02: "Fort + Supply camp", visible to everyone in the War).
Pure rules here (unit tests: scripts/waroutpost_test.py); main.py runs them (war_lobby actions
outpostBuild / outpostUpgrade / outpostCollect, and warattack.settle on a capture).

On a territory you hold in a running War you build ONE outpost, paid with your base gold (the
season base, warbase.py). Outposts unlock at Headquarters level 2 and you can have as many in each
War as your Headquarters level. Kinds:

    fort   an attacker needs +1/+2/+3 more wins to take the territory (levels 1-3)
    camp   a supply camp: makes 150/300/500 gold an hour for its holder, kept in the camp (up to
           8 hours' worth) until collected into the base

Building and upgrading take 10/30/60 minutes (nothing works while it builds). When a territory is
captured the attacker gets its outpost one level lower, with any gold waiting in a camp; a level-1
outpost is destroyed. Outposts stop when the War ends.

    wars/{id}.outposts {territory: {kind, owner, level, to, busyUntil, stored, prodAt}}
"""
from warmarket import WarError

UNLOCK_HQ = 2
MAX_LEVEL = 3
KINDS = {
    "fort": {"name": "Fort", "cost": [1000, 2500, 5000], "time": [600, 1800, 3600], "wins": [1, 2, 3]},
    "camp": {"name": "Supply camp", "cost": [800, 2000, 4500], "time": [600, 1800, 3600], "rate": [150, 300, 500], "hours": 8},
}


def _settled(o, now_ms, active=True):
    """The outpost now: a finished construction becomes its level; a camp counts its gold."""
    o = dict(o)
    busy = o.get("busyUntil")
    if busy is not None and busy <= now_ms:
        # gold made before the upgrade started was already counted; production restarts when it's done
        o.update(level=o.get("to") or o["level"], to=None, busyUntil=None, prodAt=busy)
    if o["kind"] == "camp" and o["level"] >= 1 and o.get("busyUntil") is None:
        cfg = KINDS["camp"]
        rate = cfg["rate"][o["level"] - 1]
        since = o.get("prodAt") or now_ms
        until = now_ms if active else since
        cap = rate * cfg["hours"]
        o["stored"] = min(cap, (o.get("stored") or 0) + rate * max(0, until - since) / 3600000)
        o["prodAt"] = now_ms
    return o


def settle_all(war, now_ms):
    """Every outpost on the War brought up to now (camps only make gold while the War runs)."""
    active = war.get("status") == "active"
    ops = {t: _settled(o, now_ms, active) for t, o in (war.get("outposts") or {}).items()}
    return dict(war, outposts=ops)


def count_of(war, uid):
    return sum(1 for o in (war.get("outposts") or {}).values() if o.get("owner") == uid)


def build(war, uid, terr, kind, hq_level, gold, now_ms):
    """A new outpost on terr (the caller checks uid holds it). Returns (war, gold cost)."""
    if kind not in KINDS:
        raise WarError("INVALID_ARGUMENT", "Pick a Fort or a Supply camp.")
    if hq_level < UNLOCK_HQ:
        raise WarError("FAILED_PRECONDITION", "Outposts open at Headquarters level %d." % UNLOCK_HQ)
    ops = dict(war.get("outposts") or {})
    if terr in ops:
        raise WarError("FAILED_PRECONDITION", "This territory already has an outpost.")
    if count_of(war, uid) >= hq_level:
        raise WarError("FAILED_PRECONDITION", "Headquarters level %d allows %d outpost%s in each War. Upgrade it for more." % (hq_level, hq_level, "" if hq_level == 1 else "s"))
    cfg = KINDS[kind]
    cost = cfg["cost"][0]
    if gold < cost:
        raise WarError("FAILED_PRECONDITION", "A %s costs %d gold; you have %d." % (cfg["name"], cost, int(gold)), {"reason": "base-gold"})
    ops[terr] = {"kind": kind, "owner": uid, "level": 0, "to": 1, "busyUntil": now_ms + cfg["time"][0] * 1000, "stored": 0, "prodAt": None, "builtAt": now_ms}
    return dict(war, outposts=ops), cost


def upgrade(war, uid, terr, gold, now_ms):
    ops = dict(war.get("outposts") or {})
    o = ops.get(terr)
    if not o or o.get("owner") != uid:
        raise WarError("NOT_FOUND", "You have no outpost there.")
    o = _settled(o, now_ms)
    if o.get("busyUntil") is not None:
        raise WarError("FAILED_PRECONDITION", "It's still being built.")
    if o["level"] >= MAX_LEVEL:
        raise WarError("FAILED_PRECONDITION", "It's at the top level.")
    cfg = KINDS[o["kind"]]
    cost = cfg["cost"][o["level"]]
    if gold < cost:
        raise WarError("FAILED_PRECONDITION", "Level %d costs %d gold; you have %d." % (o["level"] + 1, cost, int(gold)), {"reason": "base-gold"})
    o.update(to=o["level"] + 1, busyUntil=now_ms + cfg["time"][o["level"]] * 1000)
    ops[terr] = o
    return dict(war, outposts=ops), cost


def collect(war, uid, terr, now_ms):
    """Gold waiting in your supply camp. Returns (war, whole gold collected)."""
    war = settle_all(war, now_ms)
    ops = dict(war["outposts"])
    o = ops.get(terr)
    if not o or o.get("owner") != uid or o["kind"] != "camp":
        raise WarError("NOT_FOUND", "You have no supply camp there.")
    got = int(o.get("stored") or 0)
    ops[terr] = dict(o, stored=(o.get("stored") or 0) - got)
    return dict(war, outposts=ops), got


def fort_wins(war, terr, now_ms):
    """Extra wins an attacker needs on terr because of a finished Fort."""
    o = (war.get("outposts") or {}).get(terr)
    if not o or o["kind"] != "fort":
        return 0
    o = _settled(o, now_ms)
    return KINDS["fort"]["wins"][o["level"] - 1] if o["level"] >= 1 else 0


def capture(war, terr, attacker, now_ms):
    """The territory changed hands: its outpost goes to the attacker one level lower (with the gold
    waiting in a camp), or is destroyed at level 1. A construction in progress stops."""
    ops = dict(war.get("outposts") or {})
    if terr not in ops:
        return war
    o = _settled(ops[terr], now_ms, war.get("status") == "active")
    if o["level"] <= 1:
        ops.pop(terr)
    else:
        ops[terr] = dict(o, owner=attacker, level=o["level"] - 1, to=None, busyUntil=None, prodAt=now_ms, capturedAt=now_ms)
    return dict(war, outposts=ops)
