"""Options Scanner, run by the server (owner 2026-10-22: the paid scanners must run without anyone
running Claude). The rules follow the Zelos Options Scanner skill: one long call or long put idea
a day, on a stock whose own chart sets it up, with a 30-60 day, delta ~0.65 contract.

What's different from the skill, and why:
  - There is no options data on any plan we have, so the contract's price is the same ESTIMATE
    the practice account uses (functions/options.py: Black-Scholes on the stock's own recent
    swings). Alerts say "estimated" wherever a premium is shown, and the practice account fills
    at exactly that estimate. There is no open interest or bid/ask check; instead only big,
    heavily traded stocks qualify (price $15+, 1M+ shares a day), which all have busy chains.
  - "IV context" becomes "volatility context": how wild the stock's last month was compared
    with its own past year (a high reading means options are likely expensive).

Candidates, in the skill's order:
  1. Linked: today's Swing Trader or Breakout Rider headline, as a long call (their levels).
  2. Calls: the Swing Trader pullback rule (tested, docs/SERVER_SCANNERS.md).
  3. Puts: its mirror: a stock in a downtrend, lagging the market, in a falling market, that
     bounced up to its 20-day average today and closed back under it.
Results are judged on the stock's move (outcomes.py), as the skill's track record always was.
"""
import options as OPT
import scanner as SC

STRATEGY = "options-scanner"
MIN_PRICE = 15
MIN_VOLUME = 1_000_000
DTE_LO, DTE_HI, DTE_AIM = 30, 60, 45
DELTA_AIM = 0.65
PUT_STOP_ATR = 1.5
PUT_TARGET_R = 2.0
SIZE_NOTE = ("A general rule of thumb: risk no more than 1–2% of your own account in total premium paid on any single "
             "idea. Because this is a long call or put, never a short or multi-leg position, the most you can lose is "
             "the premium you pay — there's no additional stop order or margin exposure to manage on top of that. This "
             "is the same guideline for every subscriber, not a figure calculated from anyone's balance.")
ESTIMATE_NOTE = ("Option prices on Zelos are estimates from the stock's own recent price swings (there is no live "
                 "options feed); a real broker's price will differ.")


# ------------------------------------------------------------------ the contract
def pick_contract(sym, kind, S, closes, today):
    """The contract the rule points at: an expiration 30-60 days out (closest to 45) and the strike
    whose estimated delta is closest to 0.65 (calls) or -0.65 (puts). Prices are estimates."""
    exps = [e for e in OPT.expirations(today) if DTE_LO <= OPT.days_to(e, today) <= DTE_HI]
    if not exps:
        return None
    exp = min(exps, key=lambda e: abs(OPT.days_to(e, today) - DTE_AIM))
    vol = OPT.hist_vol(closes)
    best = None
    for k in OPT.strikes(S):
        q = OPT.quote(kind, S, k, exp, today, vol)
        gap = abs(abs(q["delta"]) - DELTA_AIM)
        if best is None or gap < best[0]:
            best = (gap, k, q)
    _, strike, q = best
    c = {"u": sym, "exp": exp, "kind": kind, "strike": strike}
    return {"id": OPT.contract_id(sym, kind, strike, exp), "label": OPT.label(c), "kind": kind, "exp": exp,
            "strike": strike, "dte": q["dte"], "delta": round(q["delta"], 2), "estMid": q["mid"],
            "estCost": round(q["mid"] * 100, 2), "vol": round(vol, 3)}


def vol_context(closes):
    """(percentile 0-100, sentence): this month's swings against the stock's past year."""
    now = OPT.hist_vol(closes)
    past = [OPT.hist_vol(closes[:i]) for i in range(max(25, len(closes) - 252), len(closes), 5)]
    if len(past) < 10:
        return 50, "not enough history to compare"
    pct = round(100 * sum(1 for x in past if x < now) / len(past))
    word = "elevated — options likely cost more than usual" if pct > 70 else "low — options likely cheaper than usual" if pct < 30 else "normal"
    return pct, "Price swings are at the %d%s percentile of the past year: %s." % (pct, _th(pct), word)


def _th(n):
    return "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


# ------------------------------------------------------------------ candidates
def _base_ok(c, v):
    if c[-1] < MIN_PRICE:
        return "price under $%d (thin option chains)" % MIN_PRICE
    if sum(v[-20:]) / 20 <= MIN_VOLUME:
        return "under 1M shares a day (thin option chains)"
    if not (-0.03 <= c[-1] / c[-2] - 1 <= 0.03):
        return "moved more than 3% today"
    return ""


