"""Unit tests for functions/invites.py (invite rules, referrals). python3 scripts/invites_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import invites as I

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

def raises(fn, code, needle=""):
    try:
        fn()
        return False
    except I.InviteError as e:
        return e.code == code and needle.lower() in e.message.lower()

NOW = 1_800_000_000_000
DAY = 86400000

# create
ok(I.validate_create({"kind": "join"}) == ("join", None), "join needs nothing else")
ok(I.validate_create({"kind": "battle", "warId": "abcdefghjk12"}) == ("battle", "abcdefghjk12"), "battle with a war id")
ok(I.validate_create({"kind": "squad", "squadId": "Sq12345"}) == ("squad", "Sq12345"), "squad with a squad id")
ok(raises(lambda: I.validate_create({"kind": "prank"}), "INVALID_ARGUMENT"), "unknown kind rejected (no prank invites)")
ok(raises(lambda: I.validate_create({"kind": "battle", "warId": "../x"}), "INVALID_ARGUMENT", "trade war"), "bad war id rejected")
ok(raises(lambda: I.validate_create({"kind": "squad", "squadId": "a/b"}), "INVALID_ARGUMENT", "squad"), "bad squad id rejected")
ok(raises(lambda: I.validate_create(None), "INVALID_ARGUMENT"), "no data rejected")

# inviter must belong
ok(raises(lambda: I.check_battle(None, "u1"), "NOT_FOUND"), "missing war")
ok(raises(lambda: I.check_battle({"players": ["u2"], "status": "lobby"}, "u1"), "PERMISSION_DENIED"), "not your war")
ok(raises(lambda: I.check_battle({"players": ["u1"], "status": "active"}, "u1"), "FAILED_PRECONDITION", "started"), "war already started")
I.check_battle({"players": ["u1"], "status": "lobby"}, "u1"); ok(True, "your lobby is fine")
ok(raises(lambda: I.check_squad({"members": ["u2"]}, "u1"), "PERMISSION_DENIED"), "not your squad")

# limits
ok(I.day_state({"day": "2026-10-07", "created": 9, "sent": 9, "join": "abc"}, "2026-10-08") == {"day": "2026-10-08", "created": 0, "sent": 0, "join": "abc", "coach": None}, "new day resets counters, keeps the join and coach links")
ok(I.day_state({"day": "2026-10-08", "created": 3, "sent": 1}, "2026-10-08")["created"] == 3, "same day keeps counters")

# accepting
inv = {"from": "u1", "status": "open", "expiresAt": NOW + DAY, "uses": 0}
I.check_accept(inv, "u2", NOW); ok(True, "open invite can be accepted")
ok(raises(lambda: I.check_accept(inv, "u1", NOW), "FAILED_PRECONDITION", "your own"), "can't accept your own invite")
ok(raises(lambda: I.check_accept(dict(inv, status="cancelled"), "u2", NOW), "FAILED_PRECONDITION", "cancelled"), "cancelled invite")
ok(raises(lambda: I.check_accept(inv, "u2", NOW + DAY), "FAILED_PRECONDITION", "expired"), "expired invite")
ok(raises(lambda: I.check_accept(dict(inv, uses=I.MAX_USES), "u2", NOW), "FAILED_PRECONDITION", "too many"), "used up")
ok(raises(lambda: I.check_accept(None, "u2", NOW), "FAILED_PRECONDITION", "doesn't exist"), "missing invite")

# referrals: once, new accounts only, never yourself
ok(I.referral_due(False, "u1", "u2", NOW - DAY, NOW), "new account (1 day) counts")
ok(not I.referral_due(False, "u1", "u2", NOW - 8 * DAY, NOW), "an 8-day-old account doesn't")
ok(not I.referral_due(True, "u1", "u2", NOW - DAY, NOW), "only once")
ok(not I.referral_due(False, "u2", "u2", NOW - DAY, NOW), "not yourself")
ok(not I.referral_due(False, "u1", "u2", None, NOW), "unknown signup time doesn't count")

# public view keeps names only
v = I.public_view("Abcdefgh23", dict(inv, kind="join", fromName="Casey", secret="x"))
ok(v["code"] == "Abcdefgh23" and v["fromName"] == "Casey" and "secret" not in v and "uses" not in v, "public view: %s" % sorted(v))
ok(I.CODE_RE.match("Abcdefgh23") and not I.CODE_RE.match("abc/../x12"), "code format")

print("\n%s (%d failed)" % ("ALL INVITE CHECKS PASSED" if not fails else "SOME CHECKS FAILED", fails))
sys.exit(1 if fails else 0)
