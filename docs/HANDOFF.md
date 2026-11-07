# Handoff (2026-11-07)

For the next Claude session: **read this first**. It is the current, complete list of what's done and
what's left, checked against the repository on 2026-11-07 (main at #171). Then read `PROJECT_STATE.md` §6
(the decision log, newest first) and the topic doc for whatever you work on. `PROJECT_STATE.md` §4, §10 and §11
date from early October; where they disagree with this file, trust this file.

The owner's full plan (security list, localization, session replay, App Store reviews, Capacitor, Lance AI and
other tools, the priority order) is in `MASTER_PLAN.md`; the product spec is in `AGENTICTRADING_MASTER_SPEC.md`.
**Never rewrite the master spec checklist.** Add to it only.

## How the owner works (standing rules)
- The owner is **not technical**. Explain in plain words. Process: talk → research → explain →
  decide → confirm → implement → test → document. "Take everything slow. Ask if you don't understand."
- **Ask first** on architecture, security, legal, payments, data or deployment decisions.
- **One PR per feature.** Send screenshots and/or a short phone video (Playwright, temporary
  `webapp/e2e/zz-*.spec.ts`, deleted afterwards). The owner reviews and says **"merge"**; merge with
  **squash + `expectedHeadSha`** (full SHA), then check main CI and the Pages deploy (deploy runs only after green main CI).
- Never trust client prices, balances, tokens or permissions (the server decides). Never commit secrets.
  Keep the site working; CI must pass. Document in `PROJECT_STATE.md` (§6 log) and `docs/`.
- Give the owner **copy-paste Cloud Shell blocks** for deploys. The owner runs them from home; Claude can't
  reach Firebase. Never a bare `firebase deploy --only functions`: name the functions, in groups of about 8.
- **Nothing unfinished in the app** (Apple review): no "coming soon" screens, no fake features. Crypto stays off the app.
- **Never ask for or accept the Apple .p8 private key.**
- **Practice Mode must NOT be reintroduced.** Solo is the single $10,000 account.
- Hall of Minds: **historical figures only**, public-domain pictures; modern people **in words only**
  ("Then & now", with the not-connected note), never a picture or a card.
- Look (2026-10-25): **square UI** (round only for naturally round things), the **bull vs bear logo**.
- **War** (`docs/WAR_DESIGN.md`): stays hidden (`WAR_OPEN = False` in `functions/main.py`, admins only)
  until the owner says **"open War"**. Real company logos and tickers never appear in War. Avoid pay-to-win.

## Status right now (2026-11-07)
- Everything through **#171** is merged. The owner has deployed every server change through #170; #171
  (package updates) needed no deploy. **No deploys are pending.**
- **War is built and checked, but hidden.** `docs/WAR_LAUNCH_CHECK.md` (2026-11-05): ready to open once the
  owner decides. Opening it is a one-line server change plus showing the War Zone card to everyone. Do it
  as its own PR, and only when the owner says "open War".
- **Open PRs**
  - **#81** iPhone app shell (Capacitor + Codemagic): **on hold** by the owner. Don't merge.
  - **#94** "Boosts" (Oct 22): **superseded**. The XP booster, battle slots and quiz retake shipped later on main
    with different prices. Ask the owner whether to close it.
- **Security warnings (Dependabot):** #171 fixed everything that could be fixed without breaking changes. What's left:
  `@grpc/grpc-js` (pinned by Firebase's own Firestore package; the issue is server-side only, and the browser doesn't
  use gRPC), plus moderate issues inside eslint/firebase-tools (dev tools, never shipped). Revisit when Firebase updates.

## Done (all on main)
**Platform**
- Classic static site at the root + the React/TypeScript app at `/app/` (`webapp/`), Python Cloud
  Functions (`functions/`), Firestore/RTDB rules with tests, CI (`.github/workflows/ci.yml`: lint, typecheck,
  unit, build, Playwright phone + desktop with axe, rules, functions e2e), GitHub Pages deploy
  (`pages.yml`) after green main CI. Firebase is used for Auth, Firestore, RTDB and Functions; the site is on GitHub Pages.
