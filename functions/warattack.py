"""Attacks on owned territory in a private War (docs/WAR_DESIGN.md §5-§7; approved 2026-10-29; owner
2026-10-30: an attacker's wins are kept until the territory is taken or changes hands). Pure rules
here (unit tests: scripts/warattack_test.py); main.py runs them (war_lobby actions "attack",
"answer", "skipWait" and the once-a-minute deadline job).

An attack, stored on the War while it's open (attacks[id]) and archived when it's done:

    answering  the defender has 2 hours (counted outside their quiet hours) to accept, with
               Counter-pick (swap the stock, once per War day), or decline. The first decline each
               War day is free; later ones concede 1 progress to the attacker (no money). No answer
               means it's accepted. A reminder goes out 30 minutes before.
    running    1 hour on the War zone price of the stock: the attacker's side against the other
               side. Each side holds a $5,000 stake from their War cash (the defender at most what
               they have). A move within 0.10% is a draw: stakes back, nothing else.
    done       the winner takes both stakes. Attacker wins: +1 progress, the defender loses 5
               soldiers; with 1 + (defender's soldiers there ÷ 20) wins the territory is captured
               (+10 soldiers to the attacker, the defender's soldiers there retreat at half).
               Defender wins: +3 soldiers to the defender, the attacker loses 5.

Who may attack: $5,000 free War cash, and a War return of 0% or more, or a sale in this War at
least 1% above its average cost in the last 2 War days (the 1% is provisional), or a Redeploy pass.
Limits: 1 attack you started open at a time, 2 incoming at most, one battle per territory, the
same attacker -> defender at most 3 a War day, none in the War's last hour, and not on land you
lost in the last War day (skip that wait once per War for 100 tokens).
"""
from warmap import NAMES
from warmarket import BY_SYM, COMPANIES, WarError

STAKE = 5000.0
ANSWER_MS = 2 * 3600000
REMIND_MS = 30 * 60000
BATTLE_MS = 3600000
DRAW_BAND = 0.001                 # 0.10%
DAY_MS = 24 * 3600000
LAST_HOUR_MS = 3600000
WAIT_MS = DAY_MS                  # the one-day wait before attacking back land you lost
SKIP_WAIT_TOKENS = 100            # owner-approved (E2), once per War
QUALIFYING = 0.01                 # a sale at least 1% above its average cost (W3, provisional)
QUALIFY_WINDOW_MS = 2 * DAY_MS
MAX_OPEN = 1
MAX_INCOMING = 2
MAX_PAIR_PER_DAY = 3
LOSE = 5
CAPTURE = 10
DEFEND = 3
SIDES = ("bull", "bear")


def stocks_of(territory):
    return [c[0] for c in COMPANIES if c[2] == territory]


