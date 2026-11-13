"""A whole market day of live prices, before turning them back on (owner 2026-11-12: "make sure
that for the next month the calls are actually being done right").

Runs the real scheduled refresh_quotes every minute from 9:00 to 16:59 New York time against the
Firestore emulator, with Marketstack's HTTP answers faked underneath the real ms_get. That way every
request is counted the way Marketstack bills it (one call per symbol in a request, one more per
extra page), and the hard stops are the real ones. Checks:
- the day-trading stocks are asked every minute and the long-term ones every 15 minutes;
- after the first run each request asks only for new bars, so it stays one page;
- the whole day costs what the plan allows (about 3,700 calls), under the 4,300 daily stop;
- the count kept in serverMeta/msUsage matches the calls actually made;
- a 21-market-day billing cycle stays under the 95,000 live cap;
- with the daily stop reached, no call is made and the app is told prices are paused.
Started by run-functions-e2e.sh inside `firebase emulators:exec`."""
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
os.environ["MARKETSTACK_API_KEY"] = "test-key"
os.environ["QUOTE_EVERY_MIN"] = "1"
os.environ["MS_STEADY_EVERY_MIN"] = "15"
os.environ["MS_INTERVAL"] = "1min"
os.environ["MS_CYCLE_SEED"] = ""
os.environ.setdefault("MS_DAILY_CALLS", "4300")
os.environ.setdefault("MS_LIVE_CAP", "95000")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402

MD = main.MD
NY = main.NY
db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


DAY = datetime(2026, 11, 16, tzinfo=NY)  # a Monday in the November cycle
NOW = [DAY]
requests = []  # (symbols, date_from, offset)


class SimTime(datetime):
    @classmethod
    def now(cls, tz=None):
        t = NOW[0]
        return t.astimezone(tz) if tz else t.replace(tzinfo=None)


