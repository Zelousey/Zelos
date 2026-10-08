"""Unit tests for functions/mdata.py (Marketstack + SEC shaping). python3 scripts/marketstack_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import mdata as MD
from datetime import datetime

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

# timestamps: Marketstack's +0000 offsets, bare dates, Z
ok(MD.parse_ts("2026-10-02T13:30:00+0000").astimezone(MD.NY).strftime("%H:%M") == "09:30", "parse +0000 -> 9:30 New York")
ok(MD.parse_ts("2026-10-02").year == 2026 and MD.parse_ts("2026-10-02T13:30:00Z") is not None and MD.parse_ts("junk") is None, "parse bare date, Z, junk")
# intraday: NY labels, session only, last price wins over close, high/low cover open/close
rows = [{"symbol": "AAPL", "date": "2026-10-02T13:30:00+0000", "open": 10, "high": 11, "low": 9, "close": 10.5, "last": 10.6, "volume": 5},
        {"symbol": "AAPL", "date": "2026-10-02T13:15:00+0000", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1},   # 9:15, pre-market
        {"symbol": "AAPL", "date": "2026-10-02T13:45:00+0000", "open": 10.6, "high": 10.7, "low": 10.2, "close": 10.4, "last": None, "volume": 7}]
b = MD.ms_intraday_bars(rows)["AAPL"]
ok(b == ["2026-10-02 09:30,10.0,11.0,9.0,10.6,5", "2026-10-02 09:45,10.6,10.7,10.2,10.4,7"], "intraday bars: " + str(b))
q = MD.ms_quote(b, 10.0, 15)
ok(q["o"] == 10.0 and q["h"] == 11.0 and q["l"] == 9.0 and q["c"] == 10.4 and q["v"] == 12 and q["chPct"] == 4.0, "quote from today's bars")
ok(datetime.fromtimestamp(q["t"], MD.NY).strftime("%H:%M") == "10:00", "quote time = end of the last bar")
ok(MD.ms_quote([], 10, 15) is None, "no bars -> no quote")
# daily: adjusted when present
d = MD.ms_daily_bars([{"symbol": "X", "date": "2026-10-01T00:00:00+0000", "open": 100, "high": 110, "low": 90, "close": 105, "volume": 9,
                        "adj_open": 50, "adj_high": 55, "adj_low": 45, "adj_close": 52.5, "adj_volume": 18},
                       {"symbol": "X", "date": "2026-09-30T00:00:00+0000", "open": 100, "high": 110, "low": 90, "close": 101, "volume": 9}])["X"]
ok(d == ["2026-09-30,100.0,110.0,90.0,101.0,9", "2026-10-01,50.0,55.0,45.0,52.5,18"], "daily bars, split-adjusted: " + str(d))
ok(MD.prev_close(d, "2026-10-01") == 101.0 and MD.prev_close(d, "2026-10-02") == 52.5, "previous close")
ok(MD.merge_series(["2026-09-30,1,1,1,1,0"], d, 5)[0].endswith(",9") and len(MD.merge_series(d, d, 1)) == 1, "merge: fresh wins, keep newest")
mi = MD.merge_intraday(["2026-09-2%d 09:30,1,1,1,1,1" % i for i in range(3, 10)], ["2026-10-01 09:30,2,2,2,2,2"], 5)
ok(len({r[:10] for r in mi}) == 5 and mi[-1].startswith("2026-10-01"), "intraday keeps 5 sessions")
# movers
mv = MD.ms_movers({"A": {"c": 10, "v": 100, "chPct": 3}, "B": {"c": 20, "v": 1000, "chPct": -2}, "SPY": {"c": 500, "v": 9e9, "chPct": 1}, "C": {"c": 5, "v": 1, "chPct": None}},
                  {"A": "Aco", "B": "Bco"}, {"A": "Tech", "B": "Tech", "SPY": "ETF"})
ok([r["sym"] for r in mv["gainers"]] == ["A"] and [r["sym"] for r in mv["losers"]] == ["B"] and mv["actives"][0]["sym"] == "B", "movers skip ETFs and missing changes")
ok(mv["sectors"] == [{"sector": "Tech", "chPct": 0.5}], "sector average")
# snapshot + globe
daily = {s: ["2026-09-%02d,1,1,1,%d,1" % (i, 100 + i) for i in range(1, 30)] for s in MD.SNAP_SYMBOLS}
sn = MD.build_snapshot(daily, datetime(2026, 10, 2, 17, 0, tzinfo=MD.NY))
ok(sn["items"]["SPY"]["label"] == "S&P 500 (SPY)" and sn["items"]["SPY"]["pct"] == round(1 / 128 * 100, 2) and len(sn["spark"]["SPY"]["points"]) == 23, "snapshot items + spark")
countries = {"CAN": {"name": "Canada", "etf": "EWC", "local": [("Shopify", "SHOP"), ("Private Co", None)], "us": [("WMT", "competes")]}}
g = MD.build_globe(countries, MD.moves_from_daily({"EWC": ["2026-10-01,1,1,1,100,1", "2026-10-02,1,1,1,102,1"], "SHOP": ["2026-10-01,1,1,1,50,1", "2026-10-02,1,1,1,49,1"]}))
c = g["countries"]["CAN"]
ok(c["chg"] == 2.0 and c["trending"]["sym"] == "SHOP" and c["local"][1]["listed"] is False and c["us"][0]["chg"] is None and g["asOf"] == "2026-10-02", "globe country")
ok(MD.globe_symbols(countries) == ["EWC", "SHOP", "WMT"], "globe symbols")
# SEC
facts = {"facts": {"us-gaap": {"Revenues": {"units": {"USD": [{"val": 5, "end": "2023-12-31", "filed": "2024-02-01", "fp": "FY", "form": "10-K"},
                                                             {"val": 7, "end": "2024-12-31", "filed": "2025-02-01", "fp": "FY", "form": "10-K"},
                                                             {"val": 99, "end": "2025-03-31", "filed": "2025-05-01", "fp": "Q1", "form": "10-Q"}]}}}}}
ok(MD.sec_latest_fact(facts, ["Revenues"], "USD") == (7, "2024"), "latest full-year 10-K value, quarters ignored")
ok(MD.sec_cik_map({"0": {"cik_str": 1, "ticker": "brk.b"}}) == {"BRK-B": 1}, "ticker map")
x = MD.sec_form4("<rptOwnerName>Jane Doe</rptOwnerName><isDirector>1</isDirector><nonDerivativeTransaction><transactionDate><value>2026-01-02</value></transactionDate>"
                 "<transactionCode>P</transactionCode><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>9.5</value></transactionPricePerShare>"
                 "</nonDerivativeTransaction><nonDerivativeTransaction><transactionCode>M</transactionCode></nonDerivativeTransaction>")
ok(x == [{"date": "2026-01-02", "who": "Jane Doe", "role": "Director", "buy": True, "shares": 100.0, "price": 9.5}], "form 4: open-market buy only")
doc = MD.sec_research("Z", {"name": "Zed", "sicDescription": "Software"}, facts, x, ["2026-10-01,1,1,1,10,1"], 10)
ok(doc["source"] == "SEC EDGAR" and doc["financials"]["revenue"] == 7 and doc["insiders"] and not any(k in doc for k in ("news", "target", "grades", "earnings")), "research doc fields")
# settings
os.environ["QUOTE_EVERY_MIN"] = "1"; os.environ["MS_INTERVAL"] = "bogus"
ok(MD.quote_every_min() == 1 and MD.ms_interval() == "15min" and MD.interval_minutes("15min") == 15, "settings")

# bad provider bars: a $0 low/close is never stored, and merging cleans ones already stored
bad = {"symbol": "PLTR", "date": "2026-06-04T00:00:00+0000", "open": 145.63, "high": 146.37, "low": 0, "close": 0, "volume": 40483209}
good = {"symbol": "PLTR", "date": "2026-06-05T00:00:00+0000", "open": 146, "high": 147, "low": 145, "close": 146.5, "volume": 1}
ok(MD.ms_daily_bars([bad, good])["PLTR"] == ["2026-06-05,146.0,147.0,145.0,146.5,1"], "daily: $0 bar dropped")
ok(MD.ms_daily_bars([dict(good, adj_open=0, adj_high=0, adj_low=0, adj_close=0)])["PLTR"] == ["2026-06-05,146.0,147.0,145.0,146.5,1"], "daily: bad adjusted values fall back to raw")
ok(MD.ms_intraday_bars([{"symbol": "A", "date": "2026-10-02T13:30:00+0000", "open": 1, "high": 1, "low": 0, "close": 1, "volume": 1}]) == {}, "intraday: $0 bar dropped")
ok(MD.merge_series(["2026-06-04,145.63,146.37,0.0,0.0,40483209", "2026-06-03,1,2,1,1.5,9"], ["2026-06-05,1,2,1,1.5,9"], 10) == ["2026-06-03,1,2,1,1.5,9", "2026-06-05,1,2,1,1.5,9"], "merge cleans stored $0 bars")
ok(MD.valid_bar("2026-06-03,1,2,1,1.5,9") and not MD.valid_bar("x,1,2") and not MD.valid_bar("d,1,2,-1,1,1"), "valid_bar")

# chunked requests: small groups, one retry on a timeout, a failing group doesn't stop the rest
calls = []
real_get = MD.ms_get
def fake_get(path, params, key, timeout=20):
    syms = params["symbols"].split(",")
    calls.append((syms, timeout))
    if "SLOW" in syms and sum(1 for c in calls if "SLOW" in c[0]) == 1:
        raise TimeoutError("read timed out")       # first try times out, retry works
    if "DEAD" in syms:
        raise TimeoutError("read timed out")
    return {"data": [{"symbol": s} for s in syms], "pagination": {"total": len(syms)}}
MD.ms_get = fake_get
try:
    rows, failed = MD.ms_rows_chunked("intraday", {"interval": "15min"}, ["A", "B", "SLOW", "C", "DEAD", "E"], "k", size=2, timeout=33)
    ok(sorted(r["symbol"] for r in rows) == ["A", "B", "C", "SLOW"] and failed == ["DEAD", "E"], "chunked: retry once, skip a dead group: %s %s" % (rows, failed))
    ok(all(len(c[0]) <= 2 and c[1] == 33 for c in calls), "chunked: group size and timeout passed through")
    try:
        MD.ms_rows_chunked("intraday", {}, ["DEAD"], "k", size=2)
        ok(False, "all groups failing raises")
    except TimeoutError:
        ok(True, "all groups failing raises the error")
    def quota(*a, **k):
        raise MD.MsQuota()
    MD.ms_get = quota
    try:
        MD.ms_rows_chunked("intraday", {}, ["A", "B", "C"], "k", size=1)
        ok(False, "quota stops everything")
    except MD.MsQuota:
        ok(True, "quota error stops everything")
    t = iter([0, 0, 500, 500, 500])
    MD.ms_get = fake_get
    rows, failed = MD.ms_rows_chunked("intraday", {}, ["A", "B", "C"], "k", size=1, budget=200, clock=lambda: next(t))
    ok([r["symbol"] for r in rows] == ["A"] and failed == ["B", "C"], "time budget stops new groups: %s" % failed)
finally:
    MD.ms_get = real_get

print("ALL CHECKS PASSED" if not fails else "%d FAILED" % fails)
sys.exit(1 if fails else 0)