- Market data from **Marketstack** (1-minute quotes, per-symbol counting, 95k/cycle cap, 30-stock list),
  SEC company research, and news. FMP and Finnhub were retired as personal-use only (`DATA_PROVIDERS.md`).
- Server-only money: token wallet and ledger, Square checkout + verified webhook, purchases.
- Security pass: XP only from `xp_award` (server tables, daily caps), server-only collections,
  account deletion, report/block/word filter, terms acceptance.
- Text goes through `t()` (`webapp/src/lib/i18n.ts`, one English catalogue), and numbers/dates go through `Intl`.
  This makes the app ready to localize.

**App features**
- Shell (5 tabs + menu), Dashboard as 4 swipe pages, Market (globe, sectors, mini charts, every stock), big charts
  (candles by default) with indicators/Fibonacci/price alerts, watchlist, company research, Find a stock (Solo / Battle).
- Solo: server-run $10,000 account, Buy/Sell with options inside the ticket, estimated P&L, account value chart.
- Trade War hub: Solo, Battle (Duel or Squad; every game mode, buy-in locks, sword clash, slots, revive,
  rematch, squad rulesets: Free-for-all, Fantasy Draft, Last Man Standing, Team Cooperation); locked until the
  Chapter 1 quiz is passed.
- **War (hidden, admins only), W1–W8:** simulated War zone market (no real companies) and a $100,000 War
  balance; Chaos events, quiet hours, morning summary; private lobbies and open War Zones with weekly seasons
  (Rookie/Open); the map (secret placement, Camouflage, reveal), contested battles, attacks, neutral claims,
  Reinforce/Rally/Hot zones; War Score, results, Battle Level; the War base (Headquarters, Gold Mine, Barracks,
  Research Center, crystals, base shop, trading desk, Fort/Supply camp outposts, Medical Station, Energy, Wizard's
  Tower, Scout, Shield); each War scores only its own trades; weekly War Zone leaderboards. A full-week test
  (`tests/rules/war_week.e2e.py`) runs in CI.
- Strategies: Swing Trader, Breakout Rider and Options Scanner run on the server with outcomes;
  3-Leg Options as a paid strategy.
- Learning: new-user quiz + beginner path, Trading 101 Chapters 1–2, Training Ground drills, Coaching (chart
  plays), Missions & XP, levels, leaderboard, first-trade walkthrough, Help & feedback.
- Social: profiles, squads & friends, communities / Founder program, invites, bell with invitation cards + push.
- Tokens: Token Store, prices + 1-day passes, spends (revive, XP booster, drill hints, chart themes, profile
  frames, animated badges, battle slots, quiz retake, War base packs).
- Sign in with Apple and Google in one sheet; App Store clean-up (`docs/APP_STORE_READINESS.md`).
- **Hall of Minds** (`docs/HALL_OF_MINDS.md`): 11 figures, book animation, figure dashboards, swipe lessons for
  Napoleon, Caesar, Alexander, Aristotle and Franklin, paid daily quotes, quote card.

## To do
**Waiting on the owner**
1. Sign in with Apple setup in Apple + Firebase (Services ID etc.): `docs/SIGN_IN_WITH_APPLE.md`.
   The owner does the key step themselves; never ask for the .p8 file.
2. Try a real Square token purchase end to end before launch.
3. Decide: close #94 (superseded)? When to restart the iPhone app (#81)? When to "open War"?
4. GitHub settings (owner only): turn on the "Zelos Protection Main" ruleset with "require a pull
   request" + "require status checks" and no role bypass (`docs/DEVELOPMENT_WORKFLOW.md`).
5. Google Cloud Console → Credentials: restrict the Firebase web API key to the site's domains.
6. Legal pages: lawyer review still recommended (`docs/LEGAL_APP_STORE.md`).

