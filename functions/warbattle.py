"""Contested battles on the War map (docs/WAR_DESIGN.md §4; owner 2026-10-29: a 10-minute side pick,
then a 1-hour battle). Pure rules here (unit tests: scripts/warbattle_test.py); main.py runs them
from the War's deadline job and the war_lobby action "pick".

A territory where the runner-up had at least 80% of the leader's soldiers is settled by a battle,
stored on the War as battles[territory] (everyone in the War can read it):

    waiting   someone involved is in their quiet hours: it waits until they're all awake (at most a day)
    picking   2 players: the one with more soldiers there has Command (a coin flip if equal) and picks
              Bull or Bear within 10 minutes (random if not); the other gets the other side.
              3+ players ("best pick"): each picks a stock from the territory and a side, in secret
              (their pick is kept with their placement until the battle starts); missing picks are random
    running   1 hour on the simulated War zone prices
    done      2 players: the side matching the price move wins; unchanged: Command wins. 3+: the
              biggest move in the picked direction wins; a tie goes to Command

The winner takes the territory (+5 soldiers to their reserve, +1 territory point); each loser gets a
Redeploy pass. No money is at stake.
"""
from warmap import NAMES
from warmarket import BY_SYM, COMPANIES, WarError

PICK_MS = 10 * 60000
BATTLE_MS = 3600000
MAX_WAIT_MS = 24 * 3600000
BONUS_SOLDIERS = 5
BONUS_POINTS = 1
SIDES = ("bull", "bear")


def stocks_of(territory):
    return [c[0] for c in COMPANIES if c[2] == territory]


def new_battle(territory, contenders, soldiers, now_ms, rng, awake_at):
    """A battle for a contested territory. soldiers: {uid: soldiers there} (only used for Command);
    awake_at: when everyone involved is out of quiet hours (now or later)."""
    top = max(soldiers.get(u, 0) for u in contenders)
    tied = [u for u in contenders if soldiers.get(u, 0) == top]
    command = tied[int(rng.random() * len(tied)) % len(tied)]
    b = {"territory": territory, "kind": "duel" if len(contenders) == 2 else "best", "players": list(contenders),
         "command": command, "createdAt": now_ms, "sides": {}, "picks": {}}
    return _wake(b, now_ms, awake_at)


def _wake(b, now_ms, awake_at):
    if awake_at > now_ms and awake_at < b["createdAt"] + MAX_WAIT_MS:
        return dict(b, stage="waiting", wakeAt=awake_at)
    return dict(b, stage="picking", pickBy=now_ms + PICK_MS, wakeAt=None)


def wake(b, now_ms, awake_at):
    """A waiting battle checks again whether everyone is awake (after a day it starts anyway)."""
    return _wake(b, now_ms, awake_at) if b.get("stage") == "waiting" else b


def validate_pick(b, uid, data):
    """(side, sym) for uid's pick, or WarError. Duel: only Command picks, a side. Best pick: each
    player picks a stock from the territory and a side."""
    data = data if isinstance(data, dict) else {}
    if uid not in b.get("players", []):
        raise WarError("PERMISSION_DENIED", "You're not in this battle.")
    if b.get("stage") != "picking":
        raise WarError("FAILED_PRECONDITION", "Picks are closed for this battle.")
    side = data.get("side")
    if side not in SIDES:
        raise WarError("INVALID_ARGUMENT", "Pick Bull or Bear.")
    if b["kind"] == "duel":
        if uid != b["command"]:
            raise WarError("PERMISSION_DENIED", "The player with Command picks the side.")
        return side, None
    sym = data.get("sym")
    if sym not in stocks_of(b["territory"]):
        raise WarError("INVALID_ARGUMENT", "Pick a stock from %s." % NAMES[b["territory"]])
    return side, sym


def ready_to_start(b, picks, now_ms):
    """Start when the picks are in (Command's side, or every best-pick player) or time is up."""
    if b.get("stage") != "picking":
        return False
    if now_ms >= b["pickBy"]:
        return True
    if b["kind"] == "duel":
        return bool(b.get("sides"))
    return all(u in picks for u in b["players"])


