"""Practice account engine (server-side). Pure functions, no Firebase: unit-tested in
scripts/practice_test.py, wired up in main.py (callables + the order pass in refresh_quotes).

Decided 2026-10-07 (PROJECT_STATE.md): the $10,000 practice account moves to the server so
balances, fills and the public leaderboard can't be edited from a browser.
  - Prices come only from the server's own market data (markets/quotes + 15-minute bars).
  - No look-ahead: a market order fills at the first price *after* it was placed (the close
    of the first bar that ends after it, or the open of a bar that starts after it); limit and
    stop orders only see bars that start after they were placed (plus closes after that).
  - Long only, whole shares, the Zelos stock list (no crypto while it's paused), US session
    9:30-16:00 ET (holidays are not modelled, same as the rest of the site).
  - Stocks/ETFs, plus long calls and puts (owner 2026-10-09) with modeled prices: see options.py.
    Option orders are market orders that fill on the underlying's next price, like stocks.

Shapes (all money in dollars, times in epoch ms, days "YYYY-MM-DD" New York):
  account   practiceAccounts/{uid}: see new_account()
  order     {id, sym, side, type, qty, limit, stop, tif, session, createdAt, bracket, oco, role, parent}
  bar       ["YYYY-MM-DD HH:MM", o, h, l, c, v]  (bar START, New York time; 15 minutes)
"""

import re
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import options as OPT

NY = ZoneInfo("America/New_York")
START_CASH = 10000.0
RESET_BELOW = 2500.0
MAX_OPEN_ORDERS = 50
MAX_POSITIONS = 60
MAX_QTY = 100000
SESSION_OPEN, SESSION_CLOSE = 9 * 60 + 30, 16 * 60
BAR_MIN = 15
PRICE_BAND = (0.2, 5.0)  # limit/stop/bracket prices must be within this multiple of the last price
SYM_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
ORDER_ID_RE = re.compile(r"^[a-z0-9]{6,32}$")

# Same as zelos-progress.js SEASONS (scripts/practice_test.py checks they match)
SEASONS = (("s1", "2026-09-27", "2026-12-31"), ("s2", "2027-01-01", "2027-03-31"))
# Same thresholds/names as zelos-levels.js LEVELS
LEVELS = ((0, 0, "Getting started"), (1, 10, "Bronze"), (2, 50, "Silver"), (3, 150, "Gold"), (4, 400, "Platinum"), (5, 1000, "Diamond"),
          (6, 2000, "Master"), (7, 3500, "Elite"), (8, 6000, "Legend"), (9, 10000, "Titan"), (10, 16000, "Zelos"))


class OrderError(Exception):
    """A request the player can fix (message is shown to them)."""


def r2(x):
    return round(float(x) + 0.0, 2)


# ------------------------------------------------------------------ time
def ny(ms):
    return datetime.fromtimestamp(ms / 1000, NY)


def ny_day(ms):
    return ny(ms).strftime("%Y-%m-%d")


def minutes(ms):
    d = ny(ms)
    return d.hour * 60 + d.minute


def is_weekday(day):
    return datetime.strptime(day, "%Y-%m-%d").weekday() < 5


def next_weekday(day):
    d = datetime.strptime(day, "%Y-%m-%d") + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def market_open(ms):
    return is_weekday(ny_day(ms)) and SESSION_OPEN <= minutes(ms) < SESSION_CLOSE


def active_session(ms):
    """The session an order placed now belongs to: today until the close, else the next weekday."""
    day = ny_day(ms)
    if is_weekday(day) and minutes(ms) < SESSION_CLOSE:
        return day
    return next_weekday(day)


def session_close_ms(day):
    d = datetime.strptime(day, "%Y-%m-%d").replace(hour=16, tzinfo=NY)
    return int(d.timestamp() * 1000)


def bar_start_ms(label):
    d = datetime.strptime(label[:16], "%Y-%m-%d %H:%M").replace(tzinfo=NY)
    return int(d.timestamp() * 1000)


def week_key(day):
    y, w, _ = datetime.strptime(day, "%Y-%m-%d").isocalendar()
    return "w%d_%02d" % (y, w)


def month_key(day):
    return "m%s_%s" % (day[:4], day[5:7])


def season_for(day):
    for sid, a, b in SEASONS:
        if a <= day <= b:
            return sid
    return None


def level_for(xp):
    out = LEVELS[0]
    for row in LEVELS:
        if (xp or 0) >= row[1]:
            out = row
    return {"level": out[0], "name": out[2]}


