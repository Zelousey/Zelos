"""XP awards, decided on the server.

The browser (zelos-xp.js) used to add XP to users/{uid}.xp itself, so anyone could
type any number into devtools, and the server trusts that number for Trade War buy-in
tiers, the whale role and community limits. Now the browser asks the `xp_award`
callable, and this module decides whether the award is real and how much it is worth.
The amount always comes from the tables below, never from the browser.

What is checked:
  - the type is known and the refId has the exact shape that type uses;
  - day-stamped refIds are for today or yesterday (New York time), week-stamped ones for
    this week or last week;
  - per-type daily limits (the same "first N a day" rules the pages already apply);
  - a total daily ceiling as a backstop.
The (type, refId) pair is still the dedup key, kept in users/{uid}/activity/{type:refId},
which only the server can write now.

Keep the tables in step with zelos-xp.js (POINTS), zelos-progress.js (DAILY, WEEKLY,
STREAK_REWARDS, achievements) and zelos-profile.js (onboarding steps).
"""

import re
from datetime import date, timedelta

FIXED = {
    "alert-open": 5, "daily-checkin": 3, "arcade-play": 5,
    "practice-trade": 5, "practice-win": 10, "grade-setup": 10,
    "referral": 50, "referral-welcome": 50, "real-trade": 10, "trading-tools": 5, "share": 10,
}

SOURCES = {
    "alert-open": ("real", "Opened an alert"), "daily-checkin": ("platform", "Daily check-in"),
    "arcade-play": ("training", "Arcade game"), "practice-trade": ("trade-war", "Trade War trade"),
    "practice-win": ("trade-war", "Trade War win"), "grade-setup": ("training", "Completed Grade Setup"),
    "referral": ("social", "Friend joined"), "referral-welcome": ("social", "Joined from an invite"),
    "real-trade": ("real", "Real Trading Activity"), "trading-tools": ("real", "Used trading tools"),
    "share": ("social", "Shared Trade War"), "mission": ("missions", "Mission"),
    "achievement": ("achievements", "Achievement"), "onboard": ("platform", "Getting set up"),
    "coach-task": ("coaching", "Coach task done"), "coach-bonus": ("coaching", "Your student finished a task"),
}

DAILY_MISSIONS = {"trade": 10, "analyze": 10, "grade": 10, "news": 5, "xp": 20}
WEEKLY_MISSIONS = {"trades10": 40, "wins3": 50, "grade10": 40, "days5": 75, "xp300": 60}
STREAK_REWARDS = {3: 25, 7: 75, 14: 150, 30: 300}
ONBOARD = {"profile": 25, "trade": 25, "app": 50, "notify": 50}
ACHIEVEMENTS = {
    "first-trade": 25, "first-win": 25, "perfect-exit": 50, "hot-hand": 50, "win-streak-10": 150,
    "explorer": 50, "options-rookie": 25, "agent-handler": 50, "centurion": 200,
    "club-12k": 50, "club-25k": 150, "club-50k": 300, "club-100k": 500,
    "comeback-kid": 150, "comeback-brink": 300, "comeback-phoenix": 600,
    "sharp-eye": 50, "on-a-roll": 75, "challenger": 50, "champion": 150, "squad-up": 25,
    "ref-bronze": 50, "ref-silver": 100, "ref-gold": 250, "ref-diamond": 500,
}
SEASON_ACH = re.compile(r"^season-s[0-9]{1,3}-(in|green)$")
SEASON_XP = {"in": 25, "green": 100}

# Awards per type per New York day (missing = no per-type limit beyond dedup).
DAILY_LIMIT = {
    "alert-open": 50, "practice-trade": 10, "practice-win": 10, "grade-setup": 5,
    "real-trade": 3, "referral": 10, "mission": 12, "achievement": 30, "onboard": 4,
    "coach-task": 3, "coach-bonus": 6,
}
# Coaching (functions/coaching.py), paid only by the server: refId "<task kind>:<task id>".
# A student earns from at most 3 coach tasks a day; a coach from at most 6 student tasks a day.
COACH_TASK_XP = {"trade": 10, "win": 15, "analyze": 10, "grade": 10, "news": 5, "custom": 5}
COACH_BONUS_XP = {"trade": 5, "win": 8, "analyze": 5, "grade": 5, "news": 3}
_COACH_REF = re.compile(r"^([a-z]+):[A-Za-z0-9]{6,40}$")
SERVER_ONLY = ("mission", "coach-task", "coach-bonus")
DAILY_XP_CEILING = 2500

