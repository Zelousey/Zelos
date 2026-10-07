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
| Database | Cloud Firestore (app data, rules in `firestore.rules`) and Realtime Database (arcade scores only, rules in `database.rules.json`). No `firestore.indexes.json` in the repo. No Cloud Storage in use. |
| Server logic | **One Python 3.12 file, `functions/main.py` (~4,100 lines), 39 Cloud Functions**: alert publishing/release, outcomes, Buffer posting, market data jobs, `market_research`, Trade War (`tw_*`), tokens/wallet, rewards, cosmetics, communities, push, Square checkout + `squareWebhook`, `admin_sales`. |
| Firebase project | `leaderboard-agentictrading` (`.firebaserc`). There is **one project**: no separate dev/staging project. Local testing uses the emulators (`firebase.emu.tmp.json`). |
| Payments | **Square** (Checkout payment links + HMAC-verified, idempotent webhook). `functions/.env` has `SQUARE_ENVIRONMENT=production`. Stripe and Gumroad are retired. |
| Market data (on `main` today) | `refresh_quotes`/`refresh_market_data`/`market_research` call **FMP**; `refresh_news` calls **Finnhub**; `update_market_snapshot.py` reads Yahoo; `data/*.json` holds price history from personal-use sources. See §6: this is being replaced by Marketstack + SEC EDGAR. |
| PWA | `manifest.json`, icons, `firebase-messaging-sw.js` (push only; no offline caching service worker). |
| CI | `.github/workflows/ci.yml` (added 2026-10-07): Python syntax, unit tests, JS syntax, JSON validity, secret-file guard. Plus GitHub's built-in Pages deploy. |
| Tests | `scripts/*_test.py` (5 suites, 127 tests, all passing 2026-10-07). Emulator end-to-end and Firestore rules tests described in `AGENTICTRADING_PROGRESS.md` were run in earlier sessions but are **not committed** to the repo. |

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
- XP, missions and the solo $10,000 practice account are **client-side** (localStorage + `users/{uid}`); see §7.
- Rules/emulator tests exist only as past session results, not as committed tests.
- Legal pages are drafted; lawyer review still recommended (`docs/LEGAL_APP_STORE.md`).

## 5. Known issues
- **Branch protection:** ruleset "Zelos Protection Main" exists but is **disabled**, and it lets the Admin/Maintain/Write roles bypass it, so it would not protect `main` even if enabled. It also has no "require a pull request" or "require status checks" rule. Recommended settings are in `docs/DEVELOPMENT_WORKFLOW.md`.
- `update-market-data.yml` sits at the repo root, so GitHub never runs it (and its script path is wrong). It is removed by the Marketstack change.
- README mentions `.github/workflows/scan-pages.yml`; it does not exist, so `scan/` pages are only rebuilt by hand.
- Two different copies of the market snapshot (`market-snapshot.json`, `data/market-snapshot.json`); both are removed by the Marketstack change.
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
- `users/{uid}` is fully owner-writable, and the server reads `xp` and `friends` from it (Trade War buy-in tiers, whale role, community limits). Being fixed in PR B (§11).
- Arcade scores (Realtime DB) can be written without signing in. Being fixed in PR B.
- Solo practice-account stats (`practiceProfiles`) are browser-written, so that leaderboard can be inflated. Accepted for now (virtual money); bounded in PR B.
- No account-deletion feature even though the Privacy Policy promises one. Being added in PR B.

## 8. Current direction
Recommended direction: **hybrid web-first / native-ready**. Keep improving the existing static site; prepare for Capacitor packaging later without rewriting it.

## 9. Important product separations
- Real Trading (journal) ≠ Trade War (virtual). Modes never mix (`zelos-modes.js`).
- Trade War matches are separate from the solo $10,000 practice account.
- Social/community features stay out of the solo trading workflow.
- Financial values are trusted only when computed server-side.

## 10. Current priorities
1. Owner: set up branch protection properly (see `docs/DEVELOPMENT_WORKFLOW.md`).
2. Owner: deploy functions + rules from PR B, check market data, then merge PR B.
3. Commit Firestore rules tests and run them in CI on the emulator.
4. Legal/privacy/App Store readiness review.
5. Native packaging evaluation (Capacitor).
6. Performance measurement.

## 11. Open pull requests / work in flight
- **PR A — docs, CI, cleanup** (`claude/docs-ci-square-wording`): this rewrite, `ci.yml`, untracked `__pycache__`. Safe to merge any time.
- **PR B — Marketstack + security** (`claude/marketstack-security`): Marketstack/SEC EDGAR data, server-side XP, signed-in arcade scores, account deletion. **Deploy functions + rules first, then merge.** Steps: `docs/OWNER_DEPLOY_RUNBOOK.md` on that branch.

## 12. Non-negotiable principles
- Never trust client-submitted prices, balances, permissions, quotas, payment states or user IDs.
- Never commit secrets.
- No major architecture/security/payment/legal/data-provider change without discussion and owner approval.
- Test before production. Remember: merging to `main` publishes the frontend.
- Document meaningful changes here.

## 13. Session handoff rule
Update this file whenever a major implementation, architectural decision, security decision, provider change, deployment change, or important bug/fix changes the project state. Detailed per-phase history stays in `AGENTICTRADING_PROGRESS.md`.