# ------------------------------------------------------------------ account
def new_account(now_ms, epoch=0, resets=0, reset_history=None):
    return {
        "v": 3, "cash": START_CASH, "positions": {}, "options": {}, "orders": {}, "openOrders": 0,
        "realized": 0.0, "startedAt": now_ms, "createdAt": now_ms, "updatedAt": now_ms,
        "epoch": epoch, "resets": resets, "resetHistory": reset_history or [], "peak": START_CASH,
        "stats": new_stats(), "life": {"fills": 0, "tpExits": 0, "symbols": []},
        "periods": {}, "seasonStats": {}, "hist": {}, "tradeDays": [], "publicProfile": True,
    }


def new_stats():
    return {"trades": 0, "wins": 0, "losses": 0, "sumWin": 0.0, "sumLoss": 0.0, "bySym": {}, "best": [], "winRun": 0, "winBest": 0}


def stock_value(acct, prices):
    return sum(p["qty"] * (prices.get(s) or p["avg"]) for s, p in (acct.get("positions") or {}).items())


def option_value(acct, prices, vols=None, now_ms=None):
    """Option positions at the model mid (intrinsic once expired), x100 shares per contract."""
    opts = acct.get("options") or {}
    if not opts:
        return 0.0
    today = ny_day(now_ms if now_ms is not None else int(time.time() * 1000))
    vols = vols or {}
    return sum(p["qty"] * 100 * OPT.value(p, prices.get(p["u"]), vols.get(p["u"], OPT.DEFAULT_VOL), today) for p in opts.values())


def equity(acct, prices, vols=None, now_ms=None):
    return r2(acct["cash"] + stock_value(acct, prices) + option_value(acct, prices, vols, now_ms))


def reserved_cash(acct, prices):
    t = 0.0
    for o in (acct.get("orders") or {}).values():
        if o["side"] == "buy":
            t += o["est"] if o.get("opt") else o["qty"] * (o.get("limit") or o.get("stop") or prices.get(o["sym"]) or 0)
    return t


def buying_power(acct, prices):
    return max(0.0, acct["cash"] - reserved_cash(acct, prices))


def reserved_shares(acct, sym):
    """Shares already promised to open sell orders. Bracket exits (stop-loss / take-profit)
    don't count: they protect the position, and a manual sell shrinks or cancels them
    (same as the classic page)."""
    return sum(o["qty"] for o in (acct.get("orders") or {}).values() if o["side"] == "sell" and o["sym"] == sym and not o.get("oco") and not o.get("opt"))


def reserved_contracts(acct, cid):
    return sum(o["qty"] for o in (acct.get("orders") or {}).values() if o["side"] == "sell" and o.get("opt") == cid)


def net_pnl(acct, eq):
    return r2(eq - START_CASH + sum((r.get("equityBefore") or START_CASH) - START_CASH for r in acct.get("resetHistory") or []))


# ------------------------------------------------------------------ order validation
def _price(v, name):
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise OrderError("Enter a valid %s price." % name)
    if not (x > 0) or x != x or x > 1e6:
        raise OrderError("Enter a valid %s price." % name)
    return round(x, 4)


def _in_band(x, last, name):
    if last and not (last * PRICE_BAND[0] <= x <= last * PRICE_BAND[1]):
        raise OrderError("That %s price is too far from the current price." % name)


