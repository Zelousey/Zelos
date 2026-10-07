# AgenticTrading.info — Architecture

> What the system actually is (verified 2026-10-07), followed by the direction it is moving in.

## Current foundation
- **The app (`webapp/`, at `/app/`):** React + TypeScript single-page app that the product is moving into. Full details: `docs/APP_ARCHITECTURE.md`. Everything below describes the classic site and the shared backend.
- **Frontend:** static HTML/CSS/vanilla JavaScript. No bundler, no framework, no npm build.
  Shared modules are plain `<script>` files at the repo root (`zelos-*.js`), styling in `zelos-theme.css`.
- **Generated pages:** Python builders in `scripts/build_*.py` write `games/`, `learn/`, `scan/`,
  `practice/`, `real/`, `ai-index.html`, `sitemap.xml` and `llms.txt`. The shared nav/footer comes
  from `games/setup-spotter.html` through `scripts/site_shell.py`.
- **Hosting:** GitHub Pages serves `main` at agentictrading.info. Merging to `main` = deploying the frontend.
- **Firebase project `leaderboard-agentictrading`:**
  - Auth: Google sign-in, plus anonymous sign-in for every visitor.
  - Firestore: app data. Rules: `firestore.rules`.
  - Realtime Database: arcade leaderboards only. Rules: `database.rules.json`.
  - Cloud Functions (Python 3.12): `functions/main.py` (+ helper modules). Secrets in Secret Manager;
    non-secret settings in `functions/.env`.
  - Cloud Messaging: web push (`firebase-messaging-sw.js`, `zelos-push.js`).
- **Payments:** Square Checkout links + `squareWebhook` (signature-verified, idempotent).
- **CI:** GitHub Actions `ci.yml` (syntax, unit tests, JSON, secret-file guard) and GitHub's Pages deploy.
- **Deploys of functions and rules** are done by the owner from their machine/Cloud Shell
  (`firebase deploy --only functions,firestore:rules`). Claude sessions have no Firebase credentials.

## Data flow
```
Browser ──reads──▶ public read-only Firestore docs (markets/*, alerts, profiles)
Browser ──callable (Firebase Auth token)──▶ Cloud Function ──▶ Firestore (server-only collections)
Scheduler ──▶ Cloud Function ──▶ market-data provider ──▶ markets/* (cached, shared by all visitors)
Claude scan skills ──HTTP + shared secret──▶ publish_alert ──▶ alerts / alertsLocked
Square ──signed webhook──▶ squareWebhook ──▶ wallets + ledger + purchases
```
Provider API keys are only used server-side. Browsers never call a paid provider directly, so
request volume does not grow with traffic.

## Who owns which value
| Value | Owner today |
|---|---|
| Token balances, purchases, ledger | Server only |
| Trade War match balances, trades, results | Server only |
| Alert content and outcomes | Server only |
| Market prices | Server only (scheduled jobs) |
| XP / levels | Moving to server (PR B); was client-written |
| Solo $10,000 practice account | Browser (localStorage + `users/{uid}.practice`); virtual, accepted |
| Arcade scores | Browser, rule-validated; signed-in requirement added in PR B |

## Market data
See `docs/market-data.md`. Direction (approved): Marketstack for prices, SEC EDGAR for company data.

## Preferred direction
Continue with the current web application and evolve it into:
1. A high-quality desktop web application.
2. A high-quality mobile PWA.
3. A native-ready web architecture.
4. A Capacitor-based iOS/Android application if evaluation confirms it is appropriate.

Do not rewrite the application solely to make a native app. Decided 2026-10-07: a Vite + React +
TypeScript app in `webapp/` beside the classic site (not a rewrite); see `docs/APP_ARCHITECTURE.md`.

## Native strategy
Evaluate Capacitor for notifications, secure storage, haptics, lifecycle, deep links, networking,
authentication, payments (App Store rules for credits) and device APIs. Keep the web app
independently functional.

## Backend principle
Firebase remains the backend unless inspection shows a concrete reason to change.
Known structural debt: `functions/main.py` is one very large file; splitting it into modules
(as `mdata.py` does for market data) is a reasonable future refactor.

## Financial integrity
Server-side systems own token balances, payment state, trade outcomes, match balances,
permissions, quotas and critical calculations.

## Component architecture
Reuse the shared `zelos-*.js` modules and theme tokens; avoid page-specific copies.
Change generated pages through their builders, never by hand.

## Localization
Prepare user-facing strings, numbers, dates, times and currencies for localization before
large-scale UI expansion. Today the site is English/USD only.

## Performance
Measure first (payload size, Firestore reads, chart latency), then optimize.
