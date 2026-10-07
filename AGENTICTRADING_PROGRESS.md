# AgenticTrading.info — Progress

Spec: `AGENTICTRADING_MASTER_SPEC.md` (source of truth).

## Current phase
**Phase 7: Dramatic challenges + interactive Trade War alerts (§14, §2). CODE DONE AND TESTED. Owner must deploy functions + rules, then merge.**
- Phase 6 (PR #12) is merged. The Buy/Sell recolor (owner feedback) ships with this merge.
- Next: **Phase 8: Last Man Standing / elimination (§10)**.
- Phase 1 (FMP) still needs the live-price check at a market open.

## 2026-10-07 — Project review, docs, CI, Marketstack merge, security fixes
Current-state summary now lives in `PROJECT_STATE.md` (canonical handoff). This log keeps the detail.
- PR A (`claude/docs-ci-square-wording`): docs rewritten to match the repo; `.github/workflows/ci.yml`.
- PR B (`claude/marketstack-security`): the Marketstack/SEC EDGAR branch merged with `main`; `xp_award` (server XP, `functions/xp.py`); rules lock XP fields and the activity ledger; arcade scores need a user + 10 s rate limit; `practiceProfiles.equity` bounded; `account_delete` + My Zelos card; Privacy Policy points to it; `firebase.json` deploys RTDB rules.
- Tests: unit suites all pass (incl. new `xp_test.py`, 12 tests); rules 19/19 on emulators (the same tests fail 7/19 against the old rules); functions end-to-end 20/20 on emulators. All committed under `tests/rules/` and run in CI.
- Deployed: **No.** Owner follows `docs/OWNER_DEPLOY_RUNBOOK.md`, then merges PR B.

## Status log
| Phase | Status | Files changed | Tests | Deployed |
| --- | --- | --- | --- | --- |
| 0 Inspection | Done | `AGENTICTRADING_MASTER_SPEC.md`, `AGENTICTRADING_PROGRESS.md` (new, docs only) | `py_compile functions/main.py` OK; `scripts/*_test.py` 37/37 pass | No. Nothing deployed; no production code touched |
| 7 Challenges + interactive alerts | Code done + tested; not deployed | `functions/main.py` (`tw_challenge`, `tw_respond`, invite cleanup in `tw_start`/`tw_cancel`), `firestore.rules` (`twInvites`), `zelos-challenge.js` (new, on all 48 signed-in pages), `practice/war.js`, `practice/profile.js`, `practice/practice.css`, rebuilt pages; also `practice/practice.css` Buy/Sell recolor | 6 new unit tests (63/63). **End-to-end on emulators: 31/31**: challenge by @username, unknown-username message, challenger lobby "waiting", real-time "YOU'VE BEEN CHALLENGED" card on another page with challenger and terms, crossing blades, others can't read or forge invites, can't answer someone else's invite, Accept → 1 v 1 starts and a $500 match account is created, challenger sees it go live, reduced-motion card, 375px fit, Decline cancels the duel, "Not now" keeps it pending, squad challenge invites 2 / accept joins the lobby / start expires the unanswered one, outsider can't challenge a squad, history (accepted / declined / waiting), profile button, no page errors. Rule suites 27 + 15 pass | **No.** Deploy functions + rules, then merge |
| 6 Trade War chart + buttons | Code done + tested; not merged | `practice/practice-chart.js`, `practice/practice.js`, `practice/war.js`, `practice/practice.css`, `scripts/build_practice.py` + rebuilt `practice/index.html`, `practice/war.html` | **End-to-end on emulators: 25/25**: Buy solid green / Sell solid red, flat 12px order button (also on matches); Sell flips the plan (SL above, TP below); dragging TP fills the ticket; SL can't cross the entry; Fib; alert placed by clicking the chart; Alerts tab lists / edits / deletes; alert saved to the account; alert fires when the live price crosses (pop-up labelled Trade War); pending limit order cancel; match chart with entry + P&L line and buy marker; desktop match layout (chart full width, account + leaderboard side by side); no page errors. 57/57 unit tests; builders stable | **No.** Merge only |
| 5 Trade War matches | Code done + tested; not deployed | `functions/main.py` (tw_* callables + `tw_mark_matches` schedule), `firestore.rules`, `practice/war.js` (new), `practice/war.html` (new, built), `scripts/build_practice.py`, `practice/practice.css`, `zelos-profile.js`, nav on 46 pages, `scripts/tradewar_test.py` (new), `.gitignore` (functions/venv) | 20 new engine unit tests (57/57 total). **End-to-end with the Auth + Firestore + Functions emulators running the real Python functions and rules: 34/34**: create (server rejects bad buy-in and length), invite/join, anonymous blocked, start, late join blocked (buy-in locked), buy at server price, no overspend, no shorting, bad symbol, non-player blocked, browser can't edit balances/buy-in/matches, positions private, outsider can't read the board, revalue job, leaderboard +$30/+6%, market-closed block, end → winner + frozen results, no trades after end, match history rank, 375px mobile, no page errors. Rule suites 27 + 15 still pass | **No.** Deploy functions + rules, then merge |
| 4 Onboarding & profile | Code done + tested; not deployed | `zelos-profile.js` (new), `firestore.rules`, `dashboard.html`, `practice/practice.js`, `practice/profile.js`, `practice/squads.js`, `practice/practice.css`, `scripts/build_practice.py` + rebuilt `practice/*.html`, nav on 46 pages (XP & Missions) | Firestore emulator: 27 new rule tests (usernames, squatting, bio, photos, squad helpMode) + 15 Phase 2 tests pass. **End-to-end on Auth+Firestore emulators with the real rules: 30/30**: sign-up, checklist advances, photo upload resized to about 1.7 KB, username uniqueness across 2 users, Help Mode on/off/default, hide checklist, public vs own profile, Edit profile dropdown, squad Help Mode, Trade War welcome + nav, 375px mobile, no page errors. Builders stable; 37/37 unit tests | **No.** 1) deploy rules, 2) merge |
| 3 Layout & navigation | Code done + tested; not published | 46 pages (nav block), `zelos-theme.css`, `scripts/site_shell.py`, `scripts/build_ai_index.py`, `ai-index.html`, `sitemap.xml` | Browser test on 16 pages: top nav order, no top-level Alerts, correct active section, every nav link resolves to a real file, dropdowns open, no JS errors, no overflow; mobile at 375px: panel opens, animates, and doesn't animate with reduced motion. Page builders re-run: output matches (stray local scan test pages discarded). 37/37 unit tests | **No.** Merge to `main` publishes it |
| Legal pages | Drafted at owner request | `terms.html`, `privacy.html` (new), 46 footers, `sitemap.xml` | Rendered at 375px, no errors, no overflow | **No.** Merge to `main`; lawyer review still recommended |
| 2 Security & compliance | Code done + tested; not deployed | `firestore.rules`, `functions/main.py`, `zelos-consent.js` (new), 53 HTML pages (one `<script>` line each) | Firestore emulator: 15/15 rule tests pass (the same tests fail 6/15 on the old rules); function secret/error checks pass; FMP test still passes; browser test 32/32 (EEA vs US time zones, 4 page depths, allow/decline/remember/reopen, Istanbul excluded, Canaries included, 375px mobile) | **Yes.** Merged to `main`; the owner ran the rules + functions deploy |
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
1. **`users/{uid}` is fully client-writable.** *Corrected in Phase 2:* `ownedSkills` is an intentional self-report ("Mark as owned" on the dashboard and My Zelos). It gates no content, because alerts are public by design, so it isn't an exploit today and was left working. Tokens must **not** be built on this doc; they need a server-only ledger.
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

