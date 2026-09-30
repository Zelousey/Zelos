# Tokens

Tokens are the site's paid currency. They replaced the $20 Gumroad purchase.
All the logic is in `functions/main.py` (Tokens section); the browser side is
`zelos-tokens.js` (wallet chip, wallet pop-up, locked-alert card) and
`tokens.html`.

## What tokens do

- **Live alerts are locked until the 4:00 pm ET close.** `publish_alert`
  writes a teaser to `alerts/{id}` (`locked: true`, `lockedUntil`) and the full
  alert to `alertsLocked/{id}`. `release_alerts` (weekdays, every 30 min from
  4:10 pm ET) copies the full alert into `alerts/{id}` once the close has
  passed, so the history, the daily scan pages and old links stay public.
  Alerts with no qualifying setup are never locked.
- **A scanner pass** (7 days) unlocks every live alert from that scanner.
- **A single unlock** opens one live alert.
- **New accounts** get welcome tokens once (Google sign-in or a verified email).

## Prices (provisional)

In `TOKENS` in `functions/main.py`. The static pages (`tokens.html`, the
scanner pages, the Terms) quote the same numbers; update them together.

| | Tokens | |
|---|---|---|
| Welcome bonus | 75 | once per verified account |
| 1-week scanner pass | 40 | |
| One live alert | 10 | |
| Pack p100 | 100 | $3.00 |
| Pack p350 | 350 | $10.00 |
| Pack p750 | 750 | $20.00 |

## Data

- `wallets/{uid}`: `{ balance, passes: {strategy: untilMs}, unlocked: [alertId], welcomed }`
  (owner can read; only Cloud Functions write).
- `wallets/{uid}/ledger/{id}`: `{ type, amount, balanceAfter, note, ref, at }`.
- `purchases/{stripeSessionId}`: one per paid Checkout session; makes the
  webhook idempotent. Server only.
- `alertsLocked/{alertId}`: readable with an active pass for that scanner or
  a single unlock of that alert.

## Functions

- `tokens_wallet`: your wallet + prices (makes it, adds welcome tokens once).
- `tokens_spend`: `{kind: 'pass', strategy}` or `{kind: 'unlock', alertId}`.
- `tokens_checkout`: `{pack}` → Stripe Checkout URL.
- `stripe_webhook`: Stripe calls it after a payment. Checks the signature and
  the amount, and credits each session exactly once.
- `release_alerts`: scheduled, see above.

## Turning on Stripe

Until real keys are set, buying says "coming soon"; everything else works.
The functions need the two secrets to exist even before that, so set them
once (type `none` for now if you don't have Stripe yet):

```
npx -y firebase-tools@latest functions:secrets:set STRIPE_SECRET_KEY
npx -y firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET
```

When the Stripe account is ready:

1. Stripe Dashboard → Developers → API keys → copy the **Secret key**
   (`sk_live_...`, or `sk_test_...` to try it first). Set it with the first
   command above.
2. Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
   URL `https://us-central1-leaderboard-agentictrading.cloudfunctions.net/stripe_webhook`,
   events `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`. Copy its **Signing secret**
   (`whsec_...`) and set it with the second command.
3. Redeploy the three functions that read them:
   `tokens_wallet`, `tokens_checkout`, `stripe_webhook`.

Never paste either key into a file in this repo.

## Not yet

- Token rewards for XP / levels: XP is still written by the browser, so
  paying tokens for it would be farmable. Add it when XP moves server-side.
- Holidays: `lockedUntil` skips weekends but not market holidays (an alert
  published on a holiday unlocks at that day's 4 pm).
