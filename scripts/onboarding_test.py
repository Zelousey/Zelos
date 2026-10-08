"""Unit tests for functions/onboarding.py (run: python3 scripts/onboarding_test.py)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))
import onboarding as OB  # noqa: E402

n = 0


def ok(cond, label):
    global n
    assert cond, label
    n += 1
    print("  ok  ", label)


def err(fn, label):
    try:
        fn()
    except OB.ProfileError as e:
        ok(e.code == "INVALID_ARGUMENT", label + " (" + e.message + ")")
        return
    raise AssertionError(label + ": no error")


ok(OB.validate({"name": "  Ada   Lovelace ", "username": "@Ada_1"}) == ("Ada Lovelace", "ada_1", None), "name trimmed, @ and case removed")
ok(OB.validate({"name": "Bo", "username": "bo_trades", "experience": "new"})[2] == "new", "experience kept")
ok(OB.clean_name("x" * 40) == "x" * 24, "name cut to 24")
ok(OB.clean_name("<b>Ada</b>") == "bAda/b", "no angle brackets")
err(lambda: OB.clean_name("   "), "empty name")
err(lambda: OB.clean_name("!!!"), "name needs a letter or number")
err(lambda: OB.clean_username("ab"), "too short")
err(lambda: OB.clean_username("a" * 21), "too long")
err(lambda: OB.clean_username("ada lovelace"), "no spaces")
err(lambda: OB.clean_username("admin"), "reserved")
err(lambda: OB.clean_username("zelos_"), "reserved with underscore")
err(lambda: OB.validate({"name": "Ada", "username": "ada_1", "experience": "god"}), "unknown experience")
err(lambda: OB.validate(None), "no data")
print("%d onboarding checks passed" % n)
