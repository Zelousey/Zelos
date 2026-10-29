# Squad rulesets (Phase 10)

Approved by the owner on 2026-10-29. Squad battles start from a **ruleset**: a preset on the one
battle engine (`tw_challenge` with `squadId` and `ruleset`), not a separate engine. A battle
without a ruleset (every battle so far, and every non-squad battle) plays exactly as before.

| Ruleset | Group | What it is | Status |
|---|---|---|---|
| Free-for-all (`ffa`) | Compete | Everyone for themselves with the same money; best % return wins. Classic rules. | Built (10a) |
| Fantasy Draft (`draft`) | Compete | Snake draft before the start; trade only your picks. | Built (10a) |
| Last Man Standing (`lms`) | Compete | Elimination rules, checked once a day at the market close. | Built (10b) |
| Team Cooperation | Together | Two teams inside the squad. | After that (10c) |

## Owner decisions (2026-10-29)
- **Fantasy Draft (Q16):** 3 picks each, 45 seconds per pick, **no ban round**. The person starting
  it can pick 2/3/5 stocks and 30/45/60 seconds.
- **Last Man Standing (Q14):** checked **once a day at the market close** (4:00 pm New York) on the
  account value then. A dip during the day doesn't knock anyone out.
- **Team Cooperation (Q17):** the squad **splits into two teams balanced by XP** (the owner can swap
  people); a team's score is the **average % return** of its players; **teammates see each other's
  trades**, the other team doesn't.

## How it fits together
- Server: `TW_RULESETS` and `tw_validate_ruleset` in `functions/main.py`. A ruleset must agree with
  the settings (Free-for-all: no draft, no elimination rules; Fantasy Draft: the draft on). Only squad
  battles take one. The ruleset is stored on the battle and on each challenge invite; a rematch keeps it.
- Draft pick timer: `modes.draft.secs` (30/45/60), copied into the draft as `secs`; drafts from before
  the option keep 45 seconds (`tw_pick_ms`).
- Last Man Standing (`lms`): the 5-minute job (`tw_mark_war`) applies the floor, biggest-loss and
  losing-trades rules only on its first run after 4:00 pm New York on a weekday the battle was already
  running (`tw_close_check_day`, recorded as `lmsCheckedDay`); in between, only timed cuts run
  (`tw_elim_now`), and a trade never knocks anyone out (the check waits for the close).
- App: the squad's **Start a squad Trade War** sheet asks for the ruleset first; the ruleset fixes the
  mode and the draft (`applyRuleset`), and the battle room shows it as a badge.
