"""Runs the real price_alerts_pass from functions/main.py against the Firestore emulator (real
transactions and queries): a crossed alert is marked triggered, lands in the bell once, and an
old copy of the list saved back can't make it notify twice. A switched-off kind gets the bell
item but no push (no device here either way). Started by run-functions-e2e.sh."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402  (initialize_app() runs here, against the emulator)
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


def al(i, sym, price, dirn, status="active", upd=1000):
    return {"id": i, "sym": sym, "price": price, "dir": dirn, "status": status, "createdAt": 1, "updatedAt": upd}


uid, other = "priceUser01", "priceUser02"
saved = [al("aaaa1111", "AAPL", 200, "above"), al("bbbb2222", "AAPL", 150, "below"), al("cccc3333", "MSFT", 999, "above"), {"id": "evil", "sym": "AAPL", "price": "x"}]
db.collection("users").document(uid).set({"twAlerts": saved, "twAlertsActive": 3})
db.collection("users").document(other).set({"twAlerts": [al("dddd4444", "AAPL", 100, "above")], "twAlertsActive": 0})  # says none waiting: not checked
inbox = lambda u: [d.to_dict() for d in db.collection("users").document(u).collection("inbox").stream()]  # noqa: E731

res = main.price_alerts_pass(db, {"AAPL": {"c": 201.5}, "MSFT": {"c": 400}}, 5000)
ok(res == {"users": 1, "fired": 1}, "one person checked, one alert fired (%s)" % res)
u = db.collection("users").document(uid).get().to_dict()
by = {a.get("id"): a for a in u["twAlerts"]}
ok(by["aaaa1111"]["status"] == "triggered" and by["aaaa1111"]["hitPrice"] == 201.5 and by["aaaa1111"]["updatedAt"] == 5000, "the crossed alert is marked triggered with the price")
ok(by["bbbb2222"]["status"] == "active" and by["cccc3333"]["status"] == "active" and u["twAlertsActive"] == 2, "the others still wait (2 active)")
ok(by["evil"] == {"id": "evil", "sym": "AAPL", "price": "x"}, "an entry the server ignores is kept as it was")
items = inbox(uid)
ok(len(items) == 1 and items[0]["kind"] == "price" and items[0]["title"] == "AAPL hit $200.00" and items[0]["link"] == "app/markets/AAPL", "one bell item: %s" % (items[0]["title"] if items else None))
ok(inbox(other) == [], "someone with no waiting alerts gets nothing")

res = main.price_alerts_pass(db, {"AAPL": {"c": 205}}, 6000)
ok(res["fired"] == 0 and len(inbox(uid)) == 1, "the next price update doesn't notify again")

# another device saves an old copy of the list (the alert active again, same placement): still once
db.collection("users").document(uid).update({"twAlerts": saved[:3], "twAlertsActive": 3})
res = main.price_alerts_pass(db, {"AAPL": {"c": 206}}, 7000)
ok(res["fired"] == 0 and len(inbox(uid)) == 1, "an old copy saved back doesn't notify twice")

# moving the alert (new updatedAt) arms it again; a switched-off kind still lands in the bell
db.collection("users").document(uid).update({"twAlerts": [al("aaaa1111", "AAPL", 210, "above", upd=8000)], "twAlertsActive": 1,
                                             "notificationPrefs": {"types": {"price": False}}})
res = main.price_alerts_pass(db, {"AAPL": {"c": 211}}, 9000)
ok(res["fired"] == 1 and len(inbox(uid)) == 2, "a moved alert fires again")
ok(main.price_alerts_pass(db, {}, 9500) == {"users": 0, "fired": 0}, "no prices: nothing to check")
print("\n%d price alert checks passed" % passed)
