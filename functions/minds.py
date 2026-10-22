"""Hall of Minds (owner 2026-10-22): history's great minds, as the server sees them.

The content (figures, lessons, quotes, head-to-head pairs) lives in data/minds.json, the same
file the app shows; scripts/build_practice.py copies it next to this module. The server needs it
for three things:
  - XP: 10 once per lesson or pair read (xp_award type "mind", refId "<figure>:<lesson>" or
    "vs:<pair>"), at most 20 a day;
  - daily quotes: following a figure costs FOLLOW_COST tokens for FOLLOW_DAYS days (renewing adds
    30 more days), kept on the wallet as mindQuotes {figure: until ms};
  - picking each follower's one quote a day (pick_quote), so nobody gets more than one a day
    however many figures they follow.
"""
import json
import os
from datetime import date

LESSON_XP = 10
DAILY_LIMIT = 20
FOLLOW_COST = 15
FOLLOW_DAYS = 30
DAY_MS = 86400000


def _load():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "minds.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("[minds] content file unreadable:", type(e).__name__)
        return {"figures": [], "pairs": []}


DATA = _load()
FIGURES = {f["id"]: f for f in DATA.get("figures") or []}
PAIRS = {p["id"]: p for p in DATA.get("pairs") or []}
XP_REFS = frozenset(["%s:%s" % (f, l["id"]) for f, fig in FIGURES.items() for l in fig["lessons"]] + ["vs:" + p for p in PAIRS])


def follow(wallet, figure, now_ms):
    """Pure: (wallet, cost) for 30 more days of a figure's daily quote. Raises ValueError with a
    message for the person when it can't be bought."""
    if figure not in FIGURES:
        raise ValueError("That figure isn't in the Hall of Minds.")
    if not FIGURES[figure].get("quotes"):
        raise ValueError("There are no quotes for %s yet." % FIGURES[figure]["name"])
    if wallet.get("balance", 0) < FOLLOW_COST:
        raise ValueError("You need %d tokens and have %d." % (FOLLOW_COST, wallet.get("balance", 0)))
    subs = dict(wallet.get("mindQuotes") or {})
    subs[figure] = max(int(subs.get(figure) or 0), now_ms) + FOLLOW_DAYS * DAY_MS
    return dict(wallet, balance=wallet["balance"] - FOLLOW_COST, mindQuotes=subs, updatedAt=now_ms), FOLLOW_COST


def active(subs, now_ms):
    """The figures someone follows right now, in a stable order."""
    return sorted(f for f, until in (subs or {}).items() if f in FIGURES and int(until or 0) > now_ms)


def pick_quote(figures, uid, day):
    """Pure: (figure id, quote) for one person's quote today. Rotates through the figures they
    follow, and through each figure's quotes, so the same quote doesn't come twice in a row."""
    if not figures:
        return None
    n = date.fromisoformat(day).toordinal() + sum(ord(c) for c in uid)
    fid = figures[n % len(figures)]
    quotes = FIGURES[fid]["quotes"]
    return fid, quotes[(n // len(figures)) % len(quotes)]
