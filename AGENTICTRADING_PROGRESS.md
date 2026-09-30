# AgenticTrading.info — Progress

Spec: `AGENTICTRADING_MASTER_SPEC.md` (source of truth).

## Current phase
**Phase 1: FMP live quote fix. DEPLOYED; LIVE CHECK AT THE NEXT MARKET OPEN (weekday 9:25 ET).**
Phase 1 is not complete until the Trade War chart is confirmed live on FMP.

## Status log
| Phase | Status | Files changed | Tests | Deployed |
| --- | --- | --- | --- | --- |
| 0 Inspection | Done | `AGENTICTRADING_MASTER_SPEC.md`, `AGENTICTRADING_PROGRESS.md` (new, docs only) | `py_compile functions/main.py` OK; `scripts/*_test.py` 37/37 pass | No. Nothing deployed; no production code touched |
| 1 FMP quote fix | Code done; live verification pending | `functions/main.py`, `practice/practice.js` (comment only), `README.md`, `docs/practice-account.md` | `py_compile` OK; offline mocked-FMP test passes (mapping c/o/h/l/pc/t, FMP URL, no `X-Finnhub-Token`, bad key as 200-error/401/402 → `auth`); `node --check practice.js` OK; 37/37 existing tests pass | **Functions deployed by owner (weekend).** A weekend force-run is a no-op by design, so the page still shows the last Finnhub error. The stored `FMP_API_KEY` turned out to be invalid; the owner re-saved the paid key and redeployed. Live check is pending the next market session |

---

## Phase 0 findings

### Architecture (as it is today)
- **Frontend:** static HTML/vanilla JS, no bundler. It appears to be hosted on GitHub Pages (`CNAME` = agentictrading.info; `firebase.json` has no `hosting`). **Pushing to `main` is effectively a production frontend deploy.**
- **Shared shell:** the nav/footer is hand-copied into **45 pages**. Generated pages (`games/`, `learn/`, `scan/`, `practice/`, `real/`) copy the shell from `games/setup-spotter.html` via `scripts/site_shell.py` and the `scripts/build_*.py` scripts.
- **Firebase project:** `leaderboard-agentictrading`. Firestore holds the app data; the Realtime DB holds the arcade scores (`database.rules.json`). Auth uses Google/email, plus anonymous guests (created by `zelos-xp.js`). There is no Storage bucket in use and no `storage.rules`.
- **Functions** (`functions/main.py`, Python 3.12):
  - HTTP: `publish_alert`, `publish_market_map`, `gumroad_ping`, `update_alert_outcomes`, `post_to_buffer`, all protected by the `ZELOS_PUBLISH_SECRET` shared secret.
  - Scheduled: `refresh_quotes` (every minute, 9–16 NY time on weekdays) and `refresh_news` (every 10 minutes).
- **Quote pipeline:** `refresh_quotes` writes `markets/quotes` `{source, updatedAt, date, marketOpen, error, quotes:{SYM:{c,o,h,l,pc,t}}}`, plus `markets/intraday_<SYM>` (5-minute bars) and `markets/dailyBars`. It covers up to 55 symbols from `functions/practice_universe.json`. The consumers are `practice/practice.js`, `zelos-dash-hub.js` and `real/real.js`, all through `onSnapshot`.
- **Trade War today:** there is **one $10,000 client-side account per user**, stored in localStorage plus `users/{uid}.practice`. Public stats go to `practiceProfiles/{uid}`. Challenges and squads (`zelos-social.js`) compare the accounts' net-P&L baselines. There are **no per-session wallets and no buy-in**, and scoring happens entirely in the browser. Internally the mode is still named `PRACTICE` (`zelos-modes.js`, `practice/` folder), but user-facing text already says "Trade War".
- **Progression:** XP (`zelos-xp.js`), missions/achievements/seasons (`zelos-progress.js`) and levels (`zelos-levels.js`) all run client-side.
- **Dashboard:** `dashboard.html` with `zelos-dashboard-layout.js` (drag/resize/hide widgets, separate Real/War presets, synced to `users/{uid}.dashboardLayout`) and `zelos-dash-hub.js`.

