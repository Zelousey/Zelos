# Tokens

Tokens are the site's paid currency. They replaced the $20 Gumroad purchase.
All the logic is in `functions/main.py` (Tokens section); the browser side is
`zelos-tokens.js` (wallet chip, wallet pop-up, locked-alert card) and
`tokens.html`.

## What tokens do

- **Alerts with a trade are token-gated until the trade finishes.** `publish_alert`
  writes a teaser to `alerts/{id}` (`locked: true`, `lockedUntil` = the 4:00 pm
  ET close) and the full alert to `alertsLocked/{id}`. Before the close an
  unlock costs the live price. `release_alerts` (weekdays, every 30 min from
  4:10 pm ET) marks it `afterClose: true` (`released: true` on the locked doc),
  and from then on an unlock costs the cheaper after-close price. When
  `update_alert_outcomes` records a final result (`hit-target`, `stopped-out`,
  `expired`, `no-trade`), the full alert is copied into `alerts/{id}`
  (`public: true` on the locked doc): free for everyone, so the track record
  stays open. Alerts with no qualifying setup are never locked. The outcome
  checker reads gated alerts through `alerts_open` (shared secret).
  Alerts released for free before this change stay public.
- **A scanner pass** (7 days) unlocks every gated alert from that scanner, live or after the close.
- **A single unlock** opens one alert.
- **New accounts** get welcome tokens once (Google sign-in or a verified email).

## Prices (provisional)

In `TOKENS` in `functions/main.py`. The static pages (`tokens.html`, the
scanner pages, the Terms) quote the same numbers; update them together.

| | Tokens | |
|---|---|---|
| Welcome bonus | 75 | once per verified account |
| 1-week scanner pass | 40 | |
| One live alert | 10 | before the 4 pm ET close |
| One alert after the close | 3 | until its trade finishes, then free |
| Pack p100 | 100 | $3.00 |
| Pack p350 | 350 | $10.00 |
| Pack p750 | 750 | $20.00 |

## Data

- `wallets/{uid}`: `{ balance, passes: {strategy: untilMs}, unlocked: [alertId], welcomed }`
  (owner can read; only Cloud Functions write).
- `wallets/{uid}/ledger/{id}`: `{ type, amount, balanceAfter, note, ref, at }`.
- `squareCheckouts/{orderId}`: each Square payment link we created:
  `{ uid, pack, tokens, amountCents, currency, status: pending|credited, env }`. Server only.
- `squareEvents/{eventId}`: every Square webhook event handled, with its result
  (credited / why it was skipped). Server only; also the duplicate guard.
- `purchases/sq_{orderId}`: one per credited purchase. Server only.
- `alertsLocked/{alertId}`: readable with an active pass for that scanner or
  a single unlock of that alert.

## Functions

- `tokens_wallet`: your wallet + prices (makes it, adds welcome tokens once).
  `canBuy` is true once the Square access token is set.
- `tokens_spend`: `{kind: 'pass', strategy}` or `{kind: 'unlock', alertId}`.
- `tokens_checkout`: `{pack}` → `{url}`, a Square Checkout payment link. The
  price and token amount come only from `TOKENS`; anything else the browser
  sends is ignored. Uses `SQUARE_LOCATION_ID` if set, otherwise the account's
  first active location.
- `squareWebhook`: Square calls it for `payment.created` / `payment.updated`.
  It checks the `x-square-hmacsha256-signature` header (HMAC-SHA256 of the
  notification URL + raw body with the subscription's signature key), and
  credits a payment only when it's `COMPLETED`, belongs to one of our
  checkouts, and matches the expected amount and currency. The checkout flips
  `pending → credited` in the same transaction as the credit, so no event (or
  repeat of an event) can credit an order twice. Errors return 500 so Square
  retries; anything else returns 200.
- `release_alerts`: scheduled, see above.

## Square setup

Secrets (Firebase Secret Manager, never in a file):

```
npx -y firebase-tools@latest functions:secrets:set SQUARE_ACCESS_TOKEN
npx -y firebase-tools@latest functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY
```

- `SQUARE_ACCESS_TOKEN`: Square Developer Console → your app → **Credentials**
  → Sandbox (or Production) **Access token**.
- `SQUARE_WEBHOOK_SIGNATURE_KEY`: Developer Console → your app → **Webhooks**
  → your subscription → **Signature key**.
- Environment: `SQUARE_ENVIRONMENT` in `functions/.env` (`sandbox` now;
  change it to `production` and set the production access token and the
  production subscription's signature key to go live).

Webhook subscription (Developer Console → Webhooks → Add subscription):

- Notification URL:
  `https://us-central1-leaderboard-agentictrading.cloudfunctions.net/squareWebhook`
  (signatures are computed over this exact URL; if you ever use a different
  one, set `SQUARE_WEBHOOK_URL` in `functions/.env` to match).
- Events: `payment.created` and `payment.updated`.

After setting or changing secrets, redeploy `tokens_wallet`,
`tokens_checkout` and `squareWebhook`.

Logs (`[square] ...` in Cloud Logging) show the environment, order id, pack,
event id, payment status and the outcome. They never include the access
token, the signature key or card details.

## Not yet

- Token rewards for XP / levels: XP is still written by the browser, so
  paying tokens for it would be farmable. Add it when XP moves server-side.
- Holidays: `lockedUntil` skips weekends but not market holidays (an alert
  published on a holiday unlocks at that day's 4 pm).
