# Market data: Marketstack (prices) + SEC EDGAR (company facts)

Everything below runs on the server (`functions/main.py`, shaping in `functions/mdata.py`).
Browsers only read the public, read-only `markets/*` docs, so the number of Marketstack
requests stays the same no matter how many people visit.

## Why these sources

The site may only show data it is licensed to show:

- **Marketstack's paid plans include commercial use.** On the Basic plan ($9.99/month) prices
  update every 15 minutes during market hours.
- **SEC EDGAR is public government data:** company facts, financials and insider trades.
- **Retired:**
  - FMP and Finnhub personal plans, and the Yahoo chart feed: these are personal use only.
  - The Robinhood exports that used to live in `data/`.
  - News headlines, analyst targets and earnings dates: none are shown until there's a
    licensed source.
- **Crypto is paused.** `data/crypto-universe.json` has `"paused": true`. Open crypto positions
  keep their last price.

## What runs when

| Job | Writes | When |
|---|---|---|
| `refresh_quotes` | `markets/quotes`, `markets/intraday_<SYM>` (1-minute bars, 5 sessions), `markets/movers`; then the practice order pass | fast stocks every `QUOTE_EVERY_MIN` minutes in market hours (every minute: 9:31, 9:32 … 4:01, plus 4:06), the others every `MS_STEADY_EVERY_MIN` (15). The first run of a day asks for the whole day; later runs only for bars since each stock's newest stored one (`serverMeta/msQuotes.sinceBy`). Stocks within 10 minutes of the newest bar share **one request** (each symbol in it is still one call); stocks that are behind are asked for 10 at a time, furthest behind first. Only a Marketstack `validation_error` switches to whole-day requests, and only for that day (`timeFilterOff`). Usage and hard stops: see the call budget below. Runs of 10+ bars with one price and no volume (a stuck feed) are dropped (`drop_frozen`); a stock without a fresh price keeps its last quote with `stale: true` (left out of fills, alerts and movers; Trade War won't trade it) |
| `run_scanners` (`ms_daily_close`) | `markets/dailyBars` (90 sessions), `markets/history_<n>` + `markets/historyIndex` (~2 years), `markets/snapshot` (ticker tape), `markets/globeBars` (30 sessions) + `markets/globe`, removed stocks' closing prices in `markets/quotes`; then the scanners | every 30 minutes from 6:05 pm until the day's bars are out (one SPY call a try) |
| `refresh_market_data` after the close | marks every practice account at the closing prices (no Marketstack calls) | once a weekday, 4:20 pm or later |
| `refresh_market_data` outside market hours | `markets/research_<SYM>` (SEC profile, last fiscal year, insider trades, P/E, 60 daily bars) | 2 stock-list symbols a run, each once a day |
| `market_research({symbol})` | the same research doc for any ticker (alert pages) | on demand, cached 12 hours, at most 60 fresh lookups a day |

Movers are computed from the Zelos stock list, not the whole market. Indexes are shown through
the ETFs that track them (S&P 500 → SPY, Nasdaq 100 → QQQ, Dow → DIA).

## Call budget (Professional plan: 100,000 calls a billing cycle, the 7th to the 7th)

**Marketstack counts every symbol in a request as one call** (marketstack.com/faq), and every
page of a paginated answer is another request. Until 2026-10-22 we counted HTTP requests, so the
old "1 request a minute for 50 stocks" was really 50 calls a minute, and the cycle went past
100,000 (overage ~$0.002 a call). Since then (owner, 2026-10-22):

- **30 stocks** (data/practice-universe.json). The 20 removed ones are in data/retired-symbols.json:
  no buying; anyone holding one can sell, filled at the next close (`_pr_order_universe`).
- **Two speeds.** The 8 "fast" (day trading) stocks, SPY QQQ AAPL NVDA MSFT AMD META AMZN, get
  prices every minute; the other 22 (long-term) every `MS_STEADY_EVERY_MIN` (15) minutes. The app's
  Market page has a Day trading and a Long-term section.
- **Counting.** `ms_get` counts calls per symbol (`mdata.CALLS`); each job adds them to
  `serverMeta/msUsage` (`day`/`calls` and `cycle`/`cycleCalls`). `MS_CYCLE_SEED` ("2026-10:112000")
  adds what Marketstack had already counted in the cycle the counter started in.
- **Hard stops.** Each job gets an allowance before it starts (`ms_budget_start`) and `ms_get`
  refuses (`MsBudget`) any request that would pass it, before sending it. Live prices stop at
  `MS_LIVE_CAP` (95,000 a cycle) or `MS_DAILY_CALLS` (4,300 a day); the daily close and the
  scanners stop at `MS_HARD_CAP` (98,000). While stopped, `markets/quotes.paused` says why and
  until when, and the app shows "Live prices paused until …" with the last prices.

| Use | Calls |
|---|---|
| Fast stocks, every minute | 8 × ~392 runs ≈ 3,140 a market day |
| Long-term stocks, every 15 minutes | 22 × ~27 runs ≈ 600 a market day |
| Daily close (`run_scanners`) | 1 per try until SPY's bar is out (≤ 12), then ~185 (history, ETFs, globe, removed stocks; only the new day) |
| Total | ≈ 3,900 a market day, ≈ 85,000 a cycle |
| First run without history | a few thousand calls, once (2 years of history) |
| Research | 0 for stock-list symbols (it reads the stored daily bars) |

## Settings

Secrets, set once in Cloud Shell:

```
firebase functions:secrets:set MARKETSTACK_API_KEY
firebase functions:secrets:set SEC_CONTACT        # an email the SEC can reach you at; kept out of the public repo
```

Settings in `functions/.env`:

- `QUOTE_EVERY_MIN=1`, `MS_INTERVAL=1min`, `MS_DAILY_CALLS=3000`: prices every minute (Professional plan or higher). Check first with `bash scripts/marketstack_check.sh`: both "1-minute" lines must say "works".
- Basic plan: `QUOTE_EVERY_MIN=15` and `MS_INTERVAL=15min` (15-minute bars; about 2 × 27 requests a day).
- If the plan turns out not to include 1-minute bars, `refresh_quotes` uses 15-minute bars on its own and `markets/quotes.note` says `interval-not-in-plan`.
- Marketstack's own docs/sales should confirm how requests are counted; this budget assumes one per HTTP request, not one per symbol. Check the usage page in the Marketstack dashboard after the first full day.

## Deploy

```
firebase deploy --only functions:refresh_quotes,functions:refresh_market_data,functions:market_research
firebase functions:delete refresh_news --force
```

Then run `bash scripts/marketstack_check.sh` to confirm the key works. It prints whether each
part of the plan works, and never prints the key.

## Local testing

`functions/.env.local` points the functions at a local stand-in through `MARKETSTACK_BASE_URL`,
`SEC_BASE_URL` and `SEC_WWW_URL`. Never set those in production.

Unit tests: `python3 scripts/marketstack_test.py`.
