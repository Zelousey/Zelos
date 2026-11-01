"""The War base (owner brief 2026-11-01, "7-day base building"; prototype stage). Pure rules here
(unit tests: scripts/warbase_test.py); main.py runs them through war_lobby "base*" actions and the
minute job (construction-done notices).

    warBases/{uid}   one base per player per weekly season (the season key is the Monday it
                     started; a new season starts a fresh base). Server write, owner read.

Owner decisions 2026-11-01: one base per player per season that counts in every War (open zones
and private Wars); building times in minutes, not days; at least 3 things building at once;
offline production; starter resources so the first 30 minutes are rewarding; every number in
CONFIG so the game can be balanced without rewriting it. Later stages add Crystals and Energy,
the other buildings, personnel, starter kits and territory outposts.

How time works: nothing is saved every second. Each building keeps when its construction ends
(busyUntil) and each mine when it last produced (prodAt); settle() works out everything up to
"now" whenever the base is read or changed. A mine doesn't produce while it's being upgraded.
"""
from warmarket import WarError

GRID = 18                                  # the base is GRID x GRID tiles
SLOTS = 3                                  # things building at once
START_GOLD = 1500                          # the season's starter gold
HQ_AT = (7, 7)                             # where the Headquarters stands on a new base

# Per building: size in tiles, max level, cost to reach each level (index 0 = build it),
# seconds to reach each level, how many you may have at each HQ level (index = HQ level - 1).
CONFIG = {
    "hq": {"name": "Trading Headquarters", "size": 4, "max": 5,
           "cost": [0, 600, 1800, 4500, 9000], "time": [0, 300, 900, 1800, 2700], "count": [1, 1, 1, 1, 1]},
    "mine": {"name": "Gold Mine", "size": 3, "max": 5,
             "cost": [150, 300, 700, 1600, 3500], "time": [60, 120, 300, 900, 1800], "count": [1, 2, 2, 3, 3],
             # gold an hour and how much it holds before you collect
             "rate": [600, 900, 1300, 1900, 2700], "store": [1200, 2400, 4500, 8000, 14000]},
    "barracks": {"name": "Military Barracks", "size": 3, "max": 5,
                 "cost": [200, 400, 900, 2000, 4200], "time": [60, 120, 300, 900, 1800], "count": [1, 1, 1, 2, 2],
                 # extra soldiers in your army in Wars and zones you start or join while it stands
                 "soldiers": [5, 10, 15, 20, 30]},
}
KINDS = tuple(CONFIG)


def new_base(season, now_ms):
    hq = {"kind": "hq", "x": HQ_AT[0], "y": HQ_AT[1], "level": 1, "to": None, "busyUntil": None}
    return {"season": season, "gold": START_GOLD, "buildings": {"hq1": hq}, "seq": 1, "createdAt": now_ms, "updatedAt": now_ms}


def hq_level(base):
    return base["buildings"].get("hq1", {}).get("level", 1)


def settle(base, now_ms):
    """The base at now: finished constructions completed, mines' production added to their store.
    Returns (base, done) where done lists the buildings finished since the last settle."""
    out = dict(base, buildings={k: dict(v) for k, v in base["buildings"].items()})
    done = []
    for bid, b in out["buildings"].items():
        if b.get("busyUntil") is not None and b["busyUntil"] <= now_ms:
            b["level"], b["to"], end = b["to"], None, b["busyUntil"]
            b["busyUntil"] = None
            if b["kind"] == "mine":
                b["prodAt"] = end
                b.setdefault("stored", 0)
            done.append(bid)
    for b in out["buildings"].values():
        if b["kind"] != "mine" or b.get("busyUntil") is not None or b.get("level", 0) < 1:
            continue
        cfg = CONFIG["mine"]
        lvl = b["level"]
        since = b.get("prodAt") or now_ms
        made = cfg["rate"][lvl - 1] * max(0, now_ms - since) / 3600000.0
        b["stored"] = min(cfg["store"][lvl - 1], (b.get("stored") or 0) + made)
        b["prodAt"] = now_ms
    out["updatedAt"] = now_ms
    return out, done


def busy_count(base):
    return sum(1 for b in base["buildings"].values() if b.get("busyUntil") is not None)


def next_done(base):
    """When the next construction finishes (for the minute job's notice), or None."""
    ends = [b["busyUntil"] for b in base["buildings"].values() if b.get("busyUntil") is not None]
    return min(ends) if ends else None


