# Server-side practice account

> Decided 2026-10-07 by the owner. Replaces the browser-written $10,000 account
> (`users/{uid}.practice`, `practice/practice.js`).

## Decisions
| Question | Decision |
|---|---|
| Where does the account live? | On the server. Only Cloud Functions write it. |
| Existing accounts | Everyone starts fresh at $10,000. The old browser account is copied once to `practiceArchive/{uid}`, read-only, marked unverified. XP, levels and achievements carry over. |
| Scope of the first version | Stocks and ETFs from the Zelos stock list (no crypto while it is paused). Options and multi-leg strategies come next. |
| Classic practice page | `practice/index.html` keeps the Trade War home (trader card, challenges, matches, tiles) and sends people to the app (`/app/practice`) to trade. |
| Naming | **Practice** = your solo virtual account. **Trade War** = competitive matches (unchanged, server-side since Phase 5). |

## Fairness rules (no look-ahead)
App prices update every 15 minutes (Marketstack Basic). To stop anyone trading on a price
they already know is stale:
- **Market orders** fill at the first price observed *after* the order was placed: the close
  of the 15-minute bar the order arrived in, or the open of a bar that starts after it.
- **Limit and stop orders** only see bars that start after the order was placed (plus the
  close of the bar it arrived in). Gaps fill at the bar's open, like a real stop.
- Orders placed while the market is closed belong to the next session and fill from its open.
- **Day** orders expire at that session's close; **Until cancelled** (GTC) orders stay.
- Long only, whole shares, max 50 open orders, max 60 holdings, prices within 0.2×–5× of the
  last price. Buying power = cash − what open buy orders could cost.
- Buy orders can carry a bracket: a stop-loss (sell stop) and a take-profit (sell limit) that
  are created when the buy fills and cancel each other (OCO). Bracket exits don't block a
  manual sell; a manual sell shrinks or cancels them.
- Reset to $10,000 only below $2,500, and it counts on your public stats (same as before).

## Where the code is
| Piece | File |
|---|---|
| Engine (pure, unit-tested) | `functions/practice.py`, tests `scripts/practice_test.py` |
| Callables | `functions/main.py`: `practice_account`, `practice_order`, `practice_cancel`, `practice_reset`, `practice_settings` |
| Fills | `practice_pass()` runs right after every `refresh_quotes` price update, on the bars it just fetched |
| Nightly | `practice_revalue_all()` runs in the after-close job: peak, period baselines, daily history, public profile |
| XP | Granted by the server on fills (`practice-trade`) and wins (`practice-win`) through `xp_grant()`, with the usual daily limits |
| App | `webapp/src/features/practice/` (account page, order ticket, display math, browser-side checks) |
| Classic widgets | `zelos-practice-acct.js` (Trade War home chip, dashboard widget) |
| Tests | rules: `tests/rules/rules.test.js`; callables: `tests/rules/functions.e2e.mjs`; fills on a real database: `tests/rules/practice_pass.e2e.py`; browser: `webapp/e2e/practice.spec.ts` |

## Data
```
practiceAccounts/{uid}            owner reads, server writes
  cash, positions{SYM:{qty, avg, openedDay}}, orders{id: open order}, openOrders,
  realized, epoch, resets, resetHistory[], peak, stats{trades, wins, losses, sumWin,
  sumLoss, bySym, best[10], winRun, winBest}, life{fills, tpExits, symbols},
  periods{w…/m…/s…: {eq0, net0, xp0, at}}, seasonStats, hist{dYYYYMMDD:{n,x,e}},
  tradeDays[], publicProfile, archivedClassic, createdAt, updatedAt
practiceAccounts/{uid}/history/*  owner reads, server writes: closed orders, fills, trades
practiceArchive/{uid}             owner reads, server writes once: the old account (unverified)
practiceProfiles/{uid}            public; server writes the numbers (same shape the
                                  leaderboards, profile page, challenges and squads already
                                  read). The owner may change only name/username/photo and
                                  the cosmetic achievements/streak, or delete it (hide stats).
```

## Not done yet (next steps)
- Options (long calls/puts) on the server: port `practice/practice-options.js` pricing.
- Missions and achievements still run in the browser (`zelos-progress.js`) and read the
  classic page's counters; they need to read the server account in the app.
- Price alerts and chart drawing tools (Fib, A-B-C) from the classic page are not in the app yet.
- Leaderboards refresh on every trade and once a night; intraday value changes without a
  trade show up after the close.
- Scale: the order pass and nightly revalue loop over accounts in one function run. Fine for
  now; batch or shard if accounts reach the tens of thousands.