### FMP (Phase 1) — critical findings
- **There is no `_fmp_quote` in the codebase or git history, on any branch.** The active quote path is 100% Finnhub:
  - `_finnhub_quote` sends `X-Finnhub-Token`.
  - `refresh_quotes` declares `secrets=["FINNHUB_API_KEY"]`.
  - It writes `"source": "finnhub"`.
- The fix therefore means adding `_fmp_quote` rather than repairing one. The FMP `stable/quote` endpoint returns a JSON array (`price, open, dayHigh, dayLow, previousClose, timestamp`), which must be mapped to `c,o,h,l,pc,t`. FMP can also report a bad key as HTTP 200 with an `"Error Message"` body, so that case must be treated as `auth`.
- `refresh_news` stays on Finnhub (`FINNHUB_API_KEY`), which keeps that key intact as the spec requires.
- The exact error text from the spec ("the price service rejected the API key") **does not exist in the repo**. The repo shows `Live feed error (API key rejected) · last close` (`practice/practice.js:442`). Either the live site is serving a different build or the wording was paraphrased. This needs confirming against production.
- Labels to update: the comments in `main.py` and `practice.js`, the `source` field, `README.md:86`, and `docs/practice-account.md`.
- **Verification blocker:** this container has no Firebase CLI, no gcloud, and no project credentials. `firebase deploy --only functions`, force-running the Cloud Scheduler job, and reading `markets/quotes` all need to happen on the owner's machine (or through CI with credentials). I will provide the exact commands.

### Checklist items that already exist (partially or fully)
| Spec item | Exists today |
| --- | --- |
| Real/War separation | Yes: modes, tags, and separate `practice/` and `real/` areas (§4 partial) |
| Custom editable dashboard | Yes: works, with Real/War presets (§4) |
| Trade War chart | Partial. `practice-chart.js` has indicators, fills, cost basis, and SL/TP forecast boxes (static, not movable, no sell-side flip); there is no Fibonacci, no Three-Legged Strategy, and no price alerts (§13) |
| Orders | Market/limit/stop orders, brackets, long-only; pending-order cancel needs checking (§39) |
| Challenges | Friend challenges with open/active/cancel states. Missing: decline, dramatic pop-up, history (§14) |
| Squads | Create/join/leave, owner rename/competitions, owner-only delete; confirmation needs checking (§11) |
| Friends | A one-way private `friends` list. Missing: requests, followers, search, QR (§17) |
| Profile | `practice/profile.html` shows name/photo/stats. Missing: username, bio, edit dropdown (§20) |
| XP/missions/achievements/seasons | Exist client-side, but hard to find (§6, §16, §32, §40) |
| Notifications | Browser `Notification` API only while `practice/` is open. **No service worker, no FCM, no device registration, no backend sender** (§22) |
| Globe | `zelos-globe.js` / `market-3d.html` with the country map (§23) |
| Chart Replay | Exists; one-click autoplay needs checking (§39) |
| Referrals, share cards | Referral links and account cards exist (§18 partial) |
| Comments/reactions, DMs, theses, tokens, email | **Do not exist** |

### Security / compliance findings (verified by reading the code)
1. **`users/{uid}` is fully client-writable.** `ownedSkills` (the paid Gumroad skills) is set from the browser (`arrayUnion` in `ai-index.html`, `arcade.html`, `alert-history.html`, `ai-knowledge-catalog.html`, etc.), so any signed-in user can grant themselves paid skills from devtools. Tokens must **not** be built on this doc.
2. XP, the `practiceProfiles` equity/stats, and challenge/squad baselines are client-trusted. The rules comments document this as an accepted trade-off. It conflicts with the spec's rule that values must be validated server-side.
3. `challenges` has no decline state, and the target can't reject a challenge.
4. The Firebase web `apiKey` in `firebase-config.js` is public by design and is not a secret. No private keys were found in the frontend.
5. **Cookies:** GA4 (`G-Y4B3ZC5XRX`) loads unconditionally on 53 pages. There is no consent banner and no Consent Mode. Terms §14 tells EEA/UK users to use their browser settings instead. **This needs a region-aware consent decision (flag for legal review).**
6. **Terms of Service** (updated Sept 16, 2026) is outdated. It describes Zelos only as a "$20 one-time Gumroad alert page". Missing items:
   - Trade War, virtual currency and no-cash-value language
   - accounts and user content
   - community guidelines
   - tokens
   - a privacy policy (there is no privacy page)
   - anonymous-auth data handling
   
   All of these are flagged for human/legal review; I won't rewrite the terms as though they were approved.
