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
`app/modules.ts` lists every area: Dashboard, Market, Trade War, Alerts, News (the five tabs),
then Practice, Squads & friends, Missions & XP, Arcade, Options, Crypto, Profile and Settings.
Charts is a route only (`/charts` opens the last symbol viewed in Market).
Each has a `status`:
- `ready`: built in the app (`load` points at its screen).
- `classic`: still on the classic site. The app shows a hand-off screen linking to
  `classicPath` (same account, same data).
- `planned`: not built anywhere yet (Crypto: paused until a licensed data source).

Other fields: `tab` (position 1–5 in the phone tab bar), `parent` (the nav entry a screen
belongs under, e.g. Practice → Trade War, so that tab stays highlighted) and `nav: false`
(a route with no nav entry).

Moving a module into the app = build `features/<id>/…Page.tsx`, set `status: 'ready'` and
`load`. Navigation updates itself.

**Information architecture (owner, 2026-10-07).** The app is *Zelos Trade War*, a simulated
trading competition; it never presents itself as a brokerage and has no real-trading module
(the website keeps its Real Trade Journal page; the app doesn't link to it). **Practice** (the
solo virtual $10,000 account) lives inside **Trade War**, beside battles, squads and
leaderboards. **Alerts** = Zelos trade-signal alerts. Invites, challenges and friend requests
go to the bell. **News** = Zelos and Trade War announcements, official market news (Fed, SEC
filings) and team-curated posts by people who move markets; not a paid headline feed
(`features/news/`, `functions/news.py`). A test fails if a module named like real trading or a brokerage appears.

## Shell behaviour
- **Desktop/tablet (> 760px):** collapsible grouped sidebar (state remembered), sticky top
  bar with sign-in, profile and bell. Screens get the full width (max 1600px).
