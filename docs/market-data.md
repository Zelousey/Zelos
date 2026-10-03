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
| `refresh_quotes` | `markets/quotes`, `markets/intraday_<SYM>` (15-minute bars, 5 sessions), `markets/movers` | every `QUOTE_EVERY_MIN` minutes in market hours (9:31, 9:46 … 4:01, plus 4:06) |
| `refresh_market_data` after the close | `markets/dailyBars` (90 sessions), `markets/history_<n>` + `markets/historyIndex` (~2 years), `markets/snapshot` (ticker tape), `markets/globe`, full-day intraday bars | once a weekday, 4:20 pm or later; also on the very first run |
| `refresh_market_data` outside market hours | `markets/research_<SYM>` (SEC profile, last fiscal year, insider trades, P/E, 60 daily bars) | 2 stock-list symbols a run, each once a day |
| `market_research({symbol})` | the same research doc for any ticker (alert pages) | on demand, cached 12 hours, at most 60 fresh lookups a day |

Movers are computed from the Zelos stock list, not the whole market. Indexes are shown through
the ETFs that track them (S&P 500 → SPY, Nasdaq 100 → QQQ, Dow → DIA).

## Request budget (Basic plan: 10,000 a month)

| Use | Requests |
|---|---|
| Price updates | 2 a run × 27 runs a day → about 1,150 a month |
| After the close | about 14 a day → about 300 a month |
| First run | about 60 once, for 2 years of history; then a full refresh once a month |
| Research | 0 for stock-list symbols; 1 for other tickers, at most 60 a day |

## Settings

Secrets, set once in Cloud Shell:

```
firebase functions:secrets:set MARKETSTACK_API_KEY
firebase functions:secrets:set SEC_CONTACT        # an email the SEC can reach you at; kept out of the public repo
```

Settings in `functions/.env`:

- `QUOTE_EVERY_MIN=15` and `MS_INTERVAL=15min` fit the Basic plan.
- On the Professional plan, use `QUOTE_EVERY_MIN=1` and `MS_INTERVAL=5min`.

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
