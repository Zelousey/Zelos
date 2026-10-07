> **Changed 2026-10-07:** the $10,000 practice account now lives on the server and trading
> happens in the app (`/app/practice`). See `docs/PRACTICE_SERVER.md`. The browser-account
> details below describe the retired classic page and are kept for reference.

# Trade War and Real Trading: setup and how it works

AgenticTrading.info has **one account** (XP, levels, streaks, achievements,
friends, profile) and **two trading modes** whose money and statistics never mix:

| Mode | Where | Tag | Data |
| --- | --- | --- | --- |
| `PRACTICE`: **Trade War** | `practice/` | TRADE WAR — VIRTUAL | the $10,000 virtual account (localStorage + `users/{uid}.practice`), public stats in `practiceProfiles/{uid}` |
| `REAL`: **Real Trading** | `real/` (Real Trade Journal) | REAL TRADE | trades the person made at their own broker, logged by them: `users/{uid}/realTrades` (private) |

Mode definitions and tags live in `zelos-modes.js`. Every trade record carries
`mode`. XP awards record their source (`trade-war`, `real`, `training`,
`social`, `missions`, `achievements`, `platform`) in the activity ledger, so
profiles and the XP feed label where each point came from.

The Trade War page is still at `practice/` (URLs and Firestore names kept); only
the name on screen changed. Earlier sections below call it the practice account.

## Real Trading (the journal)

- `real/index.html` (built by `scripts/build_real.py`, logic in `real/real.js`).
  Sign-in required. Log a trade (ticker, long/short, shares, entry, optional exit),
  close it later, see live P&L for the 50 Trade War symbols.
- **Real Trading status** ("Active", "Active · Experienced", "Experience",
  "Inactive") is computed on the profile from `traders/{uid}/realLog`: one entry
  per logged trade, holding only the ticker and a server timestamp the rules force
  to equal the write time, so it can't be backdated or edited. Active = a trade
  logged in the last 30 days; Experienced = 10+ trades on 5+ days, first 14+ days
  ago. It measures activity, never profitability. Users can switch the log off.
- `traders/{uid}` is the public identity: name, photo, XP, streak, owned Zelos
  skills and, only if the user opts in, real-trade statistics without dollar
  amounts (closed trades, win rate, average % per trade).
- XP: +10 "Real Trading Activity" per logged/closed trade (3 a day), +5 "Used
  trading tools" once a day (journal or watchlist).

## Command Center modes

The dashboard asks once "How do you use AgenticTrading.info?" and has a Real
Trading / Trade War switch. Each mode starts from a preset
(`window.ZELOS_DASH_PRESETS` in `dashboard.html`) and then keeps its own
customized layout (`zelos-dashboard-layout.js`, synced in
`users/{uid}.dashboardLayout`).


The practice account (`practice/index.html`) works right away on the latest daily
closes. Live prices need the `refresh_quotes` Cloud Function turned on once.

## How it works

Prices come from Marketstack. Its paid plans allow showing the data on the site. Full details
are in `docs/market-data.md`.

- **Live prices:** `refresh_quotes` updates `markets/quotes` every 15 minutes during market
  hours on the Basic plan. Every open page listens to that one doc, so there's only one caller
  to Marketstack, however many people are trading.
- **Charts:** 15-minute bars go in `markets/intraday_<SYM>` (last 5 sessions). The page's 15m
  and 1H charts are built from these. The 5m view needs the Professional plan.
- **History:** after the close, `refresh_market_data` saves about 2 years of daily bars
  (`markets/history_<n>`) and the last 90 sessions (`markets/dailyBars`). Pages load the
  history through `zelos-mdata.js`.
- **Company dropdown:** facts and insider trades from SEC EDGAR.
- **Retired:** no news headlines (the old Finnhub feed was personal-use only), and crypto is
  paused.
- **Keys:** the Marketstack key (`MARKETSTACK_API_KEY`) and the SEC contact (`SEC_CONTACT`) live
  only in the functions' secret config. They are never in this repo and never sent to a
  browser.
