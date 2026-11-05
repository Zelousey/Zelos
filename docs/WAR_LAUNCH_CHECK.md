# War launch check (2026-11-05)

**Verdict: ready to open to everyone**, once the owner decides to and the items under "Before opening" are done. Nothing found blocks it.

## What was checked

**A whole War Zone week, every feature together** (`tests/rules/war_week.e2e.py`, now part of the automatic checks on every change).
Four players share one Open zone for a full season. The real every-minute background job (prices, deadlines, the
trading desk, healing, the leaderboard) runs all week. Any error in it fails the test. After every simulated day
the test checks that nobody has negative money, gold, crystals, Energy or soldiers. It also checks that each War's
own books add up exactly to each player's real shares. **25 of 25 checks passed**:

- joining a zone and the secret claiming hour; the map reveal;
- bases up to Headquarters level 4, with the Wizard's Tower, the Medical Station and Energy;
- trading only in territories you hold (a player who holds nothing can't buy);
- a hired trader that made 13 trades during the week, counted in the player's War score;
- Fort and Supply camp (the camp made 575 gold in its first hours);
- Scout shows the real soldier count;
- Shield blocks an attack;
- an hour-long attack is settled correctly, the Fort means one win isn't enough, and the loser's soldiers are
  counted as wounded;
- the weekly leaderboard ranks everyone;
- the season ends with final results; players move to next season's zone with a fresh base, and the
  leaderboard moves to the new season.

**Every War screen, on a phone and a computer**: 26 browser tests, each with an accessibility check. A new phone
check confirms that no War screen scrolls sideways.

## What was found and fixed

1. **Phone: the territory details panel was partly off screen.** On a phone the War map scrolls sideways, and the
   panel with Scout, Shield and the outpost buttons sat at its right edge, so a player might not see it open.
   Tapping a territory now brings the panel into view. The new phone test fails without the fix and passes with it.
2. **Out-of-date text**: the "Your base" card said only "Build a Gold Mine and Barracks". It now mentions
   everything the base does.
3. One function was split in two so the week test can trade at simulated times. Trading works the same.

## Worth knowing (working as designed)

- A player whose War return is below 0% can't attack unless they've made a sale at least 1% above cost in the
  last 2 days, or have a Redeploy pass. In some test runs a player was blocked by exactly this (it depends on
  prices). It's the rule you approved, but new players may hit it.
- Buildings and outposts finish "on paper" and show their new level in the app straight away. The stored level
  catches up the next time someone uses them.
- The leaderboard refreshes once an hour, at 7 minutes past.

## Before opening

1. **Deploy everything once.** If any recent deploy was missed, run:
   `firebase deploy --only functions:war_trade,functions:war_lobby,functions:war_market_tick`
2. **Turn War on.** This is a one-line change (`WAR_OPEN = True` on the server) plus showing the War Zone card to
   everyone in the app. I'll make it a PR only when you say "open War".
3. **Separate from War:** GitHub reports 28 security alerts in the project's third-party packages (9 high).
   They're worth a clean-up PR before a public launch.

## Not covered by this check

Real token purchases through Square, push notifications on real phones, and heavy load (hundreds of players at
once). The background job does more work as players grow, and should be watched in the first week.