## Phase 2 changes
- **Firestore rules** (`firestore.rules`):
  - Squad join/leave may only add or remove your own entry in the `names` map (max 24 characters), so nobody can rename or remove other members.
  - `pendingOwnership` purchase claims now require a **verified** email, so an unverified email/password sign-up can't see or claim someone else's Gumroad purchase.
- **Functions** (`functions/main.py`):
  - All five HTTP endpoints check the shared secret in constant time (`hmac.compare_digest`) via `_secret_ok`. An empty secret never authorizes.
  - Firestore write failures log the exception type server-side and return a generic "Firestore write failed", instead of raw internal error text.
- **Cookie consent** (`zelos-consent.js`, loaded before the Google tag on all 53 GA pages):
  - Google Consent Mode v2. Analytics is **off by default in the EEA/UK/CH**; Google applies this from the visitor's location.
  - A small Allow/Decline banner appears only for visitors whose time zone is in those regions, with a "Cookie settings" footer link to change the choice.
  - Everyone else: no banner, and analytics works as before.
  - Ad storage is denied everywhere (the site shows no ads).
  - Reduced motion is respected, and the layout is mobile-safe.
- Kept as is on purpose:
  - "Mark as owned": working feature, gates nothing.
  - Buffer error details: only returned after the secret check, and needed by the scheduled job.
  - Terms text: flagged below, not rewritten.

## Phase 2 owner steps (deploy)
Run these in Cloud Shell on the `claude/agentictrading-master-spec` branch (`git pull` first). Each is independent and safe in any order.
1. Rules: `npx -y firebase-tools@latest deploy --only firestore:rules --project leaderboard-agentictrading`
2. Functions: `npx -y firebase-tools@latest deploy --only functions --project leaderboard-agentictrading`
3. Banner: merge the branch to `main` (GitHub Pages publishes it). Check: with the computer's time zone set to e.g. Berlin, the banner shows; with a US time zone it doesn't.
4. Optional checkpoint tag, which this session can't push: `git fetch origin && git tag -a pre-update-checkpoint 0ea1551 -m "Checkpoint before the major update" && git push origin pre-update-checkpoint`
5. In Firebase console → Storage, confirm Storage isn't enabled, or that its rules deny all access. The site doesn't use it.

## Legal pages (owner request, 2026-09-30)
- **Terms rewritten** (`terms.html`, now 17 sections):
  - §07 Payments and tokens replaces the $20 Gumroad section. Earlier Gumroad purchases and codes stay honored.
  - New §08 Trade War and virtual money: no cash value, not gambling, fair play, no auto-entry into high-stakes modes.
  - New §09 Community guidelines and your content: rules, rate limits, reporting, moderation.
  - Accounts rule (§03).
  - §16 Cookies now matches the consent banner.
  - Liability cap changed to fees paid in the last 12 months.
- **New `privacy.html`** (13 sections), written from what the code actually stores. It's linked from all 46 footers, the Terms page, and `sitemap.xml`.
- The owner asked for this text directly. It has **not been reviewed by a lawyer**, and should be before relying on it, especially:
  - §07 refunds and expiry
  - §08 "not gambling"
  - the Privacy legal bases and rights language
- The Privacy policy mentions features that are planned but not built yet (posts, messages, followers, token checkout, notification settings). Keep it in sync as they ship.

