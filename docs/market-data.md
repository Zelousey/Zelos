# Market data from FMP (paid plan)

Everything below runs server-side in `functions/main.py`. The `FMP_API_KEY` secret never
reaches a browser: pages only read the public, read-only `markets/*` docs.

## refresh_market_data (every 5 minutes, around the clock)

Each run does only what's due. Its bookkeeping lives in `serverMeta/marketData`, which no
browser can read.

| What | Doc | When |
|---|---|---|
| Crypto quotes (BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, LTC) | `markets/crypto` | every run |
| Crypto 5-minute bars, last 3 days | `markets/intraday_<SYM>` | every 15 min |
| Crypto daily bars, ~400 days | `markets/cryptoBars` | once a day |
| Top gainers, losers, most active, sector performance | `markets/movers` | every 15 min, weekdays 9:30 to 4:30 ET |
| Real 5-minute bars with volume for the Trade War stock list (5 sessions) | `markets/intraday_<SYM>` | once, after the close (4:15 pm ET) |
| Daily volume for the stock list | `markets/dailyBars` | once, after the close |
| Earnings calendar, next 45 days | `markets/earnings` | once a day |
| Company research for 2 stock-list symbols (oldest first) | `markets/research_<SYM>` | each run outside 9:25 to 4:10 ET |

The crypto list is `data/crypto-universe.json`. `scripts/build_practice.py` copies it next to
`main.py`.

## market_research (callable)

`{symbol}` returns that ticker's research doc. Alert pages call it for tickers outside the
Trade War list.

- Served from the cache when it's under 12 hours old.
- Fresh fetches are capped at 300 a day (`serverMeta/researchBudget`).
- Junk symbols and crypto are rejected.

A research doc holds:

- **Profile:** sector, industry, market cap, beta, 52-week range, description.
- **Analysts:** average, high and low price targets, plus the latest 6 ratings.
- **Next-year estimates:** EPS, revenue, number of analysts.
- **Ratios:** P/E, margin, ROE, dividend yield.
- **Last fiscal year:** revenue, net income, EPS.
- **Insiders:** recent open-market buys and sells.
- **News:** 6 headlines.
- **Next earnings date.**

## Where it shows

**Trade War**
- Crypto in the watchlist ("Crypto 24/7"). It trades around the clock in the Main account, in
  fractions of a coin, good til cancelled. Matches stay stocks only.
- The News dropdown, with the analyst target, next earnings and the latest rating.
- An "Earnings in N days" badge.
- The Market movers tile.

**Alert pages**
- An earnings warning when a report is 3 weeks away or less.
- Research tabs: Analysts, Company, Insiders, News.

**Dashboard**
- The "Market movers" widget: gainers, losers, most active and crypto.

## Deploy

```
firebase deploy --only functions:refresh_market_data
firebase deploy --only functions:market_research
```

Then run `bash scripts/fmp_check.sh` to confirm the plan covers each endpoint. Anything it
reports as not in the plan is skipped quietly: the doc just leaves that part out.

## Local testing

- `FMP_BASE_URL` in `functions/.env.local` points the functions at a fake FMP server.
- Never set it in production.
