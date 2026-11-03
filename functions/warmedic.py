"""Wounded soldiers and the Medical Station (owner 2026-11-03, "Balanced"). Pure rules here (unit
tests: scripts/warmedic_test.py); main.py records losses after an attack and runs the healing
every 10 minutes (war_market_tick).

Every soldier you lose in a War (an attack you lose, defending a territory, the retreat when it's
taken) is counted in that War's placement as `downed`. With a Medical Station (warbase.CONFIG
"medical"), a share of them is saved: 30% at level 1 up to 70% at level 5. The saved ones come back
to that War's reserve at 2/3/4/6/8 an hour. The share uses the station's level when they heal, so
building or upgrading it later also helps soldiers lost before. Without a station they're gone.

    wars/{id}/placements/{uid}: downed (lost this War), healed (brought back), healAt (healing clock)
"""
import warbase as WBASE

H = 3600000
EVERY_MIN = 10


def record_loss(place, n, now_ms):
    """The placement after losing n soldiers (n > 0)."""
    if n <= 0:
        return place
    p = dict(place or {})
    p["downed"] = (p.get("downed") or 0) + n
    if not p.get("healAt") or p.get("idle"):
        p["healAt"] = now_ms  # nobody was waiting: the healing clock starts now
    p["idle"] = False
    return p


def _saved(place, level):
    cfg = WBASE.CONFIG["medical"]
    return int((place.get("downed") or 0) * cfg["saves"][level - 1]) if level >= 1 else 0


def waiting(place, level):
    """Wounded soldiers the station will still bring back at this level."""
    return max(0, _saved(place, level) - (place.get("healed") or 0))


def heal(place, level, now_ms):
    """(placement, soldiers healed now): whole soldiers at the station's rate since the clock;
    the clock keeps the part of an hour already done."""
    p = dict(place or {})
    left = waiting(p, level)
    since = p.get("healAt") or now_ms
    if level < 1 or left <= 0:
        return (dict(p, healAt=now_ms, idle=True) if p.get("downed") else p), 0
    rate = WBASE.CONFIG["medical"]["heal"][level - 1]
    n = min(left, int(rate * max(0, now_ms - since) / H))
    if n <= 0:
        return p, 0
    p.update(reserve=(p.get("reserve") or 0) + n, healed=(p.get("healed") or 0) + n,
             healAt=now_ms if n == left else since + int(n * H / rate), idle=n == left)
    return p, n
