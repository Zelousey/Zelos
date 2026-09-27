# Roadmap

Ideas that are planned but not built yet, and what the code already does to
make room for them.

## Multi-leg options strategies (spreads, straddles, iron condors)

Not built. The practice account trades single long calls and puts today.

Room already made for it:

- Option positions are stored as instruments (`{ cid, sym, type, strike, exp, qty, avg }`)
  in `acct.options`, not as a special "call/put" field on a stock position. A strategy can
  be a group of these with a shared `groupId` and a per-leg `side` (long or short).
- Pricing is per contract (`ZelosOptions.quote` in `practice/practice-options.js`), so a
  spread's price is the sum of its legs' prices.
- Closed trades (`acct.trades`) carry a `kind` field (`stock` or `option`); a strategy
  would record `kind: 'strategy'` with its legs.

What it needs: short legs (a margin/collateral rule for a cash account, for example only
defined-risk spreads), a strategy builder in the options ticket, payoff chart, and
assignment/early-exercise rules for short legs at expiry.

## Server-side order engine (alerts while the tab is closed)

Take-profit and stop-loss orders fill, and browser notifications fire, only while the
practice page is open in a tab. When it reopens, orders catch up against the prices
since, but nothing notifies you in between.

To notify with the tab closed: a scheduled Cloud Function that reads open bracket
orders for signed-in users, checks them against `markets/quotes` every minute, fills
them in `users/{uid}.practice`, and sends a web push (Firebase Cloud Messaging with a
service worker). Orders would move from the browser to the server as the source of truth.

## Agents in the practice account

Today the Agent signals tab loads each agent's latest qualified setup into the ticket
("Paper trade this") and marks agents you own. Next step: an "auto-follow" switch per
owned agent that places its signals automatically with a fixed risk per trade, so you
can track an agent's performance on its own practice sub-account. The alert shape
(`strategy, ticker, entry, stop, target1, optionsRule`) is already all it needs.

## Live options data

Option prices are modeled (Black-Scholes on the stock's recent volatility). A paid
options feed could replace `ZelosOptions.quote` without touching the rest of the page.

## More news providers

`refresh_news` (functions/main.py) writes provider-neutral items to `markets/news`.
Adding a provider means a pair of fetch functions returning the same item shape and
pointing `NEWS_PROVIDER` at them. Robinhood has no public news embed, so it isn't an
option here.

## Server-verified competitions

Challenges, squads, season boards and XP are computed in each player's browser
(virtual money, so tampering is an accepted risk). For prize-bearing competitions,
move scoring to a scheduled Cloud Function that recomputes each player's net P&L from
their saved trades and quotes and writes the official standings.

## Season-end rewards

Seasons already give fresh rankings and two badges each. Next: freeze each season's
final top 10 per category at the end date (a scheduled function), award "Season 1 Top
10" style badges, and keep a hall of fame page.

## Private profile levels

Today a player is either public (profile + leaderboards) or private (profile deleted).
A middle option could show a profile only to friends and squad mates.
