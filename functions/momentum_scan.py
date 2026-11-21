"""Momentum Trader: the short-term call-out, one almost every market day (owner 2026-11-19: "make
another new strategy specifically for short term ... do basic advanced checks using the RSI, MACD
and stuff that we have on the charts to find good trades consistently ... like 85%").

A checklist of 13 things the charts show (the same RSI, MACD, moving averages and volume as the
chart's indicators), scored on the last finished day:

  trend        above the 50-day; 50-day over the 200-day; above the 20-day
  MACD         histogram rising; MACD over its signal line
  RSI          RSI(14) in 45-65 (room to run); RSI(14) turning up from under 55
  the day      a green day; closed in the top 40% of its range; volume at least its 20-day average
  context      SPY above its 20-day; the stock beating SPY over the last month; not stretched
               (under 5% over its 20-day, 2-day RSI under 90)

The pick is the stock that passes the most checks (at least 8). The plan: enter at the morning
price, stop one normal day's range under it, first target 1.5 times the risk, second 2.5 times,
held up to 3 market days.

Replayed on the Zelos list (2025-01-15 to 2026-09-24, entering at the next morning's open, stops
and targets on the daily highs and lows, the stop counted first if both were hit the same day): a
pick on 95% of market days, average +0.15R a trade, 55% winners (+0.13R in the first half,
+0.18R in the second). Small edge, no fees or slippage: nothing here is a promise.
"""
import scanner as SC

STRATEGY = "momentum-trader"
# Momentum Max (owner 2026-11-19: "one more that's a little more extreme ... a little higher, a little
# more risk"): the same checklist, but the MOST VOLATILE stock that passes, a tighter stop (3/4 of a
# day's range) and a 3:1 target, up to 3 days. Replayed the same way: a pick on 95% of days, average
# +0.17R (+0.20R / +0.15R by half), 44% winners: more losers, bigger winners.
STRATEGY_MAX = "momentum-max"
MAX_STOP_ATR = 0.75
MAX_TARGET_R = 3.0
MAX_TARGET2_R = 4.0
MIN_CHECKS = 8
STOP_ATR = 1.0
TARGET_R = 1.5
TARGET2_R = 2.5
HOLD_DAYS = 3
CHECK_NAMES = {
    "above50": "Above its 50-day average", "trend": "50-day over the 200-day", "above20": "Above its 20-day average",
    "macdUp": "MACD histogram rising", "macdBull": "MACD over its signal line",
    "rsiZone": "RSI(14) between 45 and 65", "rsiTurn": "RSI(14) turning up",
    "greenDay": "Closed higher than it opened", "strongClose": "Closed near the day's high",
    "volume": "Volume at least its 20-day average", "market": "SPY above its 20-day average",
    "leader": "Beating SPY over the last month", "notStretched": "Not stretched above its 20-day",
}
SIZE_NOTE = ("A general rule of thumb: risk no more than 1–2% of your own account on any single idea. Short-term trades "
             "move fast, so set the stop when you enter. The same guideline for every subscriber, not a figure "
             "calculated from anyone's balance.")


def ema(xs, n):
    k, e, out = 2 / (n + 1), xs[0], []
    for x in xs:
        e = x * k + e * (1 - k)
        out.append(e)
    return out


def macd(closes):
    """(MACD line, signal line, histogram) for 12/26/9, the chart's MACD."""
    m = [a - b for a, b in zip(ema(closes, 12), ema(closes, 26))]
    sg = ema(m, 9)
    return m, sg, [a - b for a, b in zip(m, sg)]


def rsi_n(c, n):
    g = loss = 0.0
    for i in range(len(c) - n, len(c)):
        d = c[i] - c[i - 1]
        g, loss = g + max(d, 0), loss + max(-d, 0)
    return 100.0 if loss == 0 else 100 - 100 / (1 + g / loss)


def checklist(rows, spy_c):
    """({check: passed}, numbers) for a stock's last finished day, or (None, why)."""
    d, h, l, c, v = SC._cols(rows)
    if len(c) < 210:
        return None, "not enough history"
    if c[-1] < 10:
        return None, "price under $10"
    if sum(v[-20:]) / 20 <= 500_000:
        return None, "thin volume"
    s20, s50, s200 = SC.sma(c, 20), SC.sma(c, 50), SC.sma(c, 200)
    m, sg, hist = macd(c[-150:])
    r14, r14p, r2 = SC.rsi(c), SC.rsi(c[:-1]), rsi_n(c, 2)
    rng = h[-1] - l[-1]
    vavg = sum(v[-21:-1]) / 20
    k = {
        "above50": c[-1] > s50, "trend": s50 > s200, "above20": c[-1] > s20,
        "macdUp": hist[-1] > hist[-2], "macdBull": m[-1] > sg[-1],
        "rsiZone": 45 <= r14 <= 65, "rsiTurn": r14 > r14p and r14p < 55,
        "greenDay": c[-1] > rows[-1][1], "strongClose": rng > 0 and (c[-1] - l[-1]) / rng >= 0.6,
        "volume": v[-1] >= vavg, "market": spy_c[-1] > SC.sma(spy_c, 20),
        "leader": SC.ret(c, 20) > SC.ret(spy_c, 20), "notStretched": c[-1] < s20 * 1.05 and r2 < 90,
    }
    nums = {"RSI": round(r14), "RSI(2)": round(r2), "MACD": round(m[-1], 2), "MACD signal": round(sg[-1], 2),
            "MACD histogram": round(hist[-1], 2), "SMA20": SC._r2(s20), "SMA50": SC._r2(s50), "SMA200": SC._r2(s200),
            "ATR": SC._r2(SC.atr(h, l, c)), "Volume vs month": "%.1fx" % (v[-1] / vavg if vavg else 1),
            "Month return": "%+.1f%%" % (SC.ret(c, 20) * 100)}
    return k, nums


