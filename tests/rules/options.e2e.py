"""Practice-account options through the real functions/main.py code against the Firestore
emulator: vols published from daily closes, an option buy filled by practice_pass at the model
ask, the Options Rookie badge and XP, and expiry settled by the nightly revalue.
Started by run-functions-e2e.sh inside `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST set)."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
import options as O  # noqa: E402
import practice as PR  # noqa: E402
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


uid = "optUser01"
D = "2026-10-07"
closes = [100, 101, 99, 102, 103, 101, 104, 106, 105, 107, 108, 106, 109, 108, 110, 111, 109, 112, 113, 111, 114]
db.collection("markets").document("dailyBars").set({"bars": {"AAPL": ["2026-09-%02d,1,1,1,%s,0" % (i + 1, c) for i, c in enumerate(closes)]}})
main._VOLS.update(day=None, vols={})
t0 = PR.bar_start_ms(D + " 10:05")
vols = main._pr_vols(db, t0)
want = round(O.hist_vol(closes), 4)
ok(vols.get("AAPL") == want, "vols come from the daily closes (%s)" % vols.get("AAPL"))
pub = db.collection("markets").document("optionVols").get().to_dict()
ok(pub["vols"]["AAPL"] == want and pub["day"] == D, "and are published to markets/optionVols for the app")

acct = PR.new_account(t0)
o = PR.validate_option_order(acct, {"kind": "option", "u": "AAPL", "type": "put", "exp": "2026-10-09", "strike": 115, "side": "buy", "qty": 2}, 114.0, want, {"AAPL"}, t0, "bbbbbbbbbbbbbbbb")
PR.add_order(acct, o)
db.collection("practiceAccounts").document(uid).set(acct)
db.collection("users").document(uid).set({"xp": 0})
db.collection("traders").document(uid).set({"name": "Optie"})
db.collection("practiceProfiles").document(uid).set({"name": "Optie", "equity": 10000, "achievements": []})
bars = {"AAPL": ["%s 10:06,113,113.5,112.5,113.2,1" % D]}
res = main.practice_pass(db, {"AAPL": {"c": 113.2, "t": PR.bar_start_ms(D + " 10:07") // 1000}}, bars, PR.bar_start_ms(D + " 10:08"), 1)
ok(res["fills"] == 1, "practice_pass filled the option order (%s)" % res)
a = db.collection("practiceAccounts").document(uid).get().to_dict()
ask = O.quote("put", 113.0, 115, "2026-10-09", D, want)["ask"]
pos = a["options"]["AAPL|20261009|P|11500"]
ok(pos["qty"] == 2 and pos["avg"] == ask, "bought 2 puts at the model ask on the next bar's open (%s)" % ask)
ok(abs(a["cash"] - round(10000 - ask * 200, 2)) < 1e-6, "cash paid for 2 contracts x 100")
u = db.collection("users").document(uid).get().to_dict()
ok((u.get("progress") or {}).get("achievements", {}).get("options-rookie"), "Options Rookie recorded like the website")
ok(u["xp"] >= 25 + 5, "XP for the first option and the fill (%s)" % u["xp"])
prof = db.collection("practiceProfiles").document(uid).get().to_dict()
ok("options-rookie" in prof.get("achievements", []), "the badge is on the public profile")

# expiry: Friday after the close, AAPL at $110 -> the $115 puts are worth $5 each
db.collection("markets").document("quotes").set({"quotes": {"AAPL": {"c": 110, "t": PR.bar_start_ms("2026-10-09 15:59") // 1000}}})
main.practice_revalue_all(db, PR.bar_start_ms("2026-10-09 16:20"))
a = db.collection("practiceAccounts").document(uid).get().to_dict()
ok(a.get("options") == {} and abs(a["cash"] - round(10000 - ask * 200 + 1000, 2)) < 1e-6, "expired puts settled at $5 intrinsic (cash %s)" % a["cash"])
hist = [h.to_dict() for h in db.collection("practiceAccounts").document(uid).collection("history").stream()]
ok(any(h["kind"] == "trade" and h.get("role") == "expired" for h in hist), "the expiry is in the history as a trade")
print("\n%d options checks passed" % passed)
