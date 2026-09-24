# Wiring the scan skills (and the outcome checker) up to Firestore

`docs/deploying-functions.md` gets the Cloud Functions themselves live. This
page is the other half: what to set wherever the actual scans run on a
schedule, so they call those functions instead of just doing the notification
+ republished-Artifact thing they did before Firestore existed.

There are two separate jobs that write to the `alerts` collection, and they
run on two different schedules:

1. **The scan skills** (Swing Trader, Breakout Rider, Options Scanner) —
   run once a day, find (or don't find) a qualifying setup, and call
   `publish_alert` to create that day's alert doc.
2. **The outcome checker** — also runs once a day (any time after the scan,
   typically end of day so the day's own bar is complete), looks at every
   alert that's still open, and calls `update_alert_outcomes` once it knows
   what happened. This is what fills in the `outcome` field described in
   `docs/data-model.md` and is what makes `alert-history.html` an honest
   track record instead of a feed of predictions nobody ever checks back on.

Both need the same shared secret from `docs/deploying-functions.md`
(`ZELOS_PUBLISH_SECRET`) and the same two pieces of information about where
your functions actually live: the base URL Firebase printed when you ran
`firebase deploy --only functions`, e.g.
`https://us-central1-leaderboard-agentictrading.cloudfunctions.net` — each
function is that base plus its own name (`/publish_alert`,
`/update_alert_outcomes`, etc).

## 1. The scan skills → `publish_alert`

Wherever a scan skill runs on a schedule (a Claude scheduled task, a cron
job, whatever you're using), set two environment variables it can read:

- `ZELOS_PUBLISH_URL` — the full `publish_alert` URL from the deploy output.
- `ZELOS_PUBLISH_SECRET` — the exact same value you set with
  `firebase functions:secrets:set ZELOS_PUBLISH_SECRET`.

At the end of a scan run, POST the alert as JSON with that secret in the
`X-Zelos-Secret` header:

```bash
curl -X POST "$ZELOS_PUBLISH_URL" \
  -H "X-Zelos-Secret: $ZELOS_PUBLISH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
        "strategy": "swing-trader",
        "ticker": "PFE",
        "status": "qualified",
        "direction": "long",
        "score": 71, "scoreMax": 80,
        "setupLabel": "Pullback in an uptrend",
        "marketRegime": "Neutral — SPY mixed (above 50sma, below 20sma).",
        "entry": 27.72, "stop": 27.35, "target1": 29.21, "target2": 30.00,
        "riskPerShare": -0.37, "rewardPerShare": 1.49, "rewardRiskRatio": "4.0 : 1",
        "reasoning": "...", "technicals": {"rsi": 48}, "riskNotes": "..."
      }'
```

`publish_alert` fills in `createdAt` and derives the doc id
(`<strategy>-<today's ET date>`) itself — see `docs/data-model.md` for the
full field list. This is the same call whether the scan finds a qualifying
setup or not; `status` is what tells the site which case it is.

This is the one previously-flagged gap: if the three scan skills still show
`enabled:false` wherever they're scheduled, it's very likely because this
page didn't exist yet to wire them up to. Once `ZELOS_PUBLISH_URL` and
`ZELOS_PUBLISH_SECRET` are set and each skill's scan step ends with the curl
above, they're safe to flip to `enabled:true`.

## 2. The outcome checker → `update_alert_outcomes`

This is a new job, not one of the three existing skills — it doesn't scan
for new setups, it looks back at ones that already published and asks "did
that work out?" Run it once a day, any time after market close (so the
day's own high/low is final).

**Step by step, for whatever scheduled Claude session runs this** (it needs
network access and the Robinhood MCP tools connected — the same kind of
environment the scan skills themselves run in):

1. **Fetch the open alerts.** The `alerts` collection is public-read, so a
   plain GET works with no auth and no service-account key:

   ```bash
   curl -sS "https://firestore.googleapis.com/v1/projects/leaderboard-agentictrading/databases/(default)/documents/alerts?pageSize=300"
   ```

   Keep every doc whose `status` is `"qualified"` AND either:
   - `outcome` is still missing/null or `{"result": "open"}` (nothing decided
     yet), OR
   - `outcome.result` is `"hit-target"` and `outcome.target2Hit` is still
     `null`/absent (the win is locked in, but the runner-to-target2 flag
     hasn't resolved either way yet — see the TARGET2 / "RUNNER" TRACKING
     note in `scripts/check_alert_outcomes.py`, and `docs/buffer-automation.md`
     for why that flag matters enough to keep re-checking for it).

   Everything else (`stopped-out`, `expired`, `no-trade`, or a `hit-target`
   whose `target2Hit` is already `true`/`false`) is fully resolved — skip it.
   (Firestore's REST JSON wraps values as `{"stringValue": ...}` etc. —
   unwrap those, or query through the web SDK instead if that's easier from
   wherever this runs.)

2. **Get the price bars since each one published.** For an equity alert
   (`swing-trader` or `breakout-rider`), call the Robinhood MCP
   `get_equity_historicals` tool for that ticker, daily interval, starting
   the session after the alert's `createdAt` date. For an `options-scanner`
   alert, also use `get_equity_historicals` on the underlying — see the
   OPTIONS CAVEAT at the top of `scripts/check_alert_outcomes.py` for why
   that's a deliberate proxy, not an oversight.

3. **Decide the outcome.** Pipe the alert doc and the bars you just fetched
   into `scripts/check_alert_outcomes.py`:

   ```bash
   echo '{"alert": <the alert doc>, "bars": [{"date":"2026-09-16","high":28.90,"low":28.30}, ...]}' \
     | python3 scripts/check_alert_outcomes.py
   ```

   This prints `{"result": ..., "closedAt": ..., "exitPrice": ..., "notes": ...}`.
   Read `scripts/check_alert_outcomes_test.py` if you want to see exactly
   what it does with an ambiguous day (both stop and target inside one
   session's range) or a trade that's run past the hold window — both are
   covered by tests, not just described in a comment.

4. **Skip it if the result is still `"open"`** — nothing changed, no need
   to write anything. Otherwise, POST it:

   ```bash
   curl -X POST "$ZELOS_PUBLISH_URL_BASE/update_alert_outcomes" \
     -H "X-Zelos-Secret: $ZELOS_PUBLISH_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"alertId": "swing-trader-2026-09-15", "result": "hit-target", "closedAt": "2026-09-17", "exitPrice": 29.21, "notes": "Hit target 1 2 sessions later."}'
   ```

   Or batch several in one call with `{"updates": [ {...}, {...} ]}` — see
   the docstring on `update_alert_outcomes` in `functions/main.py` for the
   exact shape. It only ever touches the `outcome` field of an existing
   alert doc (merge, never overwrite), same shared-secret gate as
   `publish_alert` and `gumroad_ping`. `check_alert_outcomes.py`'s output
   already includes `target2Hit`/`target2ResolvedAt` alongside
   `result`/`closedAt`/`exitPrice`/`notes` — post the whole dict through as-is
   (plus `alertId`), no need to pick fields out of it by hand.

That's the whole loop: scan skills publish in the morning, the outcome
checker looks back at yesterday's (and any still-open older) alerts in the
evening, and `alert-history.html` / `alert.html` already know how to render
whatever `outcome.result` they find — no site changes needed on top of this.

**One more step, same run:** once outcomes are updated, check whether any
alert's `outcome.target2Hit` just became `true` and `outcome.target2Announced`
isn't already `true` — if so, that's the trigger for the Buffer win-announce
post. See `docs/buffer-automation.md` for that whole other half of the loop
(and what to post instead on a day with nothing to announce).

## Sanity-checking it without touching real data

`scripts/check_alert_outcomes_test.py` exercises the decision logic against
made-up bars — long and short trades, a session that touches both stop and
target, a trade that expires unresolved, missing fields — with no network
or Firestore involved:

```bash
python3 scripts/check_alert_outcomes_test.py
```

Worth running any time you touch `check_alert_outcomes.py`, before wiring a
schedule up to it.
