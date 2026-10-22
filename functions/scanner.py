"""Swing Trader and Breakout Rider, run by the server (owner 2026-10-22: the paid scanners must
run without anyone running Claude).

The rules are the ones in the Zelos Swing Trader / Breakout Rider skills
(references/screening-criteria.md), written down as fixed numbers so every run is the same and
can be tested. They read the daily bars the server already stores for the Zelos stock list
(markets/history_*, Marketstack), so a scan costs no extra API calls. The stock list is the one
the practice account trades, so every alert can be traded in one tap.

Pure functions only: main.py reads the bars and publishes the result.
  regime(spy, qqq)             -> market mood
  scan_swing(bars, spy, qqq)   -> an alert dict (a setup, or "no-qualifying-setup")
  scan_breakout(bars, spy, qqq)
bars: {SYM: [[date, open, high, low, close, volume], ...]} oldest first.
"""

SCORE_MAX = 80
PASS_SCORE = 60          # the skills' preferred minimum out of 80
PASS_SCORE_BEARISH = 68  # the bar in a bearish market
MIN_RR = 2.0
# Breakout Rider's numbers were picked on 2024-25 history of the Zelos stock list and checked on the
# following year, which they weren't picked on (results: docs/SERVER_SCANNERS.md):
BREAKOUT_STOP_ATR = 0.5  # stop half a normal day's range under the old ceiling (or the breakout day's low)...
MIN_STOP_ATR = 1.0       # ...and at least one normal day's range under the entry, so ordinary noise doesn't stop it out
BREAKOUT_TARGET_R = 2.0  # first target: twice the risk (the measured move from the base is the second)
NOT_STOCKS = {"SPY", "QQQ", "IWM", "DIA", "GLD", "XLK", "XLC", "XLY", "XLV", "XLF", "XLE"}
SIZE_NOTE = ("A general rule of thumb: risk no more than 1–2% of your own account on any single idea, sized off your "
             "own stop distance (risk per share × number of shares ≈ that 1–2%). This is the same guideline for every "
             "subscriber, not a figure calculated from anyone's balance.")
RISK_NOTE = "Rule-based scan only, not personalized advice. Nothing here is a guarantee of future results."


# ------------------------------------------------------------------ indicators
def sma(xs, n):
    return sum(xs[-n:]) / n if len(xs) >= n else None


def rsi(closes, n=14):
    """Wilder's RSI of the last bar."""
    if len(closes) < n + 1:
        return None
    gains = [max(0.0, closes[i] - closes[i - 1]) for i in range(1, len(closes))]
    losses = [max(0.0, closes[i - 1] - closes[i]) for i in range(1, len(closes))]
    ag, al = sum(gains[:n]) / n, sum(losses[:n]) / n
    for g, l in zip(gains[n:], losses[n:]):
        ag, al = (ag * (n - 1) + g) / n, (al * (n - 1) + l) / n
    if al == 0:
        return 100.0
    return 100 - 100 / (1 + ag / al)


def _wilder(xs, n):
    if len(xs) < n:
        return []
    out = [sum(xs[:n])]
    for x in xs[n:]:
        out.append(out[-1] - out[-1] / n + x)
    return out


def atr(h, l, c, n=14):
    trs = [max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])) for i in range(1, len(c))]
    if len(trs) < n:
        return None
    a = sum(trs[:n]) / n
    for tr in trs[n:]:
        a = (a * (n - 1) + tr) / n
    return a


def adx(h, l, c, n=14):
    """Wilder's ADX of the last bar."""
    if len(c) < 2 * n + 1:
        return None
    tr, pdm, mdm = [], [], []
    for i in range(1, len(c)):
        up, down = h[i] - h[i - 1], l[i - 1] - l[i]
        pdm.append(up if up > down and up > 0 else 0.0)
        mdm.append(down if down > up and down > 0 else 0.0)
        tr.append(max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])))
    str_, sp, sm = _wilder(tr, n), _wilder(pdm, n), _wilder(mdm, n)
    dx = []
    for t, p, m in zip(str_, sp, sm):
        if t <= 0:
            dx.append(0.0)
            continue
        pdi, mdi = 100 * p / t, 100 * m / t
        dx.append(0.0 if pdi + mdi == 0 else 100 * abs(pdi - mdi) / (pdi + mdi))
    if len(dx) < n:
        return None
    a = sum(dx[:n]) / n
    for x in dx[n:]:
        a = (a * (n - 1) + x) / n
    return a


