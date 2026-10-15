"""The 3-Leg Options strategy (owner 2026-10-15: a token strategy, 60 tokens for 7 days, each
alert one options trade made of three positions).

An alert's trade is three option legs on one stock with one expiration:

  {"ticker": "AAPL", "entry": 182.4 (the stock price at scan time), "expiration": "2026-11-20",
   "kind": "bull-butterfly" | "bear-butterfly" | "jade-lizard",
   "legs": [{"type": "call"|"put", "side": "buy"|"sell", "strike": 180, "qty": 1, "price": 3.10}, ...]}

price = the option's mid price per share at scan time; one contract = 100 shares.

The scanner sends the legs; the server works out every number people see from them
(normalize), so the cost, max profit, max loss and breakevens are always consistent:

  netCost      dollars paid (positive) or collected (negative) to open, per set of contracts
  maxProfit    dollars at expiration, None if unlimited
  maxLoss      dollars at expiration as a positive number, None if unlimited
  breakevens   stock prices at expiration where the trade is exactly flat

outcome_at_expiry(alert, close) judges the result from the stock's close on expiration day.
Pure functions only (no Firestore), so they're unit-tested in scripts/three_leg_test.py.
"""
import re

KINDS = {"bull-butterfly": "Bull call butterfly", "bear-butterfly": "Bear put butterfly", "jade-lizard": "Jade lizard"}
MULT = 100
MAX_QTY = 10
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf") else None


def leg_value(leg, s):
    """Value at expiration of one leg (dollars, signed: + for what you own)."""
    k = leg["strike"]
    intrinsic = max(0.0, s - k) if leg["type"] == "call" else max(0.0, k - s)
    return (1 if leg["side"] == "buy" else -1) * leg["qty"] * MULT * intrinsic


def net_cost(legs):
    """Dollars paid to open (negative = a credit received)."""
    return sum((1 if l["side"] == "buy" else -1) * l["qty"] * MULT * l["price"] for l in legs)


def payoff(legs, s):
    """Profit or loss at expiration if the stock closes at s."""
    return sum(leg_value(l, s) for l in legs) - net_cost(legs)


def _stats(legs):
    strikes = sorted({l["strike"] for l in legs})
    # P&L is straight lines between strikes: check 0, every strike, and the slope past the last one
    pts = [0.0] + strikes
    vals = [payoff(legs, s) for s in pts]
    slope_up = sum((1 if l["side"] == "buy" else -1) * l["qty"] * MULT for l in legs if l["type"] == "call")
    far = strikes[-1] * 2 + 100
    pts_all, vals_all = pts + [far], vals + [payoff(legs, far)]
    max_profit = None if slope_up > 0 else round(max(vals_all), 2)
    worst = min(vals_all)
    max_loss = None if slope_up < 0 else round(max(0.0, -worst), 2)
    bes = []
    for (a, va), (b, vb) in zip(zip(pts_all, vals_all), zip(pts_all[1:], vals_all[1:])):
        if va == 0 and (not bes or abs(bes[-1] - a) > 1e-9):
            bes.append(a)
        if (va < 0 < vb) or (va > 0 > vb):
            bes.append(a + (b - a) * (-va) / (vb - va))
    if vals_all[-1] == 0:
        bes.append(pts_all[-1])
    return max_profit, max_loss, [round(x, 2) for x in bes if x > 0]


def normalize(payload):
    """Checked trade fields for a 3-Leg alert (copied onto the alert), or ValueError(message).
    No-setup days pass through untouched."""
    if payload.get("status") == "no-qualifying-setup" or not payload.get("ticker"):
        return {}
    kind = payload.get("kind")
    if kind not in KINDS:
        raise ValueError("kind must be one of: %s" % ", ".join(KINDS))
    exp = payload.get("expiration")
    if not (isinstance(exp, str) and _DATE.match(exp)):
        raise ValueError("expiration must be YYYY-MM-DD")
    entry = _num(payload.get("entry"))
    if not entry or entry <= 0:
        raise ValueError("entry (the stock price) must be a positive number")
    raw = payload.get("legs")
    if not isinstance(raw, list) or len(raw) != 3:
        raise ValueError("a 3-Leg alert needs exactly 3 legs")
    legs = []
    for i, l in enumerate(raw):
        if not isinstance(l, dict):
            raise ValueError("leg %d is not an object" % (i + 1))
        t, side, k, q, p = l.get("type"), l.get("side"), _num(l.get("strike")), l.get("qty"), _num(l.get("price"))
        if t not in ("call", "put") or side not in ("buy", "sell"):
            raise ValueError("leg %d: type call|put and side buy|sell" % (i + 1))
        if not k or k <= 0 or p is None or p < 0:
            raise ValueError("leg %d: strike must be positive and price not negative" % (i + 1))
        if not isinstance(q, int) or isinstance(q, bool) or not 1 <= q <= MAX_QTY:
            raise ValueError("leg %d: qty must be 1 to %d" % (i + 1, MAX_QTY))
        legs.append({"type": t, "side": side, "strike": round(k, 2), "qty": q, "price": round(p, 2)})
    legs.sort(key=lambda x: (x["strike"], x["type"]))
    max_profit, max_loss, bes = _stats(legs)
    cost = round(net_cost(legs), 2)
    return {"kind": kind, "kindLabel": KINDS[kind], "expiration": exp, "entry": round(entry, 2), "legs": legs,
            "netCost": cost, "maxProfit": max_profit, "maxLoss": max_loss, "breakevens": bes,
            "direction": "long" if kind in ("bull-butterfly", "jade-lizard") else "short"}


def outcome_at_expiry(alert, close, closed_at=None):
    """{result, exitPrice, closedAt, notes}: hit-target if the trade made money at expiration,
    stopped-out if it lost, expired if exactly flat. close = the stock's closing price on
    expiration day."""
    pnl = round(payoff(alert["legs"], float(close)), 2)
    result = "hit-target" if pnl > 0 else "stopped-out" if pnl < 0 else "expired"
    return {"result": result, "exitPrice": round(float(close), 2), "closedAt": closed_at, "target2Hit": None, "target2ResolvedAt": None,
            "notes": "%s held to expiration (%s): %s closed at %.2f, %s $%s per set." % (
                alert.get("kindLabel") or "3-Leg trade", alert.get("expiration"), alert.get("ticker"), float(close),
                "made" if pnl > 0 else "lost" if pnl < 0 else "broke even at", format(abs(pnl), ",.2f"))}
