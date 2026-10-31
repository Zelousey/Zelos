"""Open War zones with weekly seasons (docs/WAR_DESIGN.md §24.3-§24.4; approved 2026-10-27; W6
decisions 2026-10-30: smaller army mid-season, same War Score with the return counted from joining;
2026-10-31: 10 players per zone, seasons start Monday 9 am ET, W6b in two steps). Pure rules here
(unit tests: scripts/warzone_test.py); main.py runs them (war_lobby actions "zoneJoin" and
"zoneLeave", and the season change in the deadline job).

    wars/{zoneId}   one zone for one season: kind "zone", rookie, season "YYYY-MM-DD", zoneNo,
                    joinedAt {uid: ms}, troops {uid: soldiers}, shieldUntil {uid: ms}
    warProfiles/{uid}.zone   the zone you're in (one at a time; private Wars are separate)

Zone ids are z + the season's Monday + r (Rookie) or o (open) + a 3-digit number, so the next free
zone is found without a query and two players can't open the same zone twice.

  Seasons     Monday 9 am ET to the next Monday 9 am ET. The first hour is the secret claiming
              hour (like a private War) for everyone who's in by then; the land resets every
              season. Players who held land or traded are carried into the next season.
  Joining     any time until the season's last hour. Drop-ins land with no territory and their
              army in reserve; they claim neutral land or attack, with all the private War rules.
  Army        level army (100 + 10 per Battle Level rank above Recruit, at most 150) in the
              claiming hour, then 10 fewer per day of the season, never below 50.
  Shield      a drop-in's land can't be attacked for 24 hours; attacking someone ends it early.
  Rookie      Recruit and Soldier ranks play in Rookie zones (lower ranks only).
  Score       the same War Score, with each player's return counted from when they joined.

W6b2 (2026-10-31):
  Results     at a season's end each player's finish goes on their War profile (`seasons`, the last
              10); the top 3 are told so (gold bars for them arrive in W7).
  Moving up   a Recruit or Soldier can choose an open zone any time (and back); Sergeants and up
              always play in open zones, so a rookie who ranks up moves up at the next season.
  Going broke below $10,000 of War balance you can reset to $100,000, once a week, with no stakes
              held. It costs you this season: you forfeit every War you're in (score 0, ranked
              last). The balance chart marks the reset.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import warlevel as WLV
from warmap import CLAIM_MS, TERRITORIES
from warmarket import CHART_KEPT, START_BALANCE, WarError

ET = ZoneInfo("America/New_York")
SIZE = 10                    # players per zone (owner 2026-10-31: one territory each on average)
SEASON_HOUR = 9              # Monday 9 am ET (owner 2026-10-31)
DAY_MS = 24 * 3600000
SHIELD_MS = DAY_MS
LAST_HOUR_MS = 3600000       # no joining in a season's last hour
MIN_ARMY = 50
LATE_PER_DAY = 10            # 10 fewer soldiers per day of the season
ROOKIE_TOP = 1               # rank index: Recruit 0 and Soldier 1 play in Rookie zones
MAX_ZONES = 300              # per season and kind
RESET_BELOW = 10000.0        # going broke (§24.5)
RESET_EVERY_MS = 7 * DAY_MS
SEASONS_KEPT = 10


def season_start(now_ms):
    """The current season's start (ms): the last Monday 9 am ET at or before now."""
    now = datetime.fromtimestamp(now_ms / 1000, ET)
    d = now - timedelta(days=now.weekday())
    start = datetime(d.year, d.month, d.day, SEASON_HOUR, tzinfo=ET)
    if start > now:
        start = _week(start, -1)
    return int(start.timestamp() * 1000)


def _week(dt, n):
    d = dt.date() + timedelta(days=7 * n)
    return datetime(d.year, d.month, d.day, SEASON_HOUR, tzinfo=ET)


def season_end(start_ms):
    return int(_week(datetime.fromtimestamp(start_ms / 1000, ET), 1).timestamp() * 1000)


def season_key(start_ms):
    return datetime.fromtimestamp(start_ms / 1000, ET).strftime("%Y-%m-%d")


def zone_id(key, rookie, n):
    return "z%s%s%03d" % (key.replace("-", ""), "r" if rookie else "o", n)


def is_rookie(points):
    return WLV.rank_index(points) <= ROOKIE_TOP


def plays_rookie(points, pref):
    """Rookie zone or open: Recruits and Soldiers choose (Rookie unless they picked open)."""
    return is_rookie(points) and pref != "open"