def pivots(xs, k=3, high=True):
    """Indexes of swing highs (or lows): above (below) the k bars on either side."""
    out = []
    for i in range(k, len(xs) - k):
        win = xs[i - k:i + k + 1]
        if (xs[i] == max(win) if high else xs[i] == min(win)) and win.count(xs[i]) == 1:
            out.append(i)
    return out


def ret(closes, n):
    return closes[-1] / closes[-1 - n] - 1 if len(closes) > n and closes[-1 - n] else 0.0


def _cols(rows):
    return ([r[0] for r in rows], [float(r[2]) for r in rows], [float(r[3]) for r in rows],
            [float(r[4]) for r in rows], [float(r[5]) for r in rows])


def _r2(x):
    return round(x + 1e-9, 2)


# ------------------------------------------------------------------ market mood
def _mood(rows):
    _, _, _, c, _ = _cols(rows)
    if len(c) < 56:
        return "neutral", "not enough data"
    s20, s50 = sma(c, 20), sma(c, 50)
    s20p, s50p = sma(c[:-5], 20), sma(c[:-5], 50)
    above20, above50 = c[-1] > s20, c[-1] > s50
    if above20 and above50 and s20 > s20p and s50 > s50p:
        return "bullish", "above both averages, both rising"
    if not above20 and not above50 and s20 < s20p and s50 < s50p:
        return "bearish", "below both averages, both falling"
    return "neutral", "%s the 20-day, %s the 50-day" % ("above" if above20 else "below", "above" if above50 else "below")


def regime(spy, qqq):
    """(mood, sentence): bullish when SPY and QQQ both are, bearish when both are, else neutral."""
    a, why_a = _mood(spy)
    b, why_b = _mood(qqq)
    mood = a if a == b else "neutral"
    return mood, "%s — SPY %s; QQQ %s." % (mood.title(), why_a, why_b)


# ------------------------------------------------------------------ shared scoring
def _rs_points(c, spy_c, qqq_c):
    mine = ret(c, 15)
    beats = int(mine > ret(spy_c, 15)) + int(mine > ret(qqq_c, 15))
    return {2: 10, 1: 7, 0: 4}[beats], mine


def _liq_points(c, v):
    dollars = (sum(v[-20:]) / 20) * c[-1]
    return 10 if dollars > 5e8 else 9 if dollars > 1e8 else 7 if dollars > 2e7 else 5


def _rr_points(rr):
    return max(0, min(10, round(rr * 2.5)))


def _regime_points(mood):
    return {"bullish": 10, "neutral": 6, "bearish": 3}[mood]


def _filters(c, v, h, l, lo_move, hi_move, rsi_lo, rsi_hi, adx_lo, adx_hi):
    """The skills' loose first net. Returns (ok, reason, rsi, adx)."""
    if len(c) < 120:
        return False, "not enough history", None, None
    if c[-1] < 10:
        return False, "price under $10", None, None
    if sum(v[-20:]) / 20 <= 500_000:
        return False, "thin volume", None, None
    move = c[-1] / c[-2] - 1
    if not (lo_move <= move <= hi_move):
        return False, "moved %+.1f%% today" % (move * 100), None, None
    r, a = rsi(c), adx(h, l, c)
    if r is None or not (rsi_lo <= r <= rsi_hi):
        return False, "RSI %.0f outside %d–%d" % (r or 0, rsi_lo, rsi_hi), r, a
    if a is None or not (adx_lo <= a <= adx_hi):
        return False, "ADX %.0f outside %d–%d" % (a or 0, adx_lo, adx_hi), r, a
    return True, "", r, a