- **Phone (≤ 760px):** top bar (logo, screen name, then Profile · Notifications · ☰) and a
  bottom tab bar: Dashboard · Market · Trade War · Alerts · News. The selected tab's icon sits
  in a filled pill. ☰ opens a grouped list of everything else. News shows a dot (read out as
  "new posts") until you open it. Touch targets ≥ 44px. Safe-area insets respected (notch,
  home indicator).
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
| Dashboard | `/app/dashboard` | In the app: the Trade War command center. Trader card (level/XP from `users/{uid}.xp`, name from `traders/{uid}`, rank = a count query on `practiceProfiles`), Trade War account (`practiceAccounts/{uid}`), live globe (classic `zelos-globe.js` + `data/exchanges.ts`), daily missions and achievements (read from `users/{uid}.progress` merged with the website's localStorage copy; not written by the app yet), leaderboard (top 5 `practiceProfiles`), your Trade Wars (`tradeWars` where you're a player), top movers, US indexes + sectors, watchlist. Code: `features/dashboard/`. Levels, mission/achievement tables and exchange hours are copies of the website's; unit tests fail if they drift from `zelos-levels.js`, `zelos-globe.js`, `functions/xp.py` and `functions/practice.py`. |
| Market | `/app/markets` | In the app: the overview. Live globe + the 17 exchanges' open/closed state (`features/markets/WorldMarkets.tsx`, shared with the Dashboard), sectors, "charts at a glance" (mini charts of the index ETFs, your watchlist and today's movers: `MiniChart.tsx`, data from `miniSeries.ts` = the daily history + live quote), and every stock with search and group filters. |
| Chart | `/app/markets/:sym` (`/app/charts` → last symbol) | In the app: the big chart, sized to the screen (15m/1H/D/W, ranges, line/candles), a "Change symbol" search sheet with recent symbols, mini-chart previews (current, recent, watchlist, indexes) to jump between charts, today's stats, data table, Practice trade action. Recent symbols are kept in this browser (`zelosAppRecentSymbols`). |
| Invites | `/app/invite`, `/app/i/:code` | In the app: make a Battle (creates a Trade War lobby), Team up (your squad) or Invite-a-friend link; share it or send it to an @username (it lands in their bell with Accept). The link page shows who invited you to what (public preview), Accept → celebration → the battle room / squad / $10,000 account. Server: `invite_*` callables + `invites/{code}` (functions/invites.py). A Coach link (Level 3+) starts a coaching. |
| Coaching | `/app/coach`, `/app/coach/:id` | Coach / Learn: my coach, my students (up to 5), the Coach badge. A coaching page shows the student's progress and recent trades (the coach reacts: Good move / Bad move / Try this), tasks with progress (counted by the server from the same events as missions; custom tasks are ticked by the student and confirmed by the coach) and a notes thread; either side can end it. Server: `coach_*` callables + `coachings/{coach_student}` readable only by the two people (functions/coaching.py). |
| Welcome | `/app/welcome` | First sign-in (opened from the Dashboard when there's no @username): name + @username (live availability check, saved by `profile_setup`), experience, the $10,000 account, a first trade. The Dashboard's **First steps** card keeps the same steps (shared `users.onboard` flags with the website's checklist). The launch animation is inline in `index.html` and removed by `src/lib/splash.ts`. |
| Strategies | `/app/strategies`, `/app/strategies/:id` | The Zelos strategies (Swing Trader, Breakout Rider, Options Scanner), in the Trade War hub and on the Dashboard: what each looks for and avoids, the latest alerts (public teasers; ticker hidden while locked; test docs ignored), a 7-day pass for tokens (`tokens_spend`), the token balance and the Get tokens sheet (`tokens_wallet`, `tokens_checkout` → Square). Full alerts still open on the website (`alert.html`, strategy pages). |
| Leaderboard | `/app/leaderboard` | Trade War boards from the public `practiceProfiles` (server-written): All-time (account value), Weekly and Monthly (% return, `p.<week/month key>.pct`), the Season (% return, P&L, biggest win, XP, winning streak) and Friends (your friends + squadmates by growth). Top 50, your row highlighted, your place from a server count when you're further down. Period keys match `functions/practice.py`. Arcade game boards come with the Arcade page. |
| Profile | `/app/profile`, `/app/profile/:uid` | The website's trader profile (`practice/profile.html?u=`). Reads `practiceProfiles/{uid}` (Trade War numbers, server-written), `traders/{uid}` (name, @username, picture, bio), `twRecords/{uid}` (match record) and `cosmetics/{uid}` (profile looks). Visitors: Share, Challenge to a Trade War (`tw_challenge`; the battle opens on the website's war page), Add friend (`users/{me}.friends` + `friend_ping`). Your own: Edit (name and @username through `profile_setup`; bio and picture written to `traders/{uid}`, picture shrunk on the device to a ≤19,500-character JPEG like the website) and your tokens and passes (only you see them). The website's Real Trading card is left out: the app is the simulated competition. Leaderboard rows, the Dashboard and friend notifications open profiles here. |
| Squads & friends | `/app/social`, `/app/social/:id` | The website's Trading Squads (`practice/squads.html`) and a friends list, on the same documents (`squads/{id}`, `squads/{id}/messages`, `squadCodes/{CODE}`, `users/{uid}.friends`); `firestore.rules` checks every write. Hub: create a squad, join with a room code, your squads; Friends: add by @username (`usernames/{name}` → `friend_ping`), their Trade War stats, remove. A squad: join, shared goal, leaderboard by % growth in net P&L (competition / all-time / week / month / season; a finished competition is frozen at its end-of-day snapshot `practiceProfiles.h`), squad Trade War (`tw_challenge` with `squadId`), members-only chat (reactions, photos ≤240,000 chars), invite link (`invite_create` kind squad), and the owner's controls (competition, goal, room code, settings, allowed stocks, rename, members, delete). |
| Missions & XP | `/app/missions` | The website's "XP & Missions" tab (`practice/index.html?tab=progress`). Level and XP (`users/{uid}.xp`, server-paid), mission streak and best, daily and weekly missions (the website's progress merged with the server's count `users/{uid}.missions`), streak rewards, all 29 achievements (earned and locked, by group), recent XP from the server ledger `users/{uid}/activity`, and invite rewards (friends from `referrals` where `referrer` is you; Bronze/Silver/Gold/Diamond). Achievements earned in the app ("Squad Up" when you create or join a squad, "Challenger" when you send a challenge) are recorded in `users/{uid}.progress` like the website does, paid through `xp_award` (once, bounded by `functions/xp.py`) and added to `practiceProfiles.achievements`. |
| Training Ground | `/app/training`, `/app/training/:id` (`/app/arcade` redirects) | The website's Arcade, renamed **Training Ground** by the owner (2026-10-09) on the app and the website (`arcade.html` keeps its address). Drill cards say what each drill trains (spot setups, place stops, set targets, trade discipline) with a skill filter, today's Daily Challenge, and live drill leaderboards read from the Realtime Database (`scores/<gameId>`, `database.rules.json`). A drill opens inside the app: the website's `games/<id>.html?embed=1` in a frame; `games/zelos-embed.js` hides the site menu/footer/tab bar only when framed and sends links like "Back to Training Ground" back to the app (postMessage, same origin). Scores and XP are still saved by the drill pages themselves. |
| Tokens & levels (shell) | top bar, everywhere | **Token chip** next to your picture and the bell (owner 2026-10-09): the website's Z coin (`features/tokens/coin.ts` = `zelos-tokens.js --zt-coin`) and your live balance (`wallets/{uid}`); when it goes up, pixel coins burst and fly into the chip while it counts up (a port of the website's reward animation, off with reduced motion). It makes the wallet if missing (`tokens_wallet`) and does the once-a-day check-in reward (`rewards_checkin`, sharing the website's `ztCheckin:<uid>` mark). **Level badges** are the website's framed badges (`features/levels`): the emblem and frame change by level (laurels, wings, star crest; metal, gold, breathing glow, orbiting sparks, prism ring) and glow more at higher levels. Reaching a new level shows the website's celebration once per level (shared `zelosLevelCelebrated`). Missions & XP shows the whole level path. |
| Trade War | `/app/trade-war` | In the app: hub with your practice account summary; battles, squads, leaderboards and missions hand off to the website for now |
| Practice | `/app/practice` (under Trade War) | In the app: server account (value, P&L, positions with Close, open orders with Cancel, activity, archive, privacy, reset) |
| Practice trade | `/app/practice/trade/:sym` | In the app: order ticket (market/limit/stop, day/GTC, stop-loss + take-profit dragged on the chart), confirm step. See `docs/PRACTICE_SERVER.md` |
| News | `/app/news` | In the app: sections Zelos Updates · Trade War · Market News (Fed releases + SEC 8-K filings, `markets/officialNews`, with a your-watchlist filter) · Market Movers (owner-curated X / Truth Social quotes); featured post, "New" badges |
| Post News | `/app/news/post` | Team only (`admins/{uid}`, checked by `news_save` / `news_delete`): write, edit, delete posts |
| Alerts | `/app/alerts`, `/app/alerts/:id` | Every strategy alert (newest 100) with a strategy filter and the track record (win rate over closed trades, like the website); one alert: trade plan (entry, stop, targets, risk/reward, a price ladder), result, why (reasoning, technicals, risks, market mood), Practice this trade / Chart / Share; live alerts locked until the close (unlock with tokens or a pass, `tokens_spend`; full alert read from `alertsLocked`); opening one awards the alert-open XP. Notifications tab: the same switches as the website (`users.notificationPrefs`). Still on the website: device push sign-up and the SEC research panel. |
| Squads, Missions, Arcade, Options, Profile | — | Hand-off to the classic page |

## Performance baseline (first build, 2026-10-07)
Gzipped JS: app ~10 KB, React + router ~98 KB, Firebase Auth ~30 KB, Firestore ~129 KB
(vendor chunks cached separately, so app updates don't re-download them). CSS ~6 KB. Measure
again as screens are added; Firestore is the largest piece.
