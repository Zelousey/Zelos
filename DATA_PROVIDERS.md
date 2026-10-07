# AgenticTrading.info — Data Provider & Market Data Plan

> This file prevents unnecessary data-plan upgrades. Verify actual requirements and provider documentation before purchasing anything.

## Required data inventory

| Data | Required | Real-time required | Provider | Plan | Commercial rights verified | Status |
|---|---|---|---|---|---|---|
| Stock quotes | Yes | TBD | FMP | TBD | TBD | Verify |
| Historical stock prices | Yes | No | FMP | TBD | TBD | Verify |
| Intraday chart data | Yes | TBD | FMP | TBD | TBD | Verify |
| Options chains | Yes | TBD | FMP/other | TBD | TBD | Verify |
| News headlines | Yes | TBD | FMP/other | TBD | TBD | Verify |
| Earnings dates | Yes | No | FMP/other | TBD | TBD | Verify |
| Market movers | Yes | TBD | FMP/other | TBD | TBD | Verify |
| Crypto | Yes | TBD | FMP/other | TBD | TBD | Verify |
| Analyst targets | If needed | No | TBD | TBD | TBD | Verify |

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

## Current FMP investigation
The existing application has used FMP server-side infrastructure and an `FMP_API_KEY` secret.

Verify:
- Current plan
- Current endpoint
- Secret configuration
- Cloud Function environment
- Scheduler
- Firestore quote pipeline
- Expected fields
- Browser fallback behavior
- Rate limits
- Error handling

Do not remove the existing fallback provider until the replacement is verified.
