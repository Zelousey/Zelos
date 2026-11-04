"""War abilities paid with Energy from your base (owner 2026-11-03). Pure rules here (unit tests:
scripts/warability_test.py); main.py runs them (war_lobby actions "scout" and "shield").

    Scout   25 Energy: the real number of soldiers on an enemy territory, kept for you for 1 hour
            (wars/{id}/intel/{uid}.scouts {territory: {n, at, until}}). Nobody else sees it.
    Shield  60 Energy: one territory you hold can't be attacked for 6 hours, once a War day
            (wars/{id}.shields {territory: {by, until}}; everyone sees the shield on the map).

Energy comes from the Wizard's Tower (warbase.CONFIG "wizard", Headquarters level 4) or the shop.
"""
from warmarket import WarError
from warmoves import war_day
from warmap import NAMES

SCOUT_ENERGY = 25
SCOUT_MS = 3600000
SHIELD_ENERGY = 60
SHIELD_MS = 6 * 3600000


def _running(war):
    if war.get("status") != "active" or war.get("phase") != "holding":
        raise WarError("FAILED_PRECONDITION", "Abilities work once the map is revealed and the War is running.")


def scout(war, intel, uid, terr, soldiers_there, now_ms):
    """(intel doc, Energy cost) after scouting terr. soldiers_there: the holder's soldiers on it."""
    _running(war)
    cell = (war.get("map") or {}).get(terr) or {}
    if cell.get("state") != "owned" or cell.get("owner") == uid:
        raise WarError("FAILED_PRECONDITION", "Scout a territory another player holds.")
    scouts = {k: v for k, v in ((intel or {}).get("scouts") or {}).items() if v.get("until", 0) > now_ms}
    if terr in scouts:
        raise WarError("FAILED_PRECONDITION", "You scouted %s less than an hour ago." % NAMES.get(terr, terr))
    scouts[terr] = {"n": int(soldiers_there or 0), "at": now_ms, "until": now_ms + SCOUT_MS}
    return dict(intel or {}, scouts=scouts), SCOUT_ENERGY


def shielded(war, terr, now_ms):
    s = (war.get("shields") or {}).get(terr)
    return bool(s) and s.get("until", 0) > now_ms


def shield(war, uid, terr, now_ms):
    """(war, Energy cost) after shielding terr for 6 hours."""
    _running(war)
    cell = (war.get("map") or {}).get(terr) or {}
    if cell.get("state") != "owned" or cell.get("owner") != uid:
        raise WarError("FAILED_PRECONDITION", "Shield a territory you hold.")
    if shielded(war, terr, now_ms):
        raise WarError("FAILED_PRECONDITION", "%s is already shielded." % NAMES.get(terr, terr))
    day = "%s:%d" % (uid, war_day(war, now_ms))
    if (war.get("shieldDays") or {}).get(day):
        raise WarError("FAILED_PRECONDITION", "You've used your Shield today. It's back next War day.")
    shields = {k: v for k, v in (war.get("shields") or {}).items() if v.get("until", 0) > now_ms}
    shields[terr] = {"by": uid, "until": now_ms + SHIELD_MS}
    return dict(war, shields=shields, shieldDays=dict(war.get("shieldDays") or {}, **{day: now_ms})), SHIELD_ENERGY
