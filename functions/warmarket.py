"""The Trade War realm's simulated market and War profiles (docs/WAR_DESIGN.md §20, §24; owner
2026-10-27/29). Pure helpers here (unit tests: scripts/warmarket_test.py); the callables and the
minute job live in main.py.

The War zone runs on a simulated, always-on market (owner decision D10): made-up companies under
real sector names (E1), the same prices for everyone, made one minute at a time on the server so
nobody can see ahead. Every other mode stays on real prices.

    warEngine/state          the engine (server only): price, trend and the current 5-minute bar per stock,
                             and today's Chaos plan (secret until its warning)
    warMarket/chaos          the Chaos event people may know about: warned / live / over (§14)
    warMarket/quotes         {updatedAt, prices: {sym: {p, ref}}}: every minute (any signed-in reader)
    warMarket/bars_<SYM>     {bars: [{t, o, h, l, c}, ...]}: 5-minute bars, the last 7 days (Firestore
                             can't hold lists in lists, so bars are stored as maps: bars_out / bars_in)
    warProfiles/{uid}        a player's War profile: War balance, positions, balance chart (server write)
      fills/{id}             their War zone trades
"""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

SIM_NOTE = "Simulated War zone prices, not real market data."

# Real sector names, made-up companies (E1). Tickers are invented, five letters, and always shown
# with the "SIMULATED" marking; a match with a real listing is a coincidence.
SECTORS = (("tech", "Tech"), ("finance", "Finance"), ("health", "Health"), ("energy", "Energy"),
           ("consumer", "Consumer"), ("comms", "Communication"), ("industrials", "Industrials"))
# (sym, name, sector, start price, daily volatility)
COMPANIES = (
    ("NIMBC", "Nimbus Cloud", "tech", 182.0, 0.024),
    ("QUBTR", "Qubitron Labs", "tech", 96.0, 0.032),
    ("SYNAP", "Synaptix Chips", "tech", 248.0, 0.028),
    ("VAULT", "Vaultline Bank", "finance", 64.0, 0.015),
    ("LEDGR", "Ledgerpoint Pay", "finance", 121.0, 0.02),
    ("ORBCP", "Orbit Capital", "finance", 38.0, 0.018),
    ("HELIX", "Helixa Bio", "health", 77.0, 0.03),
    ("CURAM", "Curamed Health", "health", 142.0, 0.014),
    ("PULSV", "Pulsevia Devices", "health", 55.0, 0.02),
    ("VOLTX", "Voltex Energy", "energy", 88.0, 0.025),
    ("SOLRN", "Solarion Power", "energy", 29.0, 0.033),
    ("PETRA", "Petravo Oil", "energy", 112.0, 0.02),
    ("BRWLY", "Brewly Foods", "consumer", 47.0, 0.013),
    ("STRDE", "Stridewear", "consumer", 133.0, 0.019),
    ("CARTO", "Cartopia Stores", "consumer", 71.0, 0.017),
    ("SIGNL", "Signalwave Media", "comms", 58.0, 0.022),
    ("ECHON", "Echonet Telecom", "comms", 34.0, 0.014),
    ("STRMR", "Streamora", "comms", 205.0, 0.027),
    ("FORGE", "Forgeline Industrial", "industrials", 99.0, 0.016),
    ("AEROV", "Aerovance", "industrials", 167.0, 0.021),
    ("RAILX", "Railmax Logistics", "industrials", 52.0, 0.015),
)
SYMS = tuple(c[0] for c in COMPANIES)
BY_SYM = {c[0]: c for c in COMPANIES}

MIN_PER_DAY = 1440
BAR_MIN = 5                       # chart bars: 5 minutes
BARS_KEPT = 7 * MIN_PER_DAY // BAR_MIN   # 7 days
MAX_CATCH_UP = 60                 # minutes made up at most after a missed run
REVERT = 1.0 / (30 * MIN_PER_DAY)  # pull toward the start level: about 30 days
SECTOR_WEIGHT = 0.6               # how much a stock moves with its sector


def new_state(now_ms):
    """A fresh engine: every stock at its start price, flat trend, no bar yet."""
    return {"t": now_ms, "stocks": {c[0]: {"p": c[3], "trend": 0.0, "trendUntil": 0, "bar": None} for c in COMPANIES}}


def _trend(daily_vol, u):
    """A new per-minute drift: within about ±0.6% a day, scaled by the stock's volatility."""
    return (u * 2 - 1) * 0.25 * daily_vol / MIN_PER_DAY