def _alert(strategy, mood_line, scanned, passed, rejected, best, bar):
    stats = {"scanned": scanned, "passedFilters": passed, "rejected": rejected[:12],
             "qualified": [{"ticker": q["ticker"], "score": q["score"], "setup": q["setupLabel"]} for q in best]}
    top = best[0] if best else None
    if top and top["score"] >= bar:
        return dict(top, strategy=strategy, status="qualified", direction="long", scoreMax=SCORE_MAX,
                    marketRegime=mood_line, suggestedSizeNote=SIZE_NOTE, riskNotes=RISK_NOTE, scanStats=stats)
    note = ("Best candidate %s scored only %d/%d (need %d+)." % (top["ticker"], top["score"], SCORE_MAX, bar)
            if top else "No stock passed every check.")
    return {"strategy": strategy, "status": "no-qualifying-setup", "marketRegime": mood_line,
            "reasoning": "No qualifying setup today. " + note + " Most days find nothing, and that is the point: "
                         "the scan waits for a clean setup instead of forcing one.",
            "scanStats": stats}


# ------------------------------------------------------------------ Swing Trader
# A pullback in an uptrend: the stock is trending up (price over the 50-day, the 50-day over the
# 200-day, the 20-day rising over the 50-day), beating SPY over the last month, in a market that's
# rising too, and today it dipped to its 20-day average and closed back above it. This version held
# up on both years of the Zelos stock list; the first, looser one (any pullback near support) lost
# money on the second year (docs/SERVER_SCANNERS.md).
SWING_STOP_ATR = 1.5     # stop 1.5 normal days' range under the entry
SWING_TARGET_R = 2.0     # first target twice the risk; the recent high is the second


def _swing_one(sym, rows, spy_c, qqq_c, mood):
    d, h, l, c, v = _cols(rows)
    if len(c) < 210:
        return None, "not enough history"
    if c[-1] < 10:
        return None, "price under $10"
    if sum(v[-20:]) / 20 <= 500_000:
        return None, "thin volume"
    s20, s50, s200 = sma(c, 20), sma(c, 50), sma(c, 200)
    if not (c[-1] > s50 > s200):
        return None, "not in an uptrend (price, 50-day and 200-day out of order)"
    if not (s20 > s50 and s20 > sma(c[:-5], 20)):
        return None, "20-day average not rising above the 50-day"
    mine, bench = ret(c, 20), ret(spy_c, 20)
    if mine <= bench:
        return None, "lagging SPY over the last month"
    s50m = sma(spy_c, 50)
    if not (spy_c[-1] > s50m and s50m > sma(spy_c[:-5], 50)):
        return None, "market not rising (SPY under a rising 50-day)"
    if not (l[-1] <= s20 * 1.01 and c[-1] > s20):
        return None, "hasn't dipped to its 20-day average and held it today"
    r, a = rsi(c), adx(h, l, c)
    if r is None or r > 65:
        return None, "RSI %.0f too high for a pullback" % (r or 0)
    at = atr(h, l, c)
    entry = c[-1]
    stop = entry - SWING_STOP_ATR * at
    target1 = entry + SWING_TARGET_R * (entry - stop)
    recent_high = max(h[-30:])
    target2 = recent_high if recent_high > target1 * 1.01 else target1 + (entry - stop)
    rr = (target1 - entry) / (entry - stop)
    depth = 1 - c[-1] / recent_high
    v_pull = sum(v[-5:]) / 5
    vr = v_pull / (sum(v[-25:-5]) / 20) if sum(v[-25:-5]) else 1.0
    beats_qqq = mine > ret(qqq_c, 20)
    pts = {
        "trend": 10 if s50 > sma(c[:-10], 50) else 8,
        "regime": _regime_points(mood),
        "support": 10 if abs(l[-1] / s20 - 1) <= 0.005 else 8,
        "setup": 9 if 0.03 <= depth <= 0.10 else 7,
        "volume": 10 if vr < 0.8 else 8 if vr < 1.0 else 6,
        "relativeStrength": 10 if beats_qqq else 8,
        "rewardRisk": _rr_points(rr),
        "liquidity": _liq_points(c, v),
    }
    label = "Pullback in an uptrend"
    reasoning = (
        "%s is in an uptrend (above a rising 20-day, 50-day and 200-day average) and is up %+.1f%% over the last month "
        "against SPY's %+.1f%%. Today it dipped to its 20-day average ($%.2f) and closed back above it, %.1f%% under its "
        "recent high, on %s volume. RSI %.0f. The plan: enter near $%.2f, stop $%.2f (1.5 normal days' range), first "
        "target $%.2f (twice the risk), second target $%.2f."
        % (sym, mine * 100, bench * 100, s20, depth * 100, "lighter" if vr < 1 else "heavier", r, entry, stop, target1, target2))
    return {
        "ticker": sym, "score": sum(pts.values()), "scoreParts": pts, "setupLabel": label,
        "entry": _r2(entry), "stop": _r2(stop), "target1": _r2(target1), "target2": _r2(target2),
        "riskPerShare": _r2(stop - entry), "rewardPerShare": _r2(target1 - entry), "rewardRiskRatio": "%.1f : 1" % rr,
        "reasoning": reasoning, "asOf": d[-1],
        "technicals": {"RSI": round(r), "ADX": round(a or 0), "SMA20": _r2(s20), "SMA50": _r2(s50), "SMA200": _r2(s200),
                       "ATR": _r2(at), "Volume vs month": "%.1fx" % vr, "Month return": "%+.1f%%" % (mine * 100)},
    }, ""


