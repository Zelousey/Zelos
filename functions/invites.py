"""Invites (pure rules, unit-tested in scripts/invites_test.py; wired up in main.py).

Owner decisions 2026-10-08: invites are created and answered only by the server, so nobody
can fake who invited whom; referrals and their XP move to the server too; a squad invite
joins right away (the owner is told); Coach / Learn comes later.

    invites/{code}  { kind: battle | squad | join, from, fromName, fromUsername, fromPhoto,
                      warId, warName, buyIn, days, squadId, squadName,
                      status: open | cancelled, uses, createdAt, expiresAt }
                    public get (the link preview needs it before sign-in), server-write only
    invites/{code}/accepts/{uid}   { at }   one per person, server-only
    inviteState/{uid}  { day, created, sent, join }   daily limits + your reusable join link

A link (https://agentictrading.info/app/i/{code}) can be shared anywhere and used by up to
MAX_USES people until it expires. Sending it to a Zelos user by @username puts it in their
bell with Accept, and nothing happens until they accept.
Referral: accepting any invite as a brand-new account (signed up within NEW_ACCOUNT_DAYS, no
referral yet) records referrals/{you} = {referrer: inviter} and pays both sides the referral XP.
"""
import re

KINDS = ("battle", "squad", "join")
CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LEN = 10
CODE_RE = re.compile(r"^[A-Za-z0-9]{10}$")
TW_ID_RE = re.compile(r"^[A-Za-z0-9]{12}$")
SQUAD_ID_RE = re.compile(r"^[A-Za-z0-9]{6,40}$")
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
TTL_MS = 14 * 86400000
MAX_USES = 25
MAX_CREATED_PER_DAY = 30
MAX_SENT_PER_DAY = 20
NEW_ACCOUNT_DAYS = 7
SQUAD_MAX = 50


class InviteError(Exception):
    """A problem the person can fix; code is a Functions error code name."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def validate_create(data):
    """{kind, warId?, squadId?} -> (kind, target id or None)."""
    data = data if isinstance(data, dict) else {}
    kind = data.get("kind")
    if kind not in KINDS:
        raise InviteError("INVALID_ARGUMENT", "Pick Battle, Team up or Invite a friend.")
    if kind == "battle":
        wid = str(data.get("warId") or "")
        if not TW_ID_RE.match(wid):
            raise InviteError("INVALID_ARGUMENT", "That Trade War isn't valid.")
        return kind, wid
    if kind == "squad":
        sid = str(data.get("squadId") or "")
        if not SQUAD_ID_RE.match(sid):
            raise InviteError("INVALID_ARGUMENT", "That squad isn't valid.")
        return kind, sid
    return kind, None


def check_battle(war, uid):
    """The inviter must be in this Trade War and it must still be in the lobby."""
    if not war:
        raise InviteError("NOT_FOUND", "That Trade War doesn't exist.")
    if uid not in (war.get("players") or []):
        raise InviteError("PERMISSION_DENIED", "You can only invite people to a Trade War you're in.")
    if war.get("status") != "lobby":
        raise InviteError("FAILED_PRECONDITION", "This Trade War has already started, so nobody new can join.")


def check_squad(squad, uid):
    if not squad:
        raise InviteError("NOT_FOUND", "That squad doesn't exist.")
    if uid not in (squad.get("members") or []):
        raise InviteError("PERMISSION_DENIED", "You can only invite people to a squad you're in.")


def day_state(state, today):
    """Today's counters (a new day starts at zero; the join link is kept)."""
    state = state if isinstance(state, dict) else {}
    if state.get("day") != today:
        return {"day": today, "created": 0, "sent": 0, "join": state.get("join")}
    return {"day": today, "created": int(state.get("created") or 0), "sent": int(state.get("sent") or 0), "join": state.get("join")}


def usable(inv, now_ms):
    """None if this invite can still be accepted, else the reason shown to the person."""
    if not inv:
        return "This invite link doesn't exist. Ask for a new one."
    if inv.get("status") != "open":
        return "This invite was cancelled."
    if now_ms >= int(inv.get("expiresAt") or 0):
        return "This invite has expired. Ask for a new one."
    if int(inv.get("uses") or 0) >= MAX_USES:
        return "This invite has been used by too many people. Ask for a new one."
    return None


def check_accept(inv, uid, now_ms):
    why = usable(inv, now_ms)
    if why:
        raise InviteError("FAILED_PRECONDITION", why)
    if inv.get("from") == uid:
        raise InviteError("FAILED_PRECONDITION", "That's your own invite. Share it with a friend.")


def is_new_account(created_ms, now_ms):
    return created_ms is not None and 0 <= now_ms - int(created_ms) <= NEW_ACCOUNT_DAYS * 86400000


def referral_due(existing_referral, inviter, uid, created_ms, now_ms):
    """Should accepting this invite record a referral? Only once, only for a new account."""
    return (not existing_referral) and bool(inviter) and inviter != uid and is_new_account(created_ms, now_ms)


def public_view(code, inv):
    """What the app may show about an invite (it's public: names only, no private data)."""
    keep = ("kind", "from", "fromName", "fromUsername", "fromPhoto", "warId", "warName", "buyIn", "days", "squadId", "squadName", "status", "expiresAt")
    out = {k: inv.get(k) for k in keep}
    out["code"] = code
    return out