def scan_momentum_max(bars, spy, qqq):
    return scan_momentum(bars, spy, qqq, extreme=True)


def scan_momentum(bars, spy, qqq, extreme=False):
    """Today's short-term call-out, or "no-qualifying-setup". extreme: Momentum Max."""
    strategy = STRATEGY_MAX if extreme else STRATEGY
    stop_atr, tr, tr2 = (MAX_STOP_ATR, MAX_TARGET_R, MAX_TARGET2_R) if extreme else (STOP_ATR, TARGET_R, TARGET2_R)
    mood, line = SC.regime(spy, qqq)
    spy_c = SC._cols(spy)[3]
    found, rejected, scanned = [], [], 0
    for sym in sorted(bars):
        if sym in SC.NOT_STOCKS:
            continue
        scanned += 1
        try:
            k, nums = checklist(bars[sym], spy_c)
        except (ZeroDivisionError, IndexError, ValueError, TypeError) as e:
            k, nums = None, "skipped (%s)" % type(e).__name__
        if k is None:
            rejected.append({"ticker": sym, "reason": nums})
            continue
        n = sum(k.values())
        if n < MIN_CHECKS:
            rejected.append({"ticker": sym, "reason": "%d of %d checks (needs %d)" % (n, len(k), MIN_CHECKS)})
            continue
        _, hh, ll, cc, _ = SC._cols(bars[sym])
        rank = SC.atr(hh, ll, cc) / cc[-1] if extreme else SC.ret(cc, 20)  # Max: the most volatile first
        found.append((n, rank, sym, k, nums))
    found.sort(key=lambda f: (-f[1], -f[0], f[2]) if extreme else (-f[0], -f[1], f[2]))
    stats = {"scanned": scanned, "passedFilters": len(found), "rejected": rejected[:12],
             "qualified": [{"ticker": f[2], "score": f[0], "setup": "%d of 13 checks" % f[0]} for f in found[:8]]}
    if not found:
        return {"strategy": strategy, "status": "no-qualifying-setup", "marketRegime": line,
                "reasoning": "No qualifying setup today. No stock passed %d of the 13 chart checks." % MIN_CHECKS,
                "scanStats": stats}
    n, _, sym, k, nums = found[0]
    rows = bars[sym]
    d, h, l, c, v = SC._cols(rows)
    at = SC.atr(h, l, c)
    entry = c[-1]
    stop = entry - stop_atr * at
    risk = entry - stop
    t1, t2 = entry + tr * risk, entry + tr2 * risk
    passed = [CHECK_NAMES[x] for x, ok in k.items() if ok]
    missed = [CHECK_NAMES[x] for x, ok in k.items() if not ok]
    reasoning = ("%s passed %d of the 13 chart checks: %s.%s RSI %s, MACD %s over its signal %s. The plan, for up to %d "
                 "market days: enter near $%.2f, stop $%.2f (%s), first target $%.2f (%s the "
                 "risk), second target $%.2f.%s"
                 % (sym, n, ", ".join(p.lower() for p in passed[:6]) + (" and more" if len(passed) > 6 else ""),
                    (" Missing: %s." % ", ".join(x.lower() for x in missed)) if missed else "",
                    nums["RSI"], nums["MACD"], nums["MACD signal"], HOLD_DAYS, entry, stop,
                    "three quarters of a normal day's range" if extreme else "one normal day's range", t1,
                    "3 times" if extreme else "1.5 times", t2,
                    " High risk: the most volatile stock that passed, with a tight stop. Expect more losers and bigger winners."
                    if extreme else ""))
    return {
        "strategy": strategy, "status": "qualified", "ticker": sym, "direction": "long", "highRisk": extreme,
        "setupLabel": "%d of 13 checks" % n, "score": n, "scoreMax": 13, "checks": k,
        "entry": SC._r2(entry), "stop": SC._r2(stop), "target1": SC._r2(t1), "target2": SC._r2(t2),
        "riskPerShare": SC._r2(stop - entry), "rewardPerShare": SC._r2(t1 - entry), "rewardRiskRatio": "%.1f : 1" % tr,
        "holdDays": HOLD_DAYS, "reasoning": reasoning, "asOf": d[-1], "marketRegime": line, "technicals": nums,
        "suggestedSizeNote": SIZE_NOTE, "riskNotes": SC.RISK_NOTE, "scanStats": stats,
    }