**Offered next (owner picks; one PR each, pictures first)**
- **Square checkout test** (recommended before launch).
- **Open War to everyone** (only on "open War"; watch `war_market_tick` the first week, see `docs/WAR_LAUNCH_CHECK.md`).
- **Options payoff drill** (Training Ground).
- **Options Scanner / 3-Leg server scanner** (the 3-leg strategy exists; its alerts aren't produced on the server yet).
- Swipe lessons for the other 6 figures: **Edison, Tesla, Livermore, Dow, Newton, Morgan**
  (pictures already in `webapp/public/minds/lessons/`). When Edison converts, move the old-style 10 XP test
  lesson `edison:work` (in `scripts/minds_test.py` and `tests/rules/functions.e2e.mjs`) to a figure that's still old-style.
- Trading 101 **Chapter 3+**; **News / thesis posts**; **load test** before launch.
- **iPhone app (PR A4)**: Capacitor shell (#81), Apple in-app purchase for tokens (rule 3.1.1),
  native push, bundled drills/globe, then TestFlight → App Store. Apple credentials stay with the owner.
- Tools in `MASTER_PLAN.md` §17–18 (Lance AI, NeMo Guardrails, Better Icons, etc.): research and explain
  before connecting anything; none has been adopted.

**Smaller loose ends (fine to offer)**
- The classic website pages still have rounded corners and the old look; the arcade/demo favicons still show the old logo.
- `README` mentions `.github/workflows/scan-pages.yml`, which doesn't exist (`scan/` pages are rebuilt by hand).
- GitHub Actions warns that Node 20 actions are deprecated; bump action versions when convenient.
- `PROJECT_STATE.md` §4, §10 and §11 are stale; rewrite them from this file.
- Bigger ideas parked in `docs/roadmap.md`.

**Older handoff text that is out of date (don't act on it)**
- "FMP Plan 2" is wrong: prices come from Marketstack, and FMP is retired.
- "Practice trading" as a separate mode is wrong: it's the Solo $10,000 account, and Practice Mode must not come back.
- "Trade War = $10,000 with elimination" is only partly right: Solo/Battles use $10,000 and buy-ins; War uses a separate $100,000 balance.
- "Live brokerage execution" doesn't exist. There's no broker connection, only the Real Trade Journal for trades logged by hand.
- "Firebase Hosting" is wrong: the site is on GitHub Pages, and Firebase runs the backend.
- "`src/`" is wrong: the app code is in `webapp/src/`.

## Working notes (save yourself time)
- Hall of Minds content: edit `data/minds.json` directly (keep `indent=1`, `ensure_ascii=False`),
  then `python3 scripts/build_practice.py` to copy it to `functions/minds.json`. Don't run
  `scripts/minds/make_content.py` (it overwrites).
- Pictures: Wikimedia Commons public domain; use `upload.wikimedia.org` thumbs (compute the md5 path),
  expect 429s (retry with sleeps). Tone with `scripts/minds/lesson_images.py RAW OUT`; credits in
  `webapp/public/minds/CREDITS.txt`. Brand files: `docs/brand/` (logo master, share-image template).
- Corners: `--radius-sm/--radius/--radius-lg` are 0 in `webapp/src/styles/tokens.css`; use
  `--radius-pill` or `50%` only for naturally round things.
- Checks: `cd webapp && npm run typecheck && npm run lint && npx vitest run && npm run build`;
  browser: `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy PW_CHROMIUM=/opt/pw-browsers/chromium node e2e/run.mjs e2e/<file>.spec.ts`
  (kill stale emulators first: `ps -eo pid,args | awk '$3 ~ /venv\/bin\/functions-framework$/ {print $1}' | xargs -r kill -9`);
  server: `python3 -I scripts/minds_test.py`, `cd tests/rules && npm run test:functions` (includes `war_market` 127 checks and `war_week` 25).
- Screenshot scripts outside the e2e runner: the webapp's Playwright needs
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.
- **No Prettier** in this repo: don't run `prettier --write`.
- Flaky-looking e2e: find the real cause (e.g. #118: the test left a page before it had loaded).
  Local signed-in e2e can drop an XP call under heavy load ("socket hang up"); re-run that test alone
  before calling it a bug. CI is the judge.
- Firestore REST `updateMask.fieldPaths`: a path segment that doesn't start with a letter or `_` (e.g. a uid like
  `7tyM…`) must be in backticks and URL-encoded, or the write returns 400 (#171).
- Kill stale emulators before e2e: `fuser -k 8080/tcp 9000/tcp 5001/tcp 9099/tcp 4400/tcp; (pgrep -f "[b]in/functions-framework" | xargs -r kill -9)`.
  The full Playwright suite is 270 tests and takes about 11 minutes.
