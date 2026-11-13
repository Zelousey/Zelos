"""Unit tests for functions/posts.py (community posts). python3 scripts/posts_test.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "functions"))
import posts as P

fails = 0
def ok(c, m):
    global fails
    print(("ok   " if c else "FAIL ") + m)
    fails += 0 if c else 1

def raises(fn, *a):
    try:
        fn(*a)
        return False
    except ValueError:
        return True

ok(P.validate({"source": "solo", "ref": "abcDEF123", "thesis": "  Bought   the dip\\n\\n\\n\\nheld  "}) == ("solo", "abcDEF123", "Bought the dip\\n\\nheld")
   or P.validate({"source": "solo", "ref": "abcDEF123", "thesis": "  Bought   the dip\n\n\n\nheld  "})[2] == "Bought the dip\n\nheld", "thesis cleaned: spaces, at most one blank line")
ok(len(P.validate({"source": "battle", "ref": "w1", "thesis": "x" * 400})[2]) == 280, "thesis cut at 280")
ok(raises(P.validate, {"source": "crypto", "ref": "x"}) and raises(P.validate, {"source": "solo", "ref": "../x"}) and raises(P.validate, {"source": "solo", "ref": "x", "thesis": "y" * 2000}), "bad source, ref or a huge thesis refused")
ok(P.post_id("u1", "solo", "h9") == "u1_s_h9" and P.post_id("u1", "battle", "w9") == "u1_b_w9", "one post per trade or battle")
trade = {"kind": "trade", "sym": "AAPL", "qty": 10, "entry": 318.4, "exit": 333.63, "pnl": 152.3, "pct": 4.78, "openDay": "2026-11-02", "closeDay": "2026-11-12", "at": 1}
c = P.solo_card(trade)
ok(c == {"sym": "AAPL", "qty": 10, "entry": 318.4, "exit": 333.63, "pnl": 152.3, "pct": 4.78, "openDay": "2026-11-02", "closeDay": "2026-11-12"}, "a closed trade's card: " + str(c))
ok(P.solo_card(dict(trade, opt="AAPL261218C00340000", label="AAPL Dec 18 $340 call"))["option"] == "AAPL Dec 18 $340 call", "an option trade says which contract")
ok(raises(P.solo_card, dict(trade, kind="fill")) and raises(P.solo_card, None) and raises(P.solo_card, dict(trade, pnl="9999")), "only a real closed trade (not a fill, not made-up numbers)")
war = {"status": "ended", "name": "Friday Duel", "modes": {"lms": True, "storms": False, "bounties": True}, "endedAt": 5,
       "results": [{"uid": "a", "rank": 1, "pnlPct": 6.2, "pnl": 620, "start": 10000, "final": 10620, "trades": 7}, {"uid": "b", "rank": 2, "pnlPct": -1, "pnl": -100, "start": 10000, "final": 9900, "trades": 3}]}
b = P.battle_card(war, "a")
ok(b["rank"] == 1 and b["of"] == 2 and b["pnlPct"] == 6.2 and b["modes"] == ["bounties", "lms"] and b["name"] == "Friday Duel", "a battle card: your place, return and its modes")
ok(raises(P.battle_card, dict(war, status="active"), "a") and raises(P.battle_card, war, "zzz"), "only a finished battle you were in")
# the chart around a trade (owner 2026-11-13: the chart, when they bought, when they sold)
days = ["2026-11-%02d,1,1,1,%d,9" % (d, 100 + d) for d in range(1, 21)]
ch = P.trade_chart(days, "2026-11-05", "2026-11-12")
ok(ch["t"][0] == "2026-11-02" and ch["t"][-1] == "2026-11-15", "a few days before the buy and after the sale: %s .. %s" % (ch["t"][0], ch["t"][-1]))
ok(ch["t"][ch["buy"]] == "2026-11-05" and ch["t"][ch["sell"]] == "2026-11-12" and ch["p"][ch["buy"]] == 105, "buy and sell marked on their days")
mins = ["2026-11-12 %02d:%02d,1,1,1,%s" % (9 + (m + 30) // 60, (m + 30) % 60, 50 + m * 0.1) for m in range(390)]
ci = P.trade_chart(mins, "2026-11-12 10:00", "2026-11-12 15:30")
ok(len(ci["t"]) <= 92 and ci["t"][ci["buy"]] == "2026-11-12 10:00" and ci["t"][ci["sell"]] == "2026-11-12 15:30", "a day trade: minute prices, thinned to ~90 points, buy and sell kept exactly")
ok(P.trade_chart(days, "2026-12-01", "2026-12-05") is None and P.trade_chart([], "a", "b") is None, "no bars for the trade: no chart (the card still posts)")
cv = P.curve_chart([{"t": i, "eq": 500 + i} for i in range(300)])
ok(len(cv["t"]) <= 90 and cv["p"][0] == 500 and cv["p"][-1] == 799, "a battle's value line, thinned, first and last kept")
sys.exit(1 if fails else 0)