## Legal review flags (original Phase 2 list; items 1–5 now drafted, still need lawyer review)
- **Terms §07 Payment:** describes a "$20 one-time Gumroad" purchase and 3-week codes. This will be wrong once tokens replace Gumroad.
- **No Trade War / virtual currency terms:** no statement that virtual balances, XP, badges and (future) tokens have no cash value, can't be redeemed or transferred, aren't gambling, and can be reset or adjusted.
- **No user conduct / community guidelines:** needed before comments, reactions, DMs or theses (Priority 2). This includes grounds for removing content and suspending accounts.
- **No Privacy Policy page.** The site collects email and name/photo (Google sign-in), public profiles and leaderboards, anonymous guest IDs, localStorage and Firestore data, and GA analytics. A privacy notice is normally expected (GDPR/UK GDPR; CCPA/state laws if thresholds apply).
- **Terms §14 Cookies:** says to use browser settings. It should now mention the consent banner and "Cookie settings" link.
- **Consent approach to confirm:**
  - Consent Mode "advanced" loads GA and sends cookieless pings while consent is denied. Some EU regulators expect GA not to load at all before consent ("basic" mode). Switching is a small change in `zelos-consent.js`.
  - Time-zone detection is a heuristic; Google's own region default is the backstop.
  - US state privacy laws (e.g. CCPA opt-out) have not been assessed.
- **§03 Eligibility 18+:** age isn't checked at sign-up. Social and competition features make this more relevant.
- **Future:** high-stakes/virtual-risk challenges and IPO Wars need clear "virtual only, no prize value" wording before launch (§40–41 of the spec already require legal review before any real-money element).

## Phase 3 changes
- **New navigation**, one standard version on all 46 pages:
  - Desktop, in order: `Dashboard · Trade War ▾ · Trading Tools ▾ · Arcade ▾ · Learn · About`, down from 8 items to 6.
  - Trade War menu: Trade War, Challenges, Squads, My Trade War profile.
  - Trading Tools menu: the three strategies (including Options Scanner), then Daily Market, Alerts, Live Chart and Market 3D, then Real Trade Journal and Full Arsenal.
  - Arcade stays top-level.
  - Alerts is no longer a top-level item; it lives under Trading Tools.
  - The logo goes to Home.
- **Mobile menu:** the same groups, labelled "Trade War · virtual" and "Trading Tools · real", so the two systems stay clearly separate. The mobile header is unchanged.
- **Active section:** highlighted per page, with `aria-current` on direct links. `site_shell.set_active_nav` keeps generated pages correct on rebuild; the template's Arcade highlight used to leak into Learn pages and `ai-index.html`.
- **Motion system** (`zelos-theme.css`, audit result):
  - The site already had cross-page View Transitions; they now have a reduced-motion guard, and the nav stays still while page content fades.
  - Shared tokens: `--dur-fast/base/slow`, `--ease-out/in-out`.
  - Dropdowns and the mobile menu get a 180ms rise. It never blocks a click.
- **Signed-out homepage vs dashboard:** already separate (`index.html` vs `dashboard.html`), and signing in lands on the Dashboard. The earlier deliberate choice to keep Home browsable for signed-in users is preserved. The custom, editable dashboard (`zelos-dashboard-layout.js`) is untouched and remains the default.
- **Seen during testing, left as is (pre-existing):** the Trade War entry dialog covers the whole page, nav included, until you press Enter. Revisit in Phase 4 onboarding.

## Phase 4 changes
- **Profile** (`zelos-profile.js`): one editor for picture, display name, unique **@username** and bio (160 characters).
  - Photos are chosen from the camera roll and resized in the browser to a small JPEG (limit about 20 KB). No Firebase Storage needed.
  - The profile is saved to `traders/{uid}` (`avatar`, `username`, `bio`). The username is reserved in `usernames/{name}` in the same batch.
  - The Trade War leaderboard profile gets the new name, @username and photo.
  - The Trade War page uses the profile name and photo. Its account sync now waits for the profile, which avoids a stale-overwrite race.
- **Rules** (`firestore.rules`):
  - `usernames/{name}`: you can only claim a name you set on your own profile in the same write; changing your name must release the old one (no squatting); anonymous guests can't claim.
  - Validation on `traders`: username format, bio of 160 characters or fewer, and photo is either an https URL or a small `data:image/jpeg|png|webp` (no SVG, no `javascript:`).
  - The same photo and username checks on `practiceProfiles`.
  - Squad owners can set `helpMode`.
- **Onboarding checklist** on the dashboard: Sign up → Set up profile → First trade → Challenge a friend → Join or create a Trade War.
  - Shows "N of 5 done", and highlights the current step with one clear button.
  - Can be hidden, and disappears when everything is done.
  - Includes a Help Mode switch and an "XP & missions" link.
  - "Join or create a Trade War" currently means an accepted challenge or a squad. It will be redefined when Phase 5 adds buy-in matches.
- **Help Mode:** short tips under key controls (dashboard mode switch; Trade War account value, Buy/Sell, stop-loss/take-profit, portfolio tabs; squad board and invite).
  - On by default until onboarding is done, then off unless the person chose.
  - The owner's squad-level setting overrides the personal one on that squad's page.
- **Profile page:** shows @username and bio; your own profile gets an **Edit profile ▾** dropdown (edit, Help Mode, XP & missions, real-stats privacy), plus a "Set up your profile" button when nothing is public yet.
- **XP & Missions easier to find:** added to the Trade War menu (desktop + mobile) → `practice/index.html?tab=progress`, and linked from the checklist and the profile menu.
- **Trade War welcome dialog:** no longer covers the site nav; its "Rename" button is now "Edit profile".

