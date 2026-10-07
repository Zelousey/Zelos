# AgenticTrading.info — Data Provider & Market Data Plan

> This file prevents unnecessary data-plan upgrades. Verify actual requirements and provider documentation before purchasing anything.

## Required data inventory (decided 2026-10-07: Marketstack + SEC EDGAR)

| Data | Required | Real-time required | Provider | Plan | Commercial rights verified | Status |
|---|---|---|---|---|---|---|
| Stock quotes | Yes | No (15-min is fine on Basic) | Marketstack | Basic ($9.99/mo, 10,000 req/mo) | Paid plans include commercial use, per Marketstack; owner to confirm on their account | Code ready (PR B), not deployed |
| Historical stock prices (~2 yrs daily) | Yes | No | Marketstack | Basic | As above | Code ready |
| Intraday chart data | Yes | No | Marketstack (15-min bars) | Basic; Professional for 1/5-min | As above | Code ready |
| Market movers | Yes | No | Computed from the Zelos stock list (Marketstack quotes) | — | — | Code ready |
| Company profile, financials, insider trades | Yes | No | SEC EDGAR | Free public data | Public government data; SEC asks for a contact email in the User-Agent (`SEC_CONTACT`) | Code ready |
| Options chains | Yes (Options Scanner) | TBD | **None licensed yet** | — | — | Gap |
| News headlines | Wanted | No | **None licensed yet** (Finnhub retired) | — | — | Hidden until licensed |
| Earnings dates | Wanted | No | **None licensed yet** | — | — | Hidden until licensed |
| Analyst targets | If needed | No | **None licensed yet** | — | — | Hidden |
| Crypto | Wanted | TBD | **None licensed yet** | — | — | Paused (`data/crypto-universe.json`) |

Retired as personal-use only: FMP and Finnhub personal plans, Yahoo's chart feed, Robinhood exports.
Details, request budget and settings: `docs/market-data.md`.

## Rules
1. Never assume a plan includes a feature.
2. Verify against current provider documentation.
3. Verify commercial use/licensing.
4. Verify rate limits.
5. Estimate actual application demand.
6. Design caching before increasing API spend.
7. Use server-side API access for secret providers.
8. Do not expose provider API keys in browser code.
9. Define fallback behavior.
10. Do not add providers merely to duplicate existing capabilities.

## Data architecture goals
- Cloud Functions/server-side provider calls
- Secure provider secrets
- Response caching
- Request deduplication
- Reasonable polling
- Event subscriptions where available
- Graceful stale-data behavior
- Provider failure handling
- Monitoring
- Usage metrics

## Verification questions
Before buying/upgrading:
- Does the plan provide the exact endpoint?
- Is the data real-time or delayed?
- What exchanges are covered?
- What are the request limits?
- Are WebSockets included?
- Are historical intervals sufficient?
- Are options chains included?
- Is news included?
- Are earnings included?
- Are movers included?
- Is crypto included?
- Is commercial redistribution/display allowed?
- Are there attribution requirements?
- What caching/storage restrictions exist?

## Open Terminal / public API research
Research public/open APIs only after:
- licensing is understood,
- uptime is acceptable,
- data quality is verified,
- rate limits are understood,
- commercial usage is permitted.

Do not assume an open-source API is commercially safe simply because its code is public.

## Open questions
- Options chains for the Options Scanner: which licensed source, and at what cost?
- Is the Basic plan's 15-minute delay acceptable long-term, or is Professional needed?
- Confirm Marketstack's attribution requirements and show them on pages that display prices.
