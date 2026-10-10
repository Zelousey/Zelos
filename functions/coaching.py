"""Coach / Learn (pure rules; unit-tested in scripts/coaching_test.py; wired up in main.py).

Owner decisions 2026-10-08 (design doc "Zelos Coach / Learn — design for approval", then the
owner's answers): coaching unlocks at Level 3 (Gold); anyone can be coached; a coach has at
most 5 students and a student one coach; the coach sees the student's progress and individual
trades and can react to a trade ("good move" / "bad move" / "try this") with a note; either
side can end coaching; tasks pay small XP; custom tasks are allowed but can't farm XP; a Coach
badge after 5 completed tasks.

    coachings/{coach_student}   {coach, student, coachName, studentName, status: active|ended,
                                 startedAt, endedAt, endedBy, tasksDone, summary}
                                 readable by the two people, server-written
      tasks/{id}                 {kind, n, text, progress, status: open|review|done|expired|cancelled,
                                  createdAt, dueAt, doneAt}
      notes/{id}                 {from, fromName, text, at, reaction, trade: {id, sym, side, pnl, pct}}
      plays/{id}                 {from, fromName, sym, tf, title, note, shapes[], comments[], at}
                                 a chart the coach drew on (owner 2026-10-10: "draw on them and
                                 add comments ... your coach drew up a play"); shapes are pinned
                                 to bar dates and prices so the student sees them on the live chart
    coaches/{uid}                {students, tasksDone, badge}   public (the badge), server-written

Tasks count the same events the server's mission counter sees (functions/missions.py): a
practice or Trade War trade, a winning trade, a chart opened, a Grade the Setup round, a news
item. XP comes from functions/xp.py (COACH_TASK_XP / COACH_BONUS_XP) through xp_grant, with daily
limits there. A custom task ("Read the stop-loss guide") is ticked by the student and confirmed
by the coach; it pays the student 5 XP at most once a day and the coach nothing.
"""
import re

COACH_MIN_XP = 150            # Level 3 (Gold)
MAX_STUDENTS = 5
MAX_OPEN_TASKS = 3
MAX_NOTE = 500
NOTES_PER_DAY = 40
TASK_DAYS = (1, 3, 7, 14)
BADGE_TASKS = 5
KINDS = {  # kind: (label template, min n, max n)
    "trade": ("Make {n} practice trade{s}", 1, 10),
    "win": ("Close {n} winning trade{s}", 1, 5),
    "analyze": ("Analyze {n} different stock{s}", 1, 10),
    "grade": ("Grade {n} setup{s} in Grade the Setup", 1, 10),
    "news": ("Read {n} market news item{s}", 1, 5),
    "custom": ("{text}", 1, 1),
}
REACTIONS = ("good", "bad", "tip")
# chart plays
PLAY_TFS = ("15m", "1h", "D", "W")
SHAPE_KINDS = {"line": 2, "arrow": 2, "box": 2, "hline": 1, "text": 1}   # kind: points
SHAPE_COLORS = ("blue", "green", "red", "gold")
MAX_SHAPES = 40
MAX_TITLE = 80
MAX_SHAPE_TEXT = 80
MAX_COMMENT = 300
MAX_COMMENTS = 60
PLAYS_PER_DAY = 10
_BAR_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$")
_SYM_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,80}$")


class CoachError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


def pair_id(coach, student):
    return "%s_%s" % (coach, student)


def can_coach(xp):
    return int(xp or 0) >= COACH_MIN_XP


def check_start(coach, student, coach_xp, coach_active, student_has_coach):
    """Accepting a coach invite: who may coach whom."""
    if coach == student:
        raise CoachError("FAILED_PRECONDITION", "You can't coach yourself.")
    if not can_coach(coach_xp):
        raise CoachError("FAILED_PRECONDITION", "Your coach needs to reach Level 3 (Gold) to coach.")
    if coach_active >= MAX_STUDENTS:
        raise CoachError("FAILED_PRECONDITION", "This coach already has %d students." % MAX_STUDENTS)
    if student_has_coach:
        raise CoachError("FAILED_PRECONDITION", "You already have a coach. End that coaching first.")


