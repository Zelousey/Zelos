"""Unit tests for functions/missions.py (server-counted missions). python3 scripts/missions_test.py"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "functions"))
import missions as M
import xp as XP

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

D, Y, W = "2026-10-08", "2026-10-07", "w2026_41"

# same missions, goals and XP as the website and the XP table
js = open(os.path.join(ROOT, "zelos-progress.js")).read()
for mid, ev, goal in M.DAILY + M.WEEKLY:
    ok(re.search(r"id: '%s', label: '[^']*', goal: %d, xp: \d+, ev: '%s'" % (mid, goal, ev), js) is not None, "%s matches zelos-progress.js (goal %d, event %s)" % (mid, goal, ev))
ok({m for m, _, _ in M.DAILY} == set(XP.DAILY_MISSIONS) and {m for m, _, _ in M.WEEKLY} == set(XP.WEEKLY_MISSIONS), "mission ids match functions/xp.py")
ok(set(M.STREAK_DAYS) == set(XP.STREAK_REWARDS) and "STREAK_NEED = %d" % M.STREAK_NEED in js, "streak rule and rewards match")

# a trade completes the daily trade mission once
s, done = M.apply(None, "trade", D, Y, W)
ok(done == ["d:%s:trade" % D] and s["day"]["counts"]["trade"] == 1 and s["week"]["counts"]["trade"] == 1, "first trade: daily mission done %s" % done)
s, done = M.apply(s, "trade", D, Y, W)
ok(done == [] and s["day"]["counts"]["trade"] == 2, "second trade: counted, nothing paid twice")

# analyze: 3 different stocks, each once a day
for sym in ("AAPL", "AAPL", "MSFT"):
    s, done = M.apply(s, "analyze", D, Y, W, ref=sym)
ok(s["day"]["counts"]["analyze"] == 2 and done == [], "same stock twice counts once (2 of 3)")
s, done = M.apply(s, "analyze", D, Y, W, ref="NVDA")
ok("d:%s:analyze" % D in done, "third stock completes analyze")
ok(any(r.startswith("streak:%s:" % D) for r in done) is False and s["streak"]["days"] == 1 and s["streak"]["lastDate"] == D, "two daily missions keep the streak (day 1)")
ok(s["week"]["counts"]["mday"] == 1, "a streak day counts toward 'keep your streak 5 days'")
s, done = M.apply(s, "analyze", D, Y, W, ref=None)
ok(done == [] and s["day"]["counts"]["analyze"] == 3, "analyze without a symbol doesn't count")

# xp counts by amount; weekly xp300
s, done = M.apply(s, "xp", D, Y, W, n=120)
ok("d:%s:xp" % D in done, "100 XP in a day completes the xp mission")
s, done = M.apply(s, "xp", D, Y, W, n=200)
ok(done == ["w:%s:xp300" % W], "300 XP in a week completes xp300: %s" % done)

# a new day resets daily counts, keeps the week; streak continues from yesterday
s2, _ = M.apply(s, "news", "2026-10-09", D, W)
ok(s2["day"]["date"] == "2026-10-09" and s2["day"]["counts"] == {"news": 1} and s2["week"]["counts"]["trade"] == 2, "new day: daily counts reset, weekly kept")
s2, done = M.apply(s2, "trade", "2026-10-09", D, W)
ok(s2["streak"]["days"] == 2 and s2["streak"]["start"] == D, "streak continues (day 2)")
# streak reward on day 3
s3, _ = M.apply(s2, "news", "2026-10-10", "2026-10-09", W)
s3, done = M.apply(s3, "trade", "2026-10-10", "2026-10-09", W)
ok("streak:%s:3" % D in done, "3-day streak reward: %s" % done)
ok(all(XP.decide("mission", r, "2026-10-10")[2] is None for r in done), "every refId the server pays is one xp.py accepts")
# a gap restarts the streak
s4, _ = M.apply(s3, "news", "2026-10-13", "2026-10-12", "w2026_42")
s4, _ = M.apply(s4, "trade", "2026-10-13", "2026-10-12", "w2026_42")
ok(s4["streak"]["days"] == 1 and s4["streak"]["best"] == 3 and s4["week"]["key"] == "w2026_42" and s4["week"]["counts"].get("trade") == 1, "a missed day restarts the streak; new week starts at zero")

# junk state and events
s5, done = M.apply({"day": "junk", "week": {"counts": {"trade": "x"}, "done": {"wins3": "yes"}}}, "win", D, Y, W)
ok(s5["week"]["counts"] == {"win": 1} and s5["week"]["done"] == {}, "odd stored shapes are cleaned")
ok(M.apply(None, "hack", D, Y, W)[1] == [] and M.apply(None, "xp", D, Y, W, n=-5)[1] == [], "unknown events and negative amounts count for nothing")

# switching to server counting keeps the streak the website stored
seeded = M.seed_streak(None, {"streak": {"days": 6, "best": 9, "lastDate": Y, "start": "2026-10-02"}})
s6, _ = M.apply(seeded, "trade", D, Y, W)
s6, done = M.apply(s6, "news", D, Y, W)
ok(s6["streak"]["days"] == 7 and s6["streak"]["best"] == 9 and "streak:2026-10-02:7" in done, "website streak of 6 carries on to day 7 (+ its reward): %s" % s6["streak"])
ok(M.seed_streak({"streak": {"days": 2, "lastDate": D}}, {"streak": {"days": 9, "lastDate": Y}})["streak"]["days"] == 2, "once the server has a streak, the website copy is ignored")
ok(M.seed_streak(None, {"streak": "junk"})["streak"]["lastDate"] == "", "junk website streak ignored")

# what the browser may report
syms = {"AAPL", "MSFT"}
ok(M.check_client_event("analyze", "aapl", syms) == ("analyze", "AAPL"), "analyze: a Zelos-list symbol")
ok(M.check_client_event("analyze", "ZZZZ", syms) is None, "analyze: unknown symbol refused")
ok(M.check_client_event("news", "fed:fomc", syms) == ("news", "fed:fomc"), "news counts")
ok(M.check_client_event("trade", "", syms) is None and M.check_client_event("xp", "", syms) is None, "browsers can't report trades or XP")

print("\n%s (%d failed)" % ("ALL MISSION CHECKS PASSED" if not fails else "SOME CHECKS FAILED", fails))
sys.exit(1 if fails else 0)
