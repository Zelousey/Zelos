"""Private Wars with friends: the lobby (docs/WAR_DESIGN.md §8, §24.3; whole spec approved by the
owner 2026-10-29). Pure rules here (unit tests: scripts/warlobby_test.py); the callable
(war_lobby) and the deadline job live in main.py.

    wars/{id}   one private War (server write; readable by its players and the people invited)

Status stays lobby / active / ended / cancelled (owner Q13: stored names kept), with a `stage`
while it's a lobby:
    configuring   the organizer sets it up (name, length, lobby deadline, max players)
    recruiting    the lobby is open: the organizer invites friends by @username, they join and
                  lock in ("Ready")
    ready         everyone who joined (at least 2) is locked in: the organizer can start it
It starts once. At the lobby deadline it starts with the locked-in players if there are at least
2; otherwise it's cancelled. A draft that's never opened is cancelled after a day. Armies are equal
(100 soldiers each, owner D6; "Level armies" arrive with Battle Level in W7).
"""
import re

import warattack as WA
import warbattle as WB
from warmap import CLAIM_MS
from warmarket import WarError

DAYS = (1, 2, 3, 5, 7)              # War length (owner: never longer than a week)
LOBBY_HOURS = (1, 6, 24)            # lobby deadline (72 h dropped, §8)
MIN_PLAYERS, MAX_PLAYERS = 2, 10
MAX_OPEN = 3                        # private Wars you can be in at once (lobby or running)
MAX_INVITED = 20
SOLDIERS = 100
DRAFT_MS = 24 * 3600000             # a War never opened is cancelled after this
HOUR_MS = 3600000
DAY_MS = 24 * HOUR_MS
NAME_RE = re.compile(r"^[\w .,'!?&-]{2,40}$", re.UNICODE)
LOBBY_STAGES = ("configuring", "recruiting", "ready")


def map_size(players):
    """Territories on the map (owner-approved): 2-3 players 6, 4-6 players 8, 7-10 players 10."""
    return 6 if players <= 3 else 8 if players <= 6 else 10


def validate_config(data):
    """{name, days, lobbyHours, maxPlayers} from the browser -> settings, or WarError."""
    data = data if isinstance(data, dict) else {}
    name = " ".join(str(data.get("name") or "").split())
    if not NAME_RE.match(name):
        raise WarError("INVALID_ARGUMENT", "Give your War a name (2-40 letters).")
    out = {"name": name}
    for key, allowed, msg in (("days", DAYS, "A War lasts 1, 2, 3, 5 or 7 days."),
                              ("lobbyHours", LOBBY_HOURS, "The lobby stays open 1, 6 or 24 hours."),
                              ("maxPlayers", tuple(range(MIN_PLAYERS, MAX_PLAYERS + 1)), "A War has 2 to 10 players.")):
        v = data.get(key)
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        if isinstance(v, bool) or v not in allowed:
            raise WarError("INVALID_ARGUMENT", msg)
        out[key] = v
    return out


def new_war(uid, name, cfg, now_ms):
    return dict(cfg, status="lobby", stage="configuring", organizer=uid, players=[uid], names={uid: name},
                ready={uid: True}, invited=[], armies="equal", soldiers=SOLDIERS, createdAt=now_ms,
                updatedAt=now_ms, deadline=now_ms + DRAFT_MS)


def _lobby(war, now_ms, stages=LOBBY_STAGES):
    if war.get("status") != "lobby":
        raise WarError("FAILED_PRECONDITION", "This War has already %s." % ("started" if war.get("status") == "active" else "finished"))
    if war.get("stage") not in stages:
        raise WarError("FAILED_PRECONDITION", "The lobby isn't open yet." if war.get("stage") == "configuring" else "The lobby is already open.")
    if war.get("deadline") and now_ms >= war["deadline"]:
        raise WarError("FAILED_PRECONDITION", "The lobby deadline has passed.")


def _organizer(war, uid):
    if war.get("organizer") != uid:
        raise WarError("PERMISSION_DENIED", "Only the organizer can do that.")


def _restage(war):
    players = war["players"]
    ready = war.get("ready") or {}
    war["stage"] = "ready" if len(players) >= MIN_PLAYERS and all(ready.get(p) for p in players) else "recruiting"
    return war


def configure(war, uid, cfg, now_ms):
    """The organizer changes the settings while it's still a draft."""
    _organizer(war, uid)
    _lobby(war, now_ms, ("configuring",))
    return dict(war, **cfg, updatedAt=now_ms)


def open_lobby(war, uid, now_ms):
    """The organizer opens the lobby: invites can go out, and the lobby deadline starts."""
    _organizer(war, uid)
    _lobby(war, now_ms, ("configuring",))
    return _restage(dict(war, stage="recruiting", openedAt=now_ms, deadline=now_ms + war["lobbyHours"] * HOUR_MS, updatedAt=now_ms))


def invite(war, uid, to, now_ms):
    _organizer(war, uid)
    _lobby(war, now_ms, ("recruiting", "ready"))
    if to == uid:
        raise WarError("INVALID_ARGUMENT", "That's you. Invite a friend.")
    if to in war["players"]:
        raise WarError("FAILED_PRECONDITION", "They're already in this War.")
    if to in war["invited"]:
        raise WarError("FAILED_PRECONDITION", "They're already invited.")
    if len(war["invited"]) >= MAX_INVITED:
        raise WarError("RESOURCE_EXHAUSTED", "That's a lot of open invites. Wait for some answers first.")
    return dict(war, invited=war["invited"] + [to], updatedAt=now_ms)


