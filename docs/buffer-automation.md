# Buffer auto-posting

The idea: keep the Buffer queue (and the traffic it sends back to the site)
moving on its own, without anyone manually writing a post every day. Two
kinds of post, one job that decides which one fires each day:

1. **A win announcement** — but only for the strongest signal the schema
   can back up: an alert that ran all the way to its *second* take-profit
   target, not just the first. See the TARGET2 / "RUNNER" TRACKING note at
   the top of `scripts/check_alert_outcomes.py` for exactly what that means
   (short version: once target1 hits, the hypothetical stop moves to
   breakeven, and `target2Hit` becomes `true` only if price reaches target2
   before falling back to breakeven — `false` means it gave the runner back,
   `null` means still undecided). This is a deliberately high bar — target1
   alone never triggers a post — so every win this account brags about is
   one that's hard to argue with.
2. **A market recap** — on a day with nothing new to announce, so the queue
   (and the account) doesn't go quiet. Built from real index data the daily
   job already has access to (via the Robinhood MCP tools, same as the scan
   skills and the outcome checker use) — never invented numbers.

`functions/main.py`'s `post_to_buffer` Cloud Function is the only thing that
actually talks to Buffer's API — it holds the Buffer credential in its own
secret config and relays already-composed text. `scripts/buffer_post_content.py`
is the only thing that decides what that text says. Neither one decides
*when* to post — that's the daily job below, the same kind of scheduled
Claude session (with Robinhood MCP + network access) that already runs the
scan skills and the outcome checker described in
`docs/firestore-alerts-setup.md`.

## One-time setup

1. **Get a Buffer personal API key.** In Buffer, go to your account's API
   settings and generate a key — this is available on every plan, including
   Free (3,000 requests/30 days, one key), so no upgrade is needed. This key
   is scoped to your own account and your own already-connected channels —
   it's not a "the whole internet can post as you" credential, and Buffer
   doesn't support third-party apps posting on other people's behalf with it,
   which doesn't matter here since it's your own account posting for itself.

2. **Find your channel ids.** Buffer's API reference (developers.buffer.com)
   covers reading your connected channels; grab the id for each channel you
   want Zelos posting to (however many of "the buffers you already have set
   up" should get these posts).

3. **Set two Cloud Functions secrets**, same pattern as
   `ZELOS_PUBLISH_SECRET`:

   ```bash
   firebase functions:secrets:set BUFFER_API_KEY
   firebase functions:secrets:set BUFFER_CHANNEL_IDS
   ```

   `BUFFER_CHANNEL_IDS` is a comma-separated list — every post goes to all of
   them unless a call explicitly passes its own `channelIds`.

4. **Deploy** (or redeploy) functions — `post_to_buffer` needs the same
   `firebase deploy --only functions` step as the others; see
   `docs/deploying-functions.md`.

## The daily job

Runs once a day, after the outcome checker (`docs/firestore-alerts-setup.md`
step 2) has already updated `target2Hit` for the day:

1. **Look for a fresh win.** Query the `alerts` collection (same public-read
   REST GET as the outcome checker) for any doc where
   `outcome.target2Hit == true` and `outcome.target2Announced` is not `true`.
   If there's more than one on a given day, post the best one (highest
   `rewardRiskRatio`, say) rather than spamming the queue with all of them —
   the others will simply carry `target2Announced: false` until picked or
   skipped, at your judgment; nothing forces them to be announced.

2. **If a fresh win exists:** call `scripts/buffer_post_content.py` in `win`
   mode with that alert doc:

   ```bash
   echo '{"kind": "win", "alert": <the alert doc, including its outcome>}' \
     | python3 scripts/buffer_post_content.py
   ```

   Then POST the resulting `text`, plus that alert's id, to `post_to_buffer`:

   ```bash
   curl -X POST "$ZELOS_PUBLISH_URL_BASE/post_to_buffer" \
     -H "X-Zelos-Secret: $ZELOS_PUBLISH_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"text": "<the composed text>", "alertId": "swing-trader-2026-09-15"}'
   ```

   A successful post (on at least one channel) marks that alert's
   `outcome.target2Announced = true` automatically — the job never has to do
   that bookkeeping itself, and never announces the same win twice.

3. **If there's no fresh win today:** build a `snapshot` from real market
   data (e.g. `get_index_quotes` / `get_equity_quotes` for a couple of major
   indices via the Robinhood MCP tools) and call `buffer_post_content.py` in
   `recap` mode instead:

   ```bash
   echo '{"kind": "recap", "snapshot": {"date": "2026-09-24", "indices": [{"label": "S&P 500", "changePct": 0.42}, {"label": "Nasdaq", "changePct": -0.18}]}}' \
     | python3 scripts/buffer_post_content.py
   ```

   Then POST the resulting text to `post_to_buffer` the same way, just
   without an `alertId` (nothing to mark).

That's the whole loop — at most one post a day, always either a specific,
checkable win or a plain market check-in, never a guess dressed up as a
signal.

## Sanity-checking the wording without touching Buffer

```bash
python3 scripts/buffer_post_content_test.py
```

Covers: refusing to compose a win post for anything short of a confirmed
`target2Hit == true` (including `false` and `null`/still-running — this is
the one test suite in this repo that exists specifically to stop an
overstated claim from ever reaching a real post), the percentage-move math
for both long and short alerts, and the recap formatting. Worth running any
time the wording changes, same spirit as `check_alert_outcomes_test.py`.

## Why this doesn't touch anyone's actual Buffer login

`post_to_buffer` takes an already-written `text` string and (optionally) a
list of `channelIds` — it never receives or needs anything else. The only
place `BUFFER_API_KEY` exists is that function's own secret config, same
shared-secret gate (`X-Zelos-Secret`) as every other endpoint in
`functions/main.py`: if this URL ever leaked, it could post to your Buffer
queue, but it still couldn't read your account, change your channels, or do
anything Buffer's API itself doesn't expose to a personal key.
