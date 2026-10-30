"""Neutral claims, Reinforce, Rally and Hot zones in a private War (docs/WAR_DESIGN.md §3, §6, §11,
§18; approved 2026-10-29). Pure rules here (unit tests: scripts/warmoves_test.py); main.py runs them
(war_lobby actions "claim", "reinforce", "rally" and the War-day change in the deadline job).

"Per day" means a War day: 24 hours counted from the War's start.

  Neutral claim  take an empty territory with no battle and no stake, once a War day, with the same
                 performance check as attacking. A Redeploy pass (within a day of getting it) gives
                 one extra claim and skips the check. Worth 1 point; there's no way to release land.
  Reinforce      once a War day, move soldiers from your reserve onto your own territories, in
                 secret (at most 50 on one territory, like claiming). They raise the defence:
                 1 + soldiers ÷ 20 wins to capture.
  Rally          spend 15 reserve soldiers for one extra attack open at the same time, for the rest
                 of that War day (once a War day).
  Hot zones      each War day the 2 territories whose stocks moved most over 24 hours (a territory a
                 Chaos event hit comes first) are Hot. Holding one when the War day ends is worth
                 +1 point, and winning a battle there +1 more.
"""
from warmap import MAX_PER_TERRITORY, NAMES
from warmarket import COMPANIES, WarError

DAY_MS = 24 * 3600000
RALLY_COST = 15
HOT_COUNT = 2