def _put_one(sym, rows, spy_c, qqq_c, mood):
    d, h, l, c, v = SC._cols(rows)
    if len(c) < 210:
        return None, "not enough history"
    s20, s50, s200 = SC.sma(c, 20), SC.sma(c, 50), SC.sma(c, 200)
    if not (c[-1] < s50 < s200):
        return None, "not in a downtrend"
    if not (s20 < s50 and s20 < SC.sma(c[:-5], 20)):
        return None, "20-day average not falling under the 50-day"
    mine, bench = SC.ret(c, 20), SC.ret(spy_c, 20)
    if mine >= bench:
        return None, "not lagging SPY"
    s50m = SC.sma(spy_c, 50)
    if not (spy_c[-1] < s50m and s50m < SC.sma(spy_c[:-5], 50)):
        return None, "market not falling (SPY over a falling 50-day)"
    if not (h[-1] >= s20 * 0.99 and c[-1] < s20):
        return None, "didn't bounce to its 20-day average and fail there today"
    r = SC.rsi(c)
    if r is None or r < 35:
        return None, "RSI %.0f too low (already oversold)" % (r or 0)
    at = SC.atr(h, l, c)
    entry = c[-1]
    stop = entry + PUT_STOP_ATR * at
    target1 = entry - PUT_TARGET_R * (stop - entry)
    if target1 <= 0:
        return None, "target below zero"
    recent_low = min(l[-30:])
    target2 = recent_low if recent_low < target1 * 0.99 else target1 - (stop - entry)
    reasoning = (
        "%s is in a downtrend (under a falling 20-day, 50-day and 200-day average) and is %+.1f%% over the last month "
        "against SPY's %+.1f%%, in a falling market. Today it bounced up to its 20-day average ($%.2f) and closed back "
        "under it. RSI %.0f. The idea is wrong if it closes above $%.2f; first target $%.2f, second $%.2f."
        % (sym, mine * 100, bench * 100, s20, r, stop, target1, target2))
    return {"ticker": sym, "direction": "long-put", "setupLabel": "Failed rally", "entry": entry, "stop": stop,
            "target1": target1, "target2": target2, "reasoning": reasoning, "asOf": d[-1],
            "technicals": {"RSI": round(r), "SMA20": SC._r2(s20), "SMA50": SC._r2(s50), "SMA200": SC._r2(s200),
                           "ATR": SC._r2(at), "Month return": "%+.1f%%" % (mine * 100)}}, ""


def _call_one(sym, rows, spy_c, qqq_c, mood):
    hit, why = SC._swing_one(sym, rows, spy_c, qqq_c, mood)
    if not hit:
        return None, why
    return dict({k: hit[k] for k in ("ticker", "entry", "stop", "target1", "target2", "reasoning", "asOf", "technicals")},
                direction="long-call", setupLabel="Pullback in an uptrend"), ""


def _linked(alert):
    """Today's Swing Trader / Breakout Rider headline as a long call, with its own levels."""
    name = "Swing Trader" if alert.get("strategy") == "swing-trader" else "Breakout Rider"
    return {"ticker": alert["ticker"], "direction": "long-call", "setupLabel": alert.get("setupLabel") or "Linked setup",
            "entry": alert["entry"], "stop": alert["stop"], "target1": alert["target1"], "target2": alert.get("target2"),
            "reasoning": "Linked to today's %s alert. %s" % (name, alert.get("reasoning") or ""),
            "asOf": alert.get("asOf"), "technicals": alert.get("technicals") or {}, "linkedTo": alert.get("strategy")}


# ------------------------------------------------------------------ scoring and the alert
def _score(idea, rows, mood):
    d, h, l, c, v = SC._cols(rows)
    call = idea["direction"] == "long-call"
    risk = abs(idea["entry"] - idea["stop"])
    rr = abs(idea["target1"] - idea["entry"]) / risk if risk else 0
    s20 = SC.sma(c, 20)
    pct, _ = vol_context(c)
    with_tape = (mood == "bullish") == call if mood != "neutral" else None
    vr = (sum(v[-5:]) / 5) / (sum(v[-25:-5]) / 20) if sum(v[-25:-5]) else 1.0
    pts = {
        "trend": 10 if (c[-1] > (SC.sma(c, 200) or SC.sma(c, 50))) == call else 6,  # (a linked idea may have <200 days)
        "regime": 10 if with_tape else 6 if with_tape is None else 3,
        "supportResistance": 10 if abs((l[-1] if call else h[-1]) / s20 - 1) <= 0.005 else 8,
        "setup": 9 if idea.get("linkedTo") else 8,
        "volume": 10 if vr < 0.8 else 8 if vr < 1.0 else 6,
        "rewardRisk": SC._rr_points(rr),
        "liquidity": SC._liq_points(c, v),
        "volatility": 10 if pct < 50 else 8 if pct <= 70 else 5,
    }
    return pts, rr, pct, with_tape


