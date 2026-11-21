"""3-Leg Options scanner, run by the server every market day (owner 2026-11-19: "we need to build a
three-leg option scanner"). Until now 3-Leg alerts only came from a skill posting to publish_alert,
which nobody ran, so pass holders got nothing.

One idea a day: a BULL CALL BUTTERFLY on a stock whose own chart sets up a move up.

  - The setup comes from the tested stock rules: today's Swing Trader or Breakout Rider headline
    first (linked), then any stock that passes the Swing Trader pullback or Breakout Rider rule.
  - Only big, busy stocks ($15+, 1M+ shares a day), as for the Options Scanner: there's no option
    chain data, so this stands in for open interest and spreads.
  - The butterfly: buy 1 call at the money, sell 2 calls halfway to the setup's first target, buy 1
    call the same distance above. Expiration 10-40 days out, closest to 21.
  - Max loss is what you pay; max profit is the gap between strikes, times 100, minus the cost.
    It needs at least 2:1 max profit to max loss.

Why this design (replayed on 2025-01 to 2026-09 daily history, about 50 stocks, held to
expiration, priced with the practice account's model): bull call butterflies built this way
averaged +15% of the money at risk with a 31% win rate (most lose the small cost, a few pay
several times it). Bear put butterflies (-60%) and jade lizards (+1% for a lot of downside risk)
did not hold up, so the scanner doesn't publish them. Small sample, model prices, no fees:
nothing here is a promise (docs/SERVER_SCANNERS.md).

Prices are ESTIMATES from the stock's own recent swings (functions/options.py), as everywhere on
Zelos. Results are judged at expiration from the stock's close (outcomes.three_leg_outcome).
"""
import options as OPT
import options_scan as OSC
import scanner as SC
import three_leg as TL

STRATEGY = "three-leg"
DTE_LO, DTE_HI, DTE_AIM = 10, 40, 21
CENTER = 0.5          # the short strikes sit halfway from the price to the setup's first target
MIN_PAYOFF = 2.0      # max profit at least twice the max loss
ESTIMATE_NOTE = OSC.ESTIMATE_NOTE
SIZE_NOTE = ("A general rule of thumb: risk no more than 1–2% of your own account on any single idea. A butterfly's "
             "most you can lose is what you pay for it, so size it by that cost. The same guideline for every "
             "subscriber, not a figure calculated from anyone's balance.")
RISK_NOTE = ("Rule-based scan only, not personalized advice. A butterfly pays most if the stock finishes near the "
             "middle strike at expiration, and most of them lose the cost. Option prices are estimates. Nothing "
             "here is a guarantee of future results.")


def _strike_near(S, x):
    return min(OPT.strikes(S, 61), key=lambda k: abs(k - x))


def butterfly(sym, S, target1, closes, today):
    """The bull call butterfly for a setup (normalized like a published 3-Leg alert), or None."""
    exps = [e for e in OPT.expirations(today) if DTE_LO <= OPT.days_to(e, today) <= DTE_HI]
    if not exps or target1 <= S:
        return None
    exp = min(exps, key=lambda e: abs(OPT.days_to(e, today) - DTE_AIM))
    vol = OPT.hist_vol(closes)
    k1 = _strike_near(S, S)
    k2 = _strike_near(S, S + CENTER * (target1 - S))
    if k2 <= k1:
        k2 = k1 + OPT.strike_step(S)
    k3 = 2 * k2 - k1

    def leg(side, k, q):
        return {"type": "call", "side": side, "strike": k, "qty": q, "price": OPT.quote("call", S, k, exp, today, vol)["mid"]}

    try:
        trade = TL.normalize({"ticker": sym, "kind": "bull-butterfly", "expiration": exp, "entry": S,
                              "legs": [leg("buy", k1, 1), leg("sell", k2, 2), leg("buy", k3, 1)]})
    except ValueError:
        return None
    if not trade["maxLoss"] or trade["netCost"] <= 0 or (trade["maxProfit"] or 0) < MIN_PAYOFF * trade["maxLoss"]:
        return None
    trade["vol"] = round(vol, 3)
    trade["dte"] = OPT.days_to(exp, today)
    return trade