def war_day(war, now_ms):
    start = war.get("startedAt")
    return int((now_ms - (start if isinstance(start, (int, float)) else now_ms)) // DAY_MS)


def needed_wins(defender_soldiers):
    return 1 + max(0, int(defender_soldiers)) // 20


def qualifying_sale(fill, since_ms):
    """A sale in this War, in the window, at least 1% above its average cost (pnl = qty x (price - avg))."""
    if fill.get("side") != "sell" or (fill.get("at") or 0) < since_ms or not fill.get("qty"):
        return False
    per = (fill.get("pnl") or 0) / fill["qty"]
    avg = fill["price"] - per
    return avg > 0 and per / avg >= QUALIFYING - 1e-12


def eligible(war_return, sales, now_ms, war_start_ms):
    """Performance check: War return >= 0, or a qualifying sale in this War in the last 2 War days."""
    since = max(war_start_ms, now_ms - QUALIFY_WINDOW_MS)
    return war_return >= 0 or any(qualifying_sale(f, since) for f in sales)


def _open(war):
    return [a for a in (war.get("attacks") or {}).values() if a.get("stage") in ("answering", "running")]


def check_attack(war, uid, data, now_ms, cash, performance_ok):
    """(territory, sym, side, use_pass) for a new attack, or WarError. performance_ok: eligible()."""
    data = data if isinstance(data, dict) else {}
    t, sym, side = data.get("territory"), data.get("sym"), data.get("side")
    if war.get("status") != "active" or war.get("phase") != "holding":
        raise WarError("FAILED_PRECONDITION", "Attacks start after the map is revealed.")
    if now_ms >= war["endsAt"] - LAST_HOUR_MS:
        raise WarError("FAILED_PRECONDITION", "No new attacks in the War's last hour.")
    cell = (war.get("map") or {}).get(t)
    if not cell or cell.get("state") != "owned" or cell.get("owner") == uid:
        raise WarError("FAILED_PRECONDITION", "You can only attack a territory another player holds.")
    if sym not in stocks_of(t):
        raise WarError("INVALID_ARGUMENT", "Pick a stock from %s." % NAMES[t])
    if side not in SIDES:
        raise WarError("INVALID_ARGUMENT", "Pick Bull or Bear.")
    defender = cell["owner"]
    opened = _open(war)
    if sum(1 for a in opened if a["attacker"] == uid) >= MAX_OPEN:
        raise WarError("FAILED_PRECONDITION", "You already have an attack under way. Finish it first.")
    if sum(1 for a in opened if a["defender"] == defender) >= MAX_INCOMING:
        raise WarError("FAILED_PRECONDITION", "%s is already defending 2 attacks." % ((war.get("names") or {}).get(defender) or "That player"))
    if any(a["territory"] == t for a in opened) or ((war.get("battles") or {}).get(t) or {}).get("stage") not in (None, "done"):
        raise WarError("FAILED_PRECONDITION", "There's already a battle for %s." % NAMES[t])
    day = war_day(war, now_ms)
    if (war.get("pairs") or {}).get("%s>%s:%d" % (uid, defender, day), 0) >= MAX_PAIR_PER_DAY:
        raise WarError("FAILED_PRECONDITION", "You've attacked this player 3 times today. Try someone else.")
    lost = ((war.get("lostAt") or {}).get(uid) or {}).get(t)
    if lost and now_ms - lost < WAIT_MS:
        raise WarError("FAILED_PRECONDITION", "You lost %s less than a day ago. Wait, or skip the wait once for %d tokens." % (NAMES[t], SKIP_WAIT_TOKENS),
                       {"reason": "war-wait", "territory": t, "cost": SKIP_WAIT_TOKENS})
    if cash < STAKE:
        raise WarError("FAILED_PRECONDITION", "You need $5,000 of free War cash for the stake.")
    use_pass = False
    if not performance_ok:
        passes = (war.get("redeployPasses") or {}).get(uid, 0)
        if passes > 0 and now_ms < ((war.get("passExpiry") or {}).get(uid) or 0) and data.get("usePass") is True:
            use_pass = True
        else:
            raise WarError("FAILED_PRECONDITION", "To attack, your War return must be 0% or better, or you need a sale at least 1% above its cost in the last 2 days.",
                           {"reason": "war-eligibility", "pass": passes > 0})
    return t, sym, side, use_pass


def new_attack(war, aid, uid, t, sym, side, now_ms, answer_from_ms, use_pass):
    """The War with a new attack (the attacker's stake is held by main.py)."""
    defender = war["map"][t]["owner"]
    a = {"id": aid, "attacker": uid, "defender": defender, "territory": t, "sym": sym, "side": side, "stage": "answering",
         "createdAt": now_ms, "answerBy": max(now_ms, answer_from_ms) + ANSWER_MS, "reminded": False, "stakes": {uid: STAKE}, "usedPass": use_pass}
    day = war_day(war, now_ms)
    pairs = dict(war.get("pairs") or {})
    key = "%s>%s:%d" % (uid, defender, day)
    pairs[key] = pairs.get(key, 0) + 1
    out = dict(war, attacks=dict(war.get("attacks") or {}, **{aid: a}), pairs=pairs, updatedAt=now_ms)
    if use_pass:
        out["redeployPasses"] = dict(war.get("redeployPasses") or {}, **{uid: war["redeployPasses"][uid] - 1})
    return out


def answer(war, aid, uid, data, now_ms):
    """(war, attack, kind) after the defender answers: kind "accepted", "declined" (free) or "conceded"."""
    data = data if isinstance(data, dict) else {}
    a = (war.get("attacks") or {}).get(aid)
    if not a or a["defender"] != uid:
        raise WarError("NOT_FOUND", "There's no attack on you to answer.")
    if a["stage"] != "answering":
        raise WarError("FAILED_PRECONDITION", "This attack has already been answered.")
    day = war_day(war, now_ms)
    if data.get("accept") is True:
        sym = data.get("counter")
        if sym is not None and sym != a["sym"]:
            if sym not in stocks_of(a["territory"]):
                raise WarError("INVALID_ARGUMENT", "Counter-pick a stock from %s." % NAMES[a["territory"]])
            used = (war.get("counterPicks") or {}).get("%s:%d" % (uid, day), 0)
            if used >= 1:
                raise WarError("FAILED_PRECONDITION", "You've used today's Counter-pick.")
            war = dict(war, counterPicks=dict(war.get("counterPicks") or {}, **{"%s:%d" % (uid, day): used + 1}))
            a = dict(a, sym=sym, counterPicked=True)
        return war, dict(a, accepted="answer"), "accepted"
    if data.get("accept") is not False:
        raise WarError("INVALID_ARGUMENT", "Accept or decline the attack.")
    key = "%s:%d" % (uid, day)
    free = (war.get("declines") or {}).get(key, 0) == 0 and not (war.get("noFreeDecline") or {}).get(uid)
    war = dict(war, declines=dict(war.get("declines") or {}, **{key: (war.get("declines") or {}).get(key, 0) + 1}))
    return war, dict(a, stage="done", result="declined" if free else "conceded", doneAt=now_ms), "declined" if free else "conceded"


def auto_accept(a, now_ms):
    """No answer by the deadline: accepted."""
    return dict(a, accepted="auto") if a["stage"] == "answering" and now_ms >= a["answerBy"] else a


def start(a, prices, defender_cash, now_ms):
    """Into the 1-hour battle at the current price; the defender's stake is at most their cash."""
    stake = max(0.0, min(STAKE, round(defender_cash, 2)))
    return dict(a, stage="running", start=prices[a["sym"]], startsAt=now_ms, endsAt=now_ms + BATTLE_MS,
                stakes=dict(a["stakes"], **{a["defender"]: stake}))


def result(a, price):
    """"attacker", "defender" or "draw" (a move within 0.10%)."""
    move = price / a["start"] - 1
    if abs(move) < DRAW_BAND:
        return "draw"
    up = move > 0
    return "attacker" if (a["side"] == "bull") == up else "defender"


def settle(war, a, outcome, defender_soldiers_there, now_ms):
    """The War and the effects of a finished attack. outcome: "attacker" | "defender" | "draw" |
    "conceded". defender_soldiers_there: the defender's soldiers on the territory now.
    Effects: cash {uid: amount back/won}, soldiers [(uid, territory or None, delta)], retreat (uid,
    territory) if captured, captured (bool)."""
    t, att, dfd = a["territory"], a["attacker"], a["defender"]
    stakes = a.get("stakes") or {}
    pot = sum(stakes.values())
    fx = {"cash": {}, "soldiers": [], "retreat": None, "captured": False}
    progress = {k: dict(v) for k, v in (war.get("progress") or {}).items()}
    board = dict(war.get("map") or {})
    if outcome == "draw":
        fx["cash"] = dict(stakes)
    elif outcome == "defender":
        fx["cash"] = {dfd: pot}
        fx["soldiers"] = [(dfd, None, DEFEND), (att, t, -LOSE)]
        board[t] = dict(board[t], how="defended" if board[t].get("how") != "conceded" else "conceded", since=board[t].get("since"))
    else:
        if outcome == "attacker":
            fx["cash"] = {att: pot}
            fx["soldiers"] = [(dfd, t, -LOSE)]
            left = max(0, defender_soldiers_there - LOSE)
        else:  # conceded: progress only, no money; the attacker's stake comes back
            fx["cash"] = dict(stakes)
            left = defender_soldiers_there
        mine = progress.setdefault(t, {})
        mine[att] = mine.get(att, 0) + 1
        if mine[att] >= needed_wins(left):
            fx["captured"] = True
            fx["soldiers"].append((att, None, CAPTURE))
            fx["retreat"] = (dfd, t)
            board[t] = {"state": "owned", "owner": att, "how": "captured" if outcome == "attacker" else "conceded", "since": now_ms}
            progress[t] = {}
            lost = {k: dict(v) for k, v in (war.get("lostAt") or {}).items()}
            lost.setdefault(dfd, {})[t] = now_ms
            war = dict(war, lostAt=lost)
    attacks = dict(war.get("attacks") or {})
    attacks.pop(a["id"], None)
    done = dict(a, stage="done", result=a.get("result") or outcome, doneAt=now_ms, captured=fx["captured"])
    return dict(war, attacks=attacks, map=board, progress=progress, updatedAt=now_ms), done, fx


def due(a):
    if a.get("stage") == "answering":
        return a["answerBy"] - REMIND_MS if not a.get("reminded") else a["answerBy"]
    if a.get("stage") == "running":
        return a["endsAt"]
    return None


def line(a, names):
    who, them, t = names.get(a["attacker"], "Trader"), names.get(a["defender"], "Trader"), NAMES[a["territory"]]
    r = a.get("result")
    if r == "declined":
        return "%s declined %s's attack on %s." % (them, who, t)
    if r == "conceded":
        return "%s conceded to %s's attack on %s%s." % (them, who, t, " and lost it" if a.get("captured") else "")
    if r == "draw":
        return "%s's attack on %s was a draw (%s barely moved)." % (who, t, BY_SYM[a["sym"]][1])
    if r == "cancelled":
        return "%s's attack on %s ended with the War." % (who, t)
    if r == "attacker":
        return "%s %s %s from %s." % (who, "took" if a.get("captured") else "won a battle for", t, them)
    return "%s held %s against %s." % (them, t, who)
