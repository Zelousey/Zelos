"""Runs official_news_run from functions/main.py against the Firestore emulator with the
network replaced by canned Fed RSS / SEC Atom responses: one source failing must not stop
the other, items are merged and capped, and the doc shape is what the app reads.
Started by run-functions-e2e.sh inside `firebase emulators:exec`."""
import json
import os
import sys
from datetime import datetime

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


NOW = datetime(2026, 10, 7, 17, 0, tzinfo=main.NY)
RSS = """<rss><channel><item><title>FOMC statement</title><link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20261007a.htm</link>
<pubDate>Wed, 07 Oct 2026 18:00:00 GMT</pubDate><category>Monetary Policy</category></item></channel></rss>"""
ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>8-K - APPLE INC (0000320193) (Filer)</title>
<link href="https://www.sec.gov/Archives/edgar/data/320193/x-index.htm"/><summary type="html">Item 2.02: Results of Operations</summary>
<updated>2026-10-07T16:30:12-04:00</updated></entry></feed>"""

# the SEC ticker map the server caches (so no network for it)
db.collection("serverMeta").document("secCik").set({"json": json.dumps({"AAPL": 320193, "MSFT": 789019}), "at": int(NOW.timestamp())})
main._http_text = lambda url, timeout=20: RSS
main.MD.sec_get = lambda url, timeout=20, raw=False: ATOM
res = main.official_news_run(db, NOW)
d = db.collection("markets").document("officialNews").get().to_dict()
ok(res["fresh"] == 2 and not res["errors"], "both sources read (%s)" % res)
ok([i["kind"] for i in d["items"]] == ["filing", "fed"] and d["items"][0]["sym"] == "AAPL", "newest first: AAPL 8-K (4:30 pm), then the Fed release (2 pm)")


def boom(*a, **k):
    raise TimeoutError("down")


main._http_text = boom
res = main.official_news_run(db, NOW)
d = db.collection("markets").document("officialNews").get().to_dict()
ok(res["errors"] == ["fed:TimeoutError"] and len(d["items"]) == 2, "Fed down: SEC still updates and old items are kept")
print("\n%d official news checks passed" % passed)
