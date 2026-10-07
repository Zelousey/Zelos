# AgenticTrading.info — Project State

> Canonical snapshot of what exists, what is in progress, what is broken, and what must be verified.
> This file is the **current-state document**, not the complete product specification
> (that is `MASTER_PLAN.md` plus `AGENTICTRADING_MASTER_SPEC.md`).
> A new Claude session should be able to continue from this file alone.
>
> **Last verified against the repository:** 2026-10-07 (commit `c3554cb` on `main` + the PRs listed in §11).

## 1. Product
AgenticTrading.info ("Zelos") is a trading education, scanning and simulated-competition site for retail traders.

Live areas:
- Marketing home page, Learn articles, AI index, daily scan pages
- Scan alerts: Swing Trader, Breakout Rider, Options Scanner (published by Claude skills, stored in Firestore)
- Alert history with checked outcomes (did it hit target / stop?)
- Dashboard (drag/resize widgets, Real/War presets)
- Trade War: a $10,000 virtual account plus server-run multiplayer matches, challenges, squads, communities, Last Man Standing modes
- Real Trade Journal: trades a person logs from their own broker (no broker connection)
- Arcade: chart games on real historical charts, with leaderboards
- XP, levels, missions, achievements, seasons, Founder program, invite-a-friend
- Z tokens (on-site credits) bought with Square; used to unlock alerts, passes and cosmetics
- Web push notifications and an in-app inbox (bell)
- Owner-only sales page (`sales.html`, `admin_sales`)

## 2. Actual architecture (verified)
| Layer | What it really is |
|---|---|
| Frontend | **Static HTML/CSS/vanilla JS. No bundler, no framework, no `package.json`.** About 60 HTML pages. Shared code in root `zelos-*.js` files and `zelos-theme.css`. |
| Generated pages | `games/`, `learn/`, `scan/`, `practice/`, `real/`, `ai-index.html`, `sitemap.xml` are produced by `scripts/build_*.py` (shell copied from `games/setup-spotter.html` via `scripts/site_shell.py`). Edit the builder, then re-run it. |
| Hosting | **GitHub Pages** from `main` (root), custom domain via `CNAME` (agentictrading.info). `firebase.json` has no `hosting` section. **Merging to `main` is a production frontend deploy.** |
| Auth | Firebase Auth: Google sign-in, plus silent anonymous sign-in for every visitor (`zelos-xp.js`). Rules distinguish anonymous from real accounts (`isRealAccount()`). |
| Database | Cloud Firestore (app data, rules in `firestore.rules`) and Realtime Database (arcade scores only, rules in `database.rules.json`, now deployable with `firebase deploy --only database`). No `firestore.indexes.json` in the repo. No Cloud Storage in use. |
| Server logic | Python 3.12, `functions/main.py` (~4,500 lines) plus helper modules `mdata.py` (market data), `xp.py` (XP rules), `country_links.py`. About 40 Cloud Functions: alert publishing/release, outcomes, Buffer posting, market data jobs, `market_research`, Trade War (`tw_*`), tokens/wallet, rewards, cosmetics, communities, push, Square checkout + `squareWebhook`, `admin_sales`, `xp_award`, `account_delete`. |
| Firebase project | `leaderboard-agentictrading` (`.firebaserc`). There is **one project**: no separate dev/staging project. Local testing uses the emulators (`firebase.emu.tmp.json`). |
| Payments | **Square** (Checkout payment links + HMAC-verified, idempotent webhook). `functions/.env` has `SQUARE_ENVIRONMENT=production`. Stripe and Gumroad are retired. |
| Market data | **Marketstack** prices (quotes every 15 min, 15-min bars, ~2 yrs daily history) and **SEC EDGAR** company data, fetched only by scheduled functions (`functions/mdata.py`) into public read-only `markets/*` docs. Pages read those (`zelos-mdata.js`); the old `data/*.json` price files are gone. News, analyst targets, earnings dates hidden; crypto paused. See `docs/market-data.md`, `DATA_PROVIDERS.md`. **Live only after the PR B deploy (§11).** |
| PWA | `manifest.json`, icons, `firebase-messaging-sw.js` (push only; no offline caching service worker). |
| CI | `.github/workflows/ci.yml`: job `checks` (Python syntax, unit tests, JS syntax, JSON validity, secret-file guard), job `rules` (Firestore + RTDB rules tests on emulators), job `functions-e2e` (xp_award + account_delete on emulators). Plus GitHub's built-in Pages deploy. |
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

## 4. Partially completed / unverified
- **Production deploy state is unknown.** Several phases were logged as "code done, owner must deploy rules + functions". Nobody has confirmed the deployed Firestore rules and functions match `main`. Claude sessions have no Firebase credentials.
- Live market prices: never confirmed during a market session.
- Missions and the solo $10,000 practice account are **client-side** (localStorage + `users/{uid}`). XP itself is server-awarded once PR B is deployed; see §7.
- Rules/emulator tests exist only as past session results, not as committed tests.
- Legal pages are drafted; lawyer review still recommended (`docs/LEGAL_APP_STORE.md`).

