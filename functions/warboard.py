"""Weekly War Zone leaderboards (owner 2026-11-04): one across all Open zones and one across all
Rookie zones of this season, by War Score. Pure rules here (unit tests: scripts/warboard_test.py);
main.py rebuilds them once an hour from the zones' live standings (war_market_tick) into
warMarket/board (public to signed-in players). A new season (Monday 9 am ET) starts empty.

    warMarket/board {season, at, open: {top, ranks, total}, rookie: {...}}
        top    the best TOP rows: {uid, name, zone, zoneId, score, ret, rank}
        ranks  {uid: rank} for everyone on the board, so each player sees their own place
"""
TOP = 10


def board(zones):
    """zones: [(zoneId, war dict)] of one season -> {"open": {...}, "rookie": {...}}."""
    out = {}
    for kind in ("open", "rookie"):
        rows = []
        for zid, w in zones:
            if bool(w.get("rookie")) != (kind == "rookie"):
                continue
            names = w.get("names") or {}
            for r in w.get("standings") or []:
                rows.append({"uid": r["uid"], "name": (names.get(r["uid"]) or "Trader")[:24], "zone": w.get("name") or "Zone",
                             "zoneId": zid, "score": float(r.get("score") or 0), "ret": float(r.get("ret") or 0),
                             "forfeit": bool(r.get("forfeit"))})
        rows.sort(key=lambda r: (r["forfeit"], -r["score"], -r["ret"], r["uid"]))
        for i, r in enumerate(rows):
            r["rank"] = i + 1
        out[kind] = {"top": [{k: v for k, v in r.items() if k != "forfeit"} for r in rows[:TOP]],
                     "ranks": {r["uid"]: r["rank"] for r in rows}, "total": len(rows)}
    return out
