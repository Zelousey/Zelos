#!/usr/bin/env python3
"""
Zelos — win/loss (paper-portfolio) outcome checker.

This is the "follow-up job that checks what actually happened" promised in
docs/data-model.md's outcome field comment, and the thing that turns
alert-history.html from a feed of predictions into a transparent, honest
track record.

WHAT THIS FILE IS, ON PURPOSE: a small, dependency-free, fully unit-testable
module containing only the DECISION LOGIC (given a trade plan and the price
bars since it was published, what happened?). It deliberately does NOT fetch
market data itself and does NOT talk to Firestore — those need Robinhood
market data and network access respectively, which belong to whatever agent
runs this on a schedule (a Claude session with the Robinhood MCP tools
connected — the same kind of environment the Swing Trader / Breakout Rider /
Options Scanner scan skills already run in), not to a static library
function. Keeping this file pure means:
  - it can be unit-tested with synthetic bars, no market data or network
    needed (see check_alert_outcomes_test.py) — important, because getting
    a win/loss call wrong is exactly the kind of bug that would silently
    make the track record look better (or worse) than it really is.
  - it can be reused as-is whether the bars came from get_equity_historicals,
    get_option_historicals, or a CSV someone pasted in for a manual check.

HOW A SCHEDULED CHECK IS MEANT TO USE THIS — see
docs/firestore-alerts-setup.md for the full runbook, but in short, once a
day, something with Robinhood MCP access and network access should:
  1. GET https://firestore.googleapis.com/v1/projects/leaderboard-agentictrading
     /databases/(default)/documents/alerts — public read, no auth needed —
     and keep every doc whose status is "qualified" and whose outcome is
     still null/"open".
  2. For each one, fetch daily bars from the session AFTER createdAt up to
     today via the Robinhood MCP tools (get_equity_historicals for
     swing-trader/breakout-rider; also get_equity_historicals for
     options-scanner, since the strike itself isn't stored — see the
     OPTIONS CAVEAT below).
  3. Call determine_outcome(...) here with that data.
  4. If the result isn't still "open", POST it to the update_alert_outcomes
     Cloud Function (functions/main.py) with the shared secret, the same
     pattern publish_alert and gumroad_ping already use.

DECISION RULES (read this before trusting a number this produces):
  - "Entry" is a reference price at scan time, not a fill — same as how
    alert.html labels it ("Entry (reference)"). The hypothetical trade is
    treated as taken at approximately that price the session after the
    alert published; bars from the alert's own session are not evaluated,
    since a real reader couldn't have acted until seeing it.
  - A long trade wins if a session's HIGH reaches target1, and loses if a
    session's LOW reaches stop. A short trade is the mirror: wins on LOW
    reaching target1, loses on HIGH reaching stop.
  - If a single session's range touches BOTH the stop and target1, the
    order they actually happened in that day isn't knowable from daily
    bars — we resolve it as "stopped-out". This is the standard
    conservative convention in this kind of backtest: it never lets an
    ambiguous day count as a win, so the published win rate can't be
    inflated by an assumption we can't verify. This is called out
    explicitly in the result's `notes` whenever it happens.
  - If neither level is reached within `max_hold_sessions` trading
    sessions (default 10 — about two calendar weeks, matching the
    "swing" horizon these strategies are built around), the alert is
    marked "expired", not left "open" forever.
  - A non-"qualified" alert (status "no-qualifying-setup" or "watching")
    never had a trade proposed, so it's "no-trade" immediately — no price
    data needed.

OPTIONS CAVEAT: the alerts schema stores an `optionsRule` describing the
*rule* used to pick a contract (e.g. "1 OTM · 30-45 DTE"), not the specific
strike/expiration actually chosen — that was a deliberate simplification
when the schema was designed, not an oversight, but it means an
options-scanner alert's outcome here is evaluated against the UNDERLYING
stock's move relative to entry/stop/target, exactly like an equity alert —
it is a reasonable proxy for "did the setup work," not the option
contract's own realized P/L (which would be smaller in dollar terms but
directionally the same once the underlying is well past the strike, and
larger percentage-wise, since a long option is leveraged and decays with
time in a way the underlying's price alone doesn't capture). Anywhere this
matters, the result's `notes` says so explicitly for options-scanner alerts,
and see docs/data-model.md if you ever want to store the actual contract at
publish time instead — that would make this precise instead of a proxy.
"""

from datetime import datetime, timezone


LONG_DIRECTIONS = {"long", "long-call"}
SHORT_DIRECTIONS = {"short", "long-put"}


