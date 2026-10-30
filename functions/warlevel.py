"""Battle Level: War-only progress across Wars (docs/WAR_DESIGN.md §17, §24.4; approved 2026-10-29;
rank thresholds proposed 2026-10-30). Pure rules here (unit tests: scripts/warlevel_test.py);
main.py adds the points to the War profile (warProfiles/{uid}.battlePoints) after each result.

Earned only from real results in Wars with at least 2 players, and never lost:
    a battle won (attack or contested) +3   a successful defence +3   a capture +5 more
    Giant-slayer +2   a War win +10   2nd or 3rd place +5
Concessions and neutral claims give nothing. It gives no power inside a private War with equal
armies (the default); in open War zones (W6b) the army is 100 + 10 per rank above Recruit, at most
150 ("level armies").
"""
POINTS = {"battle": 3, "defence": 3, "capture": 5, "slayer": 2, "warWin": 10, "top3": 5}
RANKS = (("Recruit", 0), ("Soldier", 20), ("Sergeant", 60), ("Captain", 120), ("Commander", 200), ("General", 300))
BASE_ARMY = 100
PER_RANK = 10
MAX_ARMY = 150


def rank_index(points):
    i = 0
    for n, (_, need) in enumerate(RANKS):
        if (points or 0) >= need:
            i = n
    return i


def rank(points):
    return RANKS[rank_index(points)][0]


def next_rank(points):
    """(name, points still needed) for the next rank, or None at General."""
    i = rank_index(points)
    if i + 1 >= len(RANKS):
        return None
    name, need = RANKS[i + 1]
    return name, need - (points or 0)


def army(points):
    """Soldiers for a level army: 100 + 10 per rank above Recruit, at most 150."""
    return min(MAX_ARMY, BASE_ARMY + PER_RANK * rank_index(points))


def attack_awards(done):
    """[(uid, points, reason)] for a finished attack (concessions, draws and cancellations give none)."""
    r = done.get("result")
    out = []
    if r == "attacker":
        out.append((done["attacker"], POINTS["battle"], "battle"))
        if done.get("captured"):
            out.append((done["attacker"], POINTS["capture"], "capture"))
        winner = done["attacker"]
    elif r == "defender":
        out.append((done["defender"], POINTS["defence"], "defence"))
        winner = done["defender"]
    else:
        return out
    if done.get("slayer"):
        out.append((winner, POINTS["slayer"], "slayer"))
    return out


def battle_awards(b):
    out = [(b["winner"], POINTS["battle"], "battle")] if b.get("winner") else []
    if b.get("winner") and b.get("slayer"):
        out.append((b["winner"], POINTS["slayer"], "slayer"))
    return out


def result_awards(rows):
    """War win +10; 2nd and 3rd +5 (only Wars with at least 2 players)."""
    if len(rows) < 2:
        return []
    out = []
    for r in rows:
        if r["rank"] == 1:
            out.append((r["uid"], POINTS["warWin"], "warWin"))
        elif r["rank"] <= 3:
            out.append((r["uid"], POINTS["top3"], "top3"))
    return out