_DAY = r"[0-9]{4}-[0-9]{2}-[0-9]{2}"
_UID = re.compile(r"^[A-Za-z0-9]{10,128}$")
_ALERT_ID = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
_COUNTED = re.compile(r"^(" + _DAY + r"):([0-9]{1,2})$")
_COUNT_MAX = {"practice-trade": 10, "practice-win": 10, "grade-setup": 5, "real-trade": 3}


def iso_week_key(day_str):
    y, w, _ = date.fromisoformat(day_str).isocalendar()
    return "w%d_%02d" % (y, w)


def decide(kind, ref_id, today, counts=None, xp_today=0):
    """Pure. Returns (amount, ref_id, error). amount > 0 means award it.

    today   NY date "YYYY-MM-DD"
    counts  {type: awards so far today}
    xp_today XP already awarded today
    """
    counts = counts or {}
    ref_id = "" if ref_id is None else str(ref_id)
    if len(ref_id) > 120:
        return 0, ref_id, "bad-ref"
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    days_ok = (today, yesterday)
    weeks_ok = (iso_week_key(today), iso_week_key((date.fromisoformat(today) - timedelta(days=7)).isoformat()))

    amount = 0
    if kind in ("daily-checkin", "arcade-play", "trading-tools", "share"):
        ref_id = ref_id or today
        if ref_id not in days_ok:
            return 0, ref_id, "bad-ref"
        amount = FIXED[kind]
    elif kind in _COUNT_MAX:
        m = _COUNTED.match(ref_id)
        if not m or m.group(1) not in days_ok or not (1 <= int(m.group(2)) <= _COUNT_MAX[kind]):
            return 0, ref_id, "bad-ref"
        amount = FIXED[kind]
    elif kind == "alert-open":
        if not _ALERT_ID.match(ref_id):
            return 0, ref_id, "bad-ref"
        amount = FIXED[kind]
    elif kind == "referral":
        if not _UID.match(ref_id):
            return 0, ref_id, "bad-ref"
        amount = FIXED[kind]
    elif kind == "referral-welcome":
        if ref_id != "welcome":
            return 0, ref_id, "bad-ref"
        amount = FIXED[kind]
    elif kind == "mission":
        parts = ref_id.split(":")
        if len(parts) == 3 and parts[0] == "d" and parts[1] in days_ok and parts[2] in DAILY_MISSIONS:
            amount = DAILY_MISSIONS[parts[2]]
        elif len(parts) == 3 and parts[0] == "w" and parts[1] in weeks_ok and parts[2] in WEEKLY_MISSIONS:
            amount = WEEKLY_MISSIONS[parts[2]]
        elif len(parts) == 3 and parts[0] == "streak" and re.match("^" + _DAY + "$", parts[1]) and parts[2].isdigit():
            n = int(parts[2])
            try:
                start = date.fromisoformat(parts[1])
            except ValueError:
                return 0, ref_id, "bad-ref"
            # the reward fires on the day the streak reaches n: start + n - 1 must be today/yesterday
            end = (start + timedelta(days=n - 1)).isoformat() if n in STREAK_REWARDS else None
            if end not in days_ok:
                return 0, ref_id, "bad-ref"
            amount = STREAK_REWARDS[n]
        else:
            return 0, ref_id, "bad-ref"
    elif kind == "achievement":
        if ref_id in ACHIEVEMENTS:
            amount = ACHIEVEMENTS[ref_id]
        else:
            m = SEASON_ACH.match(ref_id)
            if not m:
                return 0, ref_id, "bad-ref"
            amount = SEASON_XP[m.group(1)]
    elif kind == "onboard":
        if ref_id not in ONBOARD:
            return 0, ref_id, "bad-ref"
        amount = ONBOARD[ref_id]
    elif kind in ("coach-task", "coach-bonus"):
        m = _COACH_REF.match(ref_id)
        table = COACH_TASK_XP if kind == "coach-task" else COACH_BONUS_XP
        if not m or m.group(1) not in table:
            return 0, ref_id, "bad-ref"
        amount = table[m.group(1)]
    else:
        return 0, ref_id, "bad-type"

    if counts.get(kind, 0) >= DAILY_LIMIT.get(kind, 10 ** 6):
        return 0, ref_id, "daily-limit"
    if xp_today + amount > DAILY_XP_CEILING:
        return 0, ref_id, "daily-limit"
    return amount, ref_id, None


def streak_update(data, today, yesterday):
    """Pure: the alert-open streak fields to set, or {} if already counted today."""
    if data.get("lastAlertOpenDate") == today:
        return {}
    days = (int(data.get("streakDays") or 0) + 1) if data.get("lastAlertOpenDate") == yesterday else 1
    return {"streakDays": days, "lastAlertOpenDate": today}
