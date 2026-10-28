# Phase 1: checks and reports (2026-10-28)

No app behaviour changed in this phase. The one exception is the owner's request on 2026-10-28 to
clean up three Hall of Minds portraits (Dow, Alexander, Livermore), covered in §5.

## 1. Mobile glitch sweep
**How:** a temporary Playwright test (deleted afterwards) signed in a fresh user on the emulators.
It opened 26 screens plus the 4 top-bar sheets (menu, notifications, profile, tokens) at
**390 px** (iPhone 13/14), **375 px** (iPhone SE/mini) and **320 px** (the smallest phones).
On each screen it checked for:
- sideways page scrolling;
- elements running off the screen;
- text cut off without "…";
- tap targets smaller than 32 px;
- script errors.

Every screen was screenshotted.

**Screens:**
- Dashboard, Market, a stock page (AAPL), Trade War, Battles, Alerts, News, Strategies;
- Leaderboard, Coaching, Communities, Squads & friends, Missions & XP;
- Trading 101, a lesson, the Chapter 1 quiz;
- Hall of Minds, Napoleon's page, a swipe lesson;
- Training Ground, Invite, Profile, Settings, the Buy/Sell ticket, Options, Charts.

SWEEP_RESULTS

## 2. Trading 101 inventory
| Chapter | Lessons | Quiz |
|---|---|---|
| 1 · The basics | What is a stock? · Why prices move · Your $10,000 practice money · Reading a chart · Buying and selling · Stop-loss · Take-profit · Battles with friends (8 lessons, 2–3 min each) | 5 questions, pass 4 |
| 2 · Charts & volume | Timeframes · Trends · Support & resistance · Moving averages · Volume · Candle shapes · RSI · Your chart checklist (8 lessons) | 5 questions, pass 4 |

**Nothing half-built is visible in the app** (no "coming soon" placeholders). What's missing:
- **Chapter 3 and later don't exist yet.** No topics are written down anywhere; the plan only says "Chapter 3+". Topics will be proposed for the owner to approve in Phase 18.
- **Chapter 1 lesson 2 "Why prices move"** mentions market hours in one step only ("9:30 am to 4:00 pm New York time"). List D asks for:
  - pre-market and after-hours;
  - other world markets;
  - time zones and daylight saving time;
  - why hours matter.
  - That's Phase 3. Only one other place mentions the hours (the lesson's own clock picture), so nothing would be repeated.
- **Lessons that will need updating when the Trade War realm ships** (Stage B):
  - "Your $10,000 practice money": its tip says you can reset below $2,500;
  - "Battles with friends".
  - The War realm will have its own $100,000 War balance, so these two lessons should say what's different.

## 3. Hall of Minds pictures
A numbered contact sheet of all 47 pictures (11 portraits + 36 lesson/story pictures) is in
`docs/audit-2026-10-28/hall-of-minds-contact-sheet.jpg`.

**Owner's choice (2026-10-28):** #1 Alexander, #4 Dow, #7 Livermore weren't as clear as Napoleon, Tesla or Franklin. See §5 for what was done.

## 4. Security: can hidden game information leak? (`firestore.rules`, `functions/main.py`)
| What | Who can read it today | Verdict |
|---|---|---|
| `tradeWars/{id}` (the match: name, players, names, buy-in, modes, draft picks, bounties, shields, results) | **any signed-in user**: open a single match by its id, **and also list every match** | ⚠️ **Finding S-1** (below) |
| `tradeWars/{id}/accounts/{uid}` (leaderboard numbers) | players in that match | OK |
| `tradeWars/{id}/books/{uid}` (positions and fills) | that player; all players only when a squad turns on "view everyone's trades" | OK |
| `tradeWars/{id}/events` (the ticker) | players in that match. Big trades show the stock only when trades are open to all | OK |
| `twInvites/{id}` | only the two people involved | OK |
| Push notifications (`notify_users`) | the recipient | OK: no hidden info is sent today |

**Finding S-1 (privacy, medium-low):**
- The rule `allow read: if request.auth != null` on `tradeWars/{warId}` also allows **listing**. Any signed-in user could query the whole collection and see every match's name, its players' user ids and display names, buy-ins and results.
- The comment says it should only be readable "by a visitor holding the (unguessable) invite id".
- **Fix (small, separate PR, needs the owner's OK):**
  - `allow get: if request.auth != null;`
  - `allow list: if request.auth != null && request.auth.uid in resource.data.players;`
- Everything the app and the classic site do today keeps working: they list only with `where('players', 'array-contains', uid)`. A rules test would prove both.
- **Recommended before War mode** (Phase 13), because War data will sit next to it.

**What War mode must do** (already in `docs/WAR_DESIGN.md`):
- Placements go in a new `tradeWars/{id}/deploy/{uid}` that only the owner can read and only the server writes.
- Enemy-presence warnings go in a per-player document.
- Nothing hidden goes on the match document, the accounts, the ticker or notifications.

**Existing Trade War / Squad code vs list A** (what can be reused):
| List A item | Today | Reuse |
|---|---|---|
| Lifecycle states | `lobby / draft / active / ended / cancelled`; the host starts it; min 2 players; **no lobby deadline** (lobbies wait until started or cancelled; max 5 open per host) | Keep the stored names; add `stage` + a deadline (War design §8) |
| Start exactly once | `tw_start` runs in a transaction and refuses unless status is `lobby` | Yes |
| Leaving / organizer | Players can leave in the lobby; the host can only cancel | Yes |
| Hidden deployment / territories | **None** | New (Phases 13–14) |
| Short side / challenges | **Long only** (`shortSelling: False`); "challenges" today are invites to a match | New Bull/Bear battles (Phase 15) |
| Fantasy Draft | Snake draft, 2/3/5 picks, 45 s, auto-pick | Add timer choice + ban phase (Phase 10) |
| Last Man Standing | `lms` floors and timed cuts, revive (20 tokens), shields | Add explicit thresholds + realized-only (Phase 10) |
| Squads | Squad wars with allowed-stock lists and "view trades" | Free-for-all, Team (Phase 10) |
| Rematch | **None** | New (Phase 9) |

## 5. Hall of Minds portraits cleaned up (owner request, 2026-10-28)
PORTRAIT_RESULTS

## 6. Recommendations (for the owner to pick)
RECS