def _clean(text, n):
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(text or "")).strip()
    return re.sub(r"\s+", " ", s)[:n]


def validate_task(data, now_ms):
    """{kind, n, days, text} -> the task doc, or CoachError."""
    data = data if isinstance(data, dict) else {}
    kind = data.get("kind")
    if kind not in KINDS:
        raise CoachError("INVALID_ARGUMENT", "Pick a task from the list.")
    tpl, lo, hi = KINDS[kind]
    try:
        n = int(data.get("n") if kind != "custom" else 1)
        days = int(data.get("days") or 7)
    except (TypeError, ValueError):
        raise CoachError("INVALID_ARGUMENT", "The number and the days must be numbers.")
    if not lo <= n <= hi:
        raise CoachError("INVALID_ARGUMENT", "Pick a number from %d to %d." % (lo, hi))
    if days not in TASK_DAYS:
        raise CoachError("INVALID_ARGUMENT", "Pick 1, 3, 7 or 14 days.")
    text = _clean(data.get("text"), 120) if kind == "custom" else ""
    if kind == "custom" and len(text) < 3:
        raise CoachError("INVALID_ARGUMENT", "Write what the task is (at least 3 characters).")
    label = tpl.format(n=n, s="" if n == 1 else "s", text=text)
    return {"kind": kind, "n": n, "text": text, "label": label, "progress": 0, "status": "open",
            "createdAt": now_ms, "dueAt": now_ms + days * 86400000, "doneAt": None}


def advance(task, ev, n, now_ms):
    """Count an event toward an open, matching, unexpired task. Returns (task, just_done)."""
    t = dict(task)
    if t.get("status") != "open" or t.get("kind") != ev or t.get("kind") == "custom":
        return t, False
    if now_ms > int(t.get("dueAt") or 0):
        t["status"] = "expired"
        return t, False
    t["progress"] = min(int(t.get("n") or 1), int(t.get("progress") or 0) + max(0, int(n)))
    if t["progress"] >= int(t.get("n") or 1):
        t["status"], t["doneAt"] = "done", now_ms
        return t, True
    return t, False


def validate_note(data, today_count):
    data = data if isinstance(data, dict) else {}
    text = _clean(data.get("text"), MAX_NOTE)
    reaction = data.get("reaction") if data.get("reaction") in REACTIONS else None
    trade = str(data.get("tradeId") or "")
    if trade and not _ID_RE.match(trade):
        raise CoachError("INVALID_ARGUMENT", "That trade isn't valid.")
    if not text and not reaction:
        raise CoachError("INVALID_ARGUMENT", "Write a note.")
    if today_count >= NOTES_PER_DAY:
        raise CoachError("RESOURCE_EXHAUSTED", "That's a lot of notes for one day. Try again tomorrow.")
    return text, reaction, trade or None


def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    v = float(v)
    return v if 0 < v < 1e7 else None