def start(b, picks, prices, now_ms, rng):
    """Into the 1-hour battle: missing picks are random; the starting prices are recorded.
    picks: {uid: {side, sym}} for best pick (kept secret until now)."""
    if b["kind"] == "duel":
        stocks = stocks_of(b["territory"])
        sym = stocks[int(rng.random() * len(stocks)) % len(stocks)]
        side = (b.get("sides") or {}).get(b["command"]) or SIDES[int(rng.random() * 2) % 2]
        other = [u for u in b["players"] if u != b["command"]][0]
        sides = {b["command"]: side, other: "bear" if side == "bull" else "bull"}
        return dict(b, stage="running", sym=sym, sides=sides, start={sym: prices[sym]}, startsAt=now_ms, endsAt=now_ms + BATTLE_MS,
                    randomSide=not (b.get("sides") or {}).get(b["command"]))
    out = {}
    for u in b["players"]:
        p = picks.get(u) or {}
        if p.get("side") in SIDES and p.get("sym") in stocks_of(b["territory"]):
            out[u] = {"side": p["side"], "sym": p["sym"]}
        else:
            stocks = stocks_of(b["territory"])
            out[u] = {"side": SIDES[int(rng.random() * 2) % 2], "sym": stocks[int(rng.random() * len(stocks)) % len(stocks)], "random": True}
    syms = sorted({p["sym"] for p in out.values()})
    return dict(b, stage="running", picks=out, start={s: prices[s] for s in syms}, startsAt=now_ms, endsAt=now_ms + BATTLE_MS)


def finish(b, prices, now_ms):
    """The battle's result once its hour is up: the battle with end prices and the winner."""
    end = {s: prices[s] for s in b["start"]}
    if b["kind"] == "duel":
        move = end[b["sym"]] - b["start"][b["sym"]]
        want = "bull" if move > 0 else "bear" if move < 0 else None
        winner = next((u for u, sd in b["sides"].items() if sd == want), b["command"]) if want else b["command"]
        return dict(b, stage="done", end=end, winner=winner, doneAt=now_ms)
    score = {}
    for u, p in b["picks"].items():
        ch = end[p["sym"]] / b["start"][p["sym"]] - 1
        score[u] = round(ch if p["side"] == "bull" else -ch, 8)
    best = max(score.values())
    top = [u for u in b["players"] if score[u] == best]
    winner = b["command"] if b["command"] in top else top[0]
    return dict(b, stage="done", end=end, scores=score, winner=winner, doneAt=now_ms)


def due(b):
    return {"waiting": b.get("wakeAt"), "picking": b.get("pickBy"), "running": b.get("endsAt")}.get(b.get("stage"))


def apply_result(war, b, now_ms):
    """The War after a battle: the winner owns the territory; +1 point to the winner; a Redeploy
    pass for each loser. (The +5 soldiers go to the winner's reserve, kept with their placement.)"""
    t = b["territory"]
    board = dict(war.get("map") or {})
    board[t] = {"state": "owned", "owner": b["winner"], "how": "contested-battle", "since": now_ms}
    bonus = dict(war.get("bonusPoints") or {})
    bonus[b["winner"]] = bonus.get(b["winner"], 0) + BONUS_POINTS
    passes = dict(war.get("redeployPasses") or {})
    for u in b["players"]:
        if u != b["winner"]:
            passes[u] = passes.get(u, 0) + 1
    return dict(war, map=board, bonusPoints=bonus, redeployPasses=passes, updatedAt=now_ms)


def side_name(side):
    return "Bull" if side == "bull" else "Bear"


def result_line(b, names):
    who = names.get(b["winner"], "Trader")
    if b["kind"] == "duel":
        return "%s won the battle for %s (%s on %s)." % (who, NAMES[b["territory"]], side_name(b["sides"][b["winner"]]), BY_SYM[b["sym"]][1])
    p = b["picks"][b["winner"]]
    return "%s won the battle for %s (%s on %s)." % (who, NAMES[b["territory"]], side_name(p["side"]), BY_SYM[p["sym"]][1])
