# Server-run scanners (Momentum Trader, Swing Trader, Breakout Rider, Options Scanner, 3-Leg Options)

**Why (owner, 2026-10-22):** the paid scanners used to be Claude skills that someone had to run on a
schedule. Nobody was running them, so the last real alert was 2026-09-20 and pass holders got
nothing. Now the server runs them every market day. Nothing depends on anyone's Claude usage.

## Alerts go out at 10 am (owner 2026-11-19)

"You only get a notification at the end of the day? ... I'd want it in the beginning of the day, around 10."
Since 2026-11-19:

- **Evening** (`run_scanners`, from 6:05 pm): the day's final prices and grading of open alerts only. It no
  longer publishes (`scanners_pass(..., publish=False)`).
- **10:00 am New York time** (`morning_alerts`, retried at 10:10, 10:20, 10:30 if the morning prices aren't
  in): every scanner runs on the finished daily bars through yesterday, then the plan is moved to the live
  price (`functions/live_plan.py`): entry = the live price, the stop and targets keep their distance, the
  Options Scanner's contract is picked again, a 3-Leg butterfly is built again. A stock already through its
  stop or first target is passed over and the scan runs again without it (up to 6 tries). No Marketstack
  calls: stored history plus the live quotes. On a market holiday there are no fresh quotes, so nothing goes out.
- **Passes open alerts live again** (rules + `tk_has_access`): a pass sold from 2026-11-10 to 11-19 opened them
  after the close only; with alerts at 10 am that would have locked out the people who paid.
- Grading still uses daily bars from the signal day on, so the first morning's bar (before 10 am) counts too.

| Scanner | Length | Days with a pick | Avg (entering at the next open) |
|---|---|---|---|
| Momentum Trader (new) | up to 3 market days | 94% | +0.10R (halves +0.13 / +0.08) |
| Momentum Max (high risk, hidden unless turned on) | up to 3 market days | 95% | +0.17R, 44% wins (halves +0.20 / +0.15) |
| Swing Trader (kinds A, B) | up to 10 market days | 38% | +0.17R (halves +0.19 / +0.15) |
| Options Scanner | 10 market days | 63% | +0.13R stock move (halves +0.22 / +0.02) |
| Breakout Rider | 10 market days | ~6% | unchanged |
| 3-Leg Options | to expiration (~3 weeks) | ~24% | +8% of the cost |

**Momentum Max** (same file, owner 2026-11-19: "a little more extreme"): the same checklist, but the most
volatile stock that passes, a stop 3/4 of a day's range under the entry and a 3:1 target, up to 3 days. The app
hides it unless "Show high-risk strategies" is on (per device). Shorter holds were tried for the medium
strategies (Swing 10 → 7 → 5 days: +0.17 → +0.10 → +0.08R) and made them worse, so the tested holds stay
the recommended ones; people choose their own when they take a trade (a time exit, practice.py `bracket.days`).

**Passes and notifications (2026-11-19):** a pass records when it started (`passesFrom`); every alert carries
`publishedAt`; an alert published inside your pass window stays readable after the pass ends (rules +
`tk_in_pass_window`). Push notifications go only to people with an active pass for that strategy, and since
they have access, the notification is the trade itself (stock, entry, stop, target, hold). Declining is free
(`users/{uid}/alertDecisions`); taking one back costs 2 tokens while its trade is live (`alert_reactivate`).

**Momentum Trader** (functions/momentum_scan.py): the stock passing the most of 13 chart checks (trend: above
the 50-day, 50 over 200, above the 20-day; MACD histogram rising, MACD over its signal; RSI(14) 45–65 and
turning up; a green day closing in the top 40% of its range on at least average volume; SPY above its
20-day; beating SPY over the month; not stretched), at least 8. Stop one normal day's range under the entry,
first target 1.5× the risk, second 2.5×, up to 3 market days. Tried first: single signals (RSI(2) snap-backs,
MACD crosses, coils, surges) gave picks on ~90% of days but their results flipped between halves; the
checklist held up in both.

## What runs, and when

`run_scanners` (functions/main.py) runs every 30 minutes from 6:05 pm to 11:35 pm New York time on
weekdays:

1. **Get the day's final prices.** Marketstack's end-of-day bars aren't ready at 4:20 pm, when the
   after-close job runs, so this job asks (one call: SPY) until today's bar is there, then fetches
   the day's bar for every stored symbol once (`ms_daily_close`). It then adds the bar to the stored history and the charts' daily bars. On a
   market holiday there is no bar, so nothing runs.
2. **Grade open alerts** (functions/outcomes.py, the old scripts/check_alert_outcomes.py). Each one
   is graded as hit target, stopped out, or expired after 10 sessions. A finished alert goes public,
   which builds the track record.