def join(war, uid, name, now_ms):
    _lobby(war, now_ms, ("recruiting", "ready"))
    if uid in war["players"]:
        return war
    if uid not in war["invited"]:
        raise WarError("PERMISSION_DENIED", "This War is invite only.")
    if len(war["players"]) >= war["maxPlayers"]:
        raise WarError("FAILED_PRECONDITION", "This War is full.")
    return _restage(dict(war, players=war["players"] + [uid], invited=[x for x in war["invited"] if x != uid],
                         names=dict(war.get("names") or {}, **{uid: name}), ready=dict(war.get("ready") or {}, **{uid: False}), updatedAt=now_ms))


def decline(war, uid, now_ms):
    if uid not in war.get("invited", []):
        raise WarError("FAILED_PRECONDITION", "There's no invite to decline.")
    return dict(war, invited=[x for x in war["invited"] if x != uid], updatedAt=now_ms)


def set_ready(war, uid, ready, now_ms):
    """Lock in (or step back) before the start. The organizer is always locked in."""
    _lobby(war, now_ms, ("recruiting", "ready"))
    if uid not in war["players"]:
        raise WarError("PERMISSION_DENIED", "You're not in this War.")
    if uid == war["organizer"] and not ready:
        raise WarError("FAILED_PRECONDITION", "The organizer is always ready. Cancel the War instead.")
    return _restage(dict(war, ready=dict(war.get("ready") or {}, **{uid: bool(ready)}), updatedAt=now_ms))


def leave(war, uid, now_ms):
    _lobby(war, now_ms, ("recruiting", "ready"))
    if uid == war["organizer"]:
        raise WarError("FAILED_PRECONDITION", "The organizer can't leave. Cancel the War instead.")
    if uid not in war["players"]:
        raise WarError("FAILED_PRECONDITION", "You're not in this War.")
    ready = dict(war.get("ready") or {})
    ready.pop(uid, None)
    names = dict(war.get("names") or {})
    names.pop(uid, None)
    return _restage(dict(war, players=[p for p in war["players"] if p != uid], ready=ready, names=names, updatedAt=now_ms))


def cancel(war, uid, now_ms):
    _organizer(war, uid)
    if war.get("status") != "lobby":
        raise WarError("FAILED_PRECONDITION", "A War can only be cancelled before it starts.")
    return dict(war, status="cancelled", stage=None, cancelledAt=now_ms, why="organizer", updatedAt=now_ms)


def _begin(war, players, now_ms):
    ready = war.get("ready") or {}
    return dict(war, status="active", stage=None, players=players, ready={p: True for p in players},
                names={p: (war.get("names") or {}).get(p, "Trader") for p in players},
                invited=[], mapSize=map_size(len(players)), startedAt=now_ms, endsAt=now_ms + war["days"] * DAY_MS,
                phase="claiming", claimEnds=now_ms + CLAIM_MS, lockedCount=0, dropped=[p for p in war["players"] if not ready.get(p)], updatedAt=now_ms)


def start(war, uid, now_ms):
    """The organizer starts it once everyone who joined (at least 2) is locked in."""
    _organizer(war, uid)
    _lobby(war, now_ms, ("recruiting", "ready"))
    if war.get("stage") != "ready":
        raise WarError("FAILED_PRECONDITION", "Everyone in the lobby has to be ready, and you need at least 2 players.")
    return _begin(war, list(war["players"]), now_ms)


def at_deadline(war, now_ms):
    """The lobby deadline (or a draft's day) is up: start with the locked-in players if there
    are at least 2, otherwise cancel. Returns the War unchanged if nothing is due."""
    if war.get("status") != "lobby" or not war.get("deadline") or now_ms < war["deadline"]:
        return war
    if war.get("stage") == "configuring":
        return dict(war, status="cancelled", stage=None, cancelledAt=now_ms, why="never-opened", updatedAt=now_ms)
    ready = [p for p in war["players"] if (war.get("ready") or {}).get(p)]
    if len(ready) < MIN_PLAYERS:
        return dict(war, status="cancelled", stage=None, cancelledAt=now_ms, why="not-enough-players", updatedAt=now_ms)
    return _begin(war, ready, now_ms)


def at_end(war, now_ms):
    if war.get("status") != "active" or now_ms < war.get("endsAt", float("inf")):
        return war
    return dict(war, status="ended", endedAt=now_ms, updatedAt=now_ms)


def due_at(war):
    """When the deadline job next has to look at this War (stored as `due`, so one query finds them)."""
    if war.get("status") == "lobby":
        return war.get("deadline")
    if war.get("status") == "active":
        if war.get("phase") == "claiming":
            return war.get("claimEnds")
        dues = [war.get("endsAt")] + [WB.due(b) for b in (war.get("battles") or {}).values()] + [WA.due(a) for a in (war.get("attacks") or {}).values()]
        return min(d for d in dues if d is not None)
    return None


def stored(war):
    """The War as it's saved: `due` set for the job, or removed once nothing more is due."""
    out = {k: v for k, v in war.items() if k != "due"}
    due = due_at(war)
    if due is not None:
        out["due"] = due
    return out