def war_day(war, now_ms):
    start = war.get("startedAt")
    return int((now_ms - (start if isinstance(start, (int, float)) else now_ms)) // DAY_MS)


def day_key(uid, day):
    return "%s:%d" % (uid, day)


def _holding(war):
    if war.get("status") != "active" or war.get("phase") != "holding":
        raise WarError("FAILED_PRECONDITION", "That's possible once the map is revealed.")


def claim(war, uid, terr, now_ms, performance_ok, use_pass):
    """The War after uid claims a neutral territory, or WarError."""
    _holding(war)
    if now_ms >= war["endsAt"]:
        raise WarError("FAILED_PRECONDITION", "This War is over.")
    cell = (war.get("map") or {}).get(terr)
    if not cell or cell.get("state") != "neutral":
        raise WarError("FAILED_PRECONDITION", "You can only claim a neutral territory.")
    day = war_day(war, now_ms)
    key = day_key(uid, day)
    used = (war.get("claims") or {}).get(key, 0)
    passes = (war.get("redeployPasses") or {}).get(uid, 0)
    pass_ok = passes > 0 and now_ms < ((war.get("passExpiry") or {}).get(uid) or 0)
    if use_pass:
        if not pass_ok:
            raise WarError("FAILED_PRECONDITION", "You don't have a Redeploy pass to use.")
    elif used >= 1:
        raise WarError("FAILED_PRECONDITION", "You've claimed neutral land today. Claim again tomorrow, or use a Redeploy pass.",
                       {"reason": "war-claimed", "pass": pass_ok})
    elif not performance_ok:
        raise WarError("FAILED_PRECONDITION", "To claim, your War return must be 0% or better, or you need a sale at least 1% above its cost in the last 2 days.",
                       {"reason": "war-eligibility", "pass": pass_ok})
    board = dict(war["map"])
    board[terr] = {"state": "owned", "owner": uid, "how": "neutral", "since": now_ms}
    out = dict(war, map=board, updatedAt=now_ms)
    if use_pass:
        out["redeployPasses"] = dict(war.get("redeployPasses") or {}, **{uid: passes - 1})
    else:
        out["claims"] = dict(war.get("claims") or {}, **{key: used + 1})
    return out


def reinforce(war, uid, place, data, now_ms):
    """(war, placement) after moving reserve soldiers onto uid's own territories, or WarError."""
    _holding(war)
    raw = (data or {}).get("soldiers") if isinstance(data, dict) else None
    if not isinstance(raw, dict) or not raw:
        raise WarError("INVALID_ARGUMENT", "Choose how many soldiers to move.")
    key = day_key(uid, war_day(war, now_ms))
    if (war.get("reinforced") or {}).get(key):
        raise WarError("FAILED_PRECONDITION", "You've reinforced today. You can again tomorrow.")
    soldiers = dict((place or {}).get("soldiers") or {})
    reserve = (place or {}).get("reserve") or 0
    total = 0
    for t, n in raw.items():
        if isinstance(n, float) and n.is_integer():
            n = int(n)
        if isinstance(n, bool) or not isinstance(n, int) or n < 1:
            raise WarError("INVALID_ARGUMENT", "Soldiers must be whole numbers.")
        cell = (war.get("map") or {}).get(t)
        if not cell or cell.get("state") != "owned" or cell.get("owner") != uid:
            raise WarError("FAILED_PRECONDITION", "You can only reinforce your own territories.")
        if soldiers.get(t, 0) + n > MAX_PER_TERRITORY:
            raise WarError("INVALID_ARGUMENT", "At most %d soldiers on one territory." % MAX_PER_TERRITORY)
        soldiers[t] = soldiers.get(t, 0) + n
        total += n
    if total > reserve:
        raise WarError("FAILED_PRECONDITION", "You have %d soldiers in reserve." % reserve)
    return (dict(war, reinforced=dict(war.get("reinforced") or {}, **{key: now_ms}), updatedAt=now_ms),
            dict(place or {}, soldiers=soldiers, reserve=reserve - total))


def rally(war, uid, place, now_ms):
    """(war, placement) after spending 15 reserve soldiers on one extra attack today, or WarError."""
    _holding(war)
    key = day_key(uid, war_day(war, now_ms))
    if (war.get("rallies") or {}).get(key):
        raise WarError("FAILED_PRECONDITION", "You've rallied today. You can again tomorrow.")
    reserve = (place or {}).get("reserve") or 0
    if reserve < RALLY_COST:
        raise WarError("FAILED_PRECONDITION", "Rally needs %d soldiers in reserve; you have %d." % (RALLY_COST, reserve))
    return (dict(war, rallies=dict(war.get("rallies") or {}, **{key: now_ms}), updatedAt=now_ms),
            dict(place or {}, reserve=reserve - RALLY_COST))


def extra_attacks(war, uid, now_ms):
    """Attacks open at once above the normal 1 (Rally)."""
    return 1 if (war.get("rallies") or {}).get(day_key(uid, war_day(war, now_ms))) else 0


def pick_hot(territories, quotes, chaos_syms=()):
    """{territory: hint} for the 2 Hot zones: a territory a Chaos event hit first, then the biggest
    average 24-hour move of its stocks (from the public War zone quotes)."""
    by_sym = {c[0]: c[2] for c in COMPANIES}
    moves = {}
    for t in territories:
        ch = [quotes[s]["p"] / quotes[s]["ref"] - 1 for s in quotes if by_sym.get(s) == t and quotes[s].get("ref")]
        if ch:
            moves[t] = sum(ch) / len(ch)
    chaos_t = [t for t in territories if any(by_sym.get(s) == t for s in chaos_syms)]
    ranked = chaos_t + sorted((t for t in moves if t not in chaos_t), key=lambda t: -abs(moves[t]))
    out = {}
    for t in ranked[:HOT_COUNT]:
        m = moves.get(t)
        if t in chaos_t:
            out[t] = "Hot zone: Chaos hit %s" % NAMES[t]
        else:
            out[t] = "Hot zone: %s %+.1f%% in 24 hours" % (NAMES[t], (m or 0) * 100)
    return out


def next_day_at(war):
    """When the current War day ends (the deadline job awards Hot zones then)."""
    return war["startedAt"] + (war.get("hotDay", -1) + 1) * DAY_MS if war.get("hot") is not None else None


def day_change(war, now_ms, hot):
    """At the end of a War day: +1 point to whoever holds each of that day's Hot zones, then the new
    day's Hot zones. hot: pick_hot() for the new day. Returns (war, the old day's holders)."""
    points = dict(war.get("hotPoints") or {})
    held = {}
    for t in (war.get("hot") or {}):
        cell = (war.get("map") or {}).get(t) or {}
        if cell.get("state") == "owned":
            points[cell["owner"]] = points.get(cell["owner"], 0) + 1
            held[t] = cell["owner"]
    return dict(war, hot=hot, hotDay=war_day(war, now_ms), hotPoints=points, updatedAt=now_ms), held


def hot_win(war, terr, winner):
    """+1 point for winning a battle in a Hot zone."""
    if winner and terr in (war.get("hot") or {}):
        points = dict(war.get("hotPoints") or {})
        points[winner] = points.get(winner, 0) + 1
        return dict(war, hotPoints=points)
    return war
