# AgenticTrading.info — Project State

> Canonical snapshot of what exists, what is in progress, what is broken, and what must be verified.
> This file is the **current-state document**, not the complete product specification
> (that is `MASTER_PLAN.md` plus `AGENTICTRADING_MASTER_SPEC.md`).
> A new Claude session should be able to continue from this file alone.
>
> **Last verified against the repository:** 2026-10-08 (after PRs #37 and #38; News v2 on `claude/news-v2`).

## 1. Product
AgenticTrading.info ("Zelos") is a trading education, scanning and simulated-competition site for retail traders.

Live areas:
- Marketing home page, Learn articles, AI index, daily scan pages
- Scan alerts: Swing Trader, Breakout Rider, Options Scanner (published by Claude skills, stored in Firestore)
- Alert history with checked outcomes (did it hit target / stop?)
- Dashboard (drag/resize widgets, Real/War presets)
- Trade War: a $10,000 virtual account plus server-run multiplayer matches, challenges, squads, communities, Last Man Standing modes
- Real Trade Journal: trades a person logs from their own broker (no broker connection)
- Training Ground (was Arcade): chart drills on real historical charts, with leaderboards
- XP, levels, missions, achievements, seasons, Founder program, invite-a-friend
- Z tokens (on-site credits) bought with Square; used to unlock alerts, passes and cosmetics
- Web push notifications and an in-app inbox (bell)
- Owner-only sales page (`sales.html`, `admin_sales`)

## 2. Actual architecture (verified)
| Layer | What it really is |
|---|---|
| Frontend (classic site) | Static HTML/CSS/vanilla JS, no build step. About 60 HTML pages at the repo root. Shared code in root `zelos-*.js` files and `zelos-theme.css`. Still the live product for most features. |
| Frontend (app) | **`webapp/`: Vite + React 19 + TypeScript single-page app served at `/app/`** (started 2026-10-07). App shell, routing for every module, design system. Modules move in one at a time; until then they hand off to the classic page. See `docs/APP_ARCHITECTURE.md`. |
| Generated pages | `games/`, `learn/`, `scan/`, `practice/`, `real/`, `ai-index.html`, `sitemap.xml` are produced by `scripts/build_*.py` (shell copied from `games/setup-spotter.html` via `scripts/site_shell.py`). Edit the builder, then re-run it. |
| Hosting | **GitHub Pages**, custom domain via `CNAME` (agentictrading.info). Today Pages serves the `main` branch directly. `.github/workflows/pages.yml` (added with the app) publishes classic site + built `/app/` after CI passes, once the owner switches Settings → Pages → Source to "GitHub Actions". **Merging to `main` is a production deploy either way.** |
| Auth | Firebase Auth: Google sign-in, plus silent anonymous sign-in for every visitor (`zelos-xp.js`). Rules distinguish anonymous from real accounts (`isRealAccount()`). |
| Database | Cloud Firestore (app data, rules in `firestore.rules`) and Realtime Database (arcade scores only, rules in `database.rules.json`, now deployable with `firebase deploy --only database`). No `firestore.indexes.json` in the repo. No Cloud Storage in use. |
| Server logic | Python 3.12, `functions/main.py` (~4,500 lines) plus helper modules `mdata.py` (market data), `xp.py` (XP rules), `country_links.py`. About 40 Cloud Functions: alert publishing/release, outcomes, Buffer posting, market data jobs, `market_research`, Trade War (`tw_*`), tokens/wallet, rewards, cosmetics, communities, push, Square checkout + `squareWebhook`, `admin_sales`, `xp_award`, `account_delete`. |
| Firebase project | `leaderboard-agentictrading` (`.firebaserc`). There is **one project**: no separate dev/staging project. Local testing uses the emulators (`firebase.emu.tmp.json`). |
| Payments | **Square** (Checkout payment links + HMAC-verified, idempotent webhook). `functions/.env` has `SQUARE_ENVIRONMENT=production`. Stripe and Gumroad are retired. |
| Market data | **Marketstack** prices (quotes every 15 min, 15-min bars, ~2 yrs daily history) and **SEC EDGAR** company data, fetched only by scheduled functions (`functions/mdata.py`) into public read-only `markets/*` docs. Pages read those (`zelos-mdata.js`); the old `data/*.json` price files are gone. News, analyst targets, earnings dates hidden; crypto paused. See `docs/market-data.md`, `DATA_PROVIDERS.md`. Live since 2026-10-07 (first `refresh_market_data` run filled `markets/historyIndex`, `snapshot`, `dailyBars` from Marketstack). |
| PWA | Classic: `manifest.json`, `firebase-messaging-sw.js` (push only). App: `webapp/public/manifest.webmanifest` (scope `/app/`, standalone), self-hosted fonts. No offline-caching service worker yet. |
| CI | `.github/workflows/ci.yml`: job `webapp` (app lint, typecheck, unit tests, build, Playwright phone/desktop + axe), job `checks` (Python syntax, unit tests, JS syntax, JSON validity, secret-file guard), job `rules` (Firestore + RTDB rules tests on emulators), job `functions-e2e` (xp_award + account_delete on emulators). Plus GitHub's built-in Pages deploy. |
| Tests | `scripts/*_test.py` (7 suites incl. `marketstack_test.py`, `xp_test.py`). `tests/rules/`: `rules.test.js` (19 rules tests) and `functions.e2e.mjs` (20 end-to-end checks); run with `cd tests/rules && npm ci && npm test` / `npm run test:functions` (needs Java). Older per-phase emulator suites from `AGENTICTRADING_PROGRESS.md` were never committed. |

Details: `docs/ARCHITECTURE.md`. Data model: `docs/data-model.md`.

## 3. Completed (code on `main`)
- Alerts pipeline: `publish_alert`, locked/teaser alerts released after the trade ends (`release_alerts`), outcome tracking (`update_alert_outcomes`, `scripts/check_alert_outcomes.py`), Buffer auto-posts.
- Security phase: server-only collections for wallets, ledgers, purchases, Square records, admins, push tokens; consent banner (`zelos-consent.js`); Terms and Privacy pages.
- Trade War matches enforced server-side: buy-in, trades at server prices, no overspend/shorting, revaluation (`tw_mark_matches`), elimination modes, challenges (accept/decline), bounties, shields, draft mode.
- Token wallet and ledger (server-only), daily check-in rewards, cosmetics, Square purchases.
- Profiles, usernames (unique reservations), squads, communities, friends, invites, Founder program, XP notifications and level badges.
- Dashboard layout editor; themes (Black/Blue/White).
- Web push and the bell inbox.
- **App at `/app/` (PRs #34–#36, live 2026-10-07):** React + TypeScript app shell (`webapp/`), Dashboard, Markets and Chart screens on the Marketstack `markets/*` docs, and the **server-side practice account** (engine `functions/practice.py`, callables `practice_*`, fills after every price refresh, nightly revalue) with the app's Practice and order-ticket screens. The owner deployed the functions and rules before merging #36; six unchanged functions (`tw_*`, `update_alert_outcomes`) failed to update on the first try and were re-deployed (owner reported "deploy complete"). The site is published by `.github/workflows/pages.yml` (Pages source = GitHub Actions).

- **Website sections in the app (owner list of 2026-10-09):** Alerts (#52) ✅, Leaderboard (#53) ✅, Profile (#54) ✅, Squads & friends (#55) ✅, Missions & XP (#56) ✅, Training Ground (#57) ✅ (the Arcade, renamed by the owner 2026-10-09 on the app and the website; `/app/training`), Options (#59) ✅ (long calls and puts in the practice account, modeled prices priced and filled by the server; `/app/options`; the owner deployed the functions on 2026-10-10 before the merge, not yet checked with a live order). That was the last website section to move: no app screen hands off to the website any more. Crypto is off the app until a licensed data source is chosen.
- **Battles in the app (2026-10-10, owner: "Yes, go"):** PR 1 = the battle room (`/app/battles`, lobby, draft, live match with storms / Last Man Standing / whales / bounties / stops, results) on the existing `tw_*` functions; every war.html link in the app now opens it. No deploy. PR 2 (next) = create / challenge with every game mode and the buy-in level locks.

## 4. Partially completed / unverified
- **Deploy of 2026-10-07:** the owner deployed functions, Firestore rules and RTDB rules from the PR #32 branch, then merged it, and reported it done. The first deploy attempt partly failed (some scheduled functions, an IAM error); a re-run was needed. Claude verified the Marketstack docs in `markets/*` directly; it cannot reach Cloud Functions, so the function list was confirmed by the owner, not by Claude. Still to watch: the first market session after the deploy (`markets/quotes.source` should change from `fmp` to Marketstack).
- Live market prices: **verified at the open on 2026-10-09 (after #49/#50 were deployed):** `markets/quotes.source` = marketstack, all 40 stocks had a real day change (e.g. AAPL −1.08%, TSLA +2.05%), movers filled (gainers/losers/actives), and `markets/intraday_AAPL` has `parser: 3` with true 1-minute bars (each minute's own open/high/low/close). Updates landed every 1–2 minutes, with one gap 09:44→09:52 ET when Marketstack timed out at the open (`error: TimeoutError`); it recovered by itself on the next run. Still to watch: whether open-time timeouts repeat (each run has a 45-second budget and 40-second request timeout), and intraday volume shows 0 on this plan. Practice fills before #49 (2026-10-08) used yesterday's close and were left as they are.
- **Missions counted by the server** (#44, merged 2026-10-08; the owner deployed it, not yet confirmed working in production): `functions/missions.py` counts trades and wins (practice fills, Trade War trades), graded setups and XP itself; charts opened and news read are reported by the app and the website (`mission_event`, checked); mission and streak XP are paid only by the server (`xp_award` refuses "mission" from browsers); the website's existing streak carries over. Achievements are still unlocked by the browser (bounded by the server's XP table).
- **Coach / Learn** (#45, merged 2026-10-08; deploy not confirmed). The Coach badge is stored (`coaches/{uid}.badge`) and shown in the app's Coaching hub, but not yet on the classic profile page.
- Rules/emulator tests exist only as past session results, not as committed tests.
- Legal pages are drafted; lawyer review still recommended (`docs/LEGAL_APP_STORE.md`).

## 5. Known issues
- **Live prices stuck 2026-10-07 → fixed by #38 (merged 2026-10-08):** the 15-minute Marketstack intraday request (all 50 stocks at once) timed out every run, freezing `markets/quotes` at the 2026-10-06 close; Marketstack also sent $0 daily bars (spikes to zero on charts). #38 chunks intraday requests, rejects non-positive prices and cleans stored history. **Verify at the 2026-10-08 open:** `markets/quotes.source == "marketstack"` with a fresh `updatedAt`.
- ~~**"Start with $10,000" fails with "internal"**~~ **fixed 2026-10-08:** the callable returned 403 (not publicly invokable after the deploy IAM errors). The owner opened it (and the other practice and invite functions) to the app; Claude verified a server-made practice profile now exists.
- **Branch protection:** ruleset "Zelos Protection Main" exists but is **disabled**, and it lets the Admin/Maintain/Write roles bypass it, so it would not protect `main` even if enabled. It also has no "require a pull request" or "require status checks" rule. Recommended settings are in `docs/DEVELOPMENT_WORKFLOW.md`.
- README mentions `.github/workflows/scan-pages.yml`; it does not exist, so `scan/` pages are only rebuilt by hand.
- Firebase web API key is public by design; it should be restricted to the site's domains in Google Cloud Console → Credentials.

## 6. Decisions on record
| Date | Decision |
|---|---|
| 2026-10-01 | Payments: **Square** (replaces Stripe/Gumroad). |
| 2026-10-03 / 10-07 | Market data: **Marketstack** (commercial-use prices) + **SEC EDGAR** (company facts). FMP/Finnhub personal plans, Yahoo and Robinhood exports are personal-use only and are retired. News, analyst targets and earnings dates are hidden until a licensed source exists. Crypto paused. Owner confirmed on 2026-10-07. |
| 2026-10-07 | The repository docs (this file first) are the handoff system between Claude sessions. |
| 2026-10-07 | **App build approach A:** new React + TypeScript app in `webapp/` at `/app/`, beside the classic site; features migrate one module at a time; same Firebase/functions/rules/data. No UI component library. |
| 2026-10-07 | App modules: **Practice** (solo virtual account) and **Trade War** (competitive matches) are separate. Owner confirmed the naming. |
| 2026-10-07 | **Practice account moves to the server** (owner): fresh $10,000 for everyone, old browser accounts archived read-only (unverified); stocks/ETFs first, options next; the classic practice page hands off to the app. Market/limit/stop orders fill only on prices observed after the order (no look-ahead). Details: `docs/PRACTICE_SERVER.md`. |
| 2026-10-07 | **App restructure (owner's UX checklist):** the app is named **Zelos Trade War** and positioned as a *simulated trading competition*, never a brokerage. Phone tab bar: **Dashboard · Market · Trade War · Alerts · News**; top bar: Profile · Notifications · ☰ menu (everything else). **Practice lives inside Trade War.** **Alerts tab = Zelos trade-signal alerts;** invites, challenges and friend requests go to the bell. **Real Trading is removed from the app only** (the website's Real Trade Journal page stays; its data is untouched). Zelos News = in-app announcements about Zelos, not financial news. Build order: (1) structure, (2) Market + one large chart experience + the globe, (3) Dashboard redesign, (4) invites + animations, (5) onboarding + launch animation. |
| 2026-10-08 | **Zelos News v2 (owner):** sections **Zelos Updates · Trade War · Market News · Market Movers**. Market News = free official sources now (Federal Reserve press releases, SEC 8-K filings for the stock list, with a "your watchlist" filter); a paid headline feed only later, after its commercial license and price are checked (Finnhub's plans are labelled personal use; Mediastack and Marketaux to be checked). Market Movers = posts by people who move markets (X, Truth Social), **curated by the owner** (pasted link + quote), shown as quote cards linking to the original; no X API for now (pay-per-use, about $0.005 per post read). **Post News screen approved:** team-only, backed by `news/{id}` (public read, server write) and the `news_save`/`news_delete` callables that check `admins/{uid}`. |
| 2026-10-08 | **Crypto stays out** of the app until a licensed crypto data source is found. |
| 2026-10-08 | **Coach / Learn invite (spec for step 4):** the inviter becomes the new user's coach; the coach sees the student's progress, can send notes and create tasks; both earn XP as the student works through them. Details to be designed with the owner. |
| 2026-10-08 | **Prices every minute** (owner, on the upgraded Marketstack plan): `QUOTE_EVERY_MIN=1`, `MS_INTERVAL=1min`. Each run asks only for bars since the newest stored one (about 5 requests a minute, ~2,000 a market day, ~41,000 a month); a daily cap (`MS_DAILY_CALLS=3000`) falls back to every 15 minutes; if the plan lacks 1-minute bars the server falls back to 15-minute bars on its own. The practice fill engine now uses the real bar length (no look-ahead rule unchanged). Plan to verify with `scripts/marketstack_check.sh` before deploying. |
| 2026-10-08 | **Dashboard redesign brought forward (owner):** built before the Market/charts step, from the classic `dashboard.html`: trader card (level, XP, streak, rank, badges), Trade War account, live globe with open exchanges, daily missions, leaderboard (top 5 + your rank), your Trade Wars, achievements, top movers, US market (indexes + sectors), watchlist. Only real data; screenshots in the PR stand in for the mockup, and the owner approves before merging. The globe is the classic `zelos-globe.js` loaded from the same site (one globe in the codebase). |
| 2026-10-08 | **Invites (owner):** the server creates and answers every invite (`invites/{code}`, callables `invite_create/send/accept/cancel`) so nobody can fake who invited whom; **referrals and their XP move to the server** (`referral_claim` for the website's `?ref=` links; browsers can no longer write `referrals/*`); a referral counts only for an account created in the last 7 days. **Squad invites join right away** and the squad owner is notified. Bell items carry an `action` so Accept / Decline work inline. Prank invites: not built (recommended against). **Coach / Learn: design first** (a one-page design with screens for the owner), then build. **Missions move to the server** as the step after invites. |
| 2026-10-08 | **Missions counted by the server** (owner approved, built after invites): same missions, goals and XP as before; `users/{uid}.missions` is server-only; the app's Dashboard shows the server's count. Coach / Learn design doc sent for approval ("Zelos Coach / Learn — design for approval"); building it waits on the owner. |
| 2026-10-08 | **Coach / Learn (owner approved the design):** coaching unlocks at **Level 3 (150 XP)**; anyone can be coached; **5 students** per coach, one coach per student; the coach sees the student's level, XP, missions, account value and **individual trades**, and reacts to a trade (👍 Good move / 👎 Bad move / 💡 Try this, optional note); either side can end it. Tasks pay small XP through the server only (`coach-task` 5–15 XP to the student, max 3 a day; `coach-bonus` 3–8 XP to the coach, max 6 a day). **Custom tasks can't farm XP:** the student ticks, the coach confirms, it pays 5 XP at most once a day and the coach nothing. Max 3 open tasks per coaching. **Coach badge** after 5 completed tasks (`coaches/{uid}.badge`). Started by a coach invite link; the student sees what the coach will see before accepting. |
| 2026-10-08 | **Onboarding + launch animation (owner):** a ~1 s branded launch animation on **every app open** (tap to skip, still for reduced motion; inline in `webapp/index.html`). A first sign-in without an @username opens **welcome screens**: name + @username (saved by the **server**, `profile_setup`, one atomic write; reserved names refused), **experience** (New / Some / Experienced, one tap, optional, saved as `users.experience`; New gets simpler words and a coaching pointer), the $10,000 practice account, a first trade. Then a **First steps checklist** on the Dashboard with the website's steps and XP (profile +25, first trade +25 now paid by the server, invite a friend; "Find a coach" optional for New). "Skip for now" and "Hide" are remembered per device (Hide shares the website's key). |
| 2026-10-09 | **Market opens on a chart (owner):** Market and the Dashboard open on a chart of the US indexes (S&P 500 / Nasdaq 100 / Dow, today or 6 months); a Chart \| Globe switch shows the live globe. The choice is remembered and shared with the classic dashboard (`zelosDashboardViz`). **Strategies** get a section in the Trade War hub (not a new tab). **Player-made strategies:** design doc first, built slowly with owner checks; creators are paid in **tokens only** with a house cut (no cash payouts). |
| 2026-10-10 | **Coach plays (owner):** "the coach should be able to take screenshots of the charts and draw on them and add comments" + a notification "your coach drew up a play". Owner chose **drawings on the live chart** (not flat pictures): stored as shapes pinned to bar dates and prices in `coachings/{id}/plays` (server-written, `coach_play` / `coach_play_comment`, coach-only to create, both comment; max 40 drawings, 10 plays a day, 60 comments). Needs a functions deploy (`docs/OWNER_DEPLOY_RUNBOOK.md` → Coach plays). |
| 2026-10-09 | **Before any iPhone work (owner):** every website section must be in the app first: Alerts, Leaderboard, Profile, Squads & friends, Missions & XP, Arcade, Options, Crypto (one PR each, owner checks each). Strategies use the homepage strategy pictures; Invite friends uses picture cards with the Zelos mascot (battle, team up, invite, coach). Charts always open as a line. |
| 2026-10-09 | **Arcade → Training Ground (owner):** the games are drills that train spotting setups, placing stops and setting targets, so the section is called **Training Ground** in the app and on the website (arcade.html keeps its address; /app/arcade redirects). The legal pages (terms, privacy) were renamed too on 2026-10-10 (owner: "we can change that over"; they mention "formerly the Arcade"). |
| 2026-10-09 | **Nothing unfinished in the app (owner):** anything we can't do yet stays off the app (Apple could see it as unfinished); the website may show what's coming. Crypto is removed from the app's menu (no "coming soon" screens). **Crypto data:** Marketstack has no crypto on any plan, and no free crypto feed clearly allows display in a commercial app (Coinbase and Kraken terms forbid or don't permit it; CoinGecko's free plan isn't licensed for commercial use; the cheapest licensed option found is CoinGecko Basic, ~$35/month, to be confirmed in writing). Crypto stays off the app until the owner picks a licensed source. **Options:** full options trading in the practice account now, with modeled prices (Black-Scholes on the live stock price, like the website) priced and filled by the server. |
| Standing | Hybrid web-first / native-ready direction; Capacitor to be evaluated later. The web app must keep working on its own. |
| Standing | Firebase stays the backend unless inspection shows a concrete reason to change. |

## 7. Security posture (summary)
Good:
- No real secrets in git history (all 138 commits scanned 2026-10-07). Secrets live in Firebase Secret Manager.
- Money-like state (tokens, purchases, Trade War match balances) is server-only.
- Square webhook verifies signatures and is idempotent.

Open:
Fixed in PR #32 (deployed 2026-10-07):
- XP is awarded only by `xp_award`: amounts come from server tables, refIds are shape- and date-checked, alerts/referrals are verified to exist, daily limits apply. Rules block browser writes to `xp`, `streakDays`, `lastAlertOpenDate` and the activity ledger. Note: the server still can't *see* most activities (a mission done, a trade made in the solo account), so XP is now bounded (max ~2,500/day) rather than proven.
- Arcade scores need a Firebase user (guests included), carry the uid, and are limited to one per player per 10 seconds.
- `practiceProfiles.equity` must be between 0 and 100,000,000.
- Account deletion: `account_delete` + a "Delete your account" card on My Zelos (needs a fresh sign-in). Keeps purchase/Square records.

Still open:
- Practice numbers become server-computed with the practice-server PR (below); until it is deployed, the classic browser account and its leaderboard can still be inflated.
- `users/{uid}.friends` is owner-writable and read by `friend_ping` (worst case: pings to non-friends, one per pair). Low risk.
- `users/{uid}.ownedSkills` is owner-writable (legacy Gumroad field); nothing on the server trusts it.
- Arcade scores are still self-reported by the game page (capped by rules).

## 8. Current direction
Recommended direction: **hybrid web-first / native-ready**. Keep improving the existing static site; prepare for Capacitor packaging later without rewriting it.

## 9. Important product separations
- The app has no real-trading feature. On the website, the Real Trade Journal (`real/`) ≠ Trade War (virtual); modes never mix (`zelos-modes.js`).
- Trade War matches are separate from the solo $10,000 practice account.
- Social/community features stay out of the solo trading workflow.
- Financial values are trusted only when computed server-side.

## 10. Current priorities (app build phase)
Following the owner's UX checklist (2026-10-07), one PR per step, each tried by the owner before the next:
1. ~~**Structure**~~ done (#37). ~~**News v2 + Practice fix**~~ (#39) and ~~**prices every minute**~~ (#40) merged 2026-10-08.
2. ~~**Market and charts**~~ — merged (#42): Market = the overview (live globe + 17 exchanges, sectors, mini charts of indexes/watchlist/movers, every stock with search); the chart screen = one big chart sized to the screen, a symbol switcher (search sheet + recent symbols) and mini-chart previews to jump between symbols. Mini charts use the daily history already loaded for charts plus the live quote (no extra reads). Original plan: one large chart experience with an asset switcher and mini-chart previews; the website's 3D globe (`market-3d.html`) brought into Market. The globe's country/world moves are mock + Yahoo data today: in the app it shows only real data (exchange open/closed, day/night line, US indexes and sectors from Marketstack) unless the owner approves a world-markets data source.
3. ~~**Dashboard redesign**~~ — merged (#41, 2026-10-08).
4. **Invites** — Battle / Team up / Invite a friend built (branch `claude/invites`, needs a deploy, see the runbook "Invites"): `/app/invite` to make one (link + send to @username), `/app/i/<code>` landing with Accept and a celebration, Accept/Decline in the bell. Merged as #43 and deployed 2026-10-08. ~~**Server-side missions**~~ merged (#44). **Coach / Learn** built (branch `claude/coach`, needs a deploy): `/app/coach` hub, `/app/coach/:id` coaching page, coach invite links.
5. **Onboarding + first steps,** short branded launch animation — built (branch `claude/onboarding`, needs a deploy, runbook "Welcome + launch animation"). ~~**Coach / Learn**~~ merged (#45).
Then: Capacitor (iOS first) → TestFlight. Before App Store submission: Sign in with Apple (required with Google sign-in), the token-purchase decision (Apple IAP rule 3.1.1), and every classic hand-off moved into the app (several classic pages still link to the website's Real Trading page).

**Waiting on the owner:** the Coach deploy (runbook "Coaching", #45 merged first); the onboarding deploy; confirm missions count in the app after the #44 deploy (open 3 charts → Dashboard 3/3); repo ruleset fixes (§5). The owner reported on 2026-10-08 that the `practice_account` 403 fix (public invoker) and the #40 price-function deploy are done; Claude has not been able to verify either from here.

## 11. Open pull requests / work in flight
- `claude/onboarding`: launch animation, welcome screens, First steps. Deploy, open `profile-setup`, then merge (runbook "Welcome + launch animation").

Recently done: #45 Coach / Learn (merged 2026-10-08; deploy per the runbook "Coaching" — not confirmed yet), #44 missions on the server (merged 2026-10-08), #43 Invites (deployed 2026-10-08), #42 Market + big chart, #41 Dashboard v2, #39 News v2 + Practice fix, #40 prices every minute (merged 2026-10-08; #40's two functions to be deployed per the runbook); #37 app structure (five tabs, Trade War hub, News), #38 live-price fix (both merged 2026-10-08); #34 app foundation, #35 Dashboard/Markets/Chart, #36 server practice account (all merged and deployed 2026-10-07); #31 docs + CI, #32 Marketstack + server XP + account deletion, #33 deploy notes.

## 12. Non-negotiable principles
- Never trust client-submitted prices, balances, permissions, quotas, payment states or user IDs.
- Never commit secrets.
- No major architecture/security/payment/legal/data-provider change without discussion and owner approval.
- Test before production. Remember: merging to `main` publishes the frontend.
- Document meaningful changes here.

## 13. Session handoff rule
Update this file whenever a major implementation, architectural decision, security decision, provider change, deployment change, or important bug/fix changes the project state. Detailed per-phase history stays in `AGENTICTRADING_PROGRESS.md`.
