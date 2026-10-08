"""Runs the real practice_pass / practice_revalue_all from functions/main.py against the
Firestore emulator (real transactions), to check fills, history, XP and the public profile.
Started by run-functions-e2e.sh inside `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST set)."""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402  (initialize_app() runs here, against the emulator)
import practice as PR  # noqa: E402
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


uid = "passUser01"
D = "2026-10-07"
t0 = PR.bar_start_ms(D + " 10:05")
acct = PR.new_account(t0)
o = PR.validate_order(acct, {"sym": "AAPL", "side": "buy", "qty": 10, "bracket": {"tp": 110}}, 100.0, {"AAPL"}, t0, "aaaaaaaaaaaaaaaa")
PR.add_order(acct, o)
db.collection("practiceAccounts").document(uid).set(acct)
db.collection("users").document(uid).set({"xp": 0})
db.collection("traders").document(uid).set({"name": "Passy", "username": "passy"})
db.collection("markets").document("quotes").set({"quotes": {"AAPL": {"c": 111, "t": PR.bar_start_ms(D + " 10:30") // 1000}}})

bars = {"AAPL": ["%s 10:00,100,101,99,100.5,1" % D, "%s 10:15,101,111,100,110.5,1" % D]}
quotes = {"AAPL": {"c": 110.5, "t": PR.bar_start_ms(D + " 10:30") // 1000}}
res = main.practice_pass(db, quotes, bars, PR.bar_start_ms(D + " 10:31"))
ok(res == {"accounts": 1, "fills": 2}, "pass filled the buy and its take-profit (%s)" % res)
a = db.collection("practiceAccounts").document(uid).get().to_dict()
ok(a["positions"] == {} and abs(a["cash"] - (10000 + 10 * (110 - 100.5))) < 1e-6, "cash reflects buy at 100.50 (mid-bar close) and sell at 110")
ok(a["openOrders"] == 0 and a["stats"]["wins"] == 1, "no orders left, one win recorded")
hist = [h.to_dict() for h in db.collection("practiceAccounts").document(uid).collection("history").stream()]
kinds = sorted(h["kind"] for h in hist)
ok(kinds == ["fill", "fill", "order", "order", "trade"], "history has both fills, both orders and the trade (%s)" % kinds)
u = db.collection("users").document(uid).get().to_dict()
ok(u["xp"] == 5 + 5 + 10 + 10 + 25, "server granted XP for 2 fills, 1 win, the daily trade mission and the first-trade step (%s)" % u["xp"])
m = u.get("missions") or {}
ok(m["day"]["counts"].get("trade") == 2 and m["day"]["done"].get("trade") and m["week"]["counts"].get("win") == 1,
   "the server counted the fills and the win toward missions (%s)" % m.get("day"))
prof = db.collection("practiceProfiles").document(uid).get().to_dict()
ok(prof["name"] == "Passy" and prof["trades"] == 1 and prof["source"] == "server", "public profile rebuilt by the server")
res2 = main.practice_pass(db, quotes, bars, PR.bar_start_ms(D + " 10:46"))
ok(res2["fills"] == 0, "a second pass changes nothing")
n = main.practice_revalue_all(db, PR.bar_start_ms(D + " 16:20"))
a = db.collection("practiceAccounts").document(uid).get().to_dict()
ok(n >= 1 and ("d" + D.replace("-", "")) in a["hist"], "nightly revalue writes today's history")
print("\n%d practice pass checks passed" % passed)
