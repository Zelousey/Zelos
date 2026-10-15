"""Price alerts that fire with the app closed.

A person's price alerts (drawn on a chart in the app or on the website) are saved on
users/{uid}.twAlerts by the chart engine (practice/practice-chart.js), with
users/{uid}.twAlertsActive = how many are still waiting. Every time refresh_quotes
fetches new prices, main.price_alerts_pass checks the waiting ones against those
server prices and, for each one crossed, marks it triggered and sends a bell item and
a push (notify_users, kind "price").

Nothing here trusts the saved list: every alert is re-checked (a known stock, a real
positive price, a direction), only the first MAX are looked at, and an alert can only
ever notify the person whose account it is on.
"""
import math
import re

MAX = 50  # same as ALERT_MAX in practice-chart.js
_ID_RE = re.compile(r"^[a-z0-9]{4,24}$")


def clean(raw, symbols):
    """The valid alerts in a saved list (the first MAX entries, in order). Each is a new dict
    with only the fields we use; anything malformed is dropped."""
    out = []
    for a in (raw if isinstance(raw, list) else [])[:MAX]:
        if not isinstance(a, dict):
            continue
        aid, sym, price, dirn = a.get("id"), a.get("sym"), a.get("price"), a.get("dir")
        if not (isinstance(aid, str) and _ID_RE.match(aid)):
            continue
        if not (isinstance(sym, str) and sym in symbols):
            continue
        if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
            continue
        if dirn not in ("above", "below"):
            continue
        upd = a.get("updatedAt")
        out.append({"id": aid, "sym": sym, "price": float(price), "dir": dirn,
                    "status": "active" if a.get("status") == "active" else "triggered",
                    "updatedAt": upd if isinstance(upd, (int, float)) and not isinstance(upd, bool) else 0})
    return out


def crossed(a, price):
    return (a["dir"] == "above" and price >= a["price"]) or (a["dir"] == "below" and price <= a["price"])


def hits(alerts, prices):
    """[(alert, price now)] for the waiting alerts these prices crossed. prices: {SYM: float}."""
    out = []
    for a in alerts:
        p = prices.get(a["sym"])
        if a["status"] == "active" and isinstance(p, (int, float)) and p > 0 and crossed(a, p):
            out.append((a, float(p)))
    return out


def guard_id(uid, a):
    """One notification per alert per placement: moving or re-arming an alert gives it a new
    updatedAt, so it can fire again; an old copy of the list re-saved by another device can't."""
    return "%s_%s_%d" % (uid, a["id"], int(a.get("updatedAt") or 0))


def fmt(p):
    return "${:,.2f}".format(p)


def message(a, price):
    """(title, body, link path) for one alert that fired."""
    where = "at" if price == a["price"] else ("above" if price > a["price"] else "below")
    title = "%s hit %s" % (a["sym"], fmt(a["price"]))
    body = "%s is at %s, %s your %s alert. Tap to see the chart." % (a["sym"], fmt(price), where, fmt(a["price"]))
    return title, body, "app/markets/" + a["sym"]


def mark(raw, fired, now_ms):
    """The saved list with the fired alerts (ids -> price now) marked triggered, only where the
    saved alert is still the same waiting one we checked ((id, updatedAt) matches). Returns
    (new list, how many are still waiting, the ids actually marked)."""
    out, marked = [], []
    for a in (raw if isinstance(raw, list) else []):
        if isinstance(a, dict) and a.get("id") in fired and a.get("status") == "active":
            want_upd, price = fired[a["id"]]
            if (a.get("updatedAt") or 0) == want_upd:
                a = dict(a, status="triggered", triggeredAt=now_ms, updatedAt=now_ms, hitPrice=price)
                marked.append(a["id"])
        out.append(a)
    waiting = sum(1 for a in out if isinstance(a, dict) and a.get("status") == "active")
    return out, waiting, marked