def scan_options(bars, spy, qqq, today, linked=()):
    """One long call or put idea for today (or "no-qualifying-setup"). linked: today's qualified
    Swing Trader / Breakout Rider alerts, tried first as calls."""
    mood, line = SC.regime(spy, qqq)
    spy_c, qqq_c = SC._cols(spy)[3], SC._cols(qqq)[3]
    found, rejected, scanned = [], [], 0
    seen = set()
    candidates = [(a["ticker"], lambda a=a: (_linked(a), "")) for a in linked if a.get("ticker") in bars]
    for sym in sorted(bars):
        if sym in SC.NOT_STOCKS:
            continue
        candidates.append((sym, lambda sym=sym: _call_one(sym, bars[sym], spy_c, qqq_c, mood)))
        candidates.append((sym, lambda sym=sym: _put_one(sym, bars[sym], spy_c, qqq_c, mood)))
    for sym, make in candidates:
        if sym not in seen:
            seen.add(sym)
            scanned += 1
        try:
            _, _, _, c, v = SC._cols(bars[sym])
            why = _base_ok(c, v)
            idea, why2 = (None, why) if why else make()
        except (ZeroDivisionError, IndexError, ValueError, TypeError, KeyError) as e:
            idea, why2 = None, "skipped (%s)" % type(e).__name__
        if not idea:
            rejected.append({"ticker": sym, "reason": why2})
            continue
        pts, rr, pct, with_tape = _score(idea, bars[sym], mood)
        if rr < SC.MIN_RR - 0.02:  # (a linked alert's levels are rounded to cents)
            rejected.append({"ticker": sym, "reason": "reward to risk %.1f:1 (needs 2:1)" % rr})
            continue
        bar = SC.PASS_SCORE_BEARISH if with_tape is False else SC.PASS_SCORE  # fighting the tape: a higher bar
        found.append((idea, pts, rr, pct, bar))
    # one reason per stock in the stats (the last one tried)
    reasons = {}
    for r in rejected:
        reasons[r["ticker"]] = r["reason"]
    stats = {"scanned": scanned, "passedFilters": len(found),
             "rejected": [{"ticker": k, "reason": v} for k, v in sorted(reasons.items())][:12],
             "qualified": [{"ticker": i["ticker"], "score": sum(p.values()), "setup": i["setupLabel"]} for i, p, *_ in found]}
    ok = [f for f in found if sum(f[1].values()) >= f[4]]
    ok.sort(key=lambda f: (0 if f[0].get("linkedTo") else 1, -sum(f[1].values()), f[0]["ticker"]))
    if not ok:
        best = max(found, key=lambda f: sum(f[1].values()), default=None)
        note = ("Best candidate %s scored only %d/%d (need %d+)." % (best[0]["ticker"], sum(best[1].values()), SC.SCORE_MAX, best[4])
                if best else "No stock passed every check.")
        return {"strategy": STRATEGY, "status": "no-qualifying-setup", "marketRegime": line,
                "reasoning": "No qualifying options idea today. " + note + " Most days find nothing, and that is the point.",
                "scanStats": stats}
    idea, pts, rr, pct, _ = ok[0]
    sym = idea["ticker"]
    closes = SC._cols(bars[sym])[3]
    kind = "call" if idea["direction"] == "long-call" else "put"
    contract = pick_contract(sym, kind, closes[-1], closes, today)
    if not contract:
        return {"strategy": STRATEGY, "status": "no-qualifying-setup", "marketRegime": line,
                "reasoning": "No expiration 30–60 days out today.", "scanStats": stats}
    _, vol_line = vol_context(closes)
    entry, stop, t1, t2 = (SC._r2(idea[k]) if idea.get(k) is not None else None for k in ("entry", "stop", "target1", "target2"))
    tech = dict(idea.get("technicals") or {}, **{"Volatility percentile": pct, "Contract delta (est.)": contract["delta"]})
    return {
        "strategy": STRATEGY, "status": "qualified", "ticker": sym, "direction": idea["direction"],
        "setupLabel": idea["setupLabel"], "score": sum(pts.values()), "scoreMax": SC.SCORE_MAX, "scoreParts": pts,
        "marketRegime": line, "entry": entry, "stop": stop, "target1": t1, "target2": t2,
        "riskPerShare": SC._r2(stop - entry) if kind == "call" else SC._r2(entry - stop),
        "rewardPerShare": SC._r2(t1 - entry) if kind == "call" else SC._r2(entry - t1),
        "rewardRiskRatio": "%.1f : 1" % rr,
        "optionsRule": "Long %s · %d–%d days to expiration · delta about %.2f" % (kind, DTE_LO, DTE_HI, DELTA_AIM if kind == "call" else -DELTA_AIM),
        "contract": contract,
        "reasoning": "%s The rule points at the %s (about %d days, delta %.2f), estimated at $%.2f a share ($%.0f a contract). %s"
                     % (idea["reasoning"], contract["label"], contract["dte"], contract["delta"], contract["estMid"], contract["estCost"], vol_line),
        "technicals": tech, "asOf": idea.get("asOf"), "linkedTo": idea.get("linkedTo"),
        "suggestedSizeNote": SIZE_NOTE, "riskNotes": SC.RISK_NOTE + " " + ESTIMATE_NOTE, "scanStats": stats,
    }
