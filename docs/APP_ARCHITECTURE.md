# Zelos app architecture (webapp/)

> Decided 2026-10-07 (owner approved option A): build a real single-page app **beside** the
> classic site and move features into it one at a time. The classic site keeps working
> the whole time. Same Firebase project, same security rules, same Cloud Functions, same
> Marketstack data. No backend changes were needed for the app shell.

## Why a separate app instead of editing the classic pages
The classic site is ~60 standalone HTML pages. Every tap is a full page load: the screen
blanks, Firebase and sign-in restart, scroll and state are lost. That is fine for a website
but is the main thing that makes a wrapped iOS app feel like "just a website" (App Store
guideline 4.2). A single-page app keeps the shell (sidebar / tab bar / top bar) mounted and
swaps only the screen.

Options considered: (B) add a shared shell script to every classic page (no build step,
but full reloads remain); (C) rewrite everything at once (high risk). A was chosen.

## Stack
| Piece | Choice | Why |
|---|---|---|
| Build | Vite 8 | Fast, standard, outputs static files (works on GitHub Pages and inside Capacitor). |
| UI | React 19 + TypeScript (strict) | Most widely used, best Capacitor/plugin ecosystem, type safety for financial code. |
| Routing | react-router 8, browser-history URLs under `/app/` | Shareable deep links that map 1:1 to future iOS universal links. |
| Firebase | Modular SDK v12 | Same project/config as the classic site (shared sign-in), ships only what's imported. |
| Styling | CSS Modules + design tokens (`src/styles/tokens.css`) | No UI library: our own components, so the app doesn't look generic. |
| Fonts | IBM Plex Sans/Mono, self-hosted (`@fontsource`) | Same fonts as the site; works offline and in the native app; no Google Fonts request. |
| Tests | Vitest + Testing Library (unit), Playwright + axe (browser, accessibility) | Run in CI on every PR. Browser tests use a `--mode e2e` build that talks to the local Auth + Firestore emulators (fake `demo-zelos` project) seeded with a trimmed copy of real `markets/*` docs (`webapp/e2e/fixtures/markets.json`). Normal builds can't reach the emulators. |

No component library, state library or CSS framework was added. Add one only with a stated reason.

## Layout of `webapp/src`
```
main.tsx               entry: theme → 404-redirect fix-up → render
app/modules.ts         THE module registry: every area, its route, icon, group, status
app/router.tsx         routes generated from the registry; 404 deep-link restore
shell/                 AppShell (sidebar, top bar, tab bar, sheets), inbox, online state
ui/                    shared components (import from 'ui', never between features)
features/<module>/     one folder per screen/module
lib/                   firebase, auth, theme, format (Intl), i18n, storage, platform
styles/                tokens.css (design tokens, matches zelos-theme.css), base.css
```

## The module registry
`app/modules.ts` lists every area: Dashboard, Markets, Charts, Practice, Real Trading,
Trade War, Alerts, Options, Crypto, Social, Missions & XP, Arcade, Profile, Settings.
Each has a `status`:
- `ready`: built in the app (`load` points at its screen).
- `classic`: still on the classic site. The app shows a hand-off screen linking to
  `classicPath` (same account, same data).
- `planned`: not built anywhere yet (Crypto: paused until a licensed data source).

Moving a module into the app = build `features/<id>/…Page.tsx`, set `status: 'ready'` and
`load`. Navigation updates itself.

Product separations are encoded here: **Practice** (solo virtual account), **Real Trading**
(journal of your own broker's trades) and **Trade War** (competitive matches) are separate
modules and must never share balances.

## Shell behaviour
- **Desktop/tablet (> 760px):** collapsible grouped sidebar (state remembered), sticky top
  bar with bell, sign-in and profile. Screens get the full width (max 1600px).
- **Phone (≤ 760px):** top bar (logo, screen name, bell, profile) and bottom tab bar:
  Dashboard · Markets · Practice · Alerts · More. "More" opens a grouped list of the other
  modules. Touch targets ≥ 44px. Safe-area insets respected (notch, home indicator).
- Each screen renders inside an ErrorBoundary + Suspense: one crash or slow load never
  takes down the bars. Standard loading (skeleton), empty and error states live in `ui/States`.
- Offline banner when the device loses its connection.
- Notifications: the bell reads `users/{uid}/inbox` (server-written; rules allow read and
  mark-read only). Inbox links are followed only if they are same-site paths.

## Components (`src/ui`)
Button / ButtonLink (primary, secondary, ghost, danger, buy, sell), Card (panel with header),
Badge, Stat (number + label + change), Tabs (segmented, keyboard accessible), Sheet (the one
overlay: modal, side drawer, phone bottom sheet; native `<dialog>`), Toast, Skeleton,
EmptyState / ErrorState / LoadingState, PageHeader, ErrorBoundary, Icon (one line-icon set).
Planned as the flows need them: DataTable, MarketRow/MarketCard, ChartContainer,
OrderTicket, PositionCard, Select/Input.

## Design tokens and accessibility
`tokens.css` repeats the classic site's colour values for all three themes (Black, Blue,
White); `tokens.test.ts` fails if they drift. The theme choice is shared with the classic site
(`zelosTheme` in localStorage). App-only tokens add readable shades for small text and filled
buttons (`--accent-fill`, `--buy-fill`, `--sell-fill`, `--up-ink`, `--down-ink`, `--link`) so every
theme passes WCAG AA; the axe browser test checks all three themes.

