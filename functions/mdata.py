"""Market data the site is allowed to show: Marketstack (prices) + SEC EDGAR (company facts).

Why this exists: the earlier sources (FMP and Finnhub personal plans, Yahoo's chart feed,
Robinhood exports) are licensed for personal use only, so none of them may be shown on a
public website. Marketstack's paid plans include commercial use; SEC EDGAR data is public.

Everything here runs on the server. Browsers only read the saved Firestore docs, so the
number of Marketstack requests doesn't grow with the number of visitors.

Settings (functions/.env, not secrets):
  QUOTE_EVERY_MIN=15   minutes between price updates (Basic plan: 15; Professional: 1)
  MS_INTERVAL=15min    intraday bar size (Basic plan allows 15min and longer)
Secrets (firebase functions:secrets:set NAME):
  MARKETSTACK_API_KEY  the Marketstack access key
  SEC_CONTACT          an email the SEC can reach you at (their required User-Agent); a secret so it stays out of the public repo

Docs written (all public, read-only to browsers):
  markets/quotes            {source, updatedAt, date, marketOpen, every, quotes:{SYM:{c,o,h,l,pc,t,v,chPct}}}
  markets/intraday_<SYM>    {interval:"15m", bars:["YYYY-MM-DD HH:MM,o,h,l,c,v", ...]} last 5 sessions
  markets/dailyBars         {bars:{SYM:["YYYY-MM-DD,o,h,l,c,v", ...]}} last 90 sessions
  markets/history_<n>       {json: '{"SYM":[["YYYY-MM-DD",o,h,l,c,v],...]}'} ~2 years, 15 symbols per doc
  markets/historyIndex      {parts:n, symbols:[...], updatedAt}
  markets/movers            gainers / losers / actives / sectors, from the Zelos stock list
  markets/snapshot          {json:'...'} ticker tape + market overview (same shape as the old file)
  markets/globe             {json:'...'} country map (same shape publish_market_map stores)
  markets/research_<SYM>    SEC profile, financials and insider trades + 60 daily bars
"""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
MS_BASE = (os.environ.get("MARKETSTACK_BASE_URL") or "https://api.marketstack.com/v2").rstrip("/")  # override only for local tests
SEC_BASE = (os.environ.get("SEC_BASE_URL") or "https://data.sec.gov").rstrip("/")
SEC_WWW = (os.environ.get("SEC_WWW_URL") or "https://www.sec.gov").rstrip("/")
SESSION_OPEN, SESSION_CLOSE = 9 * 60 + 30, 16 * 60
INTRADAY_SESSIONS_KEEP = 5
DAILY_BARS_KEEP = 90
HISTORY_DAYS = 760          # ~2 years of trading days, fetched once then extended daily
HISTORY_PER_DOC = 15        # ~15 symbols x 760 sessions keeps each history doc near 0.5 MB (limit 1 MB)
_SYM_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")


def quote_every_min():
    try:
        return max(1, min(60, int(os.environ.get("QUOTE_EVERY_MIN", "15"))))
    except ValueError:
        return 15


def ms_interval():
    v = (os.environ.get("MS_INTERVAL") or "15min").strip()
    return v if v in ("1min", "5min", "10min", "15min", "30min", "1hour") else "15min"


def interval_minutes(iv):
    return {"1min": 1, "5min": 5, "10min": 10, "15min": 15, "30min": 30, "1hour": 60}.get(iv, 15)


# ---------------------------------------------------------------- small helpers
def _num(v, nd=None):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x or x in (float("inf"), float("-inf")):
        return None
    return round(x, nd) if nd is not None else x


def _rows(data):
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


def _txt(v, n):
    return str(v or "").strip()[:n]


def parse_ts(s):
    """Marketstack dates: '2026-10-02T13:30:00+0000' (or a bare date). -> aware datetime (UTC) or None."""
    s = str(s or "").strip()
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    m = re.match(r"^(.*[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)([+-])(\d{2}):?(\d{2})$", s)
    if m:
        s = "%s%s%s:%s" % m.groups()
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        try:
            d = datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def chunks(seq, n):
    seq = list(seq)
    return [seq[i:i + n] for i in range(0, len(seq), n)]