def determine_outcome(direction, entry, stop, target1, target2, bars,
                       max_hold_sessions=10, strategy=None):
    """Decide what happened to one published alert.

    Args:
      direction: "long" | "short" | "long-call" | "long-put".
        long-call is treated like a long (underlying needs to rise to win);
        long-put is treated like a short (underlying needs to fall to win) —
        see the OPTIONS CAVEAT above for what that does and doesn't tell you.
      entry, stop, target1: floats, the trade-plan ledger from the alert doc.
        target2 is accepted for completeness/future use but not currently
        part of the win condition — target1 is what the published
        reward:risk ratio on the alert itself is computed against, so it's
        the correct bar for "did this hit its stated target."
      bars: list of dicts, one per trading session, in chronological order,
        starting the session AFTER the alert was published. Each needs at
        least {"date": "YYYY-MM-DD", "high": float, "low": float}. An empty
        list (e.g., not enough sessions have passed yet) is valid input and
        returns an "open" result.
      max_hold_sessions: how many bars to look at before giving up and
        calling it "expired" instead of leaving it open forever.
      strategy: optional, only used to phrase notes ("options-scanner" gets
        the underlying-proxy caveat baked into its notes automatically).

    Returns a dict matching the `outcome` shape in docs/data-model.md:
      {"result": ..., "closedAt": <ISO8601 str> | None, "exitPrice": float | None,
       "notes": "..."}
    `closedAt`/`exitPrice` are the trade-plan level (stop or target1) on the
    session it was reached, not an exact intraday fill — same "reference
    price, not a live execution" spirit as `entry`.
    """
    if direction not in LONG_DIRECTIONS and direction not in SHORT_DIRECTIONS:
        raise ValueError("unknown direction: %r" % (direction,))
    if entry is None or stop is None or target1 is None:
        # Can't evaluate a trade plan that isn't fully specified.
        return {"result": "open", "closedAt": None, "exitPrice": None,
                "notes": "Missing entry/stop/target — nothing to evaluate yet."}

    is_long = direction in LONG_DIRECTIONS
    options_note = (
        " (checked against the underlying's move, not the option contract's "
        "own price — see the options caveat in check_alert_outcomes.py)"
        if strategy == "options-scanner" else ""
    )

    sessions = bars[:max_hold_sessions]
    for i, bar in enumerate(sessions):
        high = bar.get("high")
        low = bar.get("low")
        if high is None or low is None:
            continue

        hit_target = (high >= target1) if is_long else (low <= target1)
        hit_stop = (low <= stop) if is_long else (high >= stop)

        if hit_target and hit_stop:
            # Can't tell which came first intraday from a daily bar — the
            # conservative call is the loss, so this can never inflate the
            # win rate. See DECISION RULES above.
            return {
                "result": "stopped-out",
                "closedAt": bar.get("date"),
                "exitPrice": stop,
                "notes": (
                    "Stop and target both fell inside this session's range — "
                    "can't tell which was hit first from daily data, so this "
                    "counts as stopped-out (the conservative call)."
                    + options_note
                ),
            }
        if hit_target:
            sessions_taken = i + 1
            return {
                "result": "hit-target",
                "closedAt": bar.get("date"),
                "exitPrice": target1,
                "notes": (
                    "Hit target 1 %s session%s later."
                    % (sessions_taken, "" if sessions_taken == 1 else "s")
                    + options_note
                ),
            }
        if hit_stop:
            sessions_taken = i + 1
            return {
                "result": "stopped-out",
                "closedAt": bar.get("date"),
                "exitPrice": stop,
                "notes": (
                    "Stopped out %s session%s later."
                    % (sessions_taken, "" if sessions_taken == 1 else "s")
                    + options_note
                ),
            }

    if len(bars) >= max_hold_sessions:
        return {
            "result": "expired",
            "closedAt": bars[max_hold_sessions - 1].get("date") if sessions else None,
            "exitPrice": None,
            "notes": (
                "Neither target nor stop was reached within %d trading "
                "sessions — marked expired rather than left open indefinitely."
                % max_hold_sessions
                + options_note
            ),
        }

    return {"result": "open", "closedAt": None, "exitPrice": None,
            "notes": "Still open — neither target nor stop reached yet."}


def outcome_for_alert(alert, bars, max_hold_sessions=10):
    """Convenience wrapper that reads the fields straight off an alert doc
    (as returned by Firestore) instead of positional args. `alert` is a dict
    shaped like docs/data-model.md's alerts/{alertId}.
    """
    if alert.get("status") != "qualified":
        return {"result": "no-trade", "closedAt": None, "exitPrice": None,
                "notes": "No qualifying setup was published for this alert."}
    return determine_outcome(
        direction=alert.get("direction"),
        entry=alert.get("entry"),
        stop=alert.get("stop"),
        target1=alert.get("target1"),
        target2=alert.get("target2"),
        bars=bars,
        max_hold_sessions=max_hold_sessions,
        strategy=alert.get("strategy"),
    )


if __name__ == "__main__":
    import json
    import sys

    # CLI mode for a scheduled agent to shell out to, e.g.:
    #   echo '{"alert": {...}, "bars": [...]}' | python3 check_alert_outcomes.py
    # prints the outcome dict as JSON on stdout.
    payload = json.load(sys.stdin)
    result = outcome_for_alert(
        payload["alert"], payload.get("bars", []),
        max_hold_sessions=payload.get("max_hold_sessions", 10),
    )
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