def validate_order(acct, req, last_price, universe, now_ms, new_id):
    """req from the browser -> a clean order dict, or OrderError. Nothing from req is trusted
    beyond what is checked here; prices to fill at never come from the browser."""
    if not isinstance(req, dict):
        raise OrderError("Invalid order.")
    sym = str(req.get("sym") or "").upper()
    if not SYM_RE.match(sym) or sym not in universe:
        raise OrderError("That stock isn't in the Zelos stock list.")
    if not last_price:
        raise OrderError("There's no price for %s yet. Try again in a few minutes." % sym)
    side = req.get("side")
    if side not in ("buy", "sell"):
        raise OrderError("Choose Buy or Sell.")
    otype = req.get("type") or "market"
    if otype not in ("market", "limit", "stop"):
        raise OrderError("Unknown order type.")
    tif = req.get("tif") or "day"
    if tif not in ("day", "gtc"):
        raise OrderError("Unknown time in force.")
    try:
        qty = int(req.get("qty"))
    except (TypeError, ValueError):
        raise OrderError("Enter a whole number of shares.")
    if qty != req.get("qty") and str(qty) != str(req.get("qty")):
        raise OrderError("Enter a whole number of shares.")
    if not 1 <= qty <= MAX_QTY:
        raise OrderError("Enter between 1 and %d shares." % MAX_QTY)
    if (acct.get("openOrders") or 0) >= MAX_OPEN_ORDERS:
        raise OrderError("You have %d open orders. Cancel some first." % MAX_OPEN_ORDERS)

    limit = stop = None
    if otype == "limit":
        limit = _price(req.get("limit"), "limit")
        _in_band(limit, last_price, "limit")
    if otype == "stop":
        stop = _price(req.get("stop"), "stop")
        _in_band(stop, last_price, "stop")

    bracket = None
    b = req.get("bracket")
    if b:
        if side != "buy" or not isinstance(b, dict):
            raise OrderError("Stop-loss and take-profit can be attached to buy orders.")
        ref = limit or stop or last_price
        sl = _price(b["sl"], "stop-loss") if b.get("sl") not in (None, "") else None
        tp = _price(b["tp"], "take-profit") if b.get("tp") not in (None, "") else None
        if sl is not None:
            _in_band(sl, last_price, "stop-loss")
            if sl >= ref:
                raise OrderError("The stop-loss must be below the entry price.")
        if tp is not None:
            _in_band(tp, last_price, "take-profit")
            if tp <= ref:
                raise OrderError("The take-profit must be above the entry price.")
        if sl is not None or tp is not None:
            bracket = {"sl": sl, "tp": tp}

    prices = {sym: last_price}
    if side == "buy":
        if sym not in acct["positions"] and len(acct["positions"]) >= MAX_POSITIONS:
            raise OrderError("You can hold up to %d different stocks." % MAX_POSITIONS)
        cost = qty * (limit or stop or last_price)
        bp = buying_power(acct, prices)
        if cost > bp + 0.005:
            raise OrderError("Not enough buying power: that's about $%s and you have $%s." % (format(r2(cost), ",.2f"), format(r2(bp), ",.2f")))
    else:
        held = (acct["positions"].get(sym) or {}).get("qty", 0)
        free = held - reserved_shares(acct, sym)
        if qty > free:
            raise OrderError("You can sell up to %d shares of %s (others are held by open sell orders)." % (max(0, free), sym) if held else "You don't own any %s." % sym)

    return {"id": new_id, "sym": sym, "side": side, "type": otype, "qty": qty, "limit": limit, "stop": stop, "tif": tif,
            "session": active_session(now_ms), "createdAt": now_ms, "bracket": bracket, "oco": None, "role": None, "parent": None}


def validate_option_order(acct, req, last_price, vol, universe, now_ms, new_id):
    """{kind: "option", u, type: "call"|"put", strike, exp, side, qty} -> a clean option order.
    Long calls and puts only: buy to open, sell to close. Market orders, filled on the next
    price; the cost check uses today's model ask, the fill uses the price at fill time."""
    if not isinstance(req, dict):
        raise OrderError("Invalid order.")
    u = str(req.get("u") or "").upper()
    if not SYM_RE.match(u) or u not in universe:
        raise OrderError("That stock isn't in the Zelos stock list.")
    if not last_price:
        raise OrderError("There's no price for %s yet. Try again in a few minutes." % u)
    kind = req.get("type")
    if kind not in ("call", "put"):
        raise OrderError("Choose a call or a put.")
    side = req.get("side")
    if side not in ("buy", "sell"):
        raise OrderError("Choose Buy or Sell.")
    exp = str(req.get("exp") or "")
    try:
        strike = round(float(req.get("strike")), 2)
    except (TypeError, ValueError):
        raise OrderError("Pick a strike price.")
    try:
        qty = int(req.get("qty"))
    except (TypeError, ValueError):
        raise OrderError("Enter a whole number of contracts.")
    if str(qty) != str(req.get("qty")) and qty != req.get("qty"):
        raise OrderError("Enter a whole number of contracts.")
    if not 1 <= qty <= OPT.MAX_CONTRACTS:
        raise OrderError("Enter between 1 and %d contracts." % OPT.MAX_CONTRACTS)
    if (acct.get("openOrders") or 0) >= MAX_OPEN_ORDERS:
        raise OrderError("You have %d open orders. Cancel some first." % MAX_OPEN_ORDERS)
    today = ny_day(now_ms)
    cid = OPT.contract_id(u, kind, strike, exp) if re.match(r"^\d{4}-\d{2}-\d{2}$", exp) else None
    held = ((acct.get("options") or {}).get(cid) or {}).get("qty", 0) if cid else 0
    if side == "buy":
        if exp not in OPT.expirations(today):
            raise OrderError("Pick one of the listed expiration dates.")
        if strike not in OPT.strikes(last_price):
            raise OrderError("Pick one of the listed strike prices.")
        if not held and len(acct.get("options") or {}) >= OPT.MAX_OPTION_POSITIONS:
            raise OrderError("You can hold up to %d different option contracts." % OPT.MAX_OPTION_POSITIONS)
        q = OPT.quote(kind, last_price, strike, exp, today, vol)
        est = r2(q["ask"] * 100 * qty)
        bp = buying_power(acct, {u: last_price})
        if est > bp + 0.005:
            raise OrderError("Not enough buying power: that's about $%s and you have $%s." % (format(est, ",.2f"), format(r2(bp), ",.2f")))
    else:
        if not held:
            raise OrderError("You don't hold that contract.")
        if exp < today:
            raise OrderError("That contract has expired.")
        free = held - reserved_contracts(acct, cid)
        if qty > free:
            raise OrderError("You can sell up to %d of these contracts (others are in open sell orders)." % max(0, free))
        est = 0.0
    c = {"u": u, "kind": kind, "strike": strike, "exp": exp}
    return {"id": new_id, "sym": u, "opt": cid, "contract": c, "label": OPT.label(c), "side": side, "type": "market", "qty": qty, "limit": None, "stop": None, "tif": "day",
            "session": active_session(now_ms), "createdAt": now_ms, "bracket": None, "oco": None, "role": None, "parent": None, "est": est}