# ---------------------------------------------------------------- Marketstack client
class MsKeyRejected(Exception):
    """The API key is missing, wrong or the account is inactive."""


class MsQuota(Exception):
    """The plan's monthly request allowance is used up."""


def ms_get(path, params, api_key, timeout=20):
    """One GET. Returns parsed JSON, or None when the plan doesn't include that endpoint.
    The URL holds the key, so it is never printed."""
    q = dict(params or {})
    q["access_key"] = api_key
    req = urllib.request.Request(MS_BASE + "/" + path.lstrip("/") + "?" + urllib.parse.urlencode(q),
                                 headers={"User-Agent": "agentictrading-data/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read().decode("utf-8"))
        except Exception:
            data = None
        if not (isinstance(data, dict) and isinstance(data.get("error"), dict)):
            if e.code == 401:
                raise MsKeyRejected()
            if e.code == 429:
                raise MsQuota()
            raise
    if isinstance(data, dict) and isinstance(data.get("error"), dict):
        code = str(data["error"].get("code") or "")
        if code in ("invalid_access_key", "missing_access_key", "inactive_user"):
            raise MsKeyRejected()
        if code in ("usage_limit_reached", "rate_limit_reached"):
            raise MsQuota()
        if code in ("function_access_restricted", "https_access_restricted"):
            return None
        raise RuntimeError("marketstack " + code)
    return data


def ms_rows(path, params, api_key, max_pages=12):
    """All rows of a paginated endpoint (1,000 per page)."""
    out, offset = [], 0
    for _ in range(max_pages):
        d = ms_get(path, dict(params, limit=1000, offset=offset), api_key)
        if not isinstance(d, dict):
            break
        rows = _rows(d.get("data"))
        out.extend(rows)
        total = int(_num((d.get("pagination") or {}).get("total")) or 0)
        offset += len(rows)
        if not rows or offset >= total:
            break
    return out


# ---------------------------------------------------------------- pure shaping (scripts/marketstack_test.py)
def ms_intraday_bars(rows, session_only=True):
    """Intraday rows -> {SYM: ["YYYY-MM-DD HH:MM,o,h,l,c,v", ...]} ascending, New York time, bar start."""
    out = {}
    for r in _rows(rows):
        sym = _txt(r.get("symbol"), 12).upper()
        d = parse_ts(r.get("date"))
        o, h, l = _num(r.get("open"), 4), _num(r.get("high"), 4), _num(r.get("low"), 4)
        c = _num(r.get("last"), 4) or _num(r.get("close"), 4)
        if not sym or not d or None in (o, h, l, c):
            continue
        nd = d.astimezone(NY)
        mins = nd.hour * 60 + nd.minute
        if session_only and (mins < SESSION_OPEN or mins >= SESSION_CLOSE):
            continue
        label = nd.strftime("%Y-%m-%d %H:%M")
        v = int(_num(r.get("volume")) or 0)
        out.setdefault(sym, {})[label] = "%s,%s,%s,%s,%s,%s" % (label, o, max(h, o, c), min(l, o, c), c, v)
    return {s: [b[k] for k in sorted(b)] for s, b in out.items()}


def ms_daily_bars(rows):
    """EOD rows -> {SYM: ["YYYY-MM-DD,o,h,l,c,v", ...]} ascending; split-adjusted when Marketstack gives it."""
    out = {}
    for r in _rows(rows):
        sym = _txt(r.get("symbol"), 12).upper()
        d = _txt(r.get("date"), 10)
        adj = [_num(r.get(k), 4) for k in ("adj_open", "adj_high", "adj_low", "adj_close")]
        raw = [_num(r.get(k), 4) for k in ("open", "high", "low", "close")]
        o, h, l, c = adj if None not in adj else raw
        if not sym or len(d) != 10 or None in (o, h, l, c):
            continue
        v = int(_num(r.get("adj_volume") if r.get("adj_volume") is not None else r.get("volume")) or 0)
        out.setdefault(sym, {})[d] = "%s,%s,%s,%s,%s,%s" % (d, o, max(h, o, c), min(l, o, c), c, v)
    return {s: [b[k] for k in sorted(b)] for s, b in out.items()}


def merge_series(existing, fresh, keep, key_len=10):
    """Merge bar strings by their date/time label (fresh wins), keep the newest `keep`."""
    by = {str(r)[:key_len]: str(r) for r in existing or []}
    for r in fresh or []:
        by[str(r)[:key_len]] = str(r)
    return [by[k] for k in sorted(by)][-keep:]


def merge_intraday(existing, fresh, keep_sessions=INTRADAY_SESSIONS_KEEP):
    rows = merge_series(existing, fresh, 10 ** 6, key_len=16)
    days = sorted({r[:10] for r in rows})[-keep_sessions:]
    return [r for r in rows if r[:10] in days]


def prev_close(daily_rows, today):
    for r in reversed(daily_rows or []):
        p = str(r).split(",")
        if p[0] < today and len(p) >= 5:
            return _num(p[4], 4)
    return None


def ms_quote(today_bars, pc, bar_minutes):
    """Today's intraday bars for one symbol -> the c/o/h/l/pc/t/v quote the pages use."""
    if not today_bars:
        return None
    parts = [str(b).split(",") for b in today_bars]
    o = float(parts[0][1]); c = float(parts[-1][4])
    h = max(float(p[2]) for p in parts); l = min(float(p[3]) for p in parts)
    v = sum(int(float(p[5])) for p in parts if len(p) > 5)
    last = datetime.strptime(parts[-1][0], "%Y-%m-%d %H:%M").replace(tzinfo=NY)
    t = int((last + timedelta(minutes=bar_minutes)).timestamp())
    q = {"c": c, "o": o, "h": h, "l": l, "pc": pc, "t": t, "v": v}
    if pc:
        q["chPct"] = round((c / pc - 1) * 100, 2)
    return q


def ms_movers(quotes, names, groups, n=8, skip_groups=("ETF", "ETFs", "Index", "Funds")):
    """Movers among the Zelos stock list (not the whole market), plus a sector average."""
    rows = []
    for s, q in (quotes or {}).items():
        if not q or q.get("chPct") is None or groups.get(s) in skip_groups:
            continue
        rows.append({"sym": s, "name": names.get(s, s), "price": q.get("c"), "chPct": q.get("chPct"), "dollarVol": (q.get("v") or 0) * (q.get("c") or 0)})
    def strip(r):
        return {k: r[k] for k in ("sym", "name", "price", "chPct")}
    gain = sorted([r for r in rows if r["chPct"] > 0], key=lambda r: -r["chPct"])[:n]
    lose = sorted([r for r in rows if r["chPct"] < 0], key=lambda r: r["chPct"])[:n]
    act = sorted(rows, key=lambda r: -r["dollarVol"])[:n]
    acc = {}
    for r in rows:
        g = groups.get(r["sym"])
        if g:
            a = acc.setdefault(g, [0.0, 0]); a[0] += r["chPct"]; a[1] += 1
    sectors = sorted([{"sector": k, "chPct": round(v[0] / v[1], 2)} for k, v in acc.items()], key=lambda x: -x["chPct"])
    return {"gainers": [strip(r) for r in gain], "losers": [strip(r) for r in lose], "actives": [strip(r) for r in act],
            "sectors": sectors, "scope": "Zelos stock list"}


def history_rows(daily):
    """'YYYY-MM-DD,o,h,l,c,v' strings -> [["YYYY-MM-DD",o,h,l,c,v], ...] (the old data-file shape)."""
    out = []
    for r in daily or []:
        p = str(r).split(",")
        if len(p) < 5:
            continue
        out.append([p[0], float(p[1]), float(p[2]), float(p[3]), float(p[4]), int(float(p[5])) if len(p) > 5 else 0])
    return out


def moves_from_daily(daily):
    """{SYM: daily strings} -> {SYM: {chg, m1, close, date}} for the globe and the snapshot."""
    out = {}
    for s, rows in (daily or {}).items():
        h = history_rows(rows)
        if len(h) < 2:
            continue
        last, prev = h[-1], h[-2]
        m1 = h[-22] if len(h) >= 22 else h[0]
        out[s] = {"chg": round((last[4] / prev[4] - 1) * 100, 2), "m1": round((last[4] / m1[4] - 1) * 100, 1),
                  "close": last[4], "prev": prev[4], "date": last[0]}
    return out


# The ticker tape / market overview. Indexes are shown through the ETFs that track them
# (index values themselves need an index-data license).
SNAP_LABELS = {"SPY": "S&P 500 (SPY)", "QQQ": "Nasdaq 100 (QQQ)", "DIA": "Dow (DIA)", "AAPL": "AAPL", "NVDA": "NVDA", "TSLA": "TSLA",
               "XLK": "Technology", "XLC": "Communication", "XLY": "Consumer Disc.", "XLV": "Healthcare", "XLF": "Financials", "XLE": "Energy"}
SNAP_TAPE = ["SPY", "QQQ", "DIA", "AAPL", "NVDA", "TSLA", "XLK", "XLE"]
SNAP_INDICES = ["SPY", "QQQ", "DIA"]
SNAP_SECTORS = ["XLK", "XLC", "XLY", "XLV", "XLF", "XLE"]
SNAP_SYMBOLS = sorted(set(SNAP_TAPE + SNAP_INDICES + SNAP_SECTORS))


def build_snapshot(daily, now):
    moves = moves_from_daily(daily)
    items = {}
    for s in SNAP_SYMBOLS:
        m = moves.get(s)
        if not m:
            continue
        chg = m["close"] - m["prev"]
        items[s] = {"sym": s, "label": SNAP_LABELS.get(s, s), "kind": "etf" if s in SNAP_INDICES + SNAP_SECTORS else "equity",
                    "price": round(m["close"], 4), "prev": round(m["prev"], 4), "chg": round(chg, 4),
                    "pct": round(chg / m["prev"] * 100, 2) if m["prev"] else None, "asOf": m["date"] + "T20:00:00Z"}
    spark = {}
    for s in SNAP_INDICES:
        h = history_rows(daily.get(s))[-23:]
        if h:
            spark[s] = {"label": SNAP_LABELS[s], "points": [{"d": r[0], "c": r[4]} for r in h]}
    return {"generatedAt": now.isoformat(), "source": "Marketstack end-of-day prices (indexes shown through the ETFs that track them)", "sourceShort": "Marketstack",
            "items": items, "groups": {"tape": [s for s in SNAP_TAPE if s in items], "indices": [s for s in SNAP_INDICES if s in items],
                                       "sectors": [s for s in SNAP_SECTORS if s in items]}, "spark": spark}


def build_globe(countries, moves):
    """Same output as scripts/build_market_map.py (no headlines: news isn't licensed)."""
    dates = sorted({v.get("date") for v in moves.values() if v.get("date")})
    out = {}
    for iso, c in countries.items():
        etf = moves.get(c["etf"]) if c.get("etf") else None
        local = [{"name": n, "sym": s, "chg": moves[s]["chg"] if s and s in moves else None, "listed": bool(s)} for n, s in c["local"]]
        us = [{"sym": s, "why": why, "chg": moves[s]["chg"] if s in moves else None} for s, why in c["us"]]
        movers = [x for x in local if x["chg"] is not None]
        trending = dict(max(movers, key=lambda x: abs(x["chg"]))) if movers else None
        out[iso] = {"name": c["name"], "etf": c["etf"], "etfLabel": c.get("etf_label", c["etf"] or ""),
                    "chg": etf["chg"] if etf else None, "m1": etf.get("m1") if etf else None,
                    "trending": trending, "local": local, "us": us}
    return {"asOf": dates[-1] if dates else None, "source": "Marketstack end-of-day prices of US-listed shares",
            "note": "Country moves use each country's US-listed ETF, in US dollars. Links are business relationships, not recommendations.",
            "countries": out}


def globe_symbols(countries):
    s = set()
    for c in countries.values():
        if c.get("etf"):
            s.add(c["etf"])
        s.update(x for _, x in c["local"] if x)
        s.update(x for x, _ in c["us"])
    return sorted(x for x in s if _SYM_RE.match(x))


# ---------------------------------------------------------------- SEC EDGAR (public company data)
def sec_headers():
    contact = (os.environ.get("SEC_CONTACT") or "").strip()
    return {"User-Agent": ("AgenticTrading.info " + contact).strip(), "Accept-Encoding": "identity"}


def sec_get(url, timeout=20, raw=False):
    req = urllib.request.Request(url, headers=sec_headers())
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", "replace")
    return body if raw else json.loads(body)


def sec_cik_map(tickers_json):
    """company_tickers.json -> {TICKER: cik int}"""
    out = {}
    for v in (tickers_json or {}).values():
        t = _txt(v.get("ticker"), 12).upper().replace(".", "-")
        if t and v.get("cik_str") is not None:
            out[t] = int(v["cik_str"])
    return out


def sec_latest_fact(facts, names, unit):
    """Most recent full fiscal-year (10-K, FY) value among the given us-gaap concepts."""
    best = None
    gaap = ((facts or {}).get("facts") or {}).get("us-gaap") or {}
    for n in names:
        for row in ((gaap.get(n) or {}).get("units") or {}).get(unit) or []:
            if row.get("fp") != "FY" or not str(row.get("form") or "").startswith("10-K"):
                continue
            key = (str(row.get("end") or ""), str(row.get("filed") or ""))
            if best is None or key > best[0]:
                best = (key, row)
    if not best:
        return None, None
    return _num(best[1].get("val")), str(best[1].get("end") or "")[:4]


def sec_form4(xml_text):
    """One Form 4 XML -> open-market buys (P) and sells (S) as [{date, who, role, buy, shares, price}]."""
    def tag(block, name):
        m = re.search(r"<%s>\s*(?:<value>)?\s*([^<]*?)\s*(?:</value>)?\s*</%s>" % (name, name), block, re.S)
        return m.group(1).strip() if m else ""
    who = tag(xml_text, "rptOwnerName")
    role = "Director" if tag(xml_text, "isDirector") in ("1", "true") else (tag(xml_text, "officerTitle") or ("10% owner" if tag(xml_text, "isTenPercentOwner") in ("1", "true") else ""))
    out = []
    for blk in re.findall(r"<nonDerivativeTransaction>(.*?)</nonDerivativeTransaction>", xml_text, re.S):
        code = tag(blk, "transactionCode")
        if code not in ("P", "S"):
            continue  # grants, gifts, option exercises are not open-market trades
        out.append({"date": tag(blk, "transactionDate")[:10], "who": who[:50], "role": role[:50], "buy": code == "P",
                    "shares": _num(tag(blk, "transactionShares"), 0), "price": _num(tag(blk, "transactionPricePerShare"), 2)})
    return out


def sec_research(sym, sub, facts, insiders, bars, price=None):
    """SEC pieces (+ our own daily bars) -> the public markets/research_<SYM> doc."""
    doc = {"symbol": sym, "name": _txt((sub or {}).get("name"), 80) or sym, "source": "SEC EDGAR", "priceSource": "Marketstack"}
    if sub:
        ex = (sub.get("exchanges") or [""])[0] if isinstance(sub.get("exchanges"), list) else ""
        site = _txt(sub.get("website"), 120)
        doc["profile"] = {"industry": _txt(sub.get("sicDescription"), 60), "exchange": _txt(ex, 20),
                          "website": site if site.startswith("https://") else "", "fiscalYearEnd": _txt(sub.get("fiscalYearEnd"), 4),
                          "state": _txt(sub.get("stateOfIncorporation"), 4), "price": price}
    rev, ry = sec_latest_fact(facts, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], "USD")
    ni, ny_ = sec_latest_fact(facts, ["NetIncomeLoss"], "USD")
    eps, ey = sec_latest_fact(facts, ["EarningsPerShareDiluted", "EarningsPerShareBasic"], "USD/shares")
    gp, _ = sec_latest_fact(facts, ["GrossProfit"], "USD")
    if rev is not None or ni is not None:
        doc["financials"] = {"year": ry or ny_ or ey or "", "revenue": rev, "grossProfit": gp, "netIncome": ni, "eps": _num(eps, 2)}
    m = {}
    if price and eps and eps > 0:
        m["pe"] = round(price / eps, 1)
    if rev and ni is not None and rev > 0:
        m["margin"] = round(ni / rev, 4)
    if m:
        doc["metrics"] = m
    ins = sorted(insiders or [], key=lambda r: r.get("date") or "", reverse=True)[:6]
    if ins:
        doc["insiders"] = ins
    if bars:
        doc["bars"] = list(bars)[-60:]
    return doc
