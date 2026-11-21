"""Morning alerts (owner 2026-11-19: "I'd want it in the beginning of the day ... like around 10"):
the scanners find the setup on the finished daily bars, and at about 10:00 New York time the plan
is moved to the live price before the alert goes out.

  - stock plans (Swing Trader, Breakout Rider, Momentum Trader) and the Options Scanner's stock
    levels: entry = the live price; the stop and targets keep the same distance from it
  - the Options Scanner's contract is picked again at the live price
  - a 3-Leg butterfly is built again at the live price, aimed the same distance up
  - if the price has already gone through the stop or the first target, the setup is gone:
    None, and the morning job tries the next stock

Pure functions (no Firestore): unit-tested in scripts/live_plan_test.py.
"""
import options_scan as OSC
import scanner as SC
import three_leg_scan as TLS

PLAN_SPLITS = (" The plan", " The idea is wrong if", " The idea: a bull call butterfly")


def _base(reasoning):
    out = reasoning or ""
    for cut in PLAN_SPLITS:
        out = out.split(cut)[0]
    return out


def live_price(q, today):
    """The usable live price from a markets/quotes entry, or None (stale, not today's, missing)."""
    if not isinstance(q, dict) or q.get("stale") or not q.get("c"):
        return None
    t = q.get("t")
    if t:
        from datetime import datetime
        from zoneinfo import ZoneInfo
        if datetime.fromtimestamp(t, ZoneInfo("America/New_York")).strftime("%Y-%m-%d") != today:
            return None
    return float(q["c"])


def adjust(alert, price, closes, today):
    """The alert re-planned at the live price, or None if the setup is gone."""
    if alert.get("status") != "qualified" or not price:
        return alert
    if alert.get("strategy") == TLS.STRATEGY:
        return _adjust_three_leg(alert, price, closes, today)
    entry, stop, t1 = alert.get("entry"), alert.get("stop"), alert.get("target1")
    if entry is None or stop is None or t1 is None:
        return alert
    up = t1 > entry
    if (up and not stop < price < t1) or (not up and not t1 < price < stop):
        return None
    d = price - entry
    out = dict(alert, entry=SC._r2(price), stop=SC._r2(stop + d), target1=SC._r2(t1 + d), plannedAt="10:00",
               signalClose=SC._r2(entry))
    if alert.get("target2") is not None:
        out["target2"] = SC._r2(alert["target2"] + d)
    out["riskPerShare"] = SC._r2(-abs(out["entry"] - out["stop"]))  # negative, as the scanners write it
    out["rewardPerShare"] = SC._r2(abs(out["target1"] - out["entry"]))
    plan = ("Priced at about 10:00 am New York time: enter near $%.2f (yesterday's close $%.2f), stop $%.2f, first target "
            "$%.2f%s." % (out["entry"], entry, out["stop"], out["target1"],
                          (", second $%.2f" % out["target2"]) if out.get("target2") is not None else ""))
    if out.get("holdDays"):
        plan += " Up to %d market days." % out["holdDays"]
    if alert.get("contract"):
        kind = alert["contract"]["kind"]
        c = OSC.pick_contract(alert["ticker"], kind, price, closes, today)
        if not c:
            return None
        out["contract"] = c
        plan += (" The rule points at the %s (about %d days, delta %.2f), estimated at $%.2f a share ($%.0f a contract)."
                 % (c["label"], c["dte"], c["delta"], c["estMid"], c["estCost"]))
    out["reasoning"] = (_base(alert.get("reasoning")) + " " + plan).strip()
    return out


def _adjust_three_leg(alert, price, closes, today):
    k1, k2, _ = (l["strike"] for l in alert["legs"])
    aim = price + 2 * max(k2 - k1, 0.01)  # the same distance up as the setup's butterfly
    trade = TLS.butterfly(alert["ticker"], price, aim, closes, today)
    if not trade:
        return None
    a, b, c = (l["strike"] for l in trade["legs"])
    ratio = trade["maxProfit"] / trade["maxLoss"]
    plan = ("Priced at about 10:00 am New York time (stock $%.2f): buy the $%s call, sell two $%s calls, buy the $%s call, "
            "expiring %s. Estimated cost $%s per set (the most you can lose); most you can make $%s (%.1f times the cost) "
            "if it finishes at $%s. Breakevens $%s."
            % (price, TLS._n(a), TLS._n(b), TLS._n(c), trade["expiration"], TLS._m(trade["netCost"]),
               TLS._m(trade["maxProfit"]), ratio, TLS._n(b), " and $".join(TLS._n(x) for x in trade["breakevens"])))
    return dict(alert, **trade, rewardRiskRatio="%.1f : 1" % ratio, plannedAt="10:00", signalClose=alert.get("entry"),
                setupLabel="Butterfly toward $%s" % TLS._n(b) + (" (" + alert["setupLabel"].split(" (", 1)[1]
                                                                   if " (" in alert.get("setupLabel", "") else ""),
                reasoning=(_base(alert.get("reasoning")) + " " + plan).strip())
