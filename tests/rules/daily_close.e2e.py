"""Runs ms_daily_close (the once-a-day close) against the Firestore emulator, with Marketstack's
HTTP answers faked underneath the real ms_get, so the per-symbol counting and the hard stop are
exercised too:
- before SPY's bar is out it costs ONE call and changes nothing;
- then one end-of-day request per 100 symbols, from each stock's newest stored day;
- history, daily bars, the globe and the removed stocks' prices are written;
- a removed stock can be sold (it fills at the close) but not bought;
- a job without calls left makes none.
Started by run-functions-e2e.sh inside `firebase emulators:exec`."""
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
import practice as PR  # noqa: E402
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


TODAY = "2026-10-21"
NOW = datetime(2026, 10, 21, 18, 5, tzinfo=NY)
state = {"spy_ready": False}
asked = []


def days_between(frm, to):
    d, out = datetime.strptime(frm, "%Y-%m-%d"), []
    while d.strftime("%Y-%m-%d") <= to:
        if d.weekday() < 5:
            out.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return out


def fake_open(req, timeout=20):
    q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(req.full_url).query))
    syms = q["symbols"].split(",")
    asked.append((q["date_from"], syms))
    rows = []
    for s in syms:
        for i, d in enumerate(days_between(q["date_from"], TODAY)):
            if d == TODAY and not state["spy_ready"]:
                continue
            p = 50 + len(s) + i * 0.5
            rows.append({"symbol": s, "date": d + "T00:00:00+0000", "open": p, "high": p + 1, "low": p - 1, "close": p + 0.25, "volume": 1000})
    return io.BytesIO(json.dumps({"data": rows, "pagination": {"total": len(rows)}}).encode())


urllib.request.urlopen = fake_open
os.environ["MS_CYCLE_SEED"] = ""

# stored state: ~2 years of history ending yesterday, and a globe with 30 sessions
hist_syms = main._history_symbols()
countries = main._load_countries()
globe_syms = MD.globe_symbols(countries)
old_days = days_between("2025-10-01", "2026-10-20")
hist = {s: ["%s,10,11,9,10.5,100" % d for d in old_days] for s in hist_syms}
main._write_history(db, hist, NOW)
db.collection("markets").document("globeBars").set({"bars": {s: ["%s,10,11,9,10.5,100" % d for d in old_days[-30:]] for s in globe_syms}})
db.collection("serverMeta").document("msUsage").delete()

MD.CALLS[0] = 0
MD.BUDGET[0] = None
ok(main.ms_daily_close(db, "k", NOW) is None and MD.CALLS[0] == 1 and asked == [(TODAY, ["SPY"])],
   "before today's bars are out: one call (SPY) and nothing else")

state["spy_ready"] = True
asked.clear()
MD.CALLS[0] = 0
ok(main.ms_budget_start(db, NOW, "essential", 1) == 98000, "the daily close gets the essential allowance")
h = main.ms_daily_close(db, "k", NOW)
MD.BUDGET[0] = None
everything = set(hist_syms) | set(globe_syms)
ok(h is not None and h["SPY"][-1].startswith(TODAY), "today's bar is added to the history")
ok(all(frm == TODAY for frm, _ in asked[1:]) and all(len(s) <= 100 for _, s in asked), "only today's bars are asked for, 100 symbols a request at most")
ok(MD.CALLS[0] == 1 + len(everything), "cost: 1 + one call per symbol (%d calls)" % MD.CALLS[0])
ok(MD.CALLS[0] < 250, "a market day's close stays under 250 calls")
idx = db.collection("markets").document("historyIndex").get().to_dict()
ok("AVGO" in idx["symbols"] and "AAPL" in idx["symbols"], "removed stocks keep their history (their charts still work)")
db_bars = db.collection("markets").document("dailyBars").get().to_dict()["bars"]
ok(db_bars["AAPL"][-1].startswith(TODAY) and db_bars["AVGO"][-1].startswith(TODAY), "the charts' daily bars get today")
g = json.loads(db.collection("markets").document("globe").get().to_dict()["json"])
ok(g["asOf"] == TODAY, "the globe is up to date")
gb = db.collection("markets").document("globeBars").get().to_dict()["bars"]
ok(len(gb["EWJ"]) == main.GLOBE_KEEP and gb["EWJ"][-1].startswith(TODAY), "the globe keeps its own 30 sessions")
q = db.collection("markets").document("quotes").get().to_dict()["quotes"]
ok(q["AVGO"]["eod"] is True and q["AVGO"]["c"] == float(db_bars["AVGO"][-1].split(",")[4]), "a removed stock's price is today's close")

asked.clear()
ok(main.ms_daily_close(db, "k", NOW + timedelta(minutes=30)) is not None and asked == [], "a second run the same day makes no calls")

# a removed stock: buying is refused, selling what you hold works and fills at the next close
data, uni = main._pr_order_universe({"sym": "AVGO", "side": "buy", "qty": 1})
try:
    PR.validate_order(PR.new_account(0), data, 300.0, uni, 0, "a" * 16)
    ok(False, "buying a removed stock must be refused")
except PR.OrderError as e:
    ok("isn't in the Zelos stock list" in str(e), "buying a removed stock is refused")
uid = "retiredHolder"
acct = PR.new_account(PR.bar_start_ms("2026-10-20 09:30"))
acct["cash"] -= 2 * 60.0
acct["positions"]["AVGO"] = {"qty": 2, "avg": 60.0, "openedDay": "2026-10-20"}
data, uni = main._pr_order_universe({"sym": "AVGO", "side": "sell", "qty": 2, "tif": "day"})
placed = PR.bar_start_ms("2026-10-21 19:00")
o = PR.validate_order(acct, data, 70.0, uni, placed, "b" * 16)
ok(o["tif"] == "gtc", "a sell of a removed stock waits for the next close (good-till-cancelled)")
PR.add_order(acct, o)
db.collection("practiceAccounts").document(uid).set(acct)
db.collection("users").document(uid).set({"xp": 0})
NEXT = datetime(2026, 10, 22, 18, 5, tzinfo=NY)
TODAY = "2026-10-22"
main.ms_daily_close(db, "k", NEXT)
a = db.collection("practiceAccounts").document(uid).get().to_dict()
close = float(db.collection("markets").document("dailyBars").get().to_dict()["bars"]["AVGO"][-1].split(",")[4])
ok("AVGO" not in a["positions"] and not a.get("orders"), "the sell filled after the next day's close")
ok(abs(a["cash"] - (acct["cash"] + 2 * close)) < 0.01, "at the closing price (%s)" % close)

# the hard stop: no calls left, no calls made
db.collection("serverMeta").document("msUsage").set({"cycle": MD.ms_cycle(NEXT), "cycleCalls": 98000, "day": "2026-10-22", "calls": 0})
ok(main.ms_budget_start(db, NEXT, "essential", 1) == 0, "at 98,000 the daily close gets no calls")
os.environ.pop("MS_CYCLE_SEED", None)
print("\n%d daily close checks passed" % passed)