- `firestore.rules` already allows public reads of `markets/*` and blocks browser
  writes, so no rules change is needed.

## One-time setup (about 5 minutes)

You need the Firebase project on the **Blaze** plan (already the case) and a
computer with [Node.js](https://nodejs.org) installed.

1. Install the Firebase command-line tool and log in:

   ```
   npm install -g firebase-tools
   firebase login
   ```

2. Get the site code and open its folder:

   ```
   git clone https://github.com/Zelousey/Zelos.git
   cd Zelos
   ```

   `.firebaserc` already points at the `leaderboard-agentictrading` project.

3. Save the keys as secrets (skip any that are already set). When it asks for the
   value, paste the key and press Enter (nothing shows while you paste; that's
   normal):

   ```
   firebase functions:secrets:set MARKETSTACK_API_KEY
   firebase functions:secrets:set SEC_CONTACT
   ```

4. Deploy the practice functions:

   ```
   firebase deploy --only functions:refresh_quotes,functions:refresh_market_data,functions:market_research
   ```

   If it asks to enable the Cloud Scheduler or Secret Manager APIs, say yes.

   Use `--only ...` rather than deploying every function: a full deploy also
   needs the other functions' secrets (`ZELOS_PUBLISH_SECRET`, Buffer keys) to exist.

## Updating after a code change

When `functions/main.py` changes, open https://shell.cloud.google.com, where the
repo was cloned the first time, and run:

```
cd ~/Zelos && git pull
source functions/venv/bin/activate
pip install -r functions/requirements.txt
npx -y firebase-tools@latest deploy --only functions:refresh_quotes,functions:refresh_market_data,functions:market_research --project leaderboard-agentictrading
```

The secret stays set; there's no need to enter the key again.

## Checking it works

- During market hours, open `https://agentictrading.info/practice/`. Within a
  minute or two the status line should read **"Live prices · updated Xs ago"**
  with a green dot.
- If it says **"Live feed error (API key rejected)"**, the Marketstack key is wrong,
  revoked, or its plan doesn't cover the endpoint. Set `MARKETSTACK_API_KEY` again
  (step 3) and redeploy (step 4). `bash scripts/marketstack_check.sh` tests the key.
- Outside market hours it reads **"Market closed · prices as of …"**, which is
  correct.
- Logs: Firebase console → Functions → `refresh_quotes` → Logs. To trigger a run
  by hand during market hours, go to Google Cloud console → Cloud Scheduler → the
  `refresh_quotes` job → **Force run**.

## Cost

The job runs at most 480 times per trading day and each run takes a few seconds.
That's well inside the free allowances for Cloud Functions, Cloud Scheduler and
Firestore at this traffic. Firestore reads grow with visitors (about one read a
minute for each open practice page during market hours), and the free tier
covers 50,000 reads a day.

## Firestore rules (leaderboard profiles)

Signed-in players publish their public stats to `practiceProfiles/{uid}`. That
collection needs the rule block in `firestore.rules` (search for
`practiceProfiles`). Paste the whole file into Firebase console → Firestore
Database → Rules → Publish. Without it the practice leaderboard stays empty;
everything else still works.

The profile doc holds only: display name, balance, growth, peak, resets and
reset history, closed-trade stats and best trades. Never email or login
details. Turning off "Show my stats on the leaderboard" deletes the doc.

## Features and limits

- **Entry screen.** Shown on each new visit (not on refresh). Guests trade in
  this browser; "Continue with Google" saves the account to `users/{uid}.practice`
  and follows the player to any device.
- **Resets.** Only allowed below $2,500, with a confirmation. Each reset is
  counted, logged in reset history and shown on the public profile. Trade history
  is kept.
- **Options.** Long calls and puts, buy to open and sell to close, market hours
  only. Prices are modeled (Black-Scholes on the stock's live price and its
  20-day volatility, with a bid/ask spread), not exchange quotes. Contracts left
  open settle at intrinsic value at expiration.
- **Alerts.** The bell asks for browser notification permission. A pop-up
  fires when a take-profit or stop-loss fills while the page is open in a tab.
  Alerts with the tab closed need a server-side order engine (see
  `docs/roadmap.md`).
- **Agent signals.** The latest qualified alert from each Zelos agent, loaded
  into the ticket with its stop and target. Owned agents are marked; others show
  as previews.
- **Indicators.** Defined in the `INDICATORS` registry in
  `practice/practice-chart.js`. A new indicator is one entry there (compute
  function plus how to draw it: overlay, band or pane).

## XP, missions, achievements and the social layer

Missions, achievements and the social layer run in the browser. **XP itself is awarded
by the server** (`xp_award` in `functions/main.py`; amounts, refId shapes and daily
limits in `functions/xp.py`), and the rules stop the browser writing `users/{uid}.xp`.
When a mission or achievement table changes in `zelos-progress.js`, change
`functions/xp.py` too (`scripts/xp_test.py` fails if they drift).

- **XP and levels** (`zelos-xp.js`, `zelos-levels.js`): practice trades (+5, first 10 a
  day), winning trades (+10, first 10 a day), finished Grade the Setup games (+10, 5 a
  day), missions, achievements, challenges and referrals. Levels run 0 to 10 (Diamond
  is 5; Master, Elite, Legend, Titan and Zelos come after).
- **Missions and streaks** (`zelos-progress.js`): 5 daily and 5 weekly missions. Finishing
  any 2 daily missions keeps the mission streak (rewards at 3, 7, 14 and 30 days).
- **Achievements** (`zelos-progress.js`, `ACHIEVEMENTS`): 23 badges plus 2 per season.
  Add one with a line in that list; `test(ctx)` gets the practice account's stats.
- **Recovery goals**: below $9,500 the practice page shows "Recover $X → $10,000".
  Getting back from $9,000 or lower without a reset earns Comeback Kid.
- **Net P&L**: account value minus $10,000 plus everything resets wiped out. Weekly,
  monthly, season, challenge and squad scores all use it, so a reset never counts as
  growth. Reset history stays separate.
- **Leaderboards** (`leaderboard.html#practice`, `zelos-practice-board.js`): All-time,
  Weekly, Monthly, Season (six categories) and Friends. Period numbers live in each
  profile's `p` map; single-field ordering only, so no Firestore indexes to create.
- **Seasons**: defined in `SEASONS` in `zelos-progress.js`. Season 1 (Agentic Trading
  Championship) runs 2026-09-27 to 2026-12-31. Add the next one there.
- **Friend challenges** (`practice/challenge.html`), **Trading Squads**
  (`practice/squads.html`), **friends** (`users/{uid}.friends`), **referrals**
  (`referrals/{uid}`, links like `practice/?ref=<uid>`) and **share cards** (a PNG drawn
  in the browser) are in `zelos-social.js`.

These need the `challenges`, `squads` and `referrals` blocks in `firestore.rules`.
Paste the whole file into the Firestore console and publish (same as before).

Limits: everything is computed in the browser, so like XP a determined person could
edit their own numbers. It's virtual money, so that's accepted. Weekly and monthly
baselines start at each player's first visit in the period. A challenge's final
result uses each player's end-of-day history, so it settles once someone opens it
after the end date.

## Changing the stock list

Edit `data/practice-universe.json` (symbol, name, group), then run
`python3 scripts/build_practice.py`. The build copies the list to
`functions/practice_universe.json`, which the price and news functions read, so
the page and the functions can't drift apart. Redeploy the functions afterwards.
Keep it at 55 symbols or fewer (`refresh_quotes` makes one call per symbol
every minute and must finish inside its 55-second timeout).

Price history for charts comes from the server (`markets/history_<n>`, about two
years of Marketstack daily bars, refreshed by `refresh_market_data`; see
`docs/market-data.md`). A new symbol gets its history on the next full refresh.