3. **Publish one alert per scanner** (functions/scanner.py), the same way `publish_alert` does it:
   - the public doc is a teaser, and the full trade plan is token-gated until the close;
   - subscribers get a push notification;
   - the notification opens the alert in the app, where **Trade this setup** opens the practice
     ticket with the stop and first target already filled in.

   Most days find nothing. That case is published as "no qualifying setup".

It runs once a day; state lives in `serverMeta/scanners`. If an alert for a scanner already exists
today (for example, one published by hand), the job leaves it alone. A stock that already has an
open alert isn't alerted again by the same scanner.

**Universe:** the Zelos stock list (data/practice-universe.json, 23 stocks without the ETFs, since 2026-10-22). These
are exactly the stocks the practice account can trade, so every alert is one tap from a trade. A
bigger list would need the practice account's minute prices for those stocks too.

**Cost:** one Marketstack call per try while the day's bars aren't out, then ~185 calls once (every
symbol in a request is a call; see docs/market-data.md). Stops at the 98,000-call hard cap. Firebase
cost is negligible.

## The rules

The rules come from the skills (`zelos-swing-trader`, `zelos-breakout-rider`), written as fixed
numbers so every run is the same and testable (scripts/scanner_test.py, tests/rules/scanners.e2e.py).

**Breakout Rider.**
- Price ≥ $10, 20-day average volume over 500k, today's move between −2% and +6%, RSI 55–75,
  ADX 15–35.
- An 8-week base whose ceiling was touched at least twice, and no more than 25% tall.
- The first close above the ceiling came within the last 5 sessions, and price has held above it
  since.
- Breakout volume at least 1.3× the average.
- Not more than 10% past the level.
- Stop half a normal day's range under the old ceiling (or the breakout day's low), and at least one
  day's range under the entry.
- First target 2× the risk; second target the measured move.
- Score out of 80. The bar is 60, 64 in a neutral market and 68 in a bearish one.

**Options Scanner** (functions/options_scan.py; one long call or long put a day).
- **Candidates, in the skill's order:**
  1. Today's Swing Trader / Breakout Rider headline, as a long call, with its own levels.
  2. The Swing Trader pullback, as a call.
  3. Its mirror, as a put: a stock in a downtrend, lagging SPY, in a falling market, that bounced to its 20-day
     average today and closed back under it (RSI ≥ 35).
- **Only big, busy stocks** qualify: $15+ and 1M+ shares a day. We have no option-chain data, so this stands in
  for the skill's open interest and spread check.
- **The contract** is a 30–60 day expiration (closest to 45) and the strike whose estimated delta is closest to
  0.65 (−0.65 for puts).
- **Prices are estimates.** They use the practice account's model (functions/options.py: Black-Scholes on the
  stock's last month of price swings), and alerts say so. A real broker's price will differ.
- **"IV context"** becomes a volatility context: this month's swings against the stock's past year.
- **Score** out of 80. The bar is 68 for an idea that fights the market's direction, 60 otherwise. Ideas are judged
  on the stock's move (stop = invalidation), as the skill's track record always was.
- **One tap:** **Trade this setup** opens the practice options ticket on that exact contract.

**3-Leg Options** (functions/three_leg_scan.py, owner 2026-11-19; one bull call butterfly a day).
- **The setup** comes from the tested stock rules: today's Swing Trader / Breakout Rider headline first, then any
  stock passing the Breakout Rider or Swing Trader pullback rule. Same size check as the Options Scanner ($15+,
  1M+ shares a day).
- **The butterfly:** buy 1 call at the money, sell 2 calls halfway to the setup's first target, buy 1 call the
  same distance above; expiration 10–40 days out, closest to 21. It needs max profit at least 2× max loss (the
  cost). Prices are the practice account's estimates.
- **Graded at expiration** from the stock's close (outcomes.three_leg_outcome); a stock with an open 3-Leg alert
  isn't alerted again until it expires.
- Bear put butterflies and jade lizards were tried and are not published (see below).

**Swing Trader: the daily short-term pick** (owner 2026-11-19: "I want a strategy popping up almost every day").
- The stock is in an uptrend and has pulled back toward its 20-day average. Five kinds, best first:
  - **A**, the classic: dipped to a rising 20-day and closed back above it, beating SPY, in a rising market.
  - **B**: a near-dip (within 2%) to a rising 20-day in a strong trend.
  - **C**: dipped to the 20-day in the last 3 days and is holding above it.
  - **D**: a leader 3%+ off its 2-week high.
  - **E**: above a rising 50-day and within 3% of its 20-day.