def step(state, now_ms, rng):
    """Pure: the engine `minutes` steps on (one per minute since the last run, at most
    MAX_CATCH_UP). rng gives random.Random-like gauss() and random(). Returns (state, minutes,
    closed): closed holds each stock's 5-minute bars that finished during these steps."""
    last = int(state["t"]) if isinstance(state.get("t"), (int, float)) else now_ms
    minutes = max(0, min(MAX_CATCH_UP, (now_ms - last) // 60000))
    if not minutes:
        return state, 0, {}
    stocks = {s: dict(v) for s, v in state["stocks"].items()}
    for s in SYMS:  # a stock added to the list later starts at its start price
        stocks.setdefault(s, {"p": BY_SYM[s][3], "trend": 0.0, "trendUntil": 0, "bar": None})
    closed = {s: [] for s in SYMS}
    chaos = state.get("chaos") if isinstance(state.get("chaos"), dict) else {}
    for i in range(minutes):
        t = last + (i + 1) * 60000
        shocks = {sec: rng.gauss(0, 1) for sec, _ in SECTORS}
        wild = chaos_phase(chaos, t) == "live"
        for sym, name, sec, start, vol in COMPANIES:
            st = stocks[sym]
            if t >= st.get("trendUntil", 0):
                st["trend"] = _trend(vol, rng.random())
                st["trendUntil"] = t + int((1 + rng.random() * 2) * MIN_PER_DAY * 60000)  # 1-3 days
            sigma = vol / math.sqrt(MIN_PER_DAY)
            extra = 0.0
            if wild and sym in (chaos.get("moves") or {}):
                sigma *= CHAOS_VOL
                extra = chaos["moves"][sym] / chaos["minutes"]  # the event's whole move, spread over its minutes
            z = SECTOR_WEIGHT * shocks[sec] + math.sqrt(1 - SECTOR_WEIGHT ** 2) * rng.gauss(0, 1)
            pull = -REVERT * math.log(st["p"] / start)
            st["p"] = round(max(0.5, st["p"] * math.exp(st["trend"] + extra + sigma * z + pull)), 4)
            bar = add_to_bar(st.get("bar"), t, st["p"])
            if st.get("bar") and st["bar"][0] != bar[0]:
                closed[sym].append(st["bar"])
            st["bar"] = bar
    return dict(state, t=last + minutes * 60000, stocks=stocks), minutes, {s: b for s, b in closed.items() if b}


def bar_start(t):
    return t - t % (BAR_MIN * 60000)


def add_to_bar(bar, t, p):
    """The current 5-minute bar [t, o, h, l, c] after a price at time t (a new bar each 5 minutes)."""
    start = bar_start(t)
    if not bar or bar[0] != start:
        return [start, p, p, p, p]
    return [bar[0], bar[1], max(bar[2], p), min(bar[3], p), p]


def append_bar(bars, bar):
    """Bars with this bar added or updated (same start time), keeping the last BARS_KEPT."""
    bars = list(bars or [])
    if bars and bars[-1][0] == bar[0]:
        bars[-1] = bar
    else:
        bars.append(bar)
    return bars[-BARS_KEPT:]


def bars_out(bars):
    """[t, o, h, l, c] lists -> maps, as Firestore stores them."""
    return [{"t": b[0], "o": b[1], "h": b[2], "l": b[3], "c": b[4]} for b in bars]


def bars_in(docs):
    """Stored bar maps -> [t, o, h, l, c] lists (anything malformed is dropped)."""
    out = []
    for d in docs or []:
        if isinstance(d, dict) and all(isinstance(d.get(k), (int, float)) for k in "tohlc"):
            out.append([d["t"], d["o"], d["h"], d["l"], d["c"]])
    return out


def ref_price(bars, now_ms):
    """The price 24 hours ago (for the day change), from the bars; None if there's no history yet."""
    cut = now_ms - MIN_PER_DAY * 60000
    older = [b for b in bars or [] if b[0] <= cut]
    return older[-1][4] if older else (bars[0][1] if bars else None)


# ---------------------------------------------------------------- Chaos events (§14)
# Random wild-market events: on random days (more often on weekends), at most one a day, lasting
# 1-3 hours, hitting one sector or the whole market with a 10-20% move. The plan is made on the
# server at the start of each UTC day and stays secret (warEngine) until its 30-minute warning;
# the size and direction are never published. The stocks it hits are Hot for a day after.
CHAOS_CHANCE_WEEKDAY = 0.2
CHAOS_CHANCE_WEEKEND = 0.5
CHAOS_ALL_CHANCE = 0.25           # how often an event hits the whole market instead of one sector
CHAOS_WARN_MS = 30 * 60000
CHAOS_HOT_MS = 24 * 3600000
CHAOS_VOL = 4.0                   # how much wilder minute-to-minute moves are during an event
SECTOR_NAMES = dict(SECTORS)


def day_key(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%d")


def plan_chaos(now_ms, rng):
    """Pure: today's (UTC) Chaos plan, made at the first run of the day. {"day"} alone means no
    event today. An event always starts at least 30 minutes after the plan is made, so its
    warning can go out on time."""
    day = day_key(now_ms)
    day_ms = now_ms - now_ms % (MIN_PER_DAY * 60000)
    weekend = datetime.fromtimestamp(now_ms / 1000, timezone.utc).weekday() >= 5
    if rng.random() >= (CHAOS_CHANCE_WEEKEND if weekend else CHAOS_CHANCE_WEEKDAY):
        return {"day": day}
    minutes = 60 + int(rng.random() * 121)  # 1-3 hours
    first = max(30, (now_ms - day_ms) // 60000 + 31)
    last = MIN_PER_DAY - minutes
    if first > last:
        return {"day": day}
    start = day_ms + (first + int(rng.random() * (last - first + 1))) * 60000
    ids = [sec for sec, _ in SECTORS]
    scope = "all" if rng.random() < CHAOS_ALL_CHANCE else ids[int(rng.random() * len(ids)) % len(ids)]
    signs = {sec: (1 if rng.random() < 0.5 else -1) for sec in ids}
    size = 0.10 + rng.random() * 0.10  # 10-20%
    moves = {}
    for sym, _, sec, _, _ in COMPANIES:
        if scope in ("all", sec):
            pct = signs[sec] * size * (0.8 + rng.random() * 0.4)
            moves[sym] = round(math.log(1 + pct), 6)
    return {"day": day, "startsAt": start, "endsAt": start + minutes * 60000, "minutes": minutes, "scope": scope, "moves": moves}


def chaos_phase(chaos, now_ms):
    """None (no event, or not announced yet), "warned", "live" or "over"."""
    if not chaos or not chaos.get("startsAt"):
        return None
    if now_ms >= chaos["endsAt"]:
        return "over"
    if now_ms > chaos["startsAt"]:
        return "live"
    if now_ms >= chaos["startsAt"] - CHAOS_WARN_MS:
        return "warned"
    return None


def chaos_public(chaos, phase):
    """What warMarket/chaos says in each phase: the scope and start once warned, the end and the
    stocks once live, and how long they stay Hot once over. Never the size or direction."""
    scope = chaos["scope"]
    out = {"phase": phase, "day": chaos["day"], "scope": scope, "scopeName": "the whole market" if scope == "all" else SECTOR_NAMES[scope],
           "startsAt": chaos["startsAt"], "note": SIM_NOTE}
    if phase in ("live", "over"):
        out.update(endsAt=chaos["endsAt"], syms=sorted(chaos["moves"]))
    if phase == "over":
        out["hotUntil"] = chaos["endsAt"] + CHAOS_HOT_MS
    return out


# ---------------------------------------------------------------- quiet hours (§22)
# Each player's quiet hours (default 10 pm-8 am in their own time zone, never longer than 10
# hours): no War push notifications then; what happened goes into one morning summary.
QUIET_DEFAULT = (22 * 60, 8 * 60)
QUIET_MAX_MIN = 600
QUIET_STEP_MIN = 15
SUMMARY_MAX_LINES = 8


def valid_tz(tz):
    if not isinstance(tz, str) or not 1 <= len(tz) <= 64:
        return False
    try:
        ZoneInfo(tz)
        return True
    except Exception:
        return False


def default_quiet(tz):
    return {"start": QUIET_DEFAULT[0], "end": QUIET_DEFAULT[1], "tz": tz if valid_tz(tz) else "UTC"}


def quiet_length(q):
    return (q["end"] - q["start"]) % MIN_PER_DAY


def validate_quiet(data):
    """{start, end, tz} from the browser (minutes after midnight, 15-minute steps) -> quiet
    hours, or WarError. start == end turns them off."""
    data = data if isinstance(data, dict) else {}
    start, end, tz = data.get("start"), data.get("end"), data.get("tz")
    for v in (start, end):
        if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v < MIN_PER_DAY or v % QUIET_STEP_MIN:
            raise WarError("INVALID_ARGUMENT", "Pick times on the quarter hour.")
    if not valid_tz(tz):
        raise WarError("INVALID_ARGUMENT", "That time zone isn't valid.")
    q = {"start": start, "end": end, "tz": tz}
    if quiet_length(q) > QUIET_MAX_MIN:
        raise WarError("INVALID_ARGUMENT", "Quiet hours can be at most 10 hours a day.")
    return q


def _local(now_ms, tz):
    return datetime.fromtimestamp(now_ms / 1000, ZoneInfo(tz))


def in_quiet(q, now_ms):
    if not q or not quiet_length(q):
        return False
    d = _local(now_ms, q["tz"])
    return (d.hour * 60 + d.minute - q["start"]) % MIN_PER_DAY < quiet_length(q)


def quiet_ends_at(q, now_ms):
    """When the quiet hours you're in now end (ms), or None if you're not in quiet hours."""
    if not in_quiet(q, now_ms):
        return None
    d = _local(now_ms, q["tz"])
    end = d.replace(hour=q["end"] // 60, minute=q["end"] % 60, second=0, microsecond=0)
    if end <= d:
        end = (d + timedelta(days=1)).replace(hour=q["end"] // 60, minute=q["end"] % 60, second=0, microsecond=0)
    return int(end.timestamp() * 1000)


def summary_body(lines):
    """The morning summary's text: what happened while you slept, newest last."""
    lines = list(dict.fromkeys(lines or []))[-SUMMARY_MAX_LINES:]
    return "While you slept: " + " ".join(lines) if lines else ""


# ---------------------------------------------------------------- War profiles (§24.5)
START_BALANCE = 100000.0
QUOTE_MAX_AGE_MS = 3 * 60000
MAX_QTY = 100000
CHART_KEPT = 400


class WarError(ValueError):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


def new_profile(now_ms, tz=None):
    return {"quiet": default_quiet(tz), "start": START_BALANCE, "cash": START_BALANCE, "positions": {}, "equity": START_BALANCE,
            "pnl": 0.0, "pnlPct": 0.0, "trades": 0, "createdAt": now_ms, "updatedAt": now_ms,
            "chart": [{"t": now_ms, "eq": START_BALANCE}]}


def equity(profile, prices):
    """Cash plus positions at these prices (a position without a price counts at its cost)."""
    pos = profile.get("positions") or {}
    return round(profile["cash"] + sum(p["qty"] * (prices.get(s) or p["avg"]) for s, p in pos.items()), 2)


def validate_trade(data):
    """{sym, side, qty} from the browser -> (sym, side, qty), or WarError."""
    data = data if isinstance(data, dict) else {}
    sym, side, qty = data.get("sym"), data.get("side"), data.get("qty")
    if sym not in BY_SYM:
        raise WarError("INVALID_ARGUMENT", "That company isn't in the War zone.")
    if side not in ("buy", "sell"):
        raise WarError("INVALID_ARGUMENT", "Choose buy or sell.")
    if isinstance(qty, float) and qty.is_integer():
        qty = int(qty)
    if isinstance(qty, bool) or not isinstance(qty, int) or not 1 <= qty <= MAX_QTY:
        raise WarError("INVALID_ARGUMENT", "Shares must be a whole number from 1 to %d." % MAX_QTY)
    return sym, side, qty


def apply_trade(profile, sym, side, qty, price, prices, now_ms):
    """Pure: (profile, fill) after buying or selling whole shares at price (long only, no fees:
    short selling is only for Bull/Bear battles, owner-approved). Raises WarError."""
    pos = {s: dict(p) for s, p in (profile.get("positions") or {}).items()}
    cash = profile["cash"]
    held = pos.get(sym, {}).get("qty", 0)
    pnl = None
    if side == "buy":
        cost = round(qty * price, 2)
        if cost > cash + 1e-9:
            raise WarError("FAILED_PRECONDITION", "Not enough War cash: that costs $%s and you have $%s." % (format(cost, ",.2f"), format(cash, ",.2f")))
        avg = ((held * pos[sym]["avg"]) + cost) / (held + qty) if held else price
        pos[sym] = {"qty": held + qty, "avg": round(avg, 4)}
        cash = round(cash - cost, 2)
    else:
        if qty > held:
            raise WarError("FAILED_PRECONDITION", "You hold %d share%s of %s." % (held, "" if held == 1 else "s", sym))
        pnl = round(qty * (price - pos[sym]["avg"]), 2)
        cash = round(cash + qty * price, 2)
        if qty == held:
            pos.pop(sym)
        else:
            pos[sym] = {"qty": held - qty, "avg": pos[sym]["avg"]}
    out = dict(profile, positions=pos, cash=cash, trades=profile.get("trades", 0) + 1, updatedAt=now_ms)
    marks = dict(prices, **{sym: price})
    out["equity"] = equity(out, marks)
    out["pnl"] = round(out["equity"] - profile["start"], 2)
    out["pnlPct"] = round(out["pnl"] / profile["start"] * 100, 2)
    out["chart"] = (list(profile.get("chart") or []) + [{"t": now_ms, "eq": out["equity"]}])[-CHART_KEPT:]
    fill = {"sym": sym, "side": side, "qty": qty, "price": price, "pnl": pnl, "at": now_ms}
    return out, fill
