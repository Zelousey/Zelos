"""The War map: territories, secret placement, enemy warnings, Camouflage and the reveal
(docs/WAR_DESIGN.md §2-§4; whole spec approved 2026-10-29; claiming time, map sectors and the W4
split chosen by the owner 2026-10-29). Pure rules here (unit tests: scripts/warmap_test.py); the
callable actions and the claiming deadline live in main.py.

    wars/{id}                     map: {territory: {state, owner?, contenders?, how?, since}}  (everyone in the War)
    wars/{id}/placements/{uid}    your soldiers per territory and Camouflage (only you can read it)
    wars/{id}/intel/{uid}         your enemy warnings while claiming (only you can read it)
    wars/{id}/log/{id}            what happened on the map (everyone in the War)

Claiming: each player places all their soldiers (100, less 5 per Camouflage) in secret: at most
50 on one territory and at least one territory left empty, then locks in. Claiming ends when
everyone has locked in, or after an hour; anyone not locked in has their last saved placement
used, or their soldiers spread evenly. Then each territory is a clear win (the leader has more
than 25% more soldiers than the runner-up), contested (the runner-up has at least 80% of the
leader's soldiers; settled by a battle in W4b) or neutral (nobody there).
"""
from warmarket import SECTORS, WarError

TERRITORIES = tuple(s for s, _ in SECTORS)    # 10 sectors: maps of 6, 8 or 10 take that many
NAMES = dict(SECTORS)
CLAIM_MS = 3600000                            # claiming lasts up to an hour (owner 2026-10-29)
MAX_PER_TERRITORY = 50
CAMO_COST = 5                                 # Camouflage: 5 soldiers per hidden territory (D2)
CAMO_MAX = 2
HEAVY = 30                                    # "Heavy enemy presence" from 30 soldiers (D1)
MARGIN = 0.8                                  # contested when the runner-up has >= 80% of the leader (D4)


def pick_territories(n, rng):
    """n territories for a new War, in the usual sector order (random which ones when n < 10)."""
    ids = list(TERRITORIES)
    while len(ids) > n:
        ids.pop(int(rng.random() * len(ids)) % len(ids))
    return ids


def validate_placement(data, territories, soldiers):
    """{soldiers: {territory: n}, camo: [territory]} from the browser -> a placement, or WarError."""
    data = data if isinstance(data, dict) else {}
    raw = data.get("soldiers") if isinstance(data.get("soldiers"), dict) else {}
    camo = data.get("camo") if isinstance(data.get("camo"), list) else []
    out = {}
    for t, n in raw.items():
        if t not in territories:
            raise WarError("INVALID_ARGUMENT", "That territory isn't on this map.")
        if isinstance(n, float) and n.is_integer():
            n = int(n)
        if isinstance(n, bool) or not isinstance(n, int) or n < 0:
            raise WarError("INVALID_ARGUMENT", "Soldiers must be whole numbers.")
        if n > MAX_PER_TERRITORY:
            raise WarError("INVALID_ARGUMENT", "At most %d soldiers on one territory." % MAX_PER_TERRITORY)
        if n:
            out[t] = n
    if len(set(camo)) != len(camo) or len(camo) > CAMO_MAX or any(t not in out for t in camo):
        raise WarError("INVALID_ARGUMENT", "Camouflage up to %d territories where you have soldiers." % CAMO_MAX)
    need = soldiers - CAMO_COST * len(camo)
    if sum(out.values()) != need:
        raise WarError("INVALID_ARGUMENT", "Place all %d of your soldiers (you have %d placed)." % (need, sum(out.values())))
    if len(out) >= len(territories):
        raise WarError("INVALID_ARGUMENT", "Leave at least one territory empty.")
    return {"soldiers": out, "camo": sorted(camo)}


def even_spread(territories, soldiers):
    """For a player who never locked in: soldiers spread evenly, the last territory left empty."""
    use = list(territories)[:-1]
    base, extra = divmod(soldiers, len(use))
    return {"soldiers": {t: base + (1 if i < extra else 0) for i, t in enumerate(use)}, "camo": []}


def warnings_for(uid, placements):
    """uid's enemy warnings from the *locked-in* opponents (Camouflaged territories don't count):
    {territory: "enemy" | "heavy"}. No names, no numbers."""
    totals = {}
    for other, p in placements.items():
        if other == uid or not p.get("locked"):
            continue
        hidden = set(p.get("camo") or [])
        for t, n in (p.get("soldiers") or {}).items():
            if n and t not in hidden:
                totals[t] = totals.get(t, 0) + n
    return {t: ("heavy" if n >= HEAVY else "enemy") for t, n in totals.items()}


def final_placements(players, territories, soldiers, placements, spread=True):
    """Every player's placement at the end of claiming (saved, or spread evenly), all locked.
    soldiers: one number for everyone, or {uid: n} (level armies in open zones). spread=False (open
    zones): a player who never saved keeps every soldier in reserve and holds no land."""
    out = {}
    for uid in players:
        p = placements.get(uid) or {}
        n = soldiers.get(uid, 100) if isinstance(soldiers, dict) else soldiers
        try:
            v = validate_placement(p, territories, n)
        except WarError:
            v = even_spread(territories, n) if spread else {"soldiers": {}, "camo": [], "reserve": n}
        out[uid] = dict(v, locked=True)
    return out


def resolve(territories, placements, names, now_ms):
    """The reveal: (map, log lines). Owners are public; soldier counts stay private."""
    board, lines = {}, []
    for t in territories:
        here = sorted(((p["soldiers"].get(t, 0), uid) for uid, p in placements.items() if p["soldiers"].get(t, 0) > 0), reverse=True)
        if not here:
            board[t] = {"state": "neutral", "since": now_ms}
            lines.append("%s stays neutral." % NAMES[t])
            continue
        lead = here[0][0]
        close = [uid for n, uid in here if n >= MARGIN * lead]
        if len(close) >= 2:
            board[t] = {"state": "contested", "contenders": close, "since": now_ms}
            lines.append("%s is contested: %s." % (NAMES[t], " vs ".join(names.get(u, "Trader") for u in close)))
        else:
            board[t] = {"state": "owned", "owner": here[0][1], "how": "claimed", "since": now_ms}
            lines.append("%s took %s." % (names.get(here[0][1], "Trader"), NAMES[t]))
    return board, lines


def claiming_over(war, placements, now_ms):
    """Claiming ends when every player has locked in, or at its deadline."""
    if war.get("phase") != "claiming":
        return False
    if war.get("kind") == "zone":  # more players can still drop in: the hour always runs out
        return now_ms >= war.get("claimEnds", 0)
    return now_ms >= war.get("claimEnds", 0) or all((placements.get(p) or {}).get("locked") for p in war["players"])