## Phase 4 owner steps
1. Deploy rules **first**: `npx -y firebase-tools@latest deploy --only firestore:rules --project leaderboard-agentictrading`. Without them, saving a profile shows an error.
2. Then merge `claude/agentictrading-master-spec` to `main`. This also publishes the legal pages and Phase 3.

## Phase 5 changes
- **Matches** (`practice/war.html`, `war.js`): create a Trade War with a name, a **virtual buy-in** ($100 / $500 / $1,000 / $5,000 / $10,000 or any multiple of $100 up to $100k), a length (1, 3, 7, 14 or 30 days) and a max player count (2–50).
  - Share the invite link. Friends join in the lobby, and the host starts the match.
  - Every player starts with exactly the buy-in.
  - Live view: your match account (balance, cash, $ and % P&L), a trade ticket, your positions, and the match leaderboard (rank, start, current, $ P&L, % P&L, trades, W/L, with ▲▼ rank moves).
  - Finished view: the winner and frozen final standings. The hub lists your matches (live, lobby, finished with your rank) as match history.
- **Server-authoritative** (`functions/main.py`): `tw_create`, `tw_join`, `tw_leave`, `tw_start`, `tw_cancel` and `tw_trade` are callable functions; `tw_mark_matches` runs every 5 minutes. They enforce:
  - Equal buy-in for everyone, locked at start.
  - No deposit or withdrawal path exists at all; only match cash can be spent.
  - Join and leave only in the lobby; only the host can start (with 2 or more players) or cancel.
  - Trades are long-only market orders on the Trade War symbol list, priced from the server's FMP quotes (`markets/quotes`), and only during market hours with fresh quotes. Limited to one trade a second.
  - Signed-in, non-anonymous accounts only.
  - Ranking is by % P&L.
- **Rules:** `tradeWars/*` can't be written from any browser. Players read the match leaderboard; your positions are readable only by you.
- The standing $10,000 Trade War account is unchanged and separate. Its page links to Matches, and the nav's Trade War menu now opens with "Trade War matches" and "Virtual account".
- The onboarding step "Join or create a Trade War" now points to Matches and completes once you're in any match.
- **Not in this phase:** limit/stop orders, chart and SL/TP in matches (Phase 6 is the dedicated chart), elimination modes, and interactive invite alerts (Phase 7+).

## Phase 5 owner steps
1. `cd ~/Zelos && git pull` (on `claude/agentictrading-master-spec`), then `source functions/venv/bin/activate && pip install -r functions/requirements.txt`
2. Deploy the rules: `npx -y firebase-tools@latest deploy --only firestore:rules --project leaderboard-agentictrading`
3. Deploy the functions: `npx -y firebase-tools@latest deploy --only functions --project leaderboard-agentictrading`. This creates the 6 callables and the `tw_mark_matches` schedule. If asked to enable APIs or allow unauthenticated invocation for callables, say yes.
4. Merge the branch to `main` (publishes Phases 3–5 and the legal pages).
5. Try it: `agentictrading.info/practice/war.html` → create a $500 match, open the invite link in another browser/account, join, start, and trade during market hours.

## Phase 6 changes
- **Buy/Sell restyle** (owner request): Buy/Sell and Calls/Puts are now one segmented control; the active side fills solid green or red with a soft glow and a 180ms transition. The order button is flat, solid and rounded (no gradient), with a subtle press. The match page uses the same buttons ("Buy AAPL / Sell AAPL · you hold N"). Reduced motion is respected.
- **Chart engine** (`practice-chart.js`):
  - Stop-loss/take-profit boxes can be dragged by their edges (with a grip and resize cursor); a drag can't cross the entry.
  - A Sell ticket flips the plan (TP below, SL above, "If you sell here").
  - Fibonacci retracement (0–100%) across the visible swing.
  - Trade War price-alert lines, labelled "TRADE WAR ALERT ≥/≤ price", that can be dragged to move them. An alert placement mode turns the next click into an alert.
  - The price scale holds still while you drag.
