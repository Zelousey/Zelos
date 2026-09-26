# $10,000 Practice Account: live prices setup

The practice account (`practice/index.html`) works right away on the latest daily
closes. Live prices need the `refresh_quotes` Cloud Function turned on once.

## How it works

- `refresh_quotes` (in `functions/main.py`) runs every minute on weekdays between
  9:00 and 16:59 New York time. It only calls Finnhub from 9:25 to 16:10.
- Each run fetches one quote for each of the 30 practice symbols (inside Finnhub's
  free limit of 60 calls a minute) and writes them to the Firestore doc
  `markets/quotes`. Every open practice page listens to that doc, so there's only
  ever one caller to Finnhub, however many people are trading.
- After the close it adds the day's bar to `markets/dailyBars`, so charts keep
  moving forward day by day.
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

4. Deploy only the price function:

   ```
   firebase deploy --only functions:refresh_quotes
   ```

   If it asks to enable the Cloud Scheduler or Secret Manager APIs, say yes.

   Use `--only functions:refresh_quotes` rather than deploying every function:
   a full deploy also needs the other functions' secrets
   (`ZELOS_PUBLISH_SECRET`, Buffer keys) to exist.

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

## Changing the stock list

The symbols live in two places, which must match: `PRACTICE_SYMBOLS` in
`functions/main.py` and `NAMES` in `practice/practice.js`. Price history for
charts comes from `data/game-charts.json`. A new symbol needs its history added
there too, or it starts with a short chart.
