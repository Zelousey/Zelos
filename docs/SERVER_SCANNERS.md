# Server-run scanners (Swing Trader, Breakout Rider, Options Scanner)

**Why (owner, 2026-10-22):** the paid scanners used to be Claude skills that someone had to run on a
schedule. Nobody was running them, so the last real alert was 2026-09-20 and pass holders got
nothing. Now the server runs them every market day. Nothing depends on anyone's Claude usage.

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

**Universe:** the Zelos stock list (data/practice-universe.json, 25 stocks without the ETFs, since 2026-10-22). These
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

**Swing Trader (a pullback in an uptrend).**
- The stock is in an uptrend: price above the 50-day average, the 50-day above the 200-day, and the
  20-day rising above the 50-day.
- It is beating SPY over the last month, and SPY is above its own rising 50-day average.
- Today it dipped to its 20-day average and closed back above it, with RSI ≤ 65.
- Stop 1.5 normal days' range under the entry; first target 2× the risk; second target the recent
  high.

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

**Re-checking later:** keep the alerts' public outcomes as the real record. Once there are ~100
live alerts per scanner, compare them with the numbers above before changing any rule.