7. There is no email-sending code anywhere, so there is currently no spam risk.

### Dependencies between features
- **FMP quotes (Phase 1)** block the Trade War chart (§13), price alerts (§22), and asset expansion (§24).
- **Server-authoritative Trade War sessions** (callable functions plus rules-locked `tradeWars/{id}`) block:
  - buy-in and equal capital (§8)
  - leaderboard (§9)
  - Last Man Standing (§10)
  - high-stakes (§15)
  - bounties (§27)
  - feed (§28)
  - spectator (§34)
  - battle modes (§25)
  - IPO Wars (§38)
- **Locking protected user fields** (`ownedSkills`, xp, tokens) to server-only writes blocks the token ledger (§1) and server-validated XP/rewards (§40).
- **Profile with username** blocks username search, QR, followers (§17), and share cards (§18, §35).
- **Web Push (a service worker plus FCM) and a server order/alert engine** block "notify when not viewing the chart" (§22) and interactive alerts for users who are away (§2).
- A **moderation baseline** (rules, rate limits, reports) must ship with comments/reactions (§19, §11, §34, §44).
- A **nav change** is a single scripted edit across 45 pages plus `games/setup-spotter.html` and a rebuild; it can't be done by hand-editing one page.

### Risky areas
- **`refresh_quotes`:** a bad deploy blanks live prices site-wide. Mitigations: keep last-good quotes (already done), keep the `error` flag contract (`auth`, `missing-key`) unchanged, and keep Finnhub news separate.
- **Nav/layout:** 45 duplicated copies plus the generated pages. Mobile uses a separate `nav-mobile-panel`, and both must change in lockstep.
- **Trade War account migration:** existing players' $10k accounts, histories, public profiles and active challenges must not be lost. How they coexist with new buy-in sessions needs a decision (see below).
- **Firestore rule tightening:** locking `users/{uid}` fields can break existing client writes (XP, practice, friends, dashboard layout, claim-purchase flow), so every writer must be moved first.
- **Theme/dashboard:** `zelos-theme.css` and the layout presets are shared by many pages.
- **Frontend deploy = push to `main`.** Work on a branch and merge only after verification.

---

## Proposed phased plan
Phase 1 is fixed by the spec. The later phases follow the spec's priority order, grouped by dependency. Each phase waits for the owner's go-ahead.

