# Handoff (2026-10-27)

For the next Claude session: **read this first**. It is the current, complete list of what's done and
what's left. Then `PROJECT_STATE.md` §6 (decision log, newest first) and the topic doc for whatever
you work on. Note: `PROJECT_STATE.md` §4, §10 and §11 are old (early October); trust this file over them.

## How the owner works (standing rules)
- The owner is **not technical**. Explain in plain words. Process: talk → research → explain →
  decide → confirm → implement → test → document. "Take everything slow. Ask if you don't understand."
- **Ask first** on architecture, security, legal, payments, data or deployment decisions.
- **One PR per feature.** Send screenshots and/or a short phone video (Playwright, temporary
  `webapp/e2e/zz-*.spec.ts`, deleted afterwards). The owner reviews and says **"merge"**; merge with
  **squash + `expectedHeadSha`**, then check main CI and the Pages deploy (deploy runs only after green main CI).
- Never trust client prices, balances, tokens or permissions (the server decides). Never commit secrets.
  Keep the site working; CI must pass. Document in `PROJECT_STATE.md` (§6 log) and `docs/`.
- Give the owner **copy-paste Cloud Shell blocks** for deploys (they run them; Claude can't reach Firebase).
- **Nothing unfinished in the app** (Apple review). Crypto stays off the app.
- **Never ask for or accept the Apple .p8 private key.**
- Hall of Minds: **historical figures only**, public-domain pictures; modern people **in words only**
  ("Then & now", with the not-connected note), never a picture or a card.
- Look (2026-10-25): **square UI** (round only for naturally round things), the **bull vs bear logo**.

## Status right now
- Everything through #121 (2026-10-27) is merged and deployed. **New plan for the owner's update lists A–D:** `AGENTICTRADING_MASTER_SPEC.md` → ADDENDUM 2026-10-27 and `AGENTICTRADING_PROGRESS.md` (waiting for the owner to approve a phase). War rules: `docs/WAR_DESIGN.md` v3.3, **not approved as a whole yet (incl. Section 9)**. All server deploys the owner was asked for are done
  (last one: `xp_award` for the Hall of Minds lesson steps, 2026-10-25).
- **Open PRs**
  - **#81** iPhone app shell (Codemagic): **on hold** by the owner. Don't merge.
  - **#94** "Boosts" (Oct 22): most likely **superseded** (XP booster, battle slots and quiz retake
    shipped later on main). Compare with main, then ask the owner whether to close it.

## Pending deploys (the owner runs these in Cloud Shell; Claude can't reach Firebase)
1. **War zone, step W6b2 (hidden; admins only): season results, moving up, going broke.** After it merges:
   ```
   cd ~/Zelos && git pull && firebase deploy --only functions:war_market_tick,functions:war_lobby
   ```
   No rules change and no new job.
