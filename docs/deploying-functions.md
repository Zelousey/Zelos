# Deploying the Zelos Cloud Functions

This deploys `publish_alert`, `gumroad_ping`, and `update_alert_outcomes`
(`functions/main.py`) into the `leaderboard-agentictrading` Firebase project —
the same project the arcade leaderboard already uses. Once `publish_alert` is
live, the Zelos scan skills can write real alerts into the `alerts`
collection that `alert.html`, `dashboard.html`, `alert-history.html`,
`daily-market.html`, and `index.html` already read from. `update_alert_outcomes`
is the other half of that loop — see `docs/firestore-alerts-setup.md` for how
it gets called and what decides what to send it.

## One-time setup

1. **Cloud Functions requires the Blaze (pay-as-you-go) plan**, even though
   these two functions will run well within the free tier for this kind of
   traffic. In the [Firebase console](https://console.firebase.google.com/),
   open the `leaderboard-agentictrading` project → the upgrade prompt in the
   bottom-left → switch to Blaze. Realtime Database and Firestore stay free at
   this scale either way; this only affects Cloud Functions itself.
2. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`.
3. Log in: `firebase login`.
4. From this repo's root (the folder with `firebase.json` in it), confirm the
   CLI sees the right project: `firebase use leaderboard-agentictrading`
   (`.firebaserc` already points at it, so this should just confirm it).

## Set the shared secret

`publish_alert` and `gumroad_ping` both check a shared secret
(`ZELOS_PUBLISH_SECRET`) before doing anything — this is what stops anyone who
finds the function URL from writing fake alerts or fake purchases. Generate a
long random value and store it with Firebase's own secret manager (never put
it in a file in this repo):

```
firebase functions:secrets:set ZELOS_PUBLISH_SECRET
```

The CLI will prompt you to paste the value. Keep a copy of what you paste
somewhere private (a password manager) — you'll need the exact same value
again for two things: pasting into Gumroad's Ping webhook URL, and setting as
an environment variable wherever the Zelos scan skills run on a schedule (see
`docs/firestore-alerts-setup.md`).

## Deploy

```
firebase deploy --only functions
```

This installs `functions/requirements.txt` and deploys all three functions.
The CLI prints each function's HTTPS URL when it finishes — copy the
`publish_alert` and `update_alert_outcomes` ones, you'll need both for
`docs/firestore-alerts-setup.md`. It'll look like
`https://publish-alert-<random>-uc.a.run.app` or
`https://us-central1-leaderboard-agentictrading.cloudfunctions.net/publish_alert`
depending on how the CLI names it — use exactly what it prints, don't guess.

## Deploy the Firestore rules too

`firestore.rules` at the repo root already has the right rules (public read
on `alerts`/`skills`, no client writes, per-user `users/` docs). Deploy them
with:

```
firebase deploy --only firestore:rules
```

## Wire up Gumroad's Ping webhook (optional, for `gumroad_ping`)

In your Gumroad account: **Settings → Advanced → Ping** (this is account-wide,
not per-product), paste:

```
<your gumroad_ping URL>?token=<the same ZELOS_PUBLISH_SECRET value>
```

Every sale across all three Zelos products will then automatically flag that
buyer's `ownedSkills` in Firestore, instead of you flipping it by hand.

## Redeploying after an edit

Any time `functions/main.py` changes, `firebase deploy --only functions` picks
up the new code — no other steps needed unless you also changed the secret.
