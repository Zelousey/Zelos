# Zelos data model (Firestore)

Project: `leaderboard-agentictrading` (same project the arcade leaderboard already
uses — Realtime Database stays as-is for game scores; Firestore is new, added
alongside it for everything below).

## `alerts/{alertId}`

The single source of truth for "what Zelos found." Written only by the scan
pipeline (Admin SDK / service account — never from the browser). Public read,
no login required, so a shared link always opens straight to the full analysis.

```
{
  strategy: "swing-trader" | "breakout-rider" | "options-scanner",
  ticker: "PFE",
  createdAt: <timestamp>,
  status: "qualified" | "no-qualifying-setup" | "watching",
  direction: "long" | "short" | "long-call" | "long-put",
  score: 59, scoreMax: 80,
  setupLabel: "Pullback in an uptrend",
  marketRegime: "Neutral — SPY mixed (above 50sma, below 20sma); QQQ below both.",

  // trade-plan ledger (mirrors what the alert ticket showed before)
  entry: 27.72, stop: 27.35, target1: 29.21, target2: 30.00,
  riskPerShare: -0.37, rewardPerShare: 1.49, rewardRiskRatio: "4.0 : 1",
  suggestedSizeNote: "no trade proposed, cap n/a",

  // for options-scanner alerts specifically
  optionsRule: "1 OTM · 30–45 DTE",

  // the "full analysis" content — why this setup, what to watch
  reasoning: "Pulled back to the rising 20-day average on falling volume, RSI...",
  technicals: { rsi: 48, sma20: 27.10, sma50: 26.40, volumeVsAvg: "0.8x" },
  riskNotes: "Earnings in 9 days — position sized/held with that in mind.",

  // OPTIONAL: what the scan looked at, for the public daily scan page
  // (scan/YYYY-MM-DD.html, built by scripts/build_scan_pages.py). Every field
  // is optional; the page simply leaves out sections it has no data for.
  scanStats: {
    scanned: 3120,                 // stocks in the universe that day
    passedFilters: 41,             // survived the hard filters
    rejected: [{ ticker: "XYZ", reason: "Below a falling 50-day average" }],
    qualified: [{ ticker: "PFE", score: 59, setup: "Pullback" }]
  },

  // filled in later by a follow-up job that checks what actually happened —
  // this is what makes alert history transparent instead of cherry-picked
  outcome: null | {
    result: "hit-target" | "stopped-out" | "open" | "expired" | "no-trade",
    closedAt: <timestamp>,
    exitPrice: 29.10,
    // only ever meaningful when result is "hit-target" — null/absent otherwise.
    // true = also ran to target2 before falling back to breakeven; false = gave
    // the runner back; null = still running, not resolved either way yet. See
    // docs/buffer-automation.md — this is the one and only trigger for the
    // Buffer win-announce auto-post.
    target2Hit: true | false | null,
    target2ResolvedAt: <timestamp> | null,
    // set once a win-announce post about THIS alert has actually gone out,
    // so the daily Buffer job never announces the same win twice.
    target2Announced: true | undefined,
    target2AnnouncedAt: <timestamp> | undefined,
    notes: "Hit target 1 two sessions later."
  }
}
```

## `skills/{skillId}`

The Arsenal catalog. `skillId` is `swing-trader` | `breakout-rider` | `options-scanner`.
Public read (so the Arsenal page works signed-out), admin-maintained.

```
{
  name: "Swing Trader",
  tagline: "Pullback / bull-flag / breakout-retest setups.",
  priceLabel: "40 tokens / week",
  confirmationMode: "automatic" | "manual"
}
```

## `users/{uid}`

One doc per signed-in person. Only that person can read or write it.

```
{
  email: "...", displayName: "...", createdAt: <timestamp>,
  ownedSkills: ["swing-trader"],       // legacy (Gumroad era), unused
  watchlist: ["PFE", "NVDA"],
  xp: 340, streakDays: 4, lastActiveDate: "2026-09-19",
  notificationPrefs: { push: true, strategies: ["swing-trader", "breakout-rider"] },
  // written by zelos-dashboard-layout.js when someone customizes dashboard.html
  dashboardLayout: { order: ["status", "viz", ...], hidden: ["agents"],
                     size: { viz: { w: 6, h: 520 } }, updatedAt: 1790440789677 }
}
```

### `users/{uid}/activity/{activityId}` (subcollection)

System-written log entries behind "Recent activity" on My Zelos (xp earned,
streak milestones, watchlist adds). Not user-editable.

## Tokens and live alerts

Gumroad is retired. Scanner access is paid with tokens: see `docs/tokens.md`
for `wallets/{uid}` (+ `ledger`), `purchases/{sessionId}` and
`alertsLocked/{alertId}` (the full alert while it's live). While an alert is
live, `alerts/{alertId}` holds only a teaser (`strategy`, `status`,
`direction`, `score`, `setupLabel`, `marketRegime`, scan counts) plus
`locked: true` and `lockedUntil` (epoch ms of the 4 pm ET close). After the
close `release_alerts` adds `afterClose: true` (cheaper unlock); the full alert
is copied in when its outcome is final.

`ownedSkills` on `users/{uid}` is legacy (self-reported, from the Gumroad era)
and no longer gates or shows anything.

## How `outcome` gets filled in

Not written by anything above — see `docs/firestore-alerts-setup.md` for the
outcome-checking job (`scripts/check_alert_outcomes.py` decides what
happened, `update_alert_outcomes` in `functions/main.py` writes it) that
fills this in once a published alert's stop or target is actually reached.

`target2Announced`/`target2AnnouncedAt` are the one exception — those are
written by `post_to_buffer` itself (not the outcome checker) right after a
win-announce post about that alert actually goes out. See
`docs/buffer-automation.md`.
