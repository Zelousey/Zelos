"""Community posts (owner 2026-11-13): "after you sell a trade you get a shareable card that you can
share to other social media or the Zelos community page, with a little thesis under it", for Solo
trades and, kept separate, finished Trade War battles.

The card is never sent by the browser: the server builds it from the real record (a closed trade
in practiceAccounts/{uid}/history, or the player's row in a finished battle's results), so a post
can't show a gain that didn't happen. One post per trade or battle; the thesis is short and runs
through the word filter. Pure helpers here; the callables are in main.py.

  posts/{uid_s_ref | uid_b_ref}   {uid, name, username, photo, source, ref, card, thesis, createdAt}
"""
import re

SOURCES = ("solo", "battle")
THESIS_MAX = 280
POSTS_PER_DAY = 10
_REF = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v else None


def clean_thesis(text):
    """Single spaces, no control characters, at most THESIS_MAX characters (line breaks kept, at most 2 in a row)."""
    s = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    s = "".join(ch for ch in s if ch == "\n" or (ord(ch) >= 32 and ord(ch) != 127))
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    return s[:THESIS_MAX]


def validate(data):
    """{source, ref, thesis} -> (source, ref, thesis), or ValueError(message)."""
    data = data if isinstance(data, dict) else {}
    source, ref = data.get("source"), data.get("ref")
    if source not in SOURCES:
        raise ValueError("Pick a trade or a battle to share.")
    if not (isinstance(ref, str) and _REF.match(ref)):
        raise ValueError("That can't be shared.")
    thesis = clean_thesis(data.get("thesis"))
    if len(str(data.get("thesis") or "")) > THESIS_MAX * 2:
        raise ValueError("Keep the thesis under %d characters." % THESIS_MAX)
    return source, ref, thesis


def post_id(uid, source, ref):
    return "%s_%s_%s" % (uid, source[0], ref)


def solo_card(rec):
    """A closed Solo trade (a history doc with kind 'trade') -> the card, or ValueError."""
    if not isinstance(rec, dict) or rec.get("kind") != "trade":
        raise ValueError("Only a closed trade can be shared.")
    sym = rec.get("sym")
    entry, exit_, pnl, pct, qty = (_num(rec.get(k)) for k in ("entry", "exit", "pnl", "pct", "qty"))
    if not (isinstance(sym, str) and re.match(r"^[A-Z.\-]{1,10}$", sym)) or None in (entry, exit_, pnl, pct, qty):
        raise ValueError("That trade can't be shared.")
    card = {"sym": sym, "qty": qty, "entry": round(entry, 4), "exit": round(exit_, 4), "pnl": round(pnl, 2), "pct": round(pct, 2)}
    if isinstance(rec.get("opt"), str):
        card["option"] = str(rec.get("label") or rec["opt"])[:60]
    for k in ("openDay", "closeDay"):
        if isinstance(rec.get(k), str) and _DAY.match(rec[k]):
            card[k] = rec[k]
    return card


def battle_card(war, uid):
    """Your row in a finished battle -> the card, or ValueError."""
    if not isinstance(war, dict) or war.get("status") != "ended":
        raise ValueError("Only a finished battle can be shared.")
    rows = [r for r in (war.get("results") or []) if isinstance(r, dict)]
    me = next((r for r in rows if r.get("uid") == uid), None)
    if not me:
        raise ValueError("You weren't in that battle.")
    modes = war.get("modes") if isinstance(war.get("modes"), dict) else {}
    card = {"name": str(war.get("name") or "Trade War")[:40], "rank": int(_num(me.get("rank")) or 0), "of": len(rows),
            "pnlPct": round(_num(me.get("pnlPct")) or 0.0, 2), "pnl": round(_num(me.get("pnl")) or 0.0, 2),
            "start": _num(me.get("start")), "final": _num(me.get("final")), "trades": int(_num(me.get("trades")) or 0),
            "modes": sorted(k for k, v in modes.items() if v)[:6]}
    if _num(war.get("endedAt")):
        card["endedAt"] = int(war["endedAt"])
    return card
