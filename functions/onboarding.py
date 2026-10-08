"""First sign-in in the app (pure rules; unit-tested in scripts/onboarding_test.py; wired up in
main.py profile_setup).

Owner decisions 2026-10-08: the app welcomes a new player with a few short screens (name and
@username, experience, the $10,000 practice account, a first trade), then a First steps checklist
on the Dashboard. The server saves the name and @username (one atomic write, so two people can't
take the same @username) and pays the existing "Getting set up" profile XP (functions/xp.py ONBOARD).

    traders/{uid}      {name, username, ...}     public identity (same fields the website writes)
    usernames/{name}   {uid}                     one per person; the old one is released
    users/{uid}        {experience, onboard: {profile: true}}
"""
import re

NAME_MAX = 24
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")  # same as firestore.rules validUsername
EXPERIENCE = ("new", "some", "pro")
# names people could mistake for the team or the system
RESERVED = {
    "admin", "administrator", "zelos", "zelostradewar", "tradewar", "agentictrading", "support", "help",
    "moderator", "mod", "official", "staff", "team", "system", "root", "null", "undefined", "owner",
    "security", "billing", "news", "coach",
}


class ProfileError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def clean_name(v):
    s = re.sub(r"[\x00-\x1f\x7f<>]", "", str(v or ""))
    s = re.sub(r"\s+", " ", s).strip()[:NAME_MAX].strip()
    if not re.search(r"\w", s):
        raise ProfileError("INVALID_ARGUMENT", "Type the name other players will see.")
    return s


def clean_username(v):
    u = str(v or "").strip().lstrip("@").lower()
    if not USERNAME_RE.match(u):
        raise ProfileError("INVALID_ARGUMENT", "3–20 characters: lowercase letters, numbers and _.")
    if u in RESERVED or u.replace("_", "") in RESERVED:
        raise ProfileError("INVALID_ARGUMENT", "@%s is reserved. Pick another one." % u)
    return u


def validate(data):
    """{name, username, experience?} -> (name, username, experience or None)."""
    data = data if isinstance(data, dict) else {}
    exp = data.get("experience")
    if exp is not None and exp not in EXPERIENCE:
        raise ProfileError("INVALID_ARGUMENT", "Pick New, Some or Experienced.")
    return clean_name(data.get("name")), clean_username(data.get("username")), exp