- **Alert store:** `ZelosTradeChart.alerts` keeps alerts in the browser and in `users/{uid}.twAlerts` (the owner's own doc, no rules change), shared between the $10,000 account and matches. Each alert fires once, when the price crosses, while a Trade War page is open, with a toast plus a browser notification titled "Trade War (virtual): Price alert …". Alerts with the site closed need web push (§22, a later phase).
- **$10,000 account page:**
  - Fib and ⏰ Alert toolbar buttons, and a new **Alerts** tab (edit, delete, status).
  - Dragging the boxes updates the order ticket, or moves your live stop-loss/take-profit orders (a stop can't be dragged past the current price).
  - The position line reads "ENTRY $x · N sh · P&L ±$y (±z%)".
  - Cancelling pending orders was already there (Open orders tab) and is now covered by the test.
- **Match page:** the Trade War chart sits above the account and leaderboard. It shows daily candles plus the live FMP quote, your entry and P&L line, markers for your trades, Fib, and alerts.
- **Three-Legged Strategy** (owner chose option b, an A-B-C pullback drawing tool): a **3-Leg** button on the $10,000 account chart and the match chart.
  - Click the start, then the ends of legs A, B and C. Each click snaps to that candle's high or low.
  - After B, the likely end of leg C is projected as a zone at 100%–161.8% of leg A, measured from B.
  - Each leg is labelled with its % move, and the C/A ratio is shown.
  - Saved per symbol in the browser, and kept across zoom and range changes.
  - Press 3-Leg again to remove the drawing (with confirmation). Esc cancels a drawing in progress.
  - Tested: 9/9 browser checks, plus the full chart suite (25/25).
- Match orders are still market-only, so stop-loss/take-profit boxes in matches are planning visuals only. Real SL/TP orders in matches would need a server order engine.

## Buy/Sell recolor (owner feedback after Phase 6)
- The lime green was replaced with deep emerald (`#08825e → #047857`) and rich red (`#d73535 → #c81e1e`), both with white text at WCAG AA (4.7–5.7:1).
- Slight vertical shade, thin top highlight and soft colored glow; hover lifts 1px, press settles; reduced motion removes the lift.
- Used on the Buy/Sell and Calls/Puts toggles, the order button and match buttons.

## Phase 7 changes
- **Challenge a friend** into a Trade War match, three ways: by **@username** (Matches hub), from their **profile** ("⚔️ Challenge to a Trade War"), or a whole **squad**.
  - A dialog picks the virtual buy-in ($100–$10,000) and length.
  - `tw_challenge` creates the match (the host's account is funded at the buy-in) and one `twInvites` doc per player.
  - Rate limits: up to 20 invitees at a time and 20 pending sent invites.
- **"YOU'VE BEEN CHALLENGED"** (`zelos-challenge.js`, on every signed-in page):
  - Pending invites are watched in real time.
  - A dark full-screen card shows two chart lines crossing like blades (a 460ms draw plus a spark at the cross), the challenger's picture, name and @username, and Battle (1 v 1 / Group), Buy-in and Length tiles.
  - The fine print says it's virtual only. Buttons: Accept (emerald), Decline, and "Not now".
  - A browser notification is sent once per invite when allowed.
  - Reduced motion shows a static card; it fits a 375px phone.
- **Accept** (`tw_respond`) joins with the same buy-in in a separate match account. A **1 v 1 starts immediately** and you're taken into it with a view-transition page change; a group match waits in the lobby for the host.
- **Decline** cancels a 1 v 1.
- Starting a group match or cancelling it closes the unanswered invites ("expired" / "cancelled"). **Nobody is entered without pressing Accept.**
- **Challenge history** on the Matches hub (sent and received, with status); the lobby shows "Waiting for N challenged players".
- **Rules:** `twInvites` is readable only by its sender and recipient, and written only by the server.
- **Challenge counting:** the old `challenges` link flow (net P&L on the $10k account) still works. The onboarding "Challenge a friend" step now also counts these new challenges.
- **Not yet:** web push with the site closed (§22), the Battle Preparation Guide second button (§39), and "Last Man Standing" (next phase).

## Buy-in level locks (owner request, 2026-09-30)
- $100 / $500 / $1,000: everyone. **$5,000: Level 3 (Gold, 150 XP). $10,000: Level 5 (Diamond, 1,000 XP).** Custom amounts follow the same tiers, and the max buy-in went from $100,000 to $10,000.
- Enforced by the server (`TW_BUYIN_TIERS` / `tw_buyin_lock` in `functions/main.py`) on `tw_create` and `tw_challenge`, based on the host's XP.
- Shown in the Create form and the Challenge dialog: 🔒 dashed chips with "Unlocks at Level N (Name, X XP)", plus a note with your XP. The client table is in `zelos-challenge.js`.
- Only the host's level counts; anyone can accept a challenge.
- Tested: 3 new unit tests (66/66) and 14/14 end-to-end.
- **Caveat:** XP itself is still awarded in the browser (`users/{uid}.xp` is owner-writable; a Phase 0 finding). A determined user could edit their own XP to unlock bigger virtual buy-ins. That's harmless for fairness, since everyone in a match still starts equal, but XP should move server-side before XP gates anything of value (tokens, rewards).

## Phase 7 owner steps
1. `git pull`, then deploy rules: `npx -y firebase-tools@latest deploy --only firestore:rules --project leaderboard-agentictrading`
2. Deploy functions (in the Python 3.12 venv, as before): `npx -y firebase-tools@latest deploy --only functions --project leaderboard-agentictrading`
3. Merge the PR. Try it: set a @username on two accounts, then challenge one from the other on Matches.

## One Trade War redesign (owner request, 2026-09-30)
- One Trade War home (`practice/index.html`): trader card, account switcher (Main account + your live/lobby wars), Start a Trade War, inline invites (Accept/Decline), our chart + ticket, missions, achievements, leaderboard, friends, war history. `war.html` hub redirects here; match rooms keep the switcher.
- Standing $10k account renamed **Main account** site-wide. Matches stay market-only.
- Old Challenges feature deleted (`practice/challenge.*`, social helpers); `challenges` collection is read-only in rules. "Start a Trade War" dialog: invite link, @username or squad (server `tw_create` / `tw_challenge`).
- Our chart everywhere except Real Trading/Live Chart: dashboard widget and alert pop-ups (entry/stop/targets drawn). TradingView only on `live-chart.html`.
- Nav shows @username + profile picture (never the email). Simplified Trade War menu.
- `zelos-icons.js`: emoji swapped for consistent SVG line icons on 54 pages.
- Tests: unit 66/66; home E2E 17/17 (emulators + Playwright, incl. 375px mobile, no TradingView request on dashboard).
- Owner: `firebase deploy --only firestore:rules` (retired challenges rule).

## Phase 8: Last Man Standing (§10)
- Optional mode in the Start a Trade War dialog (Classic / Last Man Standing). The host picks any of 4 elimination rules, all enforced server-side:
  - P&L floor: out at -5/10/15/20/30%
  - Max loss on one trade: 2/5/10% of the buy-in
  - Losing trades allowed: 3/5/10
  - Timed cuts: every 6/12/24/48 hours, last place is cut (must be shorter than the match)
- Knocked out = stocks sold at the current price, result locked, trading refused by the server. Checked after every trade (`tw_trade`) and every 5 minutes (`tw_mark_war`). Never knocks out everyone: if all would go, the best survives.
- The last trader standing wins at once. If the clock runs out first, survivors rank by % gain above everyone knocked out (later out = higher place).
- The marking job now runs each match in a transaction, so it can no longer overwrite a trade in flight (pre-existing race).
- Rules are shown before entering: dialog, invite pop-up, inline invite on the home, lobby, and the rules box in the room.
- In the room: "N of M still standing" bar, next-cut timer, OUT tags on the board, an Eliminations list, a "You're out" card, a flatline "ELIMINATED" banner (plays live, once per device; respects reduced motion), and a Last Man Standing winner card.
- Files: `functions/main.py`, `zelos-challenge.js`, `practice/war.js` (dead hub code removed), `practice/tw-home.js`, `practice/practice.css`, `zelos-icons.js` (skull icon), `scripts/tradewar_test.py`.
- Tests: unit 76/76 (10 new). **LMS E2E on emulators with the real functions and rules: 23/23**, covering:
  - server rule validation
  - dialog defaults and the cut filter
  - rules shown in the lobby and to joiners
  - live elimination banner; board OUT state; "You're out" card
  - stocks sold on elimination; server refuses a knocked-out player's trade
  - knockout on a trade ending the match at once; final order Amy 1 / Cat 2 / Bob 3
  - LMS rules on the invite pop-up; duel starts with a cut timer
  - 375px mobile; no page errors
- Owner: deploy functions (`tw_create`, `tw_trade`, `tw_start`, `tw_challenge`, `tw_respond`, `tw_mark_matches` changed). Rules unchanged.
- Not done: the "Last Man Standing" profile badge (§16 badges phase).

## Phase 9: Squads + private groups (§11)
- **Squad chat** (members only, live):
  - reactions (like, fire, rocket, trophy, smile)
  - optional camera-roll photos, resized in the browser to a small JPEG
  - you can delete your own messages; the owner can delete any
  - nobody can edit messages or post as someone else
- **Shared goal:** the owner sets "squad average +X% in 7/30 days"; everyone sees a progress bar.
- **Private room codes:** 6 characters, no look-alike letters. Join from the Squads page. Codes can't be listed, and a new code stops the old one working.
- **Owner controls:**
  - rename
  - remove members (with confirmation)
  - delete the squad: you type its name to confirm; this removes the chat and the room code too
  - Help Mode
- **Group settings:** reactions on/off and photos on/off. Two settings carry into **squad Trade Wars** and the server enforces them:
  - allowed stocks (other symbols refused by `tw_trade`)
  - "everyone can see everyone's trades" (a live feed of all players' fills; the rules open other players' books only in those matches)
- **Security tightening:** squads can no longer be listed by outsiders (list only returns squads you're in; open-by-id unchanged).
- **Deferred (§12 Advanced gameplay):** options/crypto assets, indicators toggle, Drafts, Whale & Minnow, Volatility Storms, Battlefield Feed, Bounty Bonuses, squad-vs-squad competitions.
- **Files:** `firestore.rules`, `functions/main.py` (`tw_squad_rules`, symbol check), `zelos-social.js`, `practice/squads.js`, `practice/war.js`, `zelos-challenge.js`, `zelos-icons.js`, `practice/practice.css`, `scripts/build_practice.py` (+ rebuilt `squads.html`), `scripts/tradewar_test.py`.
- **Tests:**
  - unit 78/78
  - **new rules suite 66/66** (listing, owner/member permissions, goal/config validation, room codes, chat post/read/react/delete/photo limits, squad-war books); older rule suites 15/15 + 27/27
  - **Squad E2E on emulators with the real functions: 27/27**: create, room code, join by code, live chat (HTML shown as text), reactions, photos toggle + upload, goal, settings validation, removing a member cuts chat access, squad Trade War with allowed stocks (ticket + server refusal) and the everyone's-trades feed, 375px mobile, delete (wrong name refused; squad + code gone), no page errors.
- **Owner:** deploy rules **and** functions.

## Phase 10: Advanced Trade War gameplay (§12)
All optional (host picks under "Game options" when starting a Trade War) and all enforced server-side:
- **Pre-battle draft:**
  - Snake draft of 2, 3 or 5 stocks each, 45 s per pick.
  - When a clock runs out, any player's page asks the server to auto-pick. The 5-minute job finishes a draft nobody touches for 2 minutes.
  - You can only trade what you drafted (`tw_trade` refuses the rest). Squad stock limits become the draft pool.
- **Whale vs Minnow:**
  - Players above the match's median XP are whales, capped at 25/50/75% of their account in one stock.
  - Everyone else gets 1-3 Shield Tokens. A token cancels a bounty on you (sponsor refunded) or saves you from a Last Man Standing timed cut.
- **Volatility Storms:** rare (~1/day) or often (~3/day), during market hours only, 30 minutes, one at a time with a calm spell after. Clearly labelled as virtual game events. Three kinds:
  - double: profits and losses on sells count twice (cash never below 0)
  - fee: 1% per trade
  - halt: one held stock can't be traded
- **Bounty Board:**
  - Stake 2/5/10% of your equity (paid from cash) on a rival, for 6 or 24 hours.
  - The winner is whoever beat the target by the most since the bounty was placed and traded since. If nobody did, the target keeps it.
  - Anti-farming limits:
    - one open bounty per sponsor
    - each sponsor→target pair once per match
    - max 2 open bounties on one target
    - no bounties in the last hour
    - the sponsor and the target can't claim
    - knocked-out players can't take part
    - bounties never give XP
- **Battlefield Ticker (always on):** server-written `tradeWars/{id}/events`, readable by players only. Covers:
  - start, draft picks, whale roles
  - big trades (25%+ of an account; the symbol shows only when trades are open to all, i.e. draft or squad view-trades)
  - lead changes, knockouts, bounties, shields, storms, the win
- **New callables:** `tw_draft_pick`, `tw_bounty`, `tw_shield`. Changed: `tw_create`, `tw_challenge`, `tw_start`, `tw_respond`, `tw_trade`, `tw_mark_matches`.
- **Rules:** `tradeWars/{id}/events` (players read, nobody writes).
- **Tests:**
  - unit 90/90 (12 new)
  - **advanced E2E on emulators with the real functions: 30/30.** Covers options in the lobby and bad options refused, the draft (roles, out-of-turn and taken picks refused, auto-pick on timeout, completion goes live), ticket limited to picks, server refusal of undrafted stocks, the whale cap, ticker events, WHALE/SHIELD/WANTED tags, halt and fee storms, the bounty rules and shield, settlement (claimed by a hunter), lead change, 375px mobile, and no page errors.
- **Owner:** deploy rules **and** functions.

## Phase 11: Trade War chart (§13)
- **Already built in Phase 6:** Buy/Sell, entry line with live P&L, current price, trade markers, Fibonacci, Three-Legged Strategy, and alerts on the FMP quote pipeline.
- **New: server-enforced Stop Loss / Take Profit on match positions.**
  - Set on the ticket when buying (`tw_trade` sl/tp), change or clear on a position (`tw_bracket`), or drag the green/red boxes on the chart.
  - The 5-minute job sells the whole position at the market price once either level is reached, only during market hours, and not on a stock halted by a storm.
  - Validation: long only, so the stop must be below the current price and the target above. You need to hold the stock, be in the match and not be knocked out.
  - Brackets follow the position: they survive adding shares and partial sells, and go away when it's closed.
  - Ticker events for stops and targets (the symbol shows only in open-book matches).
  - The everyone's-trades feed shows "hit their stop loss / took profit".
- **Chart:**
  - An SL/TP chip (on by default) shows green take-profit and red stop-loss boxes: your saved levels, a suggested bracket (1.5 ATR stop, 2:1) for an unprotected position, or a plan for your next buy.
  - Dragging an edge saves it (position) or updates the plan (next buy).
  - The engine flips the boxes for sell plans; Trade War is long only, so match boxes always sit long-side.
- **Alerts:** a "Trade War price alerts" list under the chart. Each row is tagged TW and shows ▲ Above / ▼ Below, with Edit (new price) and Delete. Alerts are still added by clicking a price on the chart and moved by dragging.
- **Fix:** success messages in the match room showed in error red; they're green now.
- **Files:** `functions/main.py` (`tw_check_bracket`, `tw_bracket_hits`, `tw_bracket`, bracket execution in `tw_mark_war`, sl/tp on `tw_trade`), `practice/war.js`, `practice/practice.css`, `scripts/tradewar_test.py`.
- **Tests:**
  - unit 93/93 (3 new)
  - **chart E2E on emulators with the real functions: 22/22**: SL/TP chip and fields, server validation (stop below, target above, needs a position, only your match), buy with a bracket, move and clear, nothing fires with the market closed, the stop fires at the market price in market hours, ticker event, the take profit fires with the right P&L, alert add / edit / delete, 375px mobile, no page errors
  - advanced gameplay E2E re-run: 30/30
  - Not browser-tested: dragging a box edge to save it (engine drag was tested in Phase 6).
- **Owner:** deploy functions (no rules change).

## Phase 12: Token economy (§1) + Gumroad retired + §14 gap check
Owner decisions (2026-09-30):
- Stripe for payments (the owner is recovering their Stripe login).
- "Cheaper" provisional prices.
- Tokens unlock **weekly scanner passes + single alerts**.

**Live alerts are token-gated until the close:**
- `publish_alert` writes a teaser to `alerts/{id}`: strategy, status, direction, score, setup, market mood and scan counts, plus `locked` / `lockedUntil`. The full alert goes to `alertsLocked/{id}`.
- `release_alerts` (weekdays from 4:10 pm ET, every 30 min) makes it public after the close. History, SEO scan pages and old links stay public.
- Days with no qualifying setup aren't locked.

**Wallet (server-only), `wallets/{uid}` + `ledger`:**
- 75 welcome tokens, once, only for verified accounts (Google or a verified email) so throwaway sign-ups can't farm them.
- 1-week pass = 40 tokens; it stacks.
- Single alert = 10 tokens; free if you already have access.
- Every change is a transaction with a ledger line.

**Stripe:**
- `tokens_checkout` makes a Checkout Session for a pack (100 = $3, 350 = $10, 750 = $20).
- `stripe_webhook` verifies the signature (5-minute tolerance), re-checks the amount and credits each session exactly once (`purchases/{sessionId}`).
- Dormant ("coming soon") until real keys are set.

**UI:**
- `zelos-tokens.js` on every signed-in page: gold balance chip in the nav, wallet pop-up (balance, passes, packs, history), welcome toast, and the locked-alert card with Unlock / Pass buttons.
- New `tokens.html`.
- `alert.html` and the alert pop-up show the full alert when you have access, otherwise the teaser and the card.
- Dashboard, home and history lists show "Locked · Live".
- The Arsenal, Dashboard and My Zelos show pass status.

**Gumroad removed:**
- `gumroad_ping` and its mapping deleted.
- `pendingOwnership` rules closed; "Mark as owned" and the purchase-claim code removed.
- $20 buy cards, FAQs and JSON-LD offers rewritten on the three scanner pages, the home page and the mockup.
- `going-to-gumroad*.html` now redirect to tokens.
- Setup, thank-you, Terms §07 (Stripe, live alerts, earlier purchases) and Privacy (Stripe) updated; docs updated; new `docs/tokens.md`.

**§14 gap check:**
- Everything was built in Phase 7 except **challenge history**, which was lost when the old hub was retired. It's back as a "Challenges" card on the Trade War home.

**Tests:**
- unit 102/102 (9 new in `scripts/tokens_test.py`)
- **token rules 22/22** (older suites 66, 15 and 27 pass; the 2 old Gumroad-claim tests now expect the closed rule)
- **token E2E on emulators with the real functions: 35/35**: teaser vs locked split, welcome (verified only, once, toast), nav chip, locked card, unlock, pass, reload without re-charging, wallet history, server refusals, direct-read denial, Stripe webhook (bad signature, wrong amount, credit, idempotent retry), release, guest read after the close, 375px mobile, no page errors
- **home E2E 16/16** (incl. challenge history)

**Caveats:**
- Token rewards for XP/levels are deferred until XP is server-side (it would be farmable today).
- `lockedUntil` skips weekends, not market holidays.

**Owner:**
- set the two Stripe secrets (placeholder `none` is fine), deploy rules, deploy the 6 functions, delete `gumroad_ping`, merge
- later: add the real Stripe keys + webhook (see `docs/tokens.md`)

## Payments switched to Square (backend only, 2026-10-01)
The owner chose **Square** instead of Stripe (Square Developer app "AgenticTrading.info", **sandbox** first). Backend only: no frontend changes this step.

**Code changes:**
- `tokens_checkout {pack}` now creates a **Square Checkout payment link** (`/v2/online-checkout/payment-links`, quick_pay) and returns `{url}`. The browser contract is unchanged.
  - Price and credits come only from `TOKENS`; browser-sent amounts are ignored.
  - Idempotency key per checkout; location from `SQUARE_LOCATION_ID` or the account's first active location.
  - Saved as `squareCheckouts/{orderId}` (pending).
- New HTTP function **`squareWebhook`**:
  - Verifies `x-square-hmacsha256-signature` (base64 HMAC-SHA256 of the notification URL + raw body).
  - Handles `payment.created` / `payment.updated`. Credits only `COMPLETED` payments for our own orders, with the exact amount and currency.
  - In one transaction: wallet credit + ledger line + checkout `pending → credited` + `purchases/sq_{orderId}`, plus `squareEvents/{eventId}` as a duplicate guard. So an order can never be credited twice, whether the same event repeats or a different event arrives for the same order.
  - 403 for a bad signature, 500 on errors (Square retries), 200 otherwise.
  - Logs show event, order, status and outcome; never secrets or card data.
- Stripe removed from the backend (`stripe_webhook`, the Stripe checkout and the Stripe secrets).
- `tokens_wallet.canBuy` follows the Square token.

**Config and rules:**
- Secrets: `SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- `functions/.env`: `SQUARE_ENVIRONMENT=sandbox` (non-secret).
- Rules: `squareCheckouts`, `squareEvents`, `purchases` are server-only.

**Tests:**
- unit 104/104 (Square signature, credit decision, server-set prices, environment)
- token rules 22/22
- **Square E2E on emulators (real functions + a fake Square API): 26/26**: checkout URL, server price, idempotency key, location, auth refusal, bad signature, not-completed, wrong amount, credit, same-event and other-event duplicates, foreign order, other event types, purchase record, wallet UI shows the credit, logs free of secrets and card data

**Frontend text still says Stripe** (tokens.html, the wallet pop-up, thank-you, Terms, Privacy). That's for the frontend step.

## Known issues
- Finding 2 (client-trusted XP, Trade War balances and challenge baselines) remains. It is addressed by the server-side Trade War sessions (Phase 5) and the token ledger.
- Arcade leaderboard (Realtime DB) accepts unauthenticated score writes, capped by rules. Spam is possible; to be revisited with the moderation work.
- Gumroad's ping secret travels in the URL query string, so it can appear in Cloud request logs. This goes away when Gumroad is retired (token phase).
- Phase 1 blocker: this container has no Firebase CLI or credentials, so the owner has to run the deploy and live check.

## Next phase
1. Owner: deploy Phase 2 (steps above) and confirm Phase 1 live prices at the next market open.
2. Owner: Phase 5 steps above (this also covers the Phase 4 rules).
3. Owner: Phase 7 steps above.
4. Phases 8-12 done (above). Next: §15 Global leaderboard + high-stakes challenges, when the owner says go.