def army(points, start_ms, now_ms):
    """Soldiers for someone joining now: the level army in the claiming hour, then 10 fewer per
    day of the season (day 1 = the first 24 hours), never below 50."""
    full = WLV.army(points)
    if now_ms < start_ms + CLAIM_MS:
        return full
    return max(MIN_ARMY, full - LATE_PER_DAY * int((now_ms - start_ms) // DAY_MS))


def new_zone(key, rookie, n, start_ms, now_ms):
    """A new zone for this season: in its claiming hour, or straight to holding with all land neutral."""
    war = {"kind": "zone", "rookie": rookie, "season": key, "zoneNo": n, "name": "%s zone %d" % ("Rookie" if rookie else "Open", n),
           "status": "active", "days": 7, "maxPlayers": SIZE, "open": True, "players": [], "names": {}, "troops": {}, "joinedAt": {},
           "shieldUntil": {}, "startEquity": {}, "territories": list(TERRITORIES), "mapSize": len(TERRITORIES),
           "startedAt": start_ms, "endsAt": season_end(start_ms), "createdAt": now_ms, "updatedAt": now_ms}
    if now_ms < start_ms + CLAIM_MS:
        war.update(phase="claiming", claimEnds=start_ms + CLAIM_MS, lockedCount=0)
    else:
        war.update(phase="holding", map={t: {"state": "neutral", "since": now_ms} for t in TERRITORIES}, battles={}, revealedAt=now_ms, standingsDue=now_ms)
    return war


def add_player(war, uid, name, soldiers, equity, now_ms):
    """(war, placement or None). In the claiming hour you place in secret like everyone else;
    after it you land with your army in reserve and a 24-hour shield."""
    if war.get("kind") != "zone" or war.get("status") != "active":
        raise WarError("FAILED_PRECONDITION", "That zone isn't running.")
    if uid in war["players"]:
        raise WarError("FAILED_PRECONDITION", "You're already in this zone.")
    if len(war["players"]) >= SIZE:
        raise WarError("FAILED_PRECONDITION", "That zone is full.")
    if now_ms >= war["endsAt"] - LAST_HOUR_MS:
        raise WarError("FAILED_PRECONDITION", "This season ends within the hour. Join when the next one starts, Monday 9 am ET.")
    players = war["players"] + [uid]
    out = dict(war, players=players, open=len(players) < SIZE, names=dict(war.get("names") or {}, **{uid: name}),
               troops=dict(war.get("troops") or {}, **{uid: soldiers}), joinedAt=dict(war.get("joinedAt") or {}, **{uid: now_ms}),
               startEquity=dict(war.get("startEquity") or {}, **{uid: equity}), updatedAt=now_ms)
    if war.get("phase") == "claiming":
        return out, None
    out["shieldUntil"] = dict(war.get("shieldUntil") or {}, **{uid: now_ms + SHIELD_MS})
    return out, {"soldiers": {}, "camo": [], "reserve": soldiers, "locked": True, "lockedAt": now_ms, "dropIn": True}


def leave(war, uid, now_ms):
    """The zone after uid leaves: their land turns neutral. Not while a battle of theirs is on."""
    if uid not in war.get("players", []):
        raise WarError("NOT_FOUND", "You're not in that zone.")
    busy = [a for a in (war.get("attacks") or {}).values() if a.get("stage") in ("answering", "running") and uid in (a.get("attacker"), a.get("defender"))]
    busy += [b for b in (war.get("battles") or {}).values() if b.get("stage") != "done" and uid in (b.get("players") or [])]
    if busy:
        raise WarError("FAILED_PRECONDITION", "Finish your battles first.")
    board = {t: ({"state": "neutral", "since": now_ms} if c.get("owner") == uid else c) for t, c in (war.get("map") or {}).items()}
    players = [p for p in war["players"] if p != uid]
    shield = {k: v for k, v in (war.get("shieldUntil") or {}).items() if k != uid}
    out = dict(war, players=players, open=len(players) < SIZE, shieldUntil=shield, left=sorted(set(war.get("left") or []) | {uid}), updatedAt=now_ms)
    if war.get("map") is not None:
        out["map"] = board
    return out


def shielded(war, uid, now_ms):
    return war.get("kind") == "zone" and now_ms < ((war.get("shieldUntil") or {}).get(uid) or 0)


def end_shield(war, uid):
    if uid not in (war.get("shieldUntil") or {}):
        return war
    return dict(war, shieldUntil={k: v for k, v in war["shieldUntil"].items() if k != uid})


def since(war, uid):
    """When uid's War return starts counting: when they joined the zone (or the War's start)."""
    return (war.get("joinedAt") or {}).get(uid) or war.get("startedAt") or 0


def carried(rows):
    """Who goes on to next season: everyone who held land or traded (the others are let go)."""
    return [r["uid"] for r in rows if r.get("points") or r.get("ret")]


def check_reset(profile, equity, now_ms):
    """WarError unless this player may reset their War balance now."""
    if equity >= RESET_BELOW:
        raise WarError("FAILED_PRECONDITION", "You can reset when your War balance is below $10,000.")
    if (profile.get("held") or 0) > 0:
        raise WarError("FAILED_PRECONDITION", "Finish your battles first: some of your War cash is held as stakes.")
    last = profile.get("lastResetAt") or 0
    if now_ms - last < RESET_EVERY_MS:
        raise WarError("FAILED_PRECONDITION", "You can reset once a week.", {"reason": "war-reset-wait", "next": last + RESET_EVERY_MS})


def reset_profile(profile, now_ms):
    """The War profile after a reset: $100,000 in cash, no positions; the chart marks it."""
    chart = (list(profile.get("chart") or []) + [{"t": now_ms, "eq": START_BALANCE, "reset": True}])[-CHART_KEPT:]
    return dict(profile, start=START_BALANCE, cash=START_BALANCE, held=0, positions={}, equity=START_BALANCE, pnl=0.0, pnlPct=0.0,
                lastResetAt=now_ms, resets=(list(profile.get("resets") or []) + [now_ms])[-10:], chart=chart, updatedAt=now_ms)


def forfeit(war, uid, now_ms):
    if uid not in war.get("players", []) or uid in (war.get("forfeits") or {}):
        return war
    return dict(war, forfeits=dict(war.get("forfeits") or {}, **{uid: now_ms}), updatedAt=now_ms)


def season_record(war, row, of):
    return {"season": war.get("season"), "zone": war.get("name"), "rookie": bool(war.get("rookie")), "rank": row["rank"], "of": of,
            "score": row["score"], "forfeit": bool(row.get("forfeit"))}


def add_season(profile, record):
    return (list(profile.get("seasons") or []) + [record])[-SEASONS_KEPT:]