def fake_open(req, timeout=20):
    q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(req.full_url).query))
    syms = q["symbols"].split(",")
    frm = q["date_from"]
    off, lim = int(q.get("offset", 0)), int(q.get("limit", 1000))
    requests.append((tuple(syms), frm, off))
    start = datetime.strptime(frm, "%Y-%m-%dT%H:%M:%S+0000").replace(tzinfo=timezone.utc) if "T" in frm else DAY
    open_at = DAY.replace(hour=9, minute=30)
    rows = []
    for s in syms:
        k = main.PRACTICE_SYMBOLS.index(s)
        t = open_at
        while t < NOW[0] and t < DAY.replace(hour=16):
            if t >= start:
                m = int((t - open_at).total_seconds() // 60)
                p = 100 + k + m * 0.01
                rows.append({"symbol": s, "date": t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000"),
                             "open": p, "high": p + 0.05, "low": p - 0.05, "close": p + 0.01, "volume": 100 + m})
            t += timedelta(minutes=1)
    page = rows[off:off + lim]
    return io.BytesIO(json.dumps({"data": page, "pagination": {"total": len(rows), "offset": off, "limit": lim, "count": len(page)}}).encode())


urllib.request.urlopen = fake_open
main.datetime = SimTime
run = main.refresh_quotes.__wrapped__
FAST, STEADY = main.FAST_SYMBOLS, main.STEADY_SYMBOLS
print("  %d stocks: %d day-trading (every minute), %d long-term (every 15 minutes)" % (len(main.PRACTICE_SYMBOLS), len(FAST), len(STEADY)))
for d in ("msQuotes", "msUsage"):
    db.collection("serverMeta").document(d).delete()
db.collection("markets").document("quotes").set({"quotes": {s: {"c": 100.0, "pc": 99.0} for s in main.PRACTICE_SYMBOLS}})

MD.CALLS[0] = 0
per_minute = {}
t = DAY.replace(hour=9, minute=0)
while t <= DAY.replace(hour=16, minute=59):
    NOW[0] = t
    before = MD.CALLS[0]
    run(None)
    per_minute[t.strftime("%H:%M")] = MD.CALLS[0] - before
    t += timedelta(minutes=1)
total = MD.CALLS[0]

odd = {m: n for m, n in per_minute.items() if n and (m < "09:31" or ("16:01" < m and m != "16:06"))}
print("  calls by minute (first and last): %s ... %s" % ({m: n for m, n in per_minute.items() if n and m < "09:50"}, {m: n for m, n in per_minute.items() if n and m > "15:40"}))
ok(not odd, "no calls before the open or after the close, apart from 16:01 (the last bar) and 16:06 (closing prices): %s" % odd)
asked_fast = [r for r in requests if set(r[0]) <= set(FAST)]
asked_steady = {s for r in requests for s in r[0] if s in STEADY}
ok(per_minute["09:32"] == len(FAST) and per_minute["09:33"] == len(FAST), "a normal minute costs one call per day-trading stock (%d)" % len(FAST))
ok(per_minute["09:46"] == len(FAST) + len(STEADY), "every 15 minutes the long-term stocks join (%d calls)" % per_minute["09:46"])
ok(asked_steady == set(STEADY), "every long-term stock is updated")
ok(all(off == 0 for _, _, off in requests), "every request is one page (only new bars are asked for)")
ok(all("T" in frm for syms, frm, _ in requests[3:]), "after the first runs, requests ask only for bars since the last one stored")
expect = 390 * len(FAST) + 26 * len(STEADY) + len(main.PRACTICE_SYMBOLS)
print("  a market day: %d calls (plan math: about %d)" % (total, expect))
ok(abs(total - expect) <= 60, "the day costs what the plan math says (%d vs %d)" % (total, expect))
ok(total < int(os.environ["MS_DAILY_CALLS"]), "under the daily stop of %s" % os.environ["MS_DAILY_CALLS"])
usage = db.collection("serverMeta").document("msUsage").get().to_dict() or {}
ok(int(usage.get("calls") or 0) == total and int(usage.get("cycleCalls") or 0) == total and usage.get("cycle") == "2026-11",
   "serverMeta/msUsage counted exactly the calls made (%s)" % usage.get("calls"))
q = db.collection("markets").document("quotes").get().to_dict()
ok(q["quotes"]["AAPL"]["c"] > 100 and q["quotes"][STEADY[0]]["c"] > 100 and not q.get("paused"), "prices moved for both kinds of stock")
cycle_days = 21
ok(total * cycle_days + 250 * cycle_days < int(os.environ["MS_LIVE_CAP"]),
   "a %d-market-day billing cycle: about %d live + %d daily-close calls, under the 95,000 stop" % (cycle_days, total * cycle_days, 250 * cycle_days))

def whole_day(day):
    """Calls made by every run of one day (from a fresh day's state)."""
    db.collection("serverMeta").document("msQuotes").delete()
    db.collection("serverMeta").document("msUsage").delete()
    c0, t = MD.CALLS[0], day.replace(hour=9, minute=0)
    last = None
    while t <= day.replace(hour=16, minute=59):
        NOW[0] = t
        b = MD.CALLS[0]
        run(None)
        if MD.CALLS[0] > b:
            last = t.strftime("%H:%M")
        t += timedelta(minutes=1)
    return MD.CALLS[0] - c0, last


global_day = DAY
DAY = datetime(2026, 11, 26, tzinfo=NY)  # Thanksgiving
n, _ = whole_day(DAY)
ok(n == 0, "Thanksgiving (markets closed): no calls at all")
DAY = datetime(2026, 11, 27, tzinfo=NY)  # the day after: closes at 1 pm
n, last = whole_day(DAY)
ok(last == "13:06" and n < total * 0.6, "the 1 pm early close: the last call is the 13:06 closing run (%d calls that day)" % n)
DAY = global_day

# the daily stop: once it's reached, no request goes out and the app is told
db.collection("serverMeta").document("msUsage").set({"day": DAY.strftime("%Y-%m-%d"), "calls": int(os.environ["MS_DAILY_CALLS"]), "cycle": "2026-11", "cycleCalls": 50000})
n = len(requests)
NOW[0] = DAY.replace(hour=15, minute=31)
run(None)
q = db.collection("markets").document("quotes").get().to_dict()
ok(len(requests) == n and (q.get("paused") or {}).get("reason") == "day", "past the daily stop: no request, and prices say paused for the day")
print("quotes_day.e2e.py: %d passed" % passed)
