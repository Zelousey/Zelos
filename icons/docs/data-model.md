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

  // filled in later by a follow-up job that checks what actually happened —
  // this is what makes alert history transparent instead of cherry-picked
  outcome: null | {
    result: "hit-target" | "stopped-out" | "open" | "expired" | "no-trade",
    closedAt: <timestamp>,
    exitPrice: 29.10,
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
  priceLabel: "$20",
  gumroadUrl: "https://...",
  confirmationMode: "automatic" | "manual"
}
```

## `users/{uid}`

One doc per signed-in person. Only that person can read or write it.

```
{
  email: "...", displayName: "...", createdAt: <timestamp>,
  ownedSkills: ["swing-trader"],       // which Arsenal skills they've bought
  watchlist: ["PFE", "NVDA"],
  xp: 340, streakDays: 4, lastActiveDate: "2026-09-19",
  notificationPrefs: { push: true, strategies: ["swing-trader", "breakout-rider"] }
}
```

### `users/{uid}/activity/{activityId}` (subcollection)

System-written log entries behind "Recent activity" on My Zelos (xp earned,
streak milestones, watchlist adds). Not user-editable.

## Known gap (not built yet)

`ownedSkills` today has no automatic link to a real Gumroad purchase — there's
no webhook wiring Gumroad sales into Firestore yet. Until that exists, treat
`ownedSkills` as manually set (e.g. Nate flips it after confirming a sale, or a
person self-marks a skill "owned" after buying). Flagged as a follow-up, not
part of the current alerts/dashboard build.
