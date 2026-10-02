# Website notifications (Web Push)

New scanner alerts notify subscribers on their phone or computer, separately from
Claude's own notifications.

## Pieces

- `firebase-messaging-sw.js` (site root): Firebase Cloud Messaging service worker.
- `zelos-push.js`: the "Turn on notifications" row (dashboard My Agents, My Zelos,
  every alert page). Asks permission, gets this device's token, sends it to
  `push_register`. "Send a test" calls `push_test`. iPhone needs Zelos added to the
  Home Screen (Share → Add to Home Screen) and opened from there.
- `functions/main.py`:
  - `push_register` / `push_unregister` → `pushTokens/{hash}` `{uid, token}` (server only; max 10 devices per person).
  - `alert_push` runs inside `publish_alert` for alerts with a trade. One notification per
    alert ever (`alertPushes/{alertId}` guard), only to people whose My Agents switch for that
    scanner is on (`users/{uid}.notificationPrefs.strategies`; missing = all on).
    The message is the teaser only (scanner, setup, score), never the ticker or levels.
    Dead tokens are removed.
- Images: `images/alert-<strategy>.png` (1024×512) and `images/alert-zelos.png`.

## Setup (once)

Firebase console → Project settings → Cloud Messaging → Web Push certificates →
Generate key pair. Put the **public** key in `window.ZELOS_VAPID_KEY` in
`firebase-config.js`. Until then the row says notifications are coming soon.

## Personal notifications (challenges, battles, friends, community, fills)

Besides scanner alerts, the server notifies people about things that involve them.
`notify_users` in `functions/main.py` handles every kind.

| Kind | Sent when |
|---|---|
| `challenges` | Someone challenges you; your challenge is accepted or declined |
| `battles` | A Trade War you joined starts or is cancelled; you lose the lead; you're knocked out; the match ends (your place) |
| `friends` | Someone adds you as a friend (once per pair); someone adds you back ("friends now") |
| `community` | Someone joins the community you founded; it reaches a Founder milestone |
| `fills` | A stop loss or take profit fills in one of your Trade War matches |

Each notification does two things:

- It always lands in `users/{uid}/inbox`. The bell on every page shows it, and opening the bell marks it read. Browsers can only read, delete, or flip `read`; the server creates them.
- It's also sent as a push to the person's devices, unless they switched that kind off. Kinds are switched off under **Alerts → Notifications** (`alert-history.html#notifications`), which writes `users/{uid}.notificationPrefs.types.{kind} = false`.

Scanner alerts keep using `notificationPrefs.strategies`. Those are the My Agents switches, and they now also appear on the Notifications page.

Deploy:

```
firebase deploy --only firestore:rules
firebase deploy --only functions:tw_challenge
firebase deploy --only functions:tw_respond
firebase deploy --only functions:tw_start
firebase deploy --only functions:tw_cancel
firebase deploy --only functions:tw_surrender
firebase deploy --only functions:tw_mark_matches
firebase deploy --only functions:friend_ping
firebase deploy --only functions:community_join
firebase deploy --only functions:rewards_checkin
firebase deploy --only functions:market_research
firebase deploy --only functions:refresh_market_data
```