def scan_three_leg(bars, spy, qqq, today, linked=()):
    """Today's 3-Leg alert: one bull call butterfly, or "no-qualifying-setup". linked: today's
    qualified Swing Trader / Breakout Rider alerts (tried first)."""
    mood, line = SC.regime(spy, qqq)
    spy_c, qqq_c = SC._cols(spy)[3], SC._cols(qqq)[3]
    found, rejected, seen = [], [], set()
    linked_syms = {a.get("ticker") for a in linked}
    for sym in sorted(bars):
        if sym in SC.NOT_STOCKS or sym in seen:
            continue
        seen.add(sym)
        rows = bars[sym]
        try:
            _, _, _, c, v = SC._cols(rows)
            why = OSC._base_ok(c, v)
            if why:
                rejected.append({"ticker": sym, "reason": why})
                continue
            idea, label, why = None, "", ""
            for one, name in ((SC._breakout_one, "breakout"), (SC._swing_one, "pullback in an uptrend")):
                idea, why = one(sym, rows, spy_c, qqq_c, mood)
                # only the classic pullback (kind A): the looser daily Swing Trader kinds didn't hold up as
                # butterflies (replayed 2026-11-19: -8% of the cost)
                if idea and name.startswith("pullback") and idea.get("tier") != "A":
                    idea, why = None, "not a classic pullback (Swing Trader's A kind)"
                if idea:
                    label = name
                    break
            if not idea:
                rejected.append({"ticker": sym, "reason": why})
                continue
            # the butterfly aims halfway to a 2:1 target on a 1.5-day-range stop (what it was tested on)
            _, h, l, _, _ = SC._cols(rows)
            aim = c[-1] + 3.0 * SC.atr(h, l, c) if label.startswith("pullback") else idea["target1"]
            trade = butterfly(sym, c[-1], aim, c, today)
            if not trade:
                rejected.append({"ticker": sym, "reason": "no butterfly with 2:1 payoff"})
                continue
        except (ZeroDivisionError, IndexError, ValueError, TypeError, KeyError) as e:
            rejected.append({"ticker": sym, "reason": "skipped (%s)" % type(e).__name__})
            continue
        found.append((sym in linked_syms, idea["score"], sym, idea, label, trade))
    stats = {"scanned": len(seen), "passedFilters": len(found), "rejected": rejected[:12],
             "qualified": [{"ticker": f[2], "score": f[1], "setup": f[4]} for f in found]}
    if not found:
        return {"strategy": STRATEGY, "status": "no-qualifying-setup", "marketRegime": line,
                "reasoning": "No qualifying setup today. No stock passed the Swing Trader or Breakout Rider rules with a "
                             "butterfly paying at least 2:1. The scan waits for a clean setup instead of forcing one.",
                "scanStats": stats}
    # today's linked headline first, then the strongest setup
    found.sort(key=lambda f: (not f[0], -f[1], f[2]))
    _, score, sym, idea, label, trade = found[0]
    k1, k2, k3 = (l["strike"] for l in trade["legs"])
    ratio = trade["maxProfit"] / trade["maxLoss"]
    reasoning = (
        "%s The idea: a bull call butterfly that pays most if %s closes near $%s on %s. Buy the $%s call, sell two $%s "
        "calls, buy the $%s call. Estimated cost $%s per set (the most you can lose); most you can make $%s (%.1f times "
        "the cost) if it finishes at $%s. Breakevens $%s."
        % (idea["reasoning"].split(" The plan:")[0], sym, _n(k2), trade["expiration"], _n(k1), _n(k2), _n(k3),
           _m(trade["netCost"]), _m(trade["maxProfit"]), ratio, _n(k2), " and $".join(_n(b) for b in trade["breakevens"])))
    return dict(trade, strategy=STRATEGY, status="qualified", ticker=sym, direction="long",
                setupLabel="Butterfly toward $%s (%s)" % (_n(k2), label), score=score, scoreMax=SC.SCORE_MAX,
                rewardRiskRatio="%.1f : 1" % ratio, reasoning=reasoning, asOf=idea["asOf"], marketRegime=line,
                estimateNote=ESTIMATE_NOTE, suggestedSizeNote=SIZE_NOTE, riskNotes=RISK_NOTE, scanStats=stats,
                technicals=dict(idea.get("technicals") or {}, **{"Volatility (20-day)": "%.0f%%" % (trade["vol"] * 100),
                                                                   "Days to expiration": trade["dte"]}))


def _n(x):
    return ("%.2f" % x).rstrip("0").rstrip(".")


def _m(x):
    return format(round(x, 2), ",.2f")