def add_order(acct, order):
    acct["orders"][order["id"]] = order
    acct["openOrders"] = len(acct["orders"])


# ------------------------------------------------------------------ fills
def trigger_on_bar(o, bar):
    """Fill price for an order on a bar that started after the order existed, or None."""
    _, op, hi, lo = bar[0], bar[1], bar[2], bar[3]
    if o["type"] == "market":
        return op
    if o["type"] == "limit":
        if o["side"] == "buy":
            return op if op <= o["limit"] else (o["limit"] if lo <= o["limit"] else None)
        return op if op >= o["limit"] else (o["limit"] if hi >= o["limit"] else None)
    if o["type"] == "stop":
        if o["side"] == "sell":
            return op if op <= o["stop"] else (o["stop"] if lo <= o["stop"] else None)
        return op if op >= o["stop"] else (o["stop"] if hi >= o["stop"] else None)
    return None


def trigger_on_price(o, p):
    """Fill price for an order seeing one price observed after it existed, or None."""
    if o["type"] == "market":
        return p
    if o["type"] == "limit":
        return p if (p <= o["limit"] if o["side"] == "buy" else p >= o["limit"]) else None
    if o["type"] == "stop":
        return p if (p <= o["stop"] if o["side"] == "sell" else p >= o["stop"]) else None
    return None


def _new_id(base, suffix):
    return (base + suffix)[:32]


def fill_option(acct, o, S, when_ms, events, vols):
    """Fill an option order: the model price with the underlying at S (buy at the ask, sell at the bid)."""
    day = ny_day(when_ms)
    acct["orders"].pop(o["id"], None)
    c = o["contract"]
    acct.setdefault("options", {})
    q = OPT.quote(c["kind"], S, c["strike"], c["exp"], day, (vols or {}).get(c["u"], OPT.DEFAULT_VOL))
    if o["side"] == "buy":
        px, qty = q["ask"], o["qty"]
        cost = r2(px * 100 * qty)
        if cost > acct["cash"] + 0.005:
            events.append({"kind": "order", "order": dict(o, status="rejected", note="Not enough cash when it triggered", closedAt=when_ms)})
            _recount(acct)
            return
        acct["cash"] = r2(acct["cash"] - cost)
        p = acct["options"].get(o["opt"]) or dict(c, qty=0, avg=0.0, openedDay=day, label=o["label"])
        p["avg"] = round((p["avg"] * p["qty"] + px * qty) / (p["qty"] + qty), 4)
        p["qty"] += qty
        acct["options"][o["opt"]] = p
        _life(acct, c["u"])
        acct["life"]["optionFills"] = acct["life"].get("optionFills", 0) + 1
        events.append({"kind": "order", "order": dict(o, status="filled", fillPrice=px, filledAt=when_ms, closedAt=when_ms)})
        events.append({"kind": "fill", "sym": c["u"], "opt": o["opt"], "label": o["label"], "side": "buy", "qty": qty, "price": px, "at": when_ms, "day": day, "orderId": o["id"]})
    else:
        pos = acct["options"].get(o["opt"])
        if not pos or pos["qty"] <= 0:
            events.append({"kind": "order", "order": dict(o, status="cancelled", note="No contracts left to sell", closedAt=when_ms)})
            _recount(acct)
            return
        px, qty = q["bid"], min(o["qty"], pos["qty"])
        _close_option(acct, o["opt"], pos, qty, px, when_ms, events, role=None)
        acct["life"]["optionFills"] = acct["life"].get("optionFills", 0) + 1
        events.insert(len(events) - 2, {"kind": "order", "order": dict(o, qty=qty, status="filled", fillPrice=px, filledAt=when_ms, closedAt=when_ms)})
    _recount(acct)


