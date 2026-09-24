#!/usr/bin/env python3
"""
Zelos — Buffer auto-post content.

Pure text-composition logic for the two kinds of post the daily Buffer job
can send (see docs/buffer-automation.md for the full runbook of what calls
this and when). Like check_alert_outcomes.py, this file deliberately does
NOT talk to Firestore, Robinhood, or Buffer itself — it only turns already-
fetched data into the exact string that gets POSTed to the update_alert_outcomes
Cloud Function's sibling, post_to_buffer. Keeping it pure means the wording
can be unit-tested and iterated on without touching any live account.

TWO POST TYPES, ONE RULE FOR WHICH ONE FIRES:
  1. win_announcement_text(alert) — "this specific published alert just ran
     all the way to its second target." Only ever called for an alert whose
     outcome.target2Hit is True (the highest bar available in the schema —
     see the TARGET2 / "RUNNER" TRACKING note in check_alert_outcomes.py for
     exactly what that means and doesn't mean). This is the ONLY trigger for
     this post type — never target1 alone, never an open or expired alert.
  2. market_recap_text(snapshot) — a plain, generic market summary for a day
     with no fresh target2 win to announce, so the Buffer queue (and the
     traffic it drives back to the site) doesn't go quiet on ordinary days.
     Takes real index/price data the caller already fetched (e.g. via the
     Robinhood MCP tools) — this function only formats it, never invents a
     number.

COMPLIANCE, ON PURPOSE: every post produced here carries the same "not
investment advice" posture as the rest of the site (see terms.html and
llms.txt) — a past result is stated as a past result, never as a promise,
and every win post links back to the alert's own page so the claim is
checkable, not just asserted. This is not optional flavor text; it is the
whole reason a specific wording function exists here instead of the calling
agent free-styling a tweet each day.
"""

STRATEGY_LABELS = {
    "swing-trader": "Swing Trader",
    "breakout-rider": "Breakout Rider",
    "options-scanner": "Options Scanner",
}

SITE_URL = "https://agentictrading.info"


def _pct_move(entry, exit_price, direction):
    if not entry:
        return None
    is_long = direction in ("long", "long-call")
    change = (exit_price - entry) if is_long else (entry - exit_price)
    return (change / entry) * 100.0


def win_announcement_text(alert):
    """alert is a dict shaped like docs/data-model.md's alerts/{alertId},
    with its outcome already showing target2Hit=True. Raises ValueError if
    that precondition isn't met, since posting on anything less than a
    resolved target2 hit is exactly the mistake this module exists to
    prevent — see the module docstring's COMPLIANCE note.

    Returns the ready-to-post text (Buffer handles per-network length/format
    quirks on its own side; this is written to comfortably fit a tweet-length
    post with room to spare).
    """
    outcome = alert.get("outcome") or {}
    if outcome.get("target2Hit") is not True:
        raise ValueError(
            "win_announcement_text called on an alert whose outcome.target2Hit "
            "is not True — refusing to post an unearned win claim."
        )

    ticker = alert.get("ticker", "").upper()
    strategy_label = STRATEGY_LABELS.get(alert.get("strategy"), "Zelos")
    entry = alert.get("entry")
    target2 = alert.get("target2")
    pct = _pct_move(entry, target2, alert.get("direction")) if target2 is not None else None
    move_str = " (+%.1f%%)" % pct if pct is not None else ""
    alert_id = alert.get("id") or alert.get("alertId") or ""
    link = "%s/alert.html?id=%s" % (SITE_URL, alert_id) if alert_id else "%s/alert-history.html" % SITE_URL

    return (
        "${ticker} ran all the way to its second target{move}. "
        "Published by {strategy}, rule-based, full reasoning on the page — "
        "no cherry-picking after the fact.\n\n"
        "{link}\n\n"
        "Not investment advice. Past results don't guarantee future ones."
    ).format(ticker=ticker, move=move_str, strategy=strategy_label, link=link)


def market_recap_text(snapshot):
    """snapshot: a dict the caller already built from real market data, e.g.:
      {
        "date": "2026-09-24",
        "indices": [{"label": "S&P 500", "changePct": 0.42},
                     {"label": "Nasdaq", "changePct": -0.18}],
        "note": "Optional one-line context, e.g. a scheduled Fed event.",
      }
    `indices` and `date` are required; a snapshot with fewer than 1 index
    raises ValueError rather than posting an empty-looking recap. `note` is
    optional free text the caller composed from real news (e.g. an
    equity-news headline) — this function never invents market commentary,
    only formats what it's given.
    """
    indices = snapshot.get("indices") or []
    if not indices:
        raise ValueError("market_recap_text needs at least one index in snapshot['indices']")

    lines = []
    for idx in indices:
        pct = idx.get("changePct")
        if pct is None:
            continue
        arrow = "+" if pct >= 0 else ""
        lines.append("%s %s%.2f%%" % (idx.get("label", "?"), arrow, pct))
    index_line = " · ".join(lines)

    note = snapshot.get("note", "").strip()
    note_line = ("\n\n" + note) if note else ""

    return (
        "Market check — {date}\n{index_line}{note_line}\n\n"
        "Zelos scans for swing setups every session — see what's live: {link}\n\n"
        "Not investment advice."
    ).format(date=snapshot.get("date", ""), index_line=index_line, note_line=note_line, link=SITE_URL)


if __name__ == "__main__":
    import json
    import sys

    # CLI mode, mirroring check_alert_outcomes.py:
    #   echo '{"kind": "win", "alert": {...}}' | python3 buffer_post_content.py
    #   echo '{"kind": "recap", "snapshot": {...}}' | python3 buffer_post_content.py
    payload = json.load(sys.stdin)
    if payload.get("kind") == "win":
        text = win_announcement_text(payload["alert"])
    elif payload.get("kind") == "recap":
        text = market_recap_text(payload["snapshot"])
    else:
        raise SystemExit("payload must have \"kind\": \"win\" or \"recap\"")
    json.dump({"text": text}, sys.stdout)
    sys.stdout.write("\n")
