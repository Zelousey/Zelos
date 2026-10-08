"""Daily and weekly missions, counted by the server (pure; unit-tested in scripts/missions_test.py).

Owner decision 2026-10-08: missions move to the server so they count everywhere (the app and
the website) and nobody can fake them. The server sees most events itself:
  trade   a practice fill or a Trade War trade         (practice pass, tw_trade)
  win     a practice trade closed in profit            (practice pass)
  grade   a finished Grade the Setup round             (xp_award "grade-setup")
  xp      XP earned                                     (every xp_grant)
and the browser reports two through mission_event, checked here:
  analyze opening a chart of a stock on the Zelos list (each stock once a day)
  news    opening a news item
State lives in users/{uid}.missions (server-only field, readable by its owner):
  {day: {date, counts, analyzed, done}, week: {key, counts, done}, streak: {days, best, lastDate, start}}
Mission XP is paid through xp_grant("mission", refId) with the same refIds and amounts the
website already uses (functions/xp.py DAILY_MISSIONS / WEEKLY_MISSIONS / STREAK_REWARDS).
Same missions, goals and streak rule as zelos-progress.js (scripts/missions_test.py checks).
"""
import copy

DAILY = (("trade", "trade", 1), ("analyze", "analyze", 3), ("grade", "grade", 1), ("news", "news", 1), ("xp", "xp", 100))
WEEKLY = (("trades10", "trade", 10), ("wins3", "win", 3), ("grade10", "grade", 10), ("days5", "mday", 5), ("xp300", "xp", 300))
STREAK_NEED = 2
STREAK_DAYS = (3, 7, 14, 30)
EVENTS = ("trade", "win", "grade", "xp", "analyze", "news")
CLIENT_EVENTS = ("analyze", "news")
MAX_ANALYZED = 50


def fresh():
    return {"day": {"date": "", "counts": {}, "analyzed": [], "done": {}},
            "week": {"key": "", "counts": {}, "done": {}},
            "streak": {"days": 0, "best": 0, "lastDate": "", "start": ""}}


def _clean(state):
    s = fresh()
    if isinstance(state, dict):
        for part in ("day", "week", "streak"):
            if isinstance(state.get(part), dict):
                s[part].update(copy.deepcopy(state[part]))
    for part in ("day", "week"):
        s[part]["counts"] = {k: int(v) for k, v in (s[part].get("counts") or {}).items() if isinstance(v, (int, float))}
        s[part]["done"] = {k: True for k, v in (s[part].get("done") or {}).items() if v is True}
    s["day"]["analyzed"] = [x for x in (s["day"].get("analyzed") or []) if isinstance(x, str)][:MAX_ANALYZED]
    return s


def roll(state, today, week_key):
    s = _clean(state)
    if s["day"]["date"] != today:
        s["day"] = {"date": today, "counts": {}, "analyzed": [], "done": {}}
    if s["week"]["key"] != week_key:
        s["week"] = {"key": week_key, "counts": {}, "done": {}}
    return s


def apply(state, ev, today, yesterday, week_key, n=1, ref=None):
    """Count an event. Returns (new state, [mission refIds now complete]). Never pays twice:
    a mission is marked done in the state the moment it completes."""
    s = roll(state, today, week_key)
    out = []
    if ev not in EVENTS or n <= 0:
        return s, out
    if ev == "analyze":
        if not ref or ref in s["day"]["analyzed"]:
            return s, out
        if len(s["day"]["analyzed"]) < MAX_ANALYZED:
            s["day"]["analyzed"].append(ref)
        n = 1
    for part in ("day", "week"):
        s[part]["counts"][ev] = s[part]["counts"].get(ev, 0) + int(n)
    for mid, mev, goal in DAILY:
        if not s["day"]["done"].get(mid) and s["day"]["counts"].get(mev, 0) >= goal:
            s["day"]["done"][mid] = True
            out.append("d:%s:%s" % (today, mid))
    st = s["streak"]
    if len(s["day"]["done"]) >= STREAK_NEED and st.get("lastDate") != today:
        cont = st.get("lastDate") == yesterday
        st["days"] = int(st.get("days") or 0) + 1 if cont else 1
        if not cont:
            st["start"] = today
        st["lastDate"] = today
        st["best"] = max(int(st.get("best") or 0), st["days"])
        s["week"]["counts"]["mday"] = s["week"]["counts"].get("mday", 0) + 1
        if st["days"] in STREAK_DAYS:
            out.append("streak:%s:%d" % (st["start"], st["days"]))
    for mid, mev, goal in WEEKLY:
        if not s["week"]["done"].get(mid) and s["week"]["counts"].get(mev, 0) >= goal:
            s["week"]["done"][mid] = True
            out.append("w:%s:%s" % (week_key, mid))
    return s, out


def seed_streak(state, old_progress):
    """First time the server counts for someone: carry on the mission streak the website kept
    (users/{uid}.progress.streak), so switching to server counting doesn't reset anyone."""
    s = _clean(state)
    if s["streak"].get("lastDate"):
        return s
    old = (old_progress or {}).get("streak") if isinstance(old_progress, dict) else None
    if isinstance(old, dict) and isinstance(old.get("lastDate"), str) and old.get("lastDate"):
        s["streak"] = {"days": int(old.get("days") or 0), "best": int(old.get("best") or 0),
                       "lastDate": old["lastDate"], "start": str(old.get("start") or "")}
    return s


def check_client_event(ev, ref, symbols):
    """mission_event input -> (ev, ref) or None if it doesn't count."""
    if ev not in CLIENT_EVENTS:
        return None
    ref = str(ref or "").strip()[:80]
    if ev == "analyze":
        ref = ref.upper()
        return (ev, ref) if ref in symbols else None
    return (ev, ref or "news")