def _close_option(acct, cid, pos, qty, px, when_ms, events, role):
    day = ny_day(when_ms)
    pnl = r2((px - pos["avg"]) * 100 * qty)
    acct["cash"] = r2(acct["cash"] + px * 100 * qty)
    acct["realized"] = r2(acct["realized"] + pnl)
    trade = {"kind": "option", "sym": pos["u"], "label": pos.get("label") or OPT.label(pos), "opt": cid, "qty": qty, "entry": round(pos["avg"], 4), "exit": round(px, 4),
             "invested": r2(pos["avg"] * 100 * qty), "pnl": pnl, "pct": round((px / pos["avg"] - 1) * 100, 2) if pos["avg"] else 0.0,
             "openDay": pos.get("openedDay"), "closeDay": day, "at": when_ms, "epoch": acct.get("epoch", 0), "role": role}
    _record_trade(acct, trade)
    pos["qty"] -= qty
    if pos["qty"] <= 0:
        acct["options"].pop(cid, None)
    _life(acct, pos["u"])
    events.append({"kind": "fill", "sym": pos["u"], "opt": cid, "label": trade["label"], "side": "sell", "qty": qty, "price": round(px, 4), "at": when_ms, "day": day, "pnl": pnl, "role": role})
    events.append({"kind": "trade", "trade": trade})


def settle_expired(acct, prices, now_ms):
    """Contracts past their expiration close settle at intrinsic value (cash), like exercise at expiry."""
    events = []
    today = ny_day(now_ms)
    for cid, pos in list((acct.get("options") or {}).items()):
        if pos["exp"] > today or (pos["exp"] == today and now_ms < session_close_ms(today)):
            continue
        S = prices.get(pos["u"])
        if S is None:
            continue
        px = OPT.intrinsic(pos, S)
        for o in [x for x in acct["orders"].values() if x.get("opt") == cid]:
            acct["orders"].pop(o["id"], None)
            events.append({"kind": "order", "order": dict(o, status="cancelled", note="Contract expired", closedAt=now_ms)})
        _close_option(acct, cid, pos, pos["qty"], px, max(now_ms, session_close_ms(pos["exp"])), events, role="expired")
    _recount(acct)
    return events


def fill(acct, o, px, when_ms, events, vols=None):
    """Apply one fill. Mirrors the classic page's fill() so results are the same."""
    if o.get("opt"):
        return fill_option(acct, o, px, when_ms, events, vols)
    sym, day = o["sym"], ny_day(when_ms)
    acct["orders"].pop(o["id"], None)
    px = round(float(px), 4)
    if o["side"] == "buy":
        qty = o["qty"]
        cost = qty * px
        if cost > acct["cash"] + 0.005:
            events.append({"kind": "order", "order": dict(o, status="rejected", note="Not enough cash when it triggered", closedAt=when_ms)})
            _recount(acct)
            return
        acct["cash"] = r2(acct["cash"] - cost)
        p = acct["positions"].get(sym) or {"qty": 0, "avg": 0.0, "openedDay": day}
        p["avg"] = round((p["avg"] * p["qty"] + cost) / (p["qty"] + qty), 6)
        p["qty"] = p["qty"] + qty
        acct["positions"][sym] = p
        _life(acct, sym)
        events.append({"kind": "order", "order": dict(o, status="filled", fillPrice=px, filledAt=when_ms, closedAt=when_ms)})
        events.append({"kind": "fill", "sym": sym, "side": "buy", "qty": qty, "price": px, "at": when_ms, "day": day, "orderId": o["id"]})
        br = o.get("bracket") or {}
        if br.get("sl") or br.get("tp"):
            group = _new_id(o["id"], "g")
            if br.get("sl"):
                add_order(acct, {"id": _new_id(o["id"], "s"), "sym": sym, "side": "sell", "type": "stop", "qty": qty, "limit": None, "stop": br["sl"], "tif": "gtc",
                                 "session": active_session(when_ms), "createdAt": when_ms, "bracket": None, "oco": group, "role": "sl", "parent": o["id"]})
            if br.get("tp"):
                add_order(acct, {"id": _new_id(o["id"], "t"), "sym": sym, "side": "sell", "type": "limit", "qty": qty, "limit": br["tp"], "stop": None, "tif": "gtc",
                                 "session": active_session(when_ms), "createdAt": when_ms, "bracket": None, "oco": group, "role": "tp", "parent": o["id"]})
    else:
        pos = acct["positions"].get(sym)
        if not pos or pos["qty"] <= 0:
            events.append({"kind": "order", "order": dict(o, status="cancelled", note="No shares left to sell", closedAt=when_ms)})
            _recount(acct)
            return
        qty = min(o["qty"], pos["qty"])
        pnl = r2((px - pos["avg"]) * qty)
        acct["cash"] = r2(acct["cash"] + qty * px)
        acct["realized"] = r2(acct["realized"] + pnl)
        trade = {"kind": "stock", "sym": sym, "qty": qty, "entry": round(pos["avg"], 4), "exit": px, "invested": r2(pos["avg"] * qty), "pnl": pnl,
                 "pct": round((px / pos["avg"] - 1) * 100, 2) if pos["avg"] else 0.0, "openDay": pos.get("openedDay"), "closeDay": day, "at": when_ms,
                 "epoch": acct.get("epoch", 0), "role": o.get("role")}
        _record_trade(acct, trade)
        pos["qty"] -= qty
        if pos["qty"] <= 0:
            del acct["positions"][sym]
        if o.get("role") == "tp":
            acct["life"]["tpExits"] = acct["life"].get("tpExits", 0) + 1
        _life(acct, sym)
        events.append({"kind": "order", "order": dict(o, qty=qty, status="filled", fillPrice=px, filledAt=when_ms, closedAt=when_ms)})
        events.append({"kind": "fill", "sym": sym, "side": "sell", "qty": qty, "price": px, "at": when_ms, "day": day, "orderId": o["id"], "pnl": pnl, "role": o.get("role")})
        events.append({"kind": "trade", "trade": trade})
        # the other side of a bracket goes; other sells shrink to what's left
        for x in list(acct["orders"].values()):
            if x["side"] != "sell" or x["sym"] != sym or x.get("opt"):
                continue
            if (o.get("oco") and x.get("oco") == o["oco"]) or sym not in acct["positions"]:
                acct["orders"].pop(x["id"], None)
                note = "Other side of the bracket filled" if o.get("oco") and x.get("oco") == o["oco"] else "Position closed"
                events.append({"kind": "order", "order": dict(x, status="cancelled", note=note, closedAt=when_ms)})
            elif x["qty"] > acct["positions"][sym]["qty"]:
                x["qty"] = acct["positions"][sym]["qty"]
    _recount(acct)