def scan_swing(bars, spy, qqq):
    return _scan("swing-trader", _swing_one, bars, spy, qqq, strict_neutral=False)


# ------------------------------------------------------------------ Breakout Rider
def _breakout_one(sym, rows, spy_c, qqq_c, mood):
    d, h, l, c, v = _cols(rows)
    ok, why, r, a = _filters(c, v, h, l, -0.02, 0.06, 55, 75, 15, 35)
    if not ok:
        return None, why
    n = len(c)
    # the breakout: the first close above the base's ceiling, within the last 5 sessions
    for back in range(5, 0, -1):  # oldest first: the first close through the ceiling, not a later one through its own high
        b = n - back
        base = list(range(b - 40, b))
        R = max(h[i] for i in base)
        if c[b] > R and all(c[i] <= R for i in base):
            break
    else:
        return None, "no fresh close above a base"
    base_lo = min(l[i] for i in base)
    height = R - base_lo
    # a base: 2+ other highs within 1.5% of the ceiling (a ceiling, not one spike), and tight enough
    tops = [i for i in pivots(h[b - 40:b], 2, True)]
    touches = sum(1 for i in tops if h[b - 40 + i] >= R * 0.985)
    if touches < 2:
        return None, "the high at $%.2f was touched only once (a spike, not a ceiling)" % R
    if height / R > 0.25:
        return None, "base too wide (%.0f%%)" % (height / R * 100)
    # hold, not spike: no close back under the old ceiling since
    if any(c[i] <= R for i in range(b, n)):
        return None, "closed back under $%.2f (failed breakout)" % R
    if c[-1] < R * 1.003:
        return None, "barely above the level"
    # anti-chasing
    if c[-1] > R * 1.10:
        return None, "already 10%+ past the breakout (chasing)"
    # volume: quiet base, loud breakout
    avg_before = sum(v[b - 20:b]) / 20
    vb = max(v[i] for i in range(b, n)) / avg_before if avg_before else 0
    if vb < 1.3:
        return None, "breakout on light volume (%.1fx average)" % vb
    quiet = (sum(v[b - 15:b]) / 15) / (sum(v[b - 40:b - 15]) / 25) if sum(v[b - 40:b - 15]) else 1.0
    at = atr(h, l, c)
    base_atr = atr(h[:b], l[:b], c[:b]) or at
    tight = base_atr / R
    # the plan: stop just under the old ceiling or the breakout day's low, whichever is tighter
    entry = c[-1]
    stop = min(max(R - BREAKOUT_STOP_ATR * at, l[b]), entry - MIN_STOP_ATR * at)
    target1 = entry + BREAKOUT_TARGET_R * (entry - stop)
    rr = (target1 - entry) / (entry - stop)
    if rr < MIN_RR:
        return None, "reward to risk %.1f:1 (needs 2:1)" % rr
    target2 = max(R + height, target1 + 0.5 * (entry - stop))  # the measured move from the base
    rs_pts, mine = _rs_points(c, spy_c, qqq_c)
    closes_above = n - b
    pts = {
        "trendBase": 10 if tight < 0.025 else 8 if tight < 0.04 else 6,
        "regime": _regime_points(mood),
        "resistanceHold": min(10, 6 + closes_above + (1 if c[-1] > R * 1.01 else 0)),
        "setup": min(10, 6 + touches),
        "volume": min(10, round(4 + vb * 2 + (1 if quiet < 0.9 else 0))),
        "relativeStrength": rs_pts,
        "rewardRisk": _rr_points(rr),
        "liquidity": _liq_points(c, v),
    }
    label = "Breakout + hold" if closes_above >= 2 else "Flat base breakout"
    reasoning = (
        "%s spent about 8 weeks under a ceiling at $%.2f, touched %d times, in a base %.0f%% tall. It closed above it "
        "%d session%s ago on %.1fx its usual volume and has held above it since. RSI %.0f shows momentum without being "
        "stretched. Over the last 15 sessions it is %+.1f%% (SPY %+.1f%%). The plan: enter near $%.2f, stop just under "
        "the old ceiling at $%.2f, first target $%.2f (twice the risk)."
        % (sym, R, touches, height / R * 100, closes_above, "" if closes_above == 1 else "s", vb, r, mine * 100,
           ret(spy_c, 15) * 100, entry, stop, target1))
    return {
        "ticker": sym, "score": sum(pts.values()), "scoreParts": pts, "setupLabel": label,
        "entry": _r2(entry), "stop": _r2(stop), "target1": _r2(target1), "target2": _r2(target2),
        "riskPerShare": _r2(stop - entry), "rewardPerShare": _r2(target1 - entry), "rewardRiskRatio": "%.1f : 1" % rr,
        "reasoning": reasoning, "asOf": d[-1],
        "technicals": {"RSI": round(r), "ADX": round(a), "Resistance": _r2(R), "ATR": _r2(at),
                       "Breakout volume": "%.1fx" % vb, "15-day return": "%+.1f%%" % (mine * 100)},
    }, ""