def validate_play(data, universe, today_count):
    """A coach's chart play -> {sym, tf, title, note, shapes}. Shapes: {k, c, pts: [{d, p}], text?}."""
    data = data if isinstance(data, dict) else {}
    sym = str(data.get("sym") or "").upper()
    if not _SYM_RE.match(sym) or sym not in universe:
        raise CoachError("INVALID_ARGUMENT", "Pick a stock from the Zelos list.")
    tf = data.get("tf") if data.get("tf") in PLAY_TFS else None
    if not tf:
        raise CoachError("INVALID_ARGUMENT", "Pick a chart timeframe.")
    title = _clean(data.get("title"), MAX_TITLE)
    if not title:
        raise CoachError("INVALID_ARGUMENT", "Give the play a title.")
    note = _clean(data.get("note"), MAX_NOTE)
    raw = data.get("shapes")
    if not isinstance(raw, list) or not raw:
        raise CoachError("INVALID_ARGUMENT", "Draw something on the chart first.")
    if len(raw) > MAX_SHAPES:
        raise CoachError("INVALID_ARGUMENT", "That's more than %d drawings. Remove a few." % MAX_SHAPES)
    shapes = []
    for sh in raw:
        sh = sh if isinstance(sh, dict) else {}
        k = sh.get("k")
        if k not in SHAPE_KINDS:
            raise CoachError("INVALID_ARGUMENT", "That drawing isn't supported.")
        pts = sh.get("pts") if isinstance(sh.get("pts"), list) else []
        if len(pts) != SHAPE_KINDS[k]:
            raise CoachError("INVALID_ARGUMENT", "A drawing is missing a point.")
        clean_pts = []
        for p in pts:
            p = p if isinstance(p, dict) else {}
            d, price = str(p.get("d") or ""), _num(p.get("p"))
            if not _BAR_RE.match(d) or price is None:
                raise CoachError("INVALID_ARGUMENT", "A drawing has a point off the chart.")
            clean_pts.append({"d": d, "p": round(price, 4)})
        item = {"k": k, "c": sh.get("c") if sh.get("c") in SHAPE_COLORS else "blue", "pts": clean_pts}
        text = _clean(sh.get("text"), MAX_SHAPE_TEXT)
        if k == "text" and not text:
            raise CoachError("INVALID_ARGUMENT", "A text label is empty.")
        if text:
            item["text"] = text
        shapes.append(item)
    if today_count >= PLAYS_PER_DAY:
        raise CoachError("RESOURCE_EXHAUSTED", "That's %d plays today. Try again tomorrow." % PLAYS_PER_DAY)
    return {"sym": sym, "tf": tf, "title": title, "note": note, "shapes": shapes}


def validate_comment(data, count):
    data = data if isinstance(data, dict) else {}
    text = _clean(data.get("text"), MAX_COMMENT)
    if not text:
        raise CoachError("INVALID_ARGUMENT", "Write a comment.")
    if count >= MAX_COMMENTS:
        raise CoachError("RESOURCE_EXHAUSTED", "This play has %d comments. Start a new one." % MAX_COMMENTS)
    return text


def summary(user, profile, trades, missions, today):
    """What the coach sees, built by the server from the student's own records."""
    user, profile, missions = user or {}, profile or {}, missions or {}
    day = missions.get("day") or {}
    streak = missions.get("streak") or {}
    done = day.get("done") if day.get("date") == today else {}
    out_trades = []
    for t in trades or []:
        pnl = t.get("pnl")
        if not isinstance(pnl, (int, float)):
            continue
        out_trades.append({"id": str(t.get("id") or "")[:80], "sym": str(t.get("sym") or "")[:10],
                           "side": "short" if t.get("side") == "short" else "long",
                           "qty": t.get("qty") if isinstance(t.get("qty"), (int, float)) else None,
                           "entry": t.get("entry") if isinstance(t.get("entry"), (int, float)) else None,
                           "exit": t.get("exit") if isinstance(t.get("exit"), (int, float)) else None,
                           "pnl": round(float(pnl), 2), "pct": round(float(t.get("pct") or 0), 2),
                           "at": int(t.get("at") or 0)})
    return {"xp": int(user.get("xp") or 0), "level": int(profile.get("level") or 0), "levelName": profile.get("levelName") or None,
            "equity": profile.get("equity") if isinstance(profile.get("equity"), (int, float)) else None,
            "growthPct": profile.get("growthPct") if isinstance(profile.get("growthPct"), (int, float)) else None,
            "trades": out_trades[:10], "missionsToday": len(done or {}),
            "streak": int(streak.get("days") or 0) if streak.get("lastDate") else 0}