def _recount(acct):
    acct["openOrders"] = len(acct["orders"])


def _life(acct, sym):
    L = acct["life"]
    L["fills"] = L.get("fills", 0) + 1
    if sym not in L.setdefault("symbols", []):
        L["symbols"] = (L["symbols"] + [sym])[-200:]


def _record_trade(acct, t):
    s = acct["stats"]
    s["trades"] += 1
    if t["pnl"] > 0:
        s["wins"] += 1
        s["sumWin"] = r2(s["sumWin"] + t["pnl"])
        s["winRun"] += 1
        s["winBest"] = max(s["winBest"], s["winRun"])
    elif t["pnl"] < 0:
        s["losses"] += 1
        s["sumLoss"] = r2(s["sumLoss"] + t["pnl"])
        s["winRun"] = 0
    b = s["bySym"].setdefault(t["sym"], {"pnl": 0.0, "n": 0})
    b["pnl"] = r2(b["pnl"] + t["pnl"])
    b["n"] += 1
    if t["pnl"] > 0:
        s["best"] = sorted(s["best"] + [t], key=lambda x: -x["pnl"])[:10]
    sid = season_for(t["closeDay"])
    if sid:
        ss = acct["seasonStats"].setdefault(sid, {"bestWin": 0.0, "bestPct": 0.0, "winRun": 0, "winBest": 0})
        if t["pnl"] > 0:
            ss["bestWin"] = max(ss["bestWin"], t["pnl"])
            ss["bestPct"] = max(ss["bestPct"], t["pct"])
            ss["winRun"] += 1
            ss["winBest"] = max(ss["winBest"], ss["winRun"])
        elif t["pnl"] < 0:
            ss["winRun"] = 0
    if t["closeDay"] not in acct["tradeDays"]:
        acct["tradeDays"] = (acct["tradeDays"] + [t["closeDay"]])[-400:]


def process_orders(acct, quotes, bars, now_ms, bar_min=BAR_MIN, vols=None):
    """Fill / expire open orders against prices observed after each order was placed.

    quotes:  {SYM: {"c": price, "t": epoch seconds of the quote}}
    bars:    {SYM: [bar, ...]} intraday bars (start labels), ascending
    bar_min: length of those bars in minutes (1 with 1-minute prices, 15 on the Basic plan)
    Returns a list of events (order closed, fill, trade) for the caller to record.
    """
    events = []
    guard = 0
    while acct["orders"] and guard < 500:
        guard += 1
        progressed = False
        for o in sorted(acct["orders"].values(), key=lambda x: (x["createdAt"], x["id"])):
            if o["id"] not in acct["orders"]:
                continue
            hit = _first_trigger(o, bars.get(o["sym"]) or [], quotes.get(o["sym"]), now_ms, bar_min)
            if hit:
                fill(acct, o, hit[0], hit[1], events, vols)
                progressed = True
                break  # orders changed (brackets added, siblings removed): start over
        if not progressed:
            break
    # day orders that missed their session expire at the close
    for o in list(acct["orders"].values()):
        if o["tif"] == "day" and now_ms >= session_close_ms(o["session"]):
            acct["orders"].pop(o["id"], None)
            events.append({"kind": "order", "order": dict(o, status="expired", note="Day order expired at the close", closedAt=now_ms)})
    _recount(acct)
    return events