## Data
Readers live in `src/data/`: `markets.ts` (typed, validated parsers for `markets/quotes`,
`movers`, `snapshot`, `intraday_SYM`, `historyIndex`/`history_n`), `liveDoc.ts` (one shared
`onSnapshot` listener per document, kept a few seconds after the last screen leaves, so
moving between screens doesn't re-read), `universe.ts` (the stock list, bundled from
`data/practice-universe.json`), `marketStatus.ts` (the "Market open · updated … · source" line).
Charts use the classic site's engine (`practice/practice-chart.js`, bundled, wrapped by
`features/charts/ChartView.tsx`; timeframe building in `features/charts/series.ts`), so both
draw the same charts and share indicator/style preferences.

The app uses the **existing** market-data architecture: scheduled Cloud Functions fetch
Marketstack/SEC EDGAR and write public read-only `markets/*` docs; the app reads those.
There is no second data system and no provider key in the app. Anything money-like or
permission-like (tokens, Trade War, XP, account deletion) goes through the existing callables
(`lib/firebase.callFunction`). Client values are never trusted for prices, balances or permissions.

## Localization readiness
All user-facing text goes through `t()` (`lib/i18n.ts`, one English catalogue today). Numbers,
money, percentages, dates and relative times go through `lib/format.ts` (Intl, explicit locale
and currency; market times in America/New_York). No full translation system yet.

## Deploy
- `.github/workflows/ci.yml` job `webapp`: lint, typecheck, unit tests, build, Playwright
  (phone + desktop, axe in 3 themes).
- `.github/workflows/pages.yml`: after CI passes on `main`, builds the app and publishes the
  classic site + `/app/` to GitHub Pages. **Needs one setting:** Settings → Pages → Source:
  "GitHub Actions". Before that switch, GitHub keeps serving the branch and `/app/` isn't live.
- GitHub Pages has no SPA fallback: `404.html` sends unknown `/app/…` paths to
  `/app/?r=<path>`, and `restoreRedirect()` restores them (same-app paths only).

## Native (Capacitor) readiness
Not started on purpose: the shell comes first. What is already in place:
- Static build with a fixed base (`/app/`), no server needed.
- Safe-area insets, 44px targets, no hover-only interactions, standalone manifest.
- `lib/platform.ts` (`isNative()`, `classicUrl()` which points classic links at the public site
  inside the native app), `lib/storage.ts` (single place to swap to Capacitor Preferences).
- Fonts and icons bundled locally.

Still to do when Capacitor starts (each needs a plugin and a decision):
| Area | Web today | Native plan |
|---|---|---|
| Sign-in | Google popup / redirect | `@capacitor-firebase/authentication` (popups don't work in WKWebView); Sign in with Apple is required by App Store rules if Google sign-in is offered |
| Push | Web push (FCM, `firebase-messaging-sw.js`) | APNs via `@capacitor/push-notifications` + FCM; server already stores push tokens |
| Secure storage | localStorage (no secrets stored) | Preferences / Keychain for anything sensitive |
| Haptics | none | `@capacitor/haptics` on order fills and confirmations |
| Deep links | `/app/...` URLs | Universal links (apple-app-site-association on agentictrading.info) |
| Lifecycle | page visibility | `@capacitor/app` (pause/resume → refresh quotes) |
| Network | `navigator.onLine` | `@capacitor/network` |
| Payments | Square checkout links | **Decision needed:** Apple requires In-App Purchase for digital goods (guideline 3.1.1). Tokens bought inside the iOS app must use IAP, or purchasing must be hidden in the iOS app. |
| Classic pages | same-origin links | must be fully moved into the app (or opened in an in-app browser) before App Store review |

## Screens in the app (status)
| Screen | Route | Status |
|---|---|---|
| Dashboard | `/app/dashboard` | In the app: index ETF tiles with sparklines, top movers, sectors, watchlist, practice entry |
| Markets | `/app/markets` | In the app: stock list with live prices, search, group filter |
| Chart | `/app/markets/:sym` (`/app/charts` → last symbol) | In the app: 15m/1H/D/W, ranges, line/candles, today's stats, data table, Practice trade action |
| Practice trade / positions | `/app/practice/...` | Next (M3) |
| Everything else | — | Hand-off to the classic page |

## Performance baseline (first build, 2026-10-07)
Gzipped JS: app ~10 KB, React + router ~98 KB, Firebase Auth ~30 KB, Firestore ~129 KB
(vendor chunks cached separately, so app updates don't re-download them). CSS ~6 KB. Measure
again as screens are added; Firestore is the largest piece.
