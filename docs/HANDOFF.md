# Handoff (2026-10-25)

For the next Claude session: read this first, then `PROJECT_STATE.md` (decision log, newest first)
and the topic doc for whatever you work on. Everything below is on `main` unless it says otherwise.

## How the owner works (standing rules)
- The owner is **not technical**. Explain in plain words. Process: talk → research → explain →
  decide → confirm → implement → test → document. "Take everything slow. Ask if you don't understand."
- **Ask first** on architecture, security, legal, payments, data or deployment decisions.
- **One PR per feature.** Send screenshots and/or a short phone video (Playwright, `e2e/zz-*.spec.ts`,
  deleted afterwards). The owner reviews and says **"merge"**; then merge with **squash +
  `expectedHeadSha`**, check main CI and the Pages deploy (it runs only after green main CI).
- Never trust client prices, balances, tokens or permissions (server decides). Never commit secrets.
  Keep the site working; CI must pass. Document in `PROJECT_STATE.md` and `docs/`.
- Give the owner **copy-paste Cloud Shell blocks** for deploys (they run them).
- **Nothing unfinished in the app** (Apple review). Crypto stays off the app.
- **Never ask for or accept the Apple .p8 private key.**
- Hall of Minds: **historical figures only** with public-domain pictures; modern people **in words
  only** ("Then & now", with the not-connected note), never a picture or a card.

## Waiting on the owner
1. **Deploy `xp_award`** (the Caesar, Alexander, Aristotle and Franklin lesson steps pay XP only after it):
   ```
   cd ~/Zelos && git checkout main && git pull origin main && source functions/venv/bin/activate && npx -y firebase-tools@latest deploy --only "functions:xp_award" --project leaderboard-agentictrading
   ```
2. Sign in with Apple setup (key + Services ID + Firebase): `docs/SIGN_IN_WITH_APPLE.md`.
3. Verify the Square token checkout end to end before launch.

## Open PRs
- **#81** iPhone app shell (Codemagic): **on hold** by the owner. Don't merge.
- **#94** "Boosts" (Oct 22): most likely **superseded** by the later spends that are on main
  (XP booster, battle slots, quiz retake). Compare with main and ask the owner before closing it.

## Just finished (2026-10-24/25), all merged and deployed
- Scroll lessons for **Napoleon, Caesar, Alexander, Aristotle, Franklin** (4 each, 5 tasks, 2 XP a step).
- #112 fixes (Newton portrait, faces at the top, tap spots, Correct!/Not quite, book animation).
- #113 **swipe-page lessons** (one swipe = one page; stories sideways, tasks from below; swipe hint).
- #114 **figure dashboard** (6 tiles → `/minds/:id/story|carried|learned|lessons|quotes|now`, pictures).
- #115 **quote card** (after 3 days away from the Hall of Minds, once a day, per device).
- Details: `docs/HALL_OF_MINDS.md`.

## Next up (owner's queue)
- **Square UI look** and **logo mock-ups** (owner 2026-10-25): mock-ups are in `docs/mockups/`,
  sent to the owner; **waiting for their pick**, build nothing before it.
  - Square UI: `square-*.jpg` show real screens in A (today, 8/12px corners), B (2px) and C (0px).
    Corners come from `--radius-sm/--radius/--radius-lg/--radius-pill` in
    `webapp/src/styles/tokens.css`, plus about 30 one-off `border-radius` values in module CSS
    (`grep -rn "border-radius" webapp/src`). The mock-up forced them with an injected stylesheet;
    a real change should set the tokens and replace the one-offs, then re-check every screen
    (avatars and round dots may stay round if the owner wants).
  - Logo: `logo-directions.jpg` (from `logo-directions.html`, plain SVG): 1 Z-Arrow, 2 Candle Z,
    3 Trade War shield, 4 Square monogram, 5 Laurel Z, 6 Target O. The current icon is
    `webapp/public/icons/icon-*.png` (glowing blue A/Z with network dots). After a pick: refine,
    then export all icon sizes (PWA manifest, favicon, Apple touch icon, the classic site's icons).
- Scroll lessons for the other 6 figures: **Edison, Tesla, Livermore, Dow, Newton, Morgan**.
  When Edison converts, move the old-style 10 XP test lesson `edison:work` (in
  `scripts/minds_test.py` and `tests/rules/functions.e2e.mjs`) to a figure that's still old-style.
- Trading 101 Chapter 3+, news/thesis posts, Help & feedback, security audit and load test,
  3-Leg server scanner, options payoff drill.

## Working notes (save yourself time)
- Hall of Minds content: edit `data/minds.json` directly (keep `indent=1`, `ensure_ascii=False`),
  then `python3 scripts/build_practice.py` to copy it to `functions/minds.json`. Don't run
  `scripts/minds/make_content.py` (it overwrites).
- Pictures: Wikimedia Commons public domain; use `upload.wikimedia.org` thumbs (compute the md5 path),
  expect 429s (retry with sleeps). Tone with `scripts/minds/lesson_images.py RAW OUT`; credits in
  `webapp/public/minds/CREDITS.txt`.
- Checks: `cd webapp && npm run typecheck && npm run lint && npx vitest run && npm run build`;
  browser: `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy PW_CHROMIUM=/opt/pw-browsers/chromium node e2e/run.mjs e2e/minds.spec.ts`
  (kill stale emulators first: `ps -eo pid,args | awk '$3 ~ /venv\/bin\/functions-framework$/ {print $1}' | xargs -r kill -9`);
  server: `python3 -I scripts/minds_test.py`, `cd tests/rules && npm run test:functions`.
- **No Prettier** in this repo: don't run `prettier --write`.
- Local signed-in e2e can drop an XP call under load ("socket hang up"); re-run that test alone before
  calling it a bug. CI is the judge.