def _first_trigger(o, bars, quote, now_ms, bar_min=BAR_MIN):
    """(price, when_ms) of the earliest fill after the order was placed, or None."""
    created = o["createdAt"]
    first_ok = session_open_ms(o["session"]) if o["session"] > ny_day(created) else created
    last_ok = session_close_ms(o["session"]) if o["tif"] == "day" else None
    for b in bars:
        start = bar_start_ms(b[0])
        end = start + bar_min * 60000
        if end > now_ms + 1000:  # a bar still in progress isn't final
            continue
        if last_ok is not None and start >= last_ok:
            break
        if end <= first_ok:
            continue
        if start >= first_ok:
            px = trigger_on_bar(o, b)
            if px is not None:
                return px, (start if o["type"] == "market" else end)
        else:
            # the order arrived mid-bar: only this bar's close happened after it
            px = trigger_on_price(o, b[4])
            if px is not None:
                return px, end
    # no bars (e.g. a symbol without intraday data): a quote newer than the order
    if quote and quote.get("c") and (quote.get("t") or 0) * 1000 > first_ok and market_open((quote.get("t") or 0) * 1000 - 1):
        if last_ok is None or (quote["t"] * 1000) <= last_ok:
            px = trigger_on_price(o, quote["c"])
            if px is not None:
                return px, quote["t"] * 1000
    return None


def session_open_ms(day):
    d = datetime.strptime(day, "%Y-%m-%d").replace(hour=9, minute=30, tzinfo=NY)
    return int(d.timestamp() * 1000)


def cancel_order(acct, order_id, now_ms):
    if not isinstance(order_id, str) or order_id not in acct["orders"]:
        raise OrderError("That order isn't open any more.")
    o = acct["orders"].pop(order_id)
    events = [{"kind": "order", "order": dict(o, status="cancelled", note="Cancelled by you", closedAt=now_ms)}]
    # cancelling one side of a bracket leaves the other in place (it still protects the shares)
    _recount(acct)
    return events


def reset_account(acct, eq, now_ms):
    if eq >= RESET_BELOW:
        raise OrderError("Reset unlocks once the account is below $%s." % format(RESET_BELOW, ",.0f"))
    events = [{"kind": "order", "order": dict(o, status="cancelled", note="Account reset", closedAt=now_ms)} for o in acct["orders"].values()]
    hist = (acct.get("resetHistory") or []) + [{"at": now_ms, "day": ny_day(now_ms), "equityBefore": r2(eq)}]
    fresh = new_account(now_ms, epoch=acct.get("epoch", 0) + 1, resets=acct.get("resets", 0) + 1, reset_history=hist[-50:])
    # lifetime numbers, trade stats and history survive a reset (they're public stats)
    for k in ("createdAt", "stats", "life", "periods", "seasonStats", "hist", "tradeDays", "publicProfile", "realized"):
        if k in acct:
            fresh[k] = acct[k]
    fresh["realized"] = acct.get("realized", 0.0)
    return fresh, events


# ------------------------------------------------------------------ daily bookkeeping + public profile
def mark(acct, eq, now_ms, xp):
    """Update peak, period baselines and the daily history with today's value."""
    day = ny_day(now_ms)
    n = net_pnl(acct, eq)
    acct["peak"] = r2(max(acct.get("peak") or START_CASH, eq))
    keys = [week_key(day), month_key(day)] + ([season_for(day)] if season_for(day) else [])
    per = acct.setdefault("periods", {})
    for k in keys:
        if k not in per:
            per[k] = {"eq0": r2(eq), "net0": n, "xp0": xp or 0, "at": now_ms}
    # keep the current periods plus the most recent few (leaderboards read the current ones)
    old = sorted((k for k in per if k not in keys), key=lambda k: per[k].get("at") or 0)
    for k in old[: max(0, len(per) - 12)]:
        per.pop(k, None)
    hist = acct.setdefault("hist", {})
    hist["d" + day.replace("-", "")] = {"n": n, "x": xp or 0, "e": r2(eq)}
    for k in sorted(hist)[:-90]:
        hist.pop(k, None)


def trade_streak(acct, today):
    """Consecutive trading days up to today (or yesterday) with at least one closed trade."""
    days = set(acct.get("tradeDays") or [])
    d = datetime.strptime(today, "%Y-%m-%d")
    if today not in days:
        d -= timedelta(days=1)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
    n = 0
    while d.strftime("%Y-%m-%d") in days:
        n += 1
        d -= timedelta(days=1)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
    return n