def scan_breakout(bars, spy, qqq):
    # breakouts fail more in a choppy tape: a neutral market asks for a few more points too
    return _scan("breakout-rider", _breakout_one, bars, spy, qqq, strict_neutral=True)


# ------------------------------------------------------------------ running a scan
def _scan(strategy, one, bars, spy, qqq, strict_neutral):
    mood, line = regime(spy, qqq)
    spy_c, qqq_c = _cols(spy)[3], _cols(qqq)[3]
    bar = PASS_SCORE_BEARISH if mood == "bearish" else PASS_SCORE + (4 if strict_neutral and mood == "neutral" else 0)
    found, rejected, scanned, passed = [], [], 0, 0
    for sym in sorted(bars):
        if sym in NOT_STOCKS:
            continue
        scanned += 1
        try:
            hit, why = one(sym, bars[sym], spy_c, qqq_c, mood)
        except (ZeroDivisionError, IndexError, ValueError, TypeError) as e:
            hit, why = None, "skipped (%s)" % type(e).__name__
        if hit:
            passed += 1
            found.append(hit)
        else:
            rejected.append({"ticker": sym, "reason": why})
    found.sort(key=lambda x: (-x["score"], x["ticker"]))
    return _alert(strategy, line, scanned, passed, rejected, found, bar)