- The day's pick is the best kind found, then the stock with the strongest last month. No score bar.
- The plan: stop one normal day's range under the entry, first target 1.5× the risk, second 2.5× (or the recent
  high), held up to **5 market days** (`SCAN_HOLD_SESSIONS_BY`).
- The Options Scanner turns the pick into a call with its own wider plan (stop 1.5 days' range, target 2×); 3-Leg
  only uses kind A and breakouts (the looser kinds lost as butterflies).

Every alert carries the skills' general 1–2% rule of thumb, worded the same for everyone, and the
"rule-based scan only, not personalized advice" note.

## How the rules were checked (2026-10-22)

The rules were replayed day by day on the stored history (2024-10 to 2026-10, the 45 stocks). For
each simulated trade, the result is measured in R, the amount risked: +2R is a win at the 2× target,
−1R is the stop, and a trade that hits neither is closed at its 10th-session close. One open trade
is allowed per stock. Year 1 was used to choose settings; year 2 was not looked at while choosing.

| Scanner | Year 1 trades (avg R) | Year 2 trades (avg R) |
|---|---|---|
| Swing Trader (final rules) | 81 (+0.08) | 184 (+0.10) |
| Breakout Rider (final rules) | 41 (+0.77) | 36 (−0.01) |
| Swing Trader, first version (any pullback near support) | 14 (+0.20) | 13 (−0.42) |
| Options Scanner calls (stock move) | 57 (−0.07) | 134 (+0.07) |
| Options Scanner puts (stock move) | 6 (+1.50) | 15 (−0.38) |

What these numbers mean:

- **The options rows** are judged on the stock's move, not on what the option itself made or lost. An option
  also loses value with time, so the option's own result is usually worse unless the stock moves quickly. Puts
  were rare because the last two years mostly went up.
- **These are small edges, and the samples are small.** With 30–40 trades a year, a result can
  easily swing by ±0.2R by chance. Neither scanner is proven to make money.
- **The first Swing Trader version** looked fine in year 1 and lost in year 2, so it was replaced.
- **The checks don't include** slippage, gaps through stops (the stop price is assumed), or fees.
- **Most trades end by stop or time-out, not at the target.** The public track record will show
  that, which is the honest picture.
- **Nothing here is a promise of future results.** The app and alerts already say so.

## The daily Swing Trader (2026-11-19)

Replayed on the Zelos list, 2025-01-15 to 2026-09-24, with the production code:

| Scanner | Days with a pick before | After | Avg result after |
|---|---|---|---|
| Swing Trader (5-day hold) | 29% | 85% | +0.09R (first half +0.10R, second +0.09R in the rule test) |
| Options Scanner | 28% | 65% | +0.06R (stock move) |
| Breakout Rider | 6% | 6% | unchanged |
| 3-Leg Options | 24% | 24% | +8% of the cost |

On the days left without a Swing pick, no stock on the list is anywhere near a pullback in an uptrend (mostly
falling markets). Small edges, small samples, no fees or slippage: nothing here is a promise.

## How often they find something, and 3-Leg designs (re-checked 2026-11-19)

The owner saw several days in a row with no setup and asked whether the scanners find enough. Replayed day by day
from 2025-01-15 to 2026-09-24 (≈400 market days) on stored daily history:

| Scanner | 23-stock list: days with a setup | ≈50 stocks: days with a setup | Avg result |
|---|---|---|---|
| Swing Trader | 29% | 45% | +0.10R / +0.14R |
| Breakout Rider | 6% | 10% | +0.33R / +0.10R |
| Options Scanner (stock move) | 28% | 47% | 0.00R / −0.01R |
| 3-Leg Options (bull call butterfly) | 24% | 42% | +10% / +15% of the cost |

- **Several quiet days in a row is normal**, and Breakout Rider is rare (about once every 3–4 weeks on the list).
  The list size is what limits it: twice the stocks gives roughly twice the setups at about the same quality.
- **A higher score did not mean a better result** (Swing Trader's 72+ alerts did worst), so raising or lowering
  the bar wouldn't help quality; the rules stay as they are.
- **3-Leg designs tried** (21 days, held to expiration): bull call butterfly on the stock rules' setups +15% of
  the cost, 31% wins (most lose the small cost, a few pay several times it); bear put butterfly −60%, 13% wins;
  jade lizard +1%, 81% wins, with a big loss when the stock drops. Only the bull call butterfly is published.
- Same caveats as above: small samples, model prices (no live option chain), no fees or slippage.

**Re-checking later:** keep the alerts' public outcomes as the real record. Once there are ~100
live alerts per scanner, compare them with the numbers above before changing any rule.
