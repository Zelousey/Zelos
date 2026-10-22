"""Runs the server scanners (main.scanners_pass) against the Firestore emulator: from stored daily
bars it grades open alerts (win / loss) and publishes today's alert for each server scanner,
token-gated like any other, once a day. Started by run-functions-e2e.sh."""
import os
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


def bars(closes, vols, d0=date(2026, 3, 2)):
    """'YYYY-MM-DD,o,h,l,c,v' strings on weekdays, the way the history docs store them."""
    out, prev, d = [], closes[0], d0
    for c, v in zip(closes, vols):
        while d.weekday() >= 5:
            d += timedelta(days=1)
        o = (prev + c) / 2
        out.append("%s,%s,%s,%s,%s,%s" % (d.isoformat(), round(o, 4), round(max(o, c) * 1.004, 4), round(min(o, c) * 0.996, 4), round(c, 4), v))
        prev, d = c, d + timedelta(days=1)
    return out


# AMD: a rise, ~8 weeks under a $120 ceiling (3 touches), then a close through it on big volume
c = [80 * 1.004 ** i for i in range(100)]
c += [112 + 6 * ((i % 14) / 13) if (i % 14) != 13 else 119.4 for i in range(42)]
c += [121.5, 122.0, 122.4]
v = [3_000_000] * (len(c) - 3) + [7_000_000, 5_000_000, 4_000_000]
market = [400 * 1.002 ** i for i in range(len(c))]
# NVDA: an older alert whose target was reached
nv = [100.0] * (len(c) - 4) + [101.0, 104.0, 111.0, 112.0]
hist = {"AMD": bars(c, v), "SPY": bars(market, [5_000_000] * len(c)), "QQQ": bars(market, [5_000_000] * len(c)),
        "NVDA": bars(nv, [9_000_000] * len(nv))}
today = hist["SPY"][-1][:10]
alert_day = hist["NVDA"][-5][:10]

db.collection("alertsLocked").document("swing-trader-" + alert_day).set({
    "strategy": "swing-trader", "status": "qualified", "ticker": "NVDA", "direction": "long", "asOf": alert_day,
    "entry": 100.0, "stop": 96.0, "target1": 108.0, "target2": 115.0, "lockedUntil": 0, "released": True})
db.collection("alerts").document("swing-trader-" + alert_day).set({"strategy": "swing-trader", "status": "qualified", "locked": True})

now = datetime.now(timezone.utc)
s = main.scanners_pass(db, hist, today, now)
ok(s["outcomes"] == 1, "graded the open alert")
pub = db.collection("alerts").document("swing-trader-" + alert_day).get().to_dict()
ok(pub["outcome"]["result"] == "hit-target" and pub["ticker"] == "NVDA" and pub.get("locked") is False,
   "a finished trade is graded and goes public (part of the track record)")

bid = "breakout-rider-" + today
teaser = db.collection("alerts").document(bid).get().to_dict()
full = db.collection("alertsLocked").document(bid).get().to_dict()
ok(full["status"] == "qualified" and full["ticker"] == "AMD" and full["source"] == "server", "Breakout Rider found the AMD breakout")
ok(full["stop"] < full["entry"] < full["target1"] and full["suggestedSizeNote"].startswith("A general rule of thumb"), "with a full trade plan")
ok(teaser["locked"] is True and "ticker" not in teaser and "entry" not in teaser and teaser["score"] == full["score"],
   "the public alert is a teaser until the close (no ticker, no levels)")
ok(db.collection("alertPushes").document(bid).get().exists, "subscribers were notified (once)")
sw = db.collection("alerts").document("swing-trader-" + today).get().to_dict()
ok(sw["status"] in ("qualified", "no-qualifying-setup") and sw["source"] == "server", "Swing Trader published its result too")

s2 = main.scanners_pass(db, hist, today, now)
ok(s2["alerts"] == {"swing-trader": "already published", "breakout-rider": "already published"} and s2["outcomes"] == 0,
   "a second run the same day changes nothing")

# the next day, AMD is still open: it isn't alerted again
nxt = (date.fromisoformat(today) + timedelta(days=3)).isoformat()
hist2 = {k: rows + [rows[-1].replace(rows[-1][:10], nxt)] for k, rows in hist.items()}
s3 = main.scanners_pass(db, hist2, nxt, now)
again = db.collection("alertsLocked").document("breakout-rider-" + nxt).get()
ok(not again.exists or again.to_dict().get("ticker") != "AMD", "a stock with an open alert isn't alerted again")
ok(db.collection("alertsLocked").document(bid).get().to_dict().get("outcome", {}).get("result") in (None, "open"),
   "and its trade is still open")
print("\n%d server scanner checks passed" % passed)