Deployed by the owner on 2026-10-29 (from home): War W2, W3 and W4a; on 2026-10-30: War W4b, W5a and W5b; on 2026-10-31: War W5c, W6a and W6b1. Earlier on 2026-10-29: the Trade War match listing rule (#123), Help & feedback (Phase 8a), Battle rematch (Phase 9), squad rulesets (Phase 10a–10c, re-sent in small groups after a full deploy hit Google's update limit) and War W1.
Tip: never run a bare `firebase deploy --only functions` (about 80 functions at once hits Google's update limit and fails part-way); deploy the named functions, in groups of about 8.

After running one, tell Claude "deployed", and it will be ticked off here.

## Done (all on main)
**Platform**
- Classic static site at the root + the React/TypeScript app at `/app/` (`webapp/`), Python Cloud
  Functions (`functions/`), Firestore/RTDB rules with tests, CI (lint, typecheck, unit, build,
  Playwright phone + desktop with axe, rules, functions e2e), GitHub Pages deploy after green CI.
- Market data from Marketstack (1-minute quotes, per-symbol counting, 95k/cycle cap, 30-stock list),
  SEC company research, news (official market news + Zelos posts).
- Server-only money: token wallet and ledger, Square checkout + verified webhook, purchases.
- Security pass: XP only from `xp_award` (server tables, daily caps), server-only collections,
  account deletion, report/block/word filter, terms acceptance.

**App features**
- Shell (5 tabs + menu), Dashboard, Market (globe, sectors, mini charts, every stock), big charts with
  indicators/Fibonacci/price alerts (also with the app closed), watchlist, company research.
- Practice: server-run $10,000 account, Buy/Sell with options inside the ticket, estimated P&L,
  account value chart.
- Trade War / Battles: battle room, every game mode, buy-in locks, sword clash animation, slots,
  revive; locked until the Chapter 1 quiz is passed.
- Strategies: Swing Trader, Breakout Rider and Options Scanner **run on the server** with outcomes;
  3-Leg Options (bull call butterfly, bear put butterfly, jade lizard) as a paid strategy.
- Learning: new-user quiz + beginner path, Trading 101 Chapters 1–2 (animated lessons, quizzes, XP),
  Training Ground drills, Coaching (chart plays), Missions & XP, levels, leaderboard.
- Social: profiles, squads & friends, communities / Founder program, invites, notifications bell + push.
- Tokens: new prices + 1-day passes, spends (revive, XP booster, drill hints, chart themes, profile
  frames, animated badges, battle slots, quiz retake).
- Sign in with Apple and Google in one sheet; App Store clean-up (`docs/APP_STORE_READINESS.md`).
- **Hall of Minds** (`docs/HALL_OF_MINDS.md`): 11 figures (7 history + 4 market legends), opening book
  animation, figure **dashboard** (story, how they carried themselves, who they learned from, lessons,
  quotes, then & now; each its own page with pictures), **swipe-page lessons** for Napoleon, Caesar,
  Alexander, Aristotle and Franklin (4 each, 5 tasks, 2 XP a step, Correct!/Not quite), paid daily
  quotes (15 tokens / 30 days), the **quote card** after 3 days away.
- **Look** (2026-10-25): new **logo** everywhere (`docs/brand/logo-master.png`), **square UI** in the
  app (#119), new **share-link picture** (#120).

## To do
**Waiting on the owner**
1. Sign in with Apple setup in Apple + Firebase (key, Services ID): `docs/SIGN_IN_WITH_APPLE.md`.
2. Try a real Square token purchase end to end before launch.
3. Decide on #94 (close if superseded) and when to restart the iPhone app (#81).
4. GitHub settings (owner only): turn on the "Zelos Protection Main" ruleset with "require a pull
   request" + "require status checks" and no role bypass (`docs/DEVELOPMENT_WORKFLOW.md`).
5. Google Cloud Console → Credentials: restrict the Firebase web API key to the site's domains.
6. Legal pages: lawyer review still recommended (`docs/LEGAL_APP_STORE.md`).

**Owner's product queue (ask which is next; one PR each, pictures first)**
- Swipe lessons for the other 6 figures: **Edison, Tesla, Livermore, Dow, Newton, Morgan**
  (their story/carried pictures already exist in `webapp/public/minds/lessons/`). When Edison
  converts, move the old-style 10 XP test lesson `edison:work` (in `scripts/minds_test.py` and
  `tests/rules/functions.e2e.mjs`) to a figure that's still old-style.
- Trading 101 **Chapter 3+**.
- **News / thesis posts**.
- **Help & feedback** screen.
- **Security audit and load test** before launch.
- **3-Leg server scanner** (the 3-leg strategy exists; its alerts aren't produced on the server yet).
- **Options payoff drill** (Training Ground).
- **iPhone app (PR A4)**: Capacitor shell (#81), Apple in-app purchase for tokens (rule 3.1.1),
  native push, bundled drills/globe, then TestFlight → App Store.

**Smaller loose ends (fine to offer)**
- The classic website pages still have rounded corners and the old look; the arcade/demo favicons
  (`favicon-arcade.ico`, `favicon-demo.ico`) still show the old logo.
- `README` mentions `.github/workflows/scan-pages.yml`, which doesn't exist (`scan/` pages are rebuilt by hand).
- GitHub reports 23 Dependabot alerts on main (5 high); review and update dependencies in a PR.
- GitHub Actions warns that Node 20 actions are deprecated (`actions/checkout@v4` etc. on Node 24 now);
  bump action versions when convenient.
- `PROJECT_STATE.md` §4, §10 and §11 are stale; rewrite them from this file.
- Bigger ideas parked in `docs/roadmap.md` (multi-leg strategies in practice, server order engine,
  agent auto-follow, live options data, server-verified competitions, season-end rewards).

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
  server: `python3 -I scripts/minds_test.py`, `cd tests/rules && npm run test:functions`.
- Screenshot scripts outside the e2e runner: the webapp's Playwright needs
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.
- **No Prettier** in this repo: don't run `prettier --write`.
- Flaky-looking e2e: find the real cause (e.g. #118: the test left a page before it had loaded).
  Local signed-in e2e can drop an XP call under heavy load ("socket hang up"); re-run that test alone
  before calling it a bug. CI is the judge.