## 5. Known issues
- **Branch protection:** ruleset "Zelos Protection Main" exists but is **disabled**, and it lets the Admin/Maintain/Write roles bypass it, so it would not protect `main` even if enabled. It also has no "require a pull request" or "require status checks" rule. Recommended settings are in `docs/DEVELOPMENT_WORKFLOW.md`.
- README mentions `.github/workflows/scan-pages.yml`; it does not exist, so `scan/` pages are only rebuilt by hand.
- Firebase web API key is public by design; it should be restricted to the site's domains in Google Cloud Console → Credentials.

## 6. Decisions on record
| Date | Decision |
|---|---|
| 2026-10-01 | Payments: **Square** (replaces Stripe/Gumroad). |
| 2026-10-03 / 10-07 | Market data: **Marketstack** (commercial-use prices) + **SEC EDGAR** (company facts). FMP/Finnhub personal plans, Yahoo and Robinhood exports are personal-use only and are retired. News, analyst targets and earnings dates are hidden until a licensed source exists. Crypto paused. Owner confirmed on 2026-10-07. |
| 2026-10-07 | The repository docs (this file first) are the handoff system between Claude sessions. |
| Standing | Hybrid web-first / native-ready direction; Capacitor to be evaluated later. The web app must keep working on its own. |
| Standing | Firebase stays the backend unless inspection shows a concrete reason to change. |

## 7. Security posture (summary)
Good:
- No real secrets in git history (all 138 commits scanned 2026-10-07). Secrets live in Firebase Secret Manager.
- Money-like state (tokens, purchases, Trade War match balances) is server-only.
- Square webhook verifies signatures and is idempotent.

Open:
Fixed in PR B (effective once deployed):
- XP is awarded only by `xp_award`: amounts come from server tables, refIds are shape- and date-checked, alerts/referrals are verified to exist, daily limits apply. Rules block browser writes to `xp`, `streakDays`, `lastAlertOpenDate` and the activity ledger. Note: the server still can't *see* most activities (a mission done, a trade made in the solo account), so XP is now bounded (max ~2,500/day) rather than proven.
- Arcade scores need a Firebase user (guests included), carry the uid, and are limited to one per player per 10 seconds.
- `practiceProfiles.equity` must be between 0 and 100,000,000.
- Account deletion: `account_delete` + a "Delete your account" card on My Zelos (needs a fresh sign-in). Keeps purchase/Square records.

Still open:
- Solo practice-account numbers (`practiceProfiles`) are browser-computed, so that leaderboard can still be inflated within the bound. Real fix = server-side solo account (large; not started).
- `users/{uid}.friends` is owner-writable and read by `friend_ping` (worst case: pings to non-friends, one per pair). Low risk.
- `users/{uid}.ownedSkills` is owner-writable (legacy Gumroad field); nothing on the server trusts it.
- Arcade scores are still self-reported by the game page (capped by rules).

## 8. Current direction
Recommended direction: **hybrid web-first / native-ready**. Keep improving the existing static site; prepare for Capacitor packaging later without rewriting it.

## 9. Important product separations
- Real Trading (journal) ≠ Trade War (virtual). Modes never mix (`zelos-modes.js`).
- Trade War matches are separate from the solo $10,000 practice account.
- Social/community features stay out of the solo trading workflow.
- Financial values are trusted only when computed server-side.

## 10. Current priorities
1. Owner: set up branch protection properly (see `docs/DEVELOPMENT_WORKFLOW.md`), with `checks`, `rules`, `functions-e2e` as required checks.
2. Owner: follow `docs/OWNER_DEPLOY_RUNBOOK.md` (deploy, fill market data, merge PR B).
3. Find a licensed options-chain source for the Options Scanner (`DATA_PROVIDERS.md`).
4. Legal/privacy/App Store readiness review.
5. Native packaging evaluation (Capacitor).
6. Performance measurement.

## 11. Open pull requests / work in flight
- **PR A — docs, CI, cleanup** (`claude/docs-ci-square-wording`): this rewrite, `ci.yml`, untracked `__pycache__`. Safe to merge any time.
- **PR B — Marketstack + security** (`claude/marketstack-security`): Marketstack/SEC EDGAR data, server-side XP, signed-in arcade scores, account deletion, committed rules/e2e tests. **Deploy functions + rules first, then merge.** Steps: `docs/OWNER_DEPLOY_RUNBOOK.md`.

## 12. Non-negotiable principles
- Never trust client-submitted prices, balances, permissions, quotas, payment states or user IDs.
- Never commit secrets.
- No major architecture/security/payment/legal/data-provider change without discussion and owner approval.
- Test before production. Remember: merging to `main` publishes the frontend.
- Document meaningful changes here.

## 13. Session handoff rule
Update this file whenever a major implementation, architectural decision, security decision, provider change, deployment change, or important bug/fix changes the project state. Detailed per-phase history stays in `AGENTICTRADING_PROGRESS.md`.
