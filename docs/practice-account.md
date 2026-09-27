# $10,000 Practice Account: setup and how it works

The practice account (`practice/index.html`) works right away on the latest daily
closes. Live prices need the `refresh_quotes` Cloud Function turned on once.

## How it works

- `refresh_quotes` (in `functions/main.py`) runs every minute on weekdays between
  9:00 and 16:59 New York time. It only calls Finnhub from 9:25 to 16:10.
- Each run fetches one quote for each of the 50 practice symbols (inside Finnhub's
  free limit of 60 calls a minute) and writes them to the Firestore doc
  `markets/quotes`. Every open practice page listens to that doc, so there's only
  ever one caller to Finnhub, however many people are trading.
- During the session it also folds each minute's price into 5-minute bars, one
  doc per symbol (`markets/intraday_<SYM>`, last 5 sessions). The page's 5m, 15m
  and 1H charts are built from these. Finnhub's free plan has no intraday
  history, so the bars start filling in from the first session after deploying.
- After the close it adds the day's bar to `markets/dailyBars`, so charts keep
  moving forward day by day.
- `refresh_news` runs every 10 minutes. It fetches the latest general market
  headlines plus company news for the 5 practice symbols refreshed longest ago (6
  calls a run), and writes everything to one doc, `markets/news`. The dashboard's
  Trending news and Watchlist news widgets read it. Headlines link to the
  publisher, and the widgets show "News via Finnhub".
- The Finnhub API key lives only in the function's secret config. It is never in
  this repo and never sent to a browser.
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

3. Save the Finnhub key as a secret. When it asks for the value, paste the key and
   press Enter (nothing shows while you paste; that's normal):

   ```
   firebase functions:secrets:set FINNHUB_API_KEY
   ```

4. Deploy the practice functions:

   ```
   firebase deploy --only functions:refresh_quotes,functions:refresh_news
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
npx -y firebase-tools@latest deploy --only functions:refresh_quotes,functions:refresh_news --project leaderboard-agentictrading
```

The secret stays set; there's no need to enter the key again.

## Checking it works

- During market hours, open `https://agentictrading.info/practice/`. Within a
  minute or two the status line should read **"Live prices · updated Xs ago"**
  with a green dot.
- If it says **"the price service rejected the API key"**, the key is wrong or
  was revoked. Set it again (step 3) and redeploy (step 4).
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

## Changing the stock list

Edit `data/practice-universe.json` (symbol, name, group), then run
`python3 scripts/build_practice.py`. The build copies the list to
`functions/practice_universe.json`, which the price and news functions read, so
the page and the functions can't drift apart. Redeploy the functions afterwards.
Keep it at 55 symbols or fewer (the free Finnhub limit is 60 calls a minute).

Price history for charts comes from `data/game-charts.json` and
`data/practice-extra.json`. A new symbol needs its daily history added to
`practice-extra.json` too, or its chart starts short and grows from the live
daily bars.