1. **Phase 1 — FMP live quote fix (§3, P1 #15).**
   - Add `_fmp_quote` (FMP stable endpoint, key only in the query string, no `X-Finnhub-Token`) and switch `_fetch_all_quotes` to it.
   - Change `refresh_quotes` to `secrets=["FMP_API_KEY","FINNHUB_API_KEY"]` and read `os.environ.get("FMP_API_KEY","")`.
   - Change `source` to `fmp` and update the logs and labels.
   - Keep `refresh_news`/Finnhub and the whole Firestore/frontend contract unchanged.
   - Tests: `py_compile`, plus an offline unit check of the mapping and error handling. The owner then deploys, force-runs the scheduler job, and verifies `markets/quotes` and the chart on `/practice/`.
2. **Phase 2 — Security & compliance baseline** (needed before any tokens or server-validated work).
   - Close the `ownedSkills` self-grant: server-only writes, moving the claim flow into a callable function.
   - Audit rules, logs and error messages.
   - Cookie/GA consent per the owner's decision.
   - A ToS/Privacy gap report for legal review (flags only).
3. **Phase 3 — Layout & navigation (§4, P1 #1–5, #16).**
   - Top-level Trade War and Arcade sections.
   - Trading Tools group (Options Scanner, Daily Market, Alerts), with Alerts moved out of the main nav.
   - A separate signed-out homepage and the signed-in dashboard, keeping the custom dashboard.
   - A small shared motion layer (CSS tokens plus `prefers-reduced-motion`).
   - A scripted nav update across all pages, with mobile checked.
4. **Phase 4 — Onboarding & profile (§5, §6, §20, P1 #6–9).**
   - Username/bio/picture setup and a visible task list: Complete Profile → First Trade → Challenge a Friend → Join/Create Trade War.
   - Help Mode, and discoverable XP/Missions.
5. **Phase 5 — Core Trade War sessions (§7, §8, §9, P1 #10–13).**
   - Server-authoritative sessions: host-set buy-in, equal starting capital, locked balances, per-session portfolio/trades/stats/history, and a % P&L leaderboard.
   - Challenge accept/decline creates the session.
6. **Phase 6 — Dedicated Trade War chart (§13, P1 #14).**
   - Movable SL/TP that flips for sells, trade markers, Fibonacci, the Three-Legged Strategy, and labelled Trade War price alerts.
   - Canceling pending orders (§39).
7. **Phase 7+ — Priority 2 → 4 in spec order.**
   - Priority 2: dramatic challenges, interactive alerts (§2, §14), Last Man Standing, friends/followers, notifications (FCM + service worker), trade sharing, theses, DMs and squads, with moderation.
   - Then tokens (§1, after Phase 2's locked ledger).
   - Then Priority 3 and Priority 4.

## Owner decisions (2026-09-30)
- **Existing $10k Trade War account:** stays, alongside the new buy-in matches.
- **Hosting:** confirmed GitHub Pages. Merging to `main` publishes the frontend.
- **Token payments:** use the cheapest option. No processor is free per sale; Stripe has no monthly fee (per-transaction fees only). To be confirmed at the token phase.
- **Cookie consent:** show the banner only in regions that require it. GitHub Pages has no server-side geolocation, so region detection must happen client-side (e.g. by timezone or a free geo lookup). To be designed in Phase 2 and flagged for legal review.
- **Error text:** resolved. "the price service rejected the API key" was stale wording in `docs/practice-account.md`; the page shows "Live feed error (API key rejected)". The doc is now fixed.

## Phase 1 changes
- `_fmp_quote` calls `https://financialmodelingprep.com/stable/quote?symbol=…&apikey=…` with the key only in the query string, no Finnhub header, and the URL never logged. It maps `price/open/dayHigh/dayLow/previousClose/timestamp` to `c/o/h/l/pc/t`.
- `_fetch_all_quotes` now uses FMP. A bad key (a 200 error body or a 401) gives `auth`. A 402/403 skips just that symbol, but gives `auth` if everything is refused.
- `refresh_quotes`: `secrets=["FMP_API_KEY"]`, `os.environ.get("FMP_API_KEY", "")`, `source: "fmp"`, and FMP log labels.
- Unchanged: the schedule, the `markets/quotes` shape and error contract, intraday/daily bars, the frontend pipeline, and `refresh_news` (still Finnhub).
- `_finnhub_quote` is kept, labelled as the fallback provider, and `FINNHUB_API_KEY` remains intact.

## Phase 1 owner steps (deploy + verify)
Run these in Google Cloud Shell, where the repo was cloned before. Do them **during market hours (Mon–Fri 9:25–16:10 New York)**, because outside that window `refresh_quotes` exits without fetching anything.
1. `cd ~/Zelos && git fetch origin && git checkout claude/agentictrading-master-spec && git pull`
2. `firebase functions:secrets:get FMP_API_KEY` should list a version; it doesn't print the key. If nothing is listed: `firebase functions:secrets:set FMP_API_KEY`.
3. `source functions/venv/bin/activate && pip install -r functions/requirements.txt`
4. `npx -y firebase-tools@latest deploy --only functions --project leaderboard-agentictrading`. If it errors on another function's missing secret, use `--only functions:refresh_quotes`.
5. Cloud console → Cloud Scheduler → `firebase-schedule-refresh_quotes-…` job → **Force run**.
6. Firestore → `markets/quotes`: `source` = `fmp`, `error` = null, `updatedAt` is current, and the quotes have `c/o/h/l/pc/t`.
7. Functions → `refresh_quotes` → Logs: no `FMP error: auth` and no 401.
8. Open `https://agentictrading.info/practice/`: the status line reads "Live prices · updated Xs ago", the chart's last candle moves, and there is no API-key error.
9. Report the results. After that, merge the branch to `main` so a later deploy from `main` can't bring back Finnhub quotes.

## Known issues
- See security findings 1–6 above. None have been changed yet.
- Phase 1 blocker: this container has no Firebase CLI or credentials, so the owner has to run the deploy and live check.

## Next phase
**Finish Phase 1** (the owner's live verification). Then Phase 2, the security and compliance baseline, which starts only when the owner says so.
