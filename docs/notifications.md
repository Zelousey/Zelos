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
