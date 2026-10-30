"""The War Score and the comeback rules (docs/WAR_DESIGN.md §10, W6; approved 2026-10-29; owner
2026-10-30: the trading return is the War balance change during the War). Pure rules here (unit
tests: scripts/warscore_test.py); main.py keeps live standings on the War and the final results.

War Score (0-100) = 60% Trading + 40% Strategy
  Trading   the War return on a straight scale: -10% -> 0, 0% -> 50, +10% -> 100 (capped)
  Strategy  your territory points / the highest territory points in the War x 100
  Territory points, counted at the end: land you claimed in secret at the start 2, neutral land
  claimed later 1, land taken or held in a battle 3, land given up by concession 1; plus Hot zone
  points, the contested-battle winner's +1 and Giant-slayer points.
  Ties: the higher return, then more battle wins.

Comeback rules: the leader (1st on the live War Score) gets no free decline; beating the leader in
a battle is +1 point (Giant-slayer) and taking the leader's land +1 more.
"""
TRADING_WEIGHT = 0.6
STRATEGY_WEIGHT = 0.4
RETURN_CAP = 10.0                  # +-10% maps to 0..100
LAND_POINTS = {"claimed": 2, "neutral": 1, "conceded": 1, "captured": 3, "defended": 3, "contested-battle": 3}
GIANT_SLAYER = 1


def trading(ret_pct):
    """0..100 from a War return in percent."""
    return max(0.0, min(100.0, 50 + 50 * ret_pct / RETURN_CAP))


def land_points(war):
    pts = {u: 0 for u in war.get("players") or []}
    for cell in (war.get("map") or {}).values():
        if cell.get("state") == "owned" and cell.get("owner") in pts:
            pts[cell["owner"]] += LAND_POINTS.get(cell.get("how"), 2)
    return pts


def points(war):
    """Territory points per player, with every bonus."""
    pts = land_points(war)
    for extra in ("hotPoints", "bonusPoints", "slayerPoints"):
        for u, n in (war.get(extra) or {}).items():
            if u in pts:
                pts[u] += n
    return pts


def standings(war, returns):
    """[{uid, rank, score, trading, strategy, ret, points, wins}] best first. returns: {uid: % return}."""
    pts = points(war)
    top = max(pts.values() or [0])
    wins = war.get("battleWins") or {}
    rows = []
    for u in war.get("players") or []:
        ret = round(returns.get(u, 0.0), 2)
        tr = trading(ret)
        st = 100.0 * pts[u] / top if top > 0 else 0.0
        rows.append({"uid": u, "score": round(TRADING_WEIGHT * tr + STRATEGY_WEIGHT * st, 1), "trading": round(tr, 1),
                     "strategy": round(st, 1), "ret": ret, "points": pts[u], "wins": wins.get(u, 0)})
    rows.sort(key=lambda r: (-r["score"], -r["ret"], -r["wins"], r["uid"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def leader(war):
    """The uid 1st on the stored live standings (None before there are any)."""
    rows = war.get("standings") or []
    return rows[0]["uid"] if rows and len(rows) > 1 else None


def add_win(war, uid):
    if not uid:
        return war
    wins = dict(war.get("battleWins") or {})
    wins[uid] = wins.get(uid, 0) + 1
    return dict(war, battleWins=wins)


def slayer(war, winner, loser, captured):
    """Giant-slayer: +1 for beating the leader in a battle, +1 more for taking the leader's land."""
    lead = leader(war)
    if not winner or not lead or loser != lead or winner == lead:
        return war
    pts = dict(war.get("slayerPoints") or {})
    pts[winner] = pts.get(winner, 0) + GIANT_SLAYER + (GIANT_SLAYER if captured else 0)
    return dict(war, slayerPoints=pts)
