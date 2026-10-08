"""Runs ms_run_quotes (1-minute prices) and practice_pass from functions/main.py against the
Firestore emulator, with Marketstack replaced by a fake that serves 1-minute bars:
- the first run of the day asks for the whole day, later runs only for bars since the newest
  stored one (date_from with a time), about one request per 10 stocks;
- quotes, intraday docs and the stored "since" are right;
- if Marketstack refuses a time filter, whole-day requests are used from then on;
- a plan without 1-minute bars raises MsNotInPlan (refresh_quotes then falls back to 15min);
- a market order fills on the first 1-minute bar after it, and usage is counted.
Started by run-functions-e2e.sh inside `firebase emulators:exec`."""
import os
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
import practice as PR  # noqa: E402
from firebase_admin import firestore  # noqa: E402

MD = main.MD
db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


NY = main.NY
DAY = datetime(2026, 10, 7, tzinfo=NY)
SYMS = main.PRACTICE_SYMBOLS
calls = []
mode = {"refuse_time": False, "no_1min": False}


def price(sym, minute):
    return 100 + SYMS.index(sym) + minute * 0.01


def fake_get(path, params, key, timeout=20):
    calls.append(dict(params))
    if mode["no_1min"] and params.get("interval") == "1min":
        return None  # what ms_get returns for function_access_restricted
    frm = params["date_from"]
    if "T" in frm:
        if mode["refuse_time"]:
            raise RuntimeError("marketstack validation_error")
        start = datetime.strptime(frm, "%Y-%m-%dT%H:%M:%S+0000").replace(tzinfo=timezone.utc)
    else:
        start = DAY.replace(hour=0)
    rows = []
    for sym in params["symbols"].split(","):
        for m in range(0, NOW_MIN[0]):  # bars that have started before "now"
            t = DAY.replace(hour=9, minute=30) + timedelta(minutes=m)
            if t < start:
                continue
            p = price(sym, m)
            rows.append({"symbol": sym, "date": t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000"),
                         "open": p, "high": p + 0.05, "low": p - 0.05, "close": p + 0.01, "volume": 100})
    return {"data": rows, "pagination": {"total": len(rows)}}


NOW_MIN = [0]
MD.ms_get = fake_get
os.environ["QUOTE_EVERY_MIN"] = "1"
os.environ["MS_INTERVAL"] = "1min"
db.collection("serverMeta").document("msQuotes").delete()
for s in SYMS:
    db.collection("markets").document("intraday_" + s).delete()

# 10:00 -> bars 9:30..9:59 have started (30 bars a symbol)
NOW_MIN[0] = 30
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=0))
first = list(calls)
ok(step == 1 and n == len(SYMS), "first run: a quote for every stock (%d)" % n)
ok(len(first) == (len(SYMS) + 9) // 10 and all(c["date_from"] == "2026-10-07" for c in first), "first run asks for the whole day, 10 stocks a request (%d requests)" % len(first))
ok(abs(quotes["AAPL"]["c"] - (price("AAPL", 29) + 0.01)) < 1e-9, "quote = the newest 1-minute close")
doc = db.collection("markets").document("intraday_AAPL").get().to_dict()
ok(doc["interval"] == "1m" and len(doc["bars"]) == 30, "intraday doc holds 30 one-minute bars")
st = db.collection("serverMeta").document("msQuotes").get().to_dict()
ok(st["since"].startswith("2026-10-07T09:59"), "newest bar stored as 'since' (%s)" % st["since"])

# 10:01 -> one more bar; only bars since 9:57 (2 bars of overlap) are asked for
calls.clear()
NOW_MIN[0] = 31
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=1))
ok(all("T" in c["date_from"] and c["date_from"].startswith("2026-10-07T13:57") for c in calls), "next run asks only for new bars (%s)" % calls[0]["date_from"])
ok(abs(quotes["AAPL"]["c"] - (price("AAPL", 30) + 0.01)) < 1e-9 and len(bars["AAPL"]) == 31, "quote moved to the new bar; 31 bars for the order pass")
ok(len(db.collection("markets").document("intraday_AAPL").get().to_dict()["bars"]) == 31, "intraday doc merged, no duplicates")

# one group of 10 stocks times out: the others update, and "since" doesn't move (no gaps later)
real_fake = MD.ms_get
def flaky(path, params, key, timeout=20):
    if "AAPL" in params["symbols"].split(","):
        raise TimeoutError("read timed out")
    return real_fake(path, params, key, timeout)
MD.ms_get = flaky
before = db.collection("serverMeta").document("msQuotes").get().to_dict()["since"]
NOW_MIN[0] = 32
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=2))
after = db.collection("serverMeta").document("msQuotes").get().to_dict()["since"]
ok(n == len(SYMS) and after == before, "a failed group keeps 'since' so its stocks catch up next run")
MD.ms_get = real_fake
NOW_MIN[0] = 33
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=3))
ok(len(bars["AAPL"]) == 33, "next run fills the missed bars (33 for AAPL)")
calls.clear()

# Marketstack refuses a time filter -> whole day, and remembered
calls.clear()
mode["refuse_time"] = True
NOW_MIN[0] = 34
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=4))
ok(n == len(SYMS) and any(c["date_from"] == "2026-10-07" for c in calls), "refused time filter: falls back to whole-day requests")
ok(db.collection("serverMeta").document("msQuotes").get().to_dict()["timeFilter"] is False, "and remembers not to use it")
mode["refuse_time"] = False

# the plan has no 1-minute bars
mode["no_1min"] = True
try:
    main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=3))
    ok(False, "1-minute bars missing from the plan must be reported")
except MD.MsNotInPlan:
    ok(True, "1-minute bars missing from the plan raise MsNotInPlan")
mode["no_1min"] = False

# a market order placed at 10:00:10 fills at the 10:00 bar's close once that bar is over
uid = "oneMinUser"
acct = PR.new_account(PR.bar_start_ms("2026-10-07 09:59"))
t0 = PR.bar_start_ms("2026-10-07 10:00") + 10000
o = PR.validate_order(acct, {"sym": "AAPL", "side": "buy", "qty": 1}, 130.0, {"AAPL"}, t0, "bbbbbbbbbbbbbbbb")
PR.add_order(acct, o)
db.collection("practiceAccounts").document(uid).set(acct)
db.collection("users").document(uid).set({"xp": 0})
NOW_MIN[0] = 32
n, quotes, bars, step = main.ms_run_quotes(db, "k", DAY.replace(hour=10, minute=2))
res = main.practice_pass(db, quotes, bars, PR.bar_start_ms("2026-10-07 10:02") + 5000, step)
a = db.collection("practiceAccounts").document(uid).get().to_dict()
ok(res["fills"] == 1 and abs(a["positions"]["AAPL"]["avg"] - (price("AAPL", 30) + 0.01)) < 1e-9, "market order filled at the 10:00 one-minute close, about a minute after it was placed")

# usage counting
db.collection("serverMeta").document("msUsage").delete()
main.ms_count_calls(db, DAY.replace(hour=10, minute=5), 5)
main.ms_count_calls(db, DAY.replace(hour=10, minute=6), 5)
ok(main.ms_calls_today(db, DAY.replace(hour=11)) == 10, "requests counted per day")
ok(main.ms_calls_today(db, DAY.replace(hour=11) + timedelta(days=1)) == 0, "a new day starts at zero")
print("\n%d one-minute price checks passed" % passed)