def build_profile(acct, eq, now_ms, identity, xp, keep=None):
    """practiceProfiles/{uid}: the same public shape the classic page published, now computed
    by the server. `identity` = {name, username, photo} from traders/{uid}; `keep` = cosmetic
    fields the owner may set (achievements, streak) carried over from the existing doc."""
    s, today = acct["stats"], ny_day(now_ms)
    n = net_pnl(acct, eq)
    lv = level_for(xp)
    periods = {}
    for k, b in (acct.get("periods") or {}).items():
        pnl = r2(n - b["net0"])
        row = {"pnl": pnl, "pct": r2(pnl / (b.get("eq0") or START_CASH) * 100)}
        if k in acct.get("seasonStats", {}) or k.startswith("s"):
            ss = acct.get("seasonStats", {}).get(k, {})
            row.update({"xp": max(0, (xp or 0) - (b.get("xp0") or 0)), "bestWin": r2(ss.get("bestWin", 0)), "bestPct": r2(ss.get("bestPct", 0)), "winStreak": ss.get("winBest", 0)})
        periods[k] = row
    by = s["bySym"]
    out = {
        "name": str(identity.get("name") or "Trader")[:24], "username": identity.get("username") or None, "photo": identity.get("photo") or None,
        "equity": r2(eq), "start": START_CASH, "growthPct": r2((eq / START_CASH - 1) * 100), "peakEquity": r2(max(acct.get("peak") or eq, eq)),
        "resets": acct.get("resets", 0), "resetHistory": [{"day": r["day"], "equityBefore": r["equityBefore"]} for r in (acct.get("resetHistory") or [])[-20:]],
        "trades": s["trades"], "wins": s["wins"], "losses": s["losses"], "winRate": round(s["wins"] / s["trades"] * 100) if s["trades"] else 0,
        "avgWin": r2(s["sumWin"] / s["wins"]) if s["wins"] else 0, "avgLoss": r2(s["sumLoss"] / s["losses"]) if s["losses"] else 0,
        "realized": r2(acct.get("realized", 0)),
        "bestTrades": [{k: t.get(k) for k in ("sym", "kind", "qty", "invested", "pnl", "pct", "entry", "exit", "openDay", "closeDay")} | {"label": t["sym"]} for t in s["best"]],
        "topStocks": sorted([{"sym": k, "pnl": v["pnl"]} for k, v in by.items() if v["pnl"] > 0], key=lambda x: -x["pnl"])[:5],
        "mostTraded": sorted([{"sym": k, "trades": v["n"], "pnl": v["pnl"]} for k, v in by.items()], key=lambda x: -x["trades"])[:5],
        "since": acct.get("createdAt"), "updatedAt": now_ms, "mode": "PRACTICE", "source": "server",
        "virtualTrades": acct["life"].get("fills", 0), "tradeStreak": trade_streak(acct, today), "netPnl": n,
        "xp": xp or 0, "level": lv["level"], "levelName": lv["name"], "winStreakBest": s["winBest"],
        "p": periods, "h": acct.get("hist", {}),
    }
    keep = keep or {}
    out["achievements"] = [a for a in (keep.get("achievements") or []) if isinstance(a, str)][:80]
    out["streak"] = int(keep.get("streak") or 0) if isinstance(keep.get("streak"), (int, float)) else 0
    return out


def archive_classic(practice):
    """Summary of a classic (browser-written) account to keep read-only after the switch.
    Marked unverified: those numbers were never checked by a server."""
    if not isinstance(practice, dict):
        return None
    summ = practice.get("summary") if isinstance(practice.get("summary"), dict) else {}
    raw = practice.get("trades")
    trades = [t for t in (raw if isinstance(raw, list) else []) if isinstance(t, dict)][-200:]
    clean = []
    for t in trades:
        try:
            if any(x != x or x in (float("inf"), float("-inf")) for x in (float(t.get(k) or 0) for k in ("qty", "entry", "exit", "pnl", "pct"))):
                continue
            clean.append({"sym": str(t.get("sym") or "")[:12], "kind": str(t.get("kind") or "stock")[:10], "qty": float(t.get("qty") or 0),
                          "entry": float(t.get("entry") or 0), "exit": float(t.get("exit") or 0), "pnl": float(t.get("pnl") or 0),
                          "pct": float(t.get("pct") or 0), "openDay": t.get("openDay") if isinstance(t.get("openDay"), str) else None,
                          "closeDay": t.get("closeDay") if isinstance(t.get("closeDay"), str) else None})
        except (TypeError, ValueError):
            continue
    def num(v):
        return float(v) if isinstance(v, (int, float)) else None
    return {"verified": False, "equity": num(summ.get("equity")), "cash": num(practice.get("cash")), "resets": int(practice.get("resets") or 0) if isinstance(practice.get("resets"), (int, float)) else 0,
            "createdAt": practice.get("createdAt") if isinstance(practice.get("createdAt"), (int, float)) else None, "trades": clean}