def _fits(base, kind, x, y, skip=None):
    size = CONFIG[kind]["size"]
    if not (isinstance(x, int) and isinstance(y, int)) or x < 0 or y < 0 or x + size > GRID or y + size > GRID:
        return False
    for bid, b in base["buildings"].items():
        if bid == skip:
            continue
        s2 = CONFIG[b["kind"]]["size"]
        if x < b["x"] + s2 and b["x"] < x + size and y < b["y"] + s2 and b["y"] < y + size:
            return False
    return True


def _need_slot(base):
    if busy_count(base) >= SLOTS:
        raise WarError("FAILED_PRECONDITION", "All %d builders are busy. Wait for one to finish." % SLOTS)


def _pay(base, cost):
    if base["gold"] < cost:
        raise WarError("FAILED_PRECONDITION", "You need %d gold for that; you have %d." % (cost, int(base["gold"])), {"reason": "base-gold", "need": cost})
    base["gold"] = base["gold"] - cost


def place(base, kind, x, y, now_ms):
    """Build a new building at (x, y): pay its cost and start building level 1."""
    if kind not in CONFIG or kind == "hq":
        raise WarError("INVALID_ARGUMENT", "Pick a building to place.")
    cfg = CONFIG[kind]
    _need_slot(base)
    have = sum(1 for b in base["buildings"].values() if b["kind"] == kind)
    if have >= cfg["count"][hq_level(base) - 1]:
        raise WarError("FAILED_PRECONDITION", "Upgrade your Headquarters to build another %s." % cfg["name"])
    if not _fits(base, kind, x, y):
        raise WarError("FAILED_PRECONDITION", "That spot is taken or off the land.")
    out = dict(base, buildings=dict(base["buildings"]))
    _pay(out, cfg["cost"][0])
    out["seq"] = base.get("seq", 1) + 1
    bid = "%s%d" % (kind, out["seq"])
    out["buildings"][bid] = {"kind": kind, "x": x, "y": y, "level": 0, "to": 1, "busyUntil": now_ms + cfg["time"][0] * 1000}
    out["updatedAt"] = now_ms
    return out, bid


def upgrade(base, bid, now_ms):
    b = base["buildings"].get(bid)
    if not b:
        raise WarError("NOT_FOUND", "That building isn't on your base.")
    if b.get("busyUntil") is not None:
        raise WarError("FAILED_PRECONDITION", "It's already being built.")
    cfg = CONFIG[b["kind"]]
    lvl = b["level"]
    if lvl >= cfg["max"]:
        raise WarError("FAILED_PRECONDITION", "%s is at its top level." % cfg["name"])
    if b["kind"] != "hq" and lvl + 1 > hq_level(base) + 1:
        raise WarError("FAILED_PRECONDITION", "Upgrade your Headquarters first: buildings can be at most one level above it.")
    _need_slot(base)
    out = dict(base, buildings=dict(base["buildings"]))
    _pay(out, cfg["cost"][lvl])
    nb = dict(b, to=lvl + 1, busyUntil=now_ms + cfg["time"][lvl] * 1000)
    out["buildings"][bid] = nb
    out["updatedAt"] = now_ms
    return out


def move(base, bid, x, y, now_ms):
    b = base["buildings"].get(bid)
    if not b:
        raise WarError("NOT_FOUND", "That building isn't on your base.")
    if not _fits(base, b["kind"], x, y, skip=bid):
        raise WarError("FAILED_PRECONDITION", "That spot is taken or off the land.")
    out = dict(base, buildings=dict(base["buildings"]))
    out["buildings"][bid] = dict(b, x=x, y=y)
    out["updatedAt"] = now_ms
    return out


def collect(base, bid, now_ms):
    """Move a mine's stored gold (every mine's when bid is None) into your gold. Returns (base, amount)."""
    out = dict(base, buildings=dict(base["buildings"]))
    got = 0
    for k, b in base["buildings"].items():
        if b["kind"] != "mine" or (bid and k != bid):
            continue
        amt = int(b.get("stored") or 0)
        if amt:
            got += amt
            out["buildings"][k] = dict(b, stored=(b.get("stored") or 0) - amt)
    if bid and bid not in base["buildings"]:
        raise WarError("NOT_FOUND", "That building isn't on your base.")
    out["gold"] = base["gold"] + got
    out["updatedAt"] = now_ms
    return out, got


def soldiers_bonus(base):
    """Extra soldiers from your best finished Barracks (not one under construction to level 1)."""
    best = max((b["level"] for b in base["buildings"].values() if b["kind"] == "barracks" and b["level"] >= 1), default=0)
    return CONFIG["barracks"]["soldiers"][best - 1] if best else 0


def public(base, now_ms):
    """What the app gets: the base plus the rules it needs to draw and price things."""
    return dict(base, now=now_ms, slots=SLOTS, grid=GRID, config=CONFIG)
