"""Practice-account options (owner 2026-10-09: "full options trading now").

There is no options data on any plan we have, so option prices are MODELED, the same way as
the website (practice/practice-options.js): Black-Scholes on the stock's own price, with
volatility from its last 20 daily closes (lifted ~10% toward typical implied vol, 15%-180%),
a 4% bid/ask spread (2c to 50c), at least 1 cent. The app shows the same model from
markets/optionVols so the prices people see are the prices the server fills at.

Scope (same as the Options Scanner): long calls and puts only, buy to open and sell to close,
market orders that fill on the next price after you place them (like stock market orders).
Expired contracts settle at their intrinsic value at the close on expiration day.
Pure functions; practice.py and main.py do the storage.
"""
import math
import re
from datetime import date, timedelta

RATE = 0.04
MAX_CONTRACTS = 100           # per order
MAX_OPTION_POSITIONS = 20
STRIKE_COUNT = 31             # strikes offered around the money
DEFAULT_VOL = 0.4
CONTRACT_RE = re.compile(r"^([A-Z][A-Z0-9.\-]{0,9})\|(\d{8})\|([CP])\|(\d{1,9})$")


class OptionError(Exception):
    pass


# ------------------------------------------------------------------ the model (practice-options.js)
def ncdf(x):
    t = 1 / (1 + 0.2316419 * abs(x))
    d = 0.3989423 * math.exp(-x * x / 2)
    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return 1 - p if x > 0 else p


def bs(kind, S, K, T, sigma, r=RATE):
    if T <= 0 or sigma <= 0:
        return {"price": max(0.0, S - K if kind == "call" else K - S), "delta": (1.0 if S > K else 0.0) if kind == "call" else (-1.0 if S < K else 0.0)}
    sq = sigma * math.sqrt(T)
    d1 = (math.log(S / K) + (r + sigma * sigma / 2) * T) / sq
    d2 = d1 - sq
    if kind == "call":
        return {"price": S * ncdf(d1) - K * math.exp(-r * T) * ncdf(d2), "delta": ncdf(d1)}
    return {"price": K * math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1), "delta": ncdf(d1) - 1}


def hist_vol(closes, n=20):
    c = [float(x) for x in closes if x and float(x) > 0][-(n + 1):]
    if len(c) < 5:
        return DEFAULT_VOL
    r = [math.log(c[i] / c[i - 1]) for i in range(1, len(c))]
    m = sum(r) / len(r)
    v = sum((x - m) ** 2 for x in r) / (len(r) - 1)
    return min(1.8, max(0.15, math.sqrt(v * 252) * 1.1))


def r2(x):
    return math.floor(x * 100 + 0.5) / 100  # round half up, like Math.round in the app


def _d(s):
    return date.fromisoformat(s)


def expirations(today):
    """The next 6 weekly Fridays plus the next monthly (3rd-Friday) ones, as YYYY-MM-DD."""
    d = _d(today)
    ahead = (4 - d.weekday()) % 7 or 7
    f = d + timedelta(days=ahead)
    out = []
    for _ in range(6):
        out.append(f.isoformat())
        f += timedelta(days=7)
    for k in range(5):
        y, m = d.year + (d.month - 1 + k) // 12, (d.month - 1 + k) % 12 + 1
        first = date(y, m, 1)
        third = first + timedelta(days=(4 - first.weekday()) % 7 + 14)
        s = third.isoformat()
        if s > today and s not in out:
            out.append(s)
    return sorted(out)


def days_to(exp, today):
    return (_d(exp) - _d(today)).days


def strike_step(S):
    return 0.5 if S < 25 else 1 if S < 60 else 2.5 if S < 150 else 5 if S < 400 else 10 if S < 1000 else 25


def strikes(S, count=STRIKE_COUNT):
    st = strike_step(S)
    atm = round(S / st) * st
    half = count // 2
    return [round(atm + k * st, 2) for k in range(-half, half + 1) if atm + k * st > 0]


def quote(kind, S, K, exp, today, sigma):
    dte = max(0, days_to(exp, today))
    T = max(dte, 0.5) / 365
    q = bs(kind, S, K, T, sigma)
    mid = max(0.01, q["price"])
    spread = max(0.02, min(0.5, mid * 0.04))
    return {"mid": r2(mid), "bid": r2(max(0.01, mid - spread / 2)), "ask": r2(mid + spread / 2), "delta": q["delta"], "dte": dte}


# ------------------------------------------------------------------ contracts
def contract_id(u, kind, strike, exp):
    """AAPL|20261120|C|25000: underlying | expiry | C/P | strike in cents (no dots: safe as a map key)."""
    return "%s|%s|%s|%d" % (u, exp.replace("-", ""), "C" if kind == "call" else "P", int(round(strike * 100)))


def parse_contract(cid):
    m = CONTRACT_RE.match(str(cid or ""))
    if not m:
        return None
    e = m.group(2)
    return {"u": m.group(1), "exp": "%s-%s-%s" % (e[:4], e[4:6], e[6:]), "kind": "call" if m.group(3) == "C" else "put", "strike": int(m.group(4)) / 100}


def label(c):
    e = c["exp"][5:].replace("-", "/")
    k = c["strike"]
    return "%s $%s %s %s" % (c["u"], ("%g" % k), "Call" if c["kind"] == "call" else "Put", e)


def intrinsic(c, S):
    return max(0.0, S - c["strike"]) if c["kind"] == "call" else max(0.0, c["strike"] - S)


def value(pos, S, vol, today):
    """Mark value of a position (per contract, per share) at the model mid; intrinsic once expired."""
    if S is None:
        return pos["avg"]
    if pos["exp"] < today:
        return intrinsic(pos, S)
    return quote(pos["kind"], S, pos["strike"], pos["exp"], today, vol)["mid"]
