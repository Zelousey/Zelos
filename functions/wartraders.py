"""The trading desk (owner 2026-11-02: "make the trading post features available when you upgrade
the trading headquarters to a certain level"). Pure rules here (unit tests: scripts/wartraders_test.py);
main.py runs them (war_lobby baseHire / baseTrader, and every 5 minutes in the minute job).

The Trading Headquarters unlocks traders at level 3 (1 at level 3, 2 at level 4, 3 at level 5). A
trader works one territory you hold in one War, with a strategy you pick and a budget per trade,
and trades that territory's companies with your War balance. It only buys while you hold the
territory (the same check as your own buys, warmarket.check_buy) and only sells what it bought,
so its trades count in that War's own score like yours. Every number is in this file.

    warBases/{uid}.traders [{id, strategy, warId, terr, budget, on, pos {sym: {qty, cost}}, log [...]}]
"""
from warmarket import BY_SYM, COMPANIES, WarError

UNLOCK_HQ = 3
COUNT = [0, 0, 1, 2, 3]          # traders at each Headquarters level
HIRE_GOLD = 800
BUDGETS = (1000, 2500, 5000, 10000)
EVERY_MIN = 5                    # how often traders look at the market
LOG_KEPT = 8

STRATEGIES = {
    "dip": {"name": "Dip buyer", "about": "Buys a company 2% or more below its price a day ago; sells at +1.5% or a -3% stop.",
            "buy_below": -2.0, "take": 1.5, "stop": -3.0},
    "momentum": {"name": "Momentum", "about": "Buys a company up 2% or more on the day; sells at +3% or a -2% stop.",
                 "buy_above": 2.0, "take": 3.0, "stop": -2.0},
}


def slots(hq_level):
    return COUNT[max(1, min(hq_level, len(COUNT))) - 1]


def validate(data):
    """{strategy, warId, terr, budget} from the app -> clean values, or WarError."""
    strategy, terr, budget, wid = data.get("strategy"), data.get("terr"), data.get("budget"), data.get("warId")
    if strategy not in STRATEGIES:
        raise WarError("INVALID_ARGUMENT", "Pick a strategy.")
    if terr not in {c[2] for c in COMPANIES}:
        raise WarError("INVALID_ARGUMENT", "Pick a territory.")
    if budget not in BUDGETS:
        raise WarError("INVALID_ARGUMENT", "Pick a budget per trade.")
    if not (isinstance(wid, str) and 6 <= len(wid) <= 40 and wid.isalnum()):
        raise WarError("INVALID_ARGUMENT", "Pick a War.")
    return strategy, wid, terr, budget


def hire(base, hq_level, strategy, wid, terr, budget, now_ms):
    """A new trader on the desk: costs HIRE_GOLD; the caller checks you hold terr in wid."""
    traders = list(base.get("traders") or [])
    if hq_level < UNLOCK_HQ:
        raise WarError("FAILED_PRECONDITION", "The trading desk opens at Headquarters level %d." % UNLOCK_HQ)
    if len(traders) >= slots(hq_level):
        raise WarError("FAILED_PRECONDITION", "Your desk is full. Upgrade your Headquarters for another trader.")
    if base["gold"] < HIRE_GOLD:
        raise WarError("FAILED_PRECONDITION", "Hiring a trader costs %d gold; you have %d." % (HIRE_GOLD, int(base["gold"])), {"reason": "base-gold"})
    seq = base.get("seq", 1) + 1
    traders.append({"id": "t%d" % seq, "strategy": strategy, "warId": wid, "terr": terr, "budget": budget, "on": True,
                    "pos": {}, "log": [], "hiredAt": now_ms})
    out = dict(base, traders=traders, seq=seq, gold=base["gold"] - HIRE_GOLD, updatedAt=now_ms)
    out["tradersOn"] = sum(1 for x in traders if x["on"])
    return out


def change(base, tid, now_ms, on=None, strategy=None, budget=None, fire=False):
    traders = list(base.get("traders") or [])
    i = next((n for n, x in enumerate(traders) if x["id"] == tid), None)
    if i is None:
        raise WarError("NOT_FOUND", "That trader isn't on your desk.")
    if fire:
        traders.pop(i)  # its shares stay yours; you can sell them yourself
    else:
        x = dict(traders[i])
        if on is not None:
            x["on"] = bool(on)
        if strategy is not None:
            if strategy not in STRATEGIES:
                raise WarError("INVALID_ARGUMENT", "Pick a strategy.")
            x["strategy"] = strategy
        if budget is not None:
            if budget not in BUDGETS:
                raise WarError("INVALID_ARGUMENT", "Pick a budget per trade.")
            x["budget"] = budget
        traders[i] = x
    out = dict(base, traders=traders, updatedAt=now_ms)
    out["tradersOn"] = sum(1 for x in traders if x["on"])
    return out


def decide(trader, quotes, cash, holds):
    """What one trader does now: a list of (sym, side, qty, why). quotes {sym: {p, ref}}; cash is
    your War cash; holds says whether you still hold the territory (no buying without it).
    At most one buy a look, and it sells what it bought when its target or stop is reached."""
    st = STRATEGIES[trader["strategy"]]
    out = []
    for sym, p in (trader.get("pos") or {}).items():
        q = quotes.get(sym)
        if not q or not p.get("qty"):
            continue
        chg = (q["p"] * p["qty"] / p["cost"] - 1) * 100
        if chg >= st["take"]:
            out.append((sym, "sell", p["qty"], "take"))
        elif chg <= st["stop"]:
            out.append((sym, "sell", p["qty"], "stop"))
    if not holds or not trader.get("on"):
        return out
    for sym in sorted(s for s, c in BY_SYM.items() if c[2] == trader["terr"]):
        if sym in (trader.get("pos") or {}):
            continue
        q = quotes.get(sym)
        if not q or not q.get("ref"):
            continue
        day = (q["p"] / q["ref"] - 1) * 100
        signal = day <= st["buy_below"] if "buy_below" in st else day >= st["buy_above"]
        qty = int(trader["budget"] // q["p"])
        if signal and qty >= 1 and qty * q["p"] <= cash:
            out.append((sym, "buy", qty, "signal"))
            break
    return out


def record(trader, sym, side, qty, price, why, now_ms):
    """The trader after a fill: its own position and a short log line."""
    pos = {k: dict(v) for k, v in (trader.get("pos") or {}).items()}
    if side == "buy":
        p = pos.setdefault(sym, {"qty": 0, "cost": 0.0})
        p["qty"] += qty
        p["cost"] = round(p["cost"] + qty * price, 2)
    else:
        pos.pop(sym, None)
    line = {"at": now_ms, "sym": sym, "side": side, "qty": qty, "price": price, "why": why}
    return dict(trader, pos=pos, log=([line] + list(trader.get("log") or []))[:LOG_KEPT])
