"""Server-granted achievements (owner 2026-11-14) through the real functions/main.py code against the
Firestore emulator: granted once with XP once, shown on the public profile, and Gave It All Back
from the nightly revalue of a Solo account that reached +60% and fell below $10,000."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "functions"))
os.environ.setdefault("GCLOUD_PROJECT", "demo-zelos")
import main  # noqa: E402
import practice as PR  # noqa: E402
import xp as XP  # noqa: E402
from firebase_admin import firestore  # noqa: E402

db = firestore.client()
passed = 0


def ok(cond, msg):
    global passed
    assert cond, msg
    passed += 1
    print("  ok   " + msg)


uid = "achUser01"
now = PR.bar_start_ms("2026-11-13 16:20")
db.collection("users").document(uid).set({"xp": 0})
db.collection("practiceProfiles").document(uid).set({"name": "Ach", "achievements": []})
got = main.award_achievements(db, uid, ["first-post", "first-victory", "not-a-thing"], now)
ok(got == ["first-post", "first-victory"], "unknown ids are ignored (%s)" % got)
u = db.collection("users").document(uid).get().to_dict()
ok(set(u["progress"]["achievements"]) == {"first-post", "first-victory"}, "recorded where the app reads achievements")
ok(u["xp"] == XP.ACHIEVEMENTS["first-post"] + XP.ACHIEVEMENTS["first-victory"], "their XP (%s)" % u["xp"])
ok(set(db.collection("practiceProfiles").document(uid).get().to_dict()["achievements"]) == {"first-post", "first-victory"}, "on the public profile")
ok(main.award_achievements(db, uid, ["first-post"], now + 1000) == [], "never twice")
ok(db.collection("users").document(uid).get().to_dict()["xp"] == u["xp"], "no XP twice")

# Gave It All Back: this account peaked at $17,000 (+70%) and is now $9,000, all cash
db.collection("markets").document("quotes").set({"quotes": {}})
db.collection("practiceAccounts").document(uid).set(dict(PR.new_account(now - 864e5 * 30), cash=9000.0, peak=17000.0))
other = "achUser02"  # peaked at $15,000 only: no badge
db.collection("practiceAccounts").document(other).set(dict(PR.new_account(now - 864e5 * 30), cash=9000.0, peak=15000.0))
main.practice_revalue_all(db, now)
ach = (db.collection("users").document(uid).get().to_dict()["progress"]["achievements"])
ok("round-trip" in ach, "Gave It All Back after a +60% peak and a fall below $10,000")
o = db.collection("users").document(other).get()
ok(not o.exists or "round-trip" not in (((o.to_dict() or {}).get("progress") or {}).get("achievements") or {}), "not without reaching +60%")
print("\n%d achievement checks passed" % passed)
