# War, challenges, Squad rulesets and Chaos Simulator: design for approval

**Version 2 (2026-10-27, after the owner's "War Mode Rules, Balancing & Pre-Phase-One Updates").**
**Status: DRAFT. Section 9 is NOT approved** (the owner withdrew the earlier approval; it stays pending
until the owner explicitly approves it). No code until it's approved.
It belongs with `AGENTICTRADING_MASTER_SPEC.md`, ADDENDUM 2026-10-27 (list A, Phases 10–13, and the
"War Mode rules update" section there).

**How to read the labels:**
- **Owner-approved:** the owner decided it. Don't change it without a specific reason, written here.
- **(proposed):** my recommendation, waiting for the owner.
- ⚖️ marks anything that affects fairness, money/accounting or security.

## 0. Approval status
| Item | Status |
|---|---|
| The numbers in v1: 100 pieces, 2–10 players, sector territories, stake 5% of the buy-in, 1 + pieces÷20 wins to capture, Chaos 5% | **Owner-approved: keep these values** |
| Capture model: battle wins earn attack progress; hidden deployment stays primary | **Owner-approved** |
| Short side only in challenges, fixed max loss, Bull/Bear for new users, virtual only | **Owner-approved** |
| Notification pictures (new-logo style, #120 design language) | **Owner-approved: don't redesign** |
| New logo direction | **Owner-approved: keep it everywhere** |
| Neutral territories (v1 item 2) | **Replaced** by §7 below, per the owner |
| Tie battles, visibility, eligibility, counterplay, declines, comebacks, rewards | **Proposed:** this version |
| **Section 9 (what to approve)** | **NOT approved: pending** |

## 1. War in one paragraph
A War is a Trade War match with a **map of sector territories** (owner-approved).
- Each player gets **100 pieces** and places them **in secret** during the claiming stage.
- When claiming ends, the server resolves every territory:
  - the most pieces owns it;
  - a **tie starts a tie battle** right away;
  - a territory nobody placed pieces on is **neutral**.
- Then **everyone sees who owns what** (never the piece counts).
- During the War, everyone trades their equal virtual buy-in. They can **attack** owned territories through Bull/Bear battles (once eligible), **defend** with a limited counter-move, and **claim** neutral territories.
- Territories earn **points**: battle-won land is worth more than a neutral claim. The most points at the end wins.

## 2. The map (owner-approved numbers)
- Territories are market sectors, each with a few stocks from the 30-stock list (Tech, Finance, Health, Energy, Consumer, Communication, Industrials, Index…).
- Map size:
  - 2–3 players: 6 territories;
  - 4–6 players: 8 territories;
  - 7–10 players: 10 territories.
- Players: min 2, max 10.
- No borders in the first version: any territory can be attacked.

## 3. Claiming stage and visibility ⚖️ (owner rule 1)
- **During claiming, nobody sees anyone else's choices.** You see only your own placement. **Owner-approved** (rule 1).
- Placement rules (from v1, unchanged):
  - place all 100 pieces;
  - leave at least 1 territory empty;
  - no more than 50 pieces in one territory.
  - Then **Lock in**; a locked placement can't change.
- **The claiming stage ends** when the War starts, either by the organizer pressing Start or at the lobby deadline (§8).
- **After claiming:** everyone sees each territory's **owner**, which ones are **neutral**, and which ones are **in a tie battle**. Players use that to choose whom to attack and which neutral land to claim.
- **Piece counts are never shown** to other players. **(Proposed:** not even after the War.)
- **Conflict with list D (enemy-presence warning):** the yes/no "Enemy presence" hint during placement would show part of opponents' choices, which rule 1 forbids.
  - **(Proposed:)** drop it during claiming.
  - Keep a different, safe hint after the reveal: "Contested: a tie battle is running here." See the open decision **W1**.
- **Storage (security):**
  - Placements live in `tradeWars/{id}/deploy/{uid}`: readable only by that player, written only by the server.
  - Totals are computed only inside the server's start transaction.
  - Rules tests will prove opponents can't read placements, and no notification or ticker line contains counts.

## 4. Tie battles ⚖️ (owner rule 2)
If the top claims on a territory tie, **a battle between the tied players starts at once.** The territory is never left unresolved. **Owner-approved** (rule 2); the details below are proposed.

**Two players tied:**
- **Stock:** the server picks one stock at random from the territory's list. Neither player chose it, so neither has an edge.
- **Sides:** the server flips a coin for who picks first. That player chooses Bull or Bear, and the other gets the opposite. They have 30 minutes to pick; otherwise the server picks at random.
- **Window:** the first full market hour of the War. If the War starts outside market hours, it's the first hour after the next open.
- **Stake (proposed):** no money is at stake. The players didn't choose this battle, so nobody loses virtual cash to an automatic event. Only the territory is decided.
- **Result:** the side that matches the price direction wins, even for a tiny move (there's no draw band, because the territory must be decided). If the price is exactly unchanged:
  - the player with the higher War return at that moment wins;
  - if that's still tied, whoever locked in first wins.

**Three or more players tied (proposed):** a "best pick" battle.
- Each tied player picks one stock from the territory's list and a side, all hidden until the window starts.
- The best result over the window wins, with the same tie-breakers.

**Ownership record:**
- The territory shows "Tie battle" until it's settled. Then `owners[territory]` becomes `{uid, since, how: "tie-battle"}`, and a line is added to the War's territory log (`tradeWars/{id}/territoryLog`, which players can read and only the server writes).
- The winner's defence on that territory = 1 + (their pieces there ÷ 20), the approved formula.

**The loser:**
- They get a **Redeploy pass** (proposed). Within the next trading day they can make **one attack without the eligibility check** (§5), **or one neutral claim that doesn't use their daily neutral limit** (§7). This fits the owner's "the loser must either challenge another player or claim a neutral territory".
- The pass expires after one trading day, so it can't be saved for later.

**Notifications:** "Tie on Tech! Battle vs Ana starts 9:30 am: Bull on NVDA (you picked)". Then: "You won Tech" / "Ana won Tech; you have a Redeploy pass".

## 5. Attacking an owned territory ⚖️ (owner rule 3)
The battle system is the same one used for tie battles, with a stake.

**Eligibility to attack (proposed):** both must be true.
1. **Money:** you have at least the stake in free War cash. The stake is **5% of the buy-in** (owner-approved), e.g. $500 on $10,000.
2. **Performance, one of these:**
   - your War account is **at or above its starting value** (return ≥ 0%); **or**
   - you **closed a winning trade of at least +1%** in this War during the last 2 trading days.

**Why these values:**
- The money rule is the approved stake, nothing new.
- The performance rule makes attacking something you earn by trading well, not something you can spam.
- The "winning trade" route keeps the door open for a player who is behind: they can earn an attack by trading well now.
- +1% is small enough for any active trader to reach in a day or two, but it can't be faked without a real profit.
- I'd set the final number after the first test Wars (open decision **W3**).

**The attack:**
- The attacker picks one stock from the territory's list and a side (Bull/Bear). The defender gets the opposite side. Both stakes are set aside.
- Window: 1 hour or until today's close (v1).
- Result: the side matching the move wins, with the v1 **draw band of 0.10%**. In a draw, both stakes are returned and nothing changes.

**Settlement:**
- The winner gets both stakes; the loser loses exactly their stake, never more.
- Money only moves between the two players, so the War's total doesn't change.

**Consequences:**
- **Attacker wins:** +1 attack progress. When progress reaches the defence (1 + pieces÷20, approved), the territory transfers.
- **Defender wins:** the attacker loses 1 progress (never below 0), and the territory stays.
- The new owner's defence = 1 + their own pieces there ÷ 20 (minimum 1).

**Limits (from v1):**
- 1 attack you started open at a time;
- at most 2 incoming;
- one open battle per territory;
- the same attacker → defender pair at most 3 times a day;
- no new attacks in the last hour;
- knocked-out or surrendered players can't take part.

**Ping-pong rule (proposed):** a player who just lost a territory can't attack it back for 1 trading day. This stops two friends trading land back and forth to farm points.

## 6. Defender counterplay ⚖️ (owner rule 4)
**The problem:** the attacker chooses the stock, the side and the moment. That's a real information edge, and the defender is stuck with the opposite side.

**Options I looked at:**
| Option | Fair? | Simple? | Verdict |
|---|---|---|---|
| Defensive bonus on the result (e.g. the defender wins draws or gets +0.5%) | Tilts every battle toward defenders and can make attacks pointless | Simple | No |
| Defensive resource (shields bought or earned) | Shields already exist in Whale mode; more currencies add confusion | Medium | No |
| A once-per-period counter-ability | Limited and a real choice | Simple | **Yes** |
| Contest the attack under conditions (re-vote, appeal) | Hard to make clear; risks endless loops | Complex | No |

**Recommendation: "Counter-pick", once per trading day per defender (proposed).**
- When attacked, the defender can **swap the stock** for any other stock in the same territory's list. The attacker keeps their side (Bull/Bear), and the window doesn't change.
- This takes away the attacker's cherry-picked stock without giving the defender a guaranteed edge. The defender must still read the market.
- **Once per trading day**, the attacker can't re-pick after a counter-pick, and there's only one swap per battle, so there's no endless back-and-forth.

**Against the owner's principles:**
1. **Skill matters:** both stock picks are skill.
2. **Defenders get a meaningful choice:** the counter-pick.
3. **Attackers get a real chance:** it's still a market call with no bonus against them.
4. **No guaranteed edge:** neither side starts ahead.
5. **Limited:** once a day, one swap, no loops.

## 7. Declining a challenge ⚖️ (owner rule 5)
**Policy (proposed):** discourage dodging without punishing absence.
- **Response deadline:** 2 market hours (v1). Only market hours count, so a challenge sent at night doesn't expire before the defender wakes up.
- **Reminder:** a notification 30 minutes before the deadline.
- **First decline each trading day: free.**
  - Nothing changes hands, the territory stays, and the attacker's stake is returned.
  - It doesn't count as a loss, and it doesn't use up the attacker's daily pair limit.
- **Further declines the same day: "Concede the round".**
  - The attacker gets +1 attack progress, as if they'd won, but **no stake money moves**.
  - It's **not** a loss on the defender's battle record. The attacker gets progress only, with no battle points or XP (this blocks friends using declines to farm).
  - The territory transfers only if the progress reaches the defence, exactly like a normal win. A decline never hands over the territory directly.
- **No answer by the deadline: auto-accept.**
  - The battle runs with the defender on the opposite side; the defender keeps their counter-pick unused.
  - This is fair to someone who's simply away: the result is a real market outcome, not a penalty, and the most they can lose is the fixed stake.
  - If the defender doesn't have the stake in cash, the battle runs with no money and only territory progress at stake.

## 8. Lobby and lifecycle (from v1, unchanged)
The stored statuses stay `lobby / active / ended / cancelled`, and a new `stage` field adds configuring, recruiting and ready. The app shows the new names.
- Start happens exactly once (one transaction with a guard).
- Lobby deadline: 1 h, 6 h, 24 h or 72 h. At the deadline it starts with the locked-in players if there are at least 2; otherwise it's cancelled and battle slots are returned.
- The organizer can Cancel up to the start; after that they're a normal player.
- Disconnecting is harmless: everything runs on the server.
- The existing slots, level locks, quiz lock and War lengths stay.

## 9. What to approve — **NOT APPROVED (pending the owner's explicit approval)**
1. Visibility (§3): hidden claiming, owners revealed after the start, counts never revealed; **W1**, the enemy-presence hint.
2. Tie battles (§4): random stock, coin flip for first side pick, no stake, no draw, tie-breakers, Redeploy pass for the loser, "best pick" for 3 or more players.
3. Attack eligibility (§5): stake in cash plus (return ≥ 0% or a +1% winning trade in the last 2 days); ping-pong rule.
4. Counterplay (§6): Counter-pick once per trading day.
5. Declines (§7): 1 free decline a day; after that a concession gives progress only; no answer means auto-accept; 30-minute reminder.
6. Comebacks and scoring (§10).
7. Neutral territories and rewards (§11).
8. Notifications (§12).
9. Squad rulesets (§13) and Chaos Simulator (§14), carried over from v1.

## 10. Comeback mechanics and leaderboard balance ⚖️ (owner rule 6)
**Ideas I looked at:**
| Idea | Effect | Verdict |
|---|---|---|
| Flat comeback bonus (free points or cash when behind) | Rewards losing; makes winning feel cheap | No |
| Rubber-band money (the leader's trades count less) | Punishes skill | No |
| Higher-risk underdog bets (bigger stakes for trailing players) | Can wipe out a trailing player faster; adds money rules | No |
| **Giant-slayer reward:** beating a higher-ranked player is worth more | Rewards skill and gives trailing players a target | **Yes** |
| **Leader exposure:** the top player can't hide (their territories can't be shielded by declines) | Stops snowballing without taking anything away | **Yes** |
| Points counted at the end, not banked early | Keeps every War alive until the last day | **Yes** |

**Recommendation (proposed):**
- **Giant-slayer:** win a battle against a player ranked **above** you on the War points table and you get **+1 bonus point**. Take a territory from the **current leader** and you get **+1 more**.
  - It only pays on a real win with a stake. Concessions and neutral claims never pay it.
- **Leader exposure:** the player currently 1st on points **can't use free declines**: every challenge to them is accepted or conceded. They keep their counter-pick, so they still have a real defence. Nothing is taken from them for being good.
- **Points are counted at the end** from the territories held then (§11), so a strong last day can change the result. No new attacks in the final hour (v1) keeps the finish clean.
- **Eligibility by trading (§5)** gives a trailing player a way back in by trading well, without a handout.

**Why it's balanced:**
- Leaders still earn the most by holding the most valuable land.
- Trailing players gain only by **winning real battles**, and they gain a little extra for beating stronger players.
- Nobody gets points for losing, and nobody's money is scaled.

## 11. Neutral territories, points and XP ⚖️ (owner rule 7; replaces v1 item 2)
**Neutral claim:**
- Any player can claim an available neutral territory with **no battle and no stake**: **1 neutral claim per trading day** (proposed); a Redeploy pass gives one extra.
- Eligibility: the same performance rule as attacking (§5), so it's earned.
- The claimer becomes the owner with defence 1.

**Points each territory is worth at the end (proposed):**
| How you hold it | Points |
|---|---|
| Neutral claim (never fought over) | **1** |
| Won at the start by hidden deployment (most pieces) | **2** |
| Won or **successfully defended** in a real battle (tie battle or attack, with a stake, or the no-stake tie battle) | **3** |

Giant-slayer bonuses (§10) come on top. **The winner is the player with the most points;** ties are broken by War return %, then by more battle wins.

**Neutral → contested:**
- The first time a battle is fought over a neutral-claimed territory, it becomes **contested**.
- If the owner defends it, it goes up to 3 points for them; if it's taken, it's worth 3 to the attacker.
- A territory taken through concessions only (§7) counts as 1 point (no real battle).

**XP (proposed; all through the existing server `xp_award` tables and daily caps):**
- neutral claim: 2 XP;
- winning a battle: 10 XP;
- successful defence: 10 XP;
- Giant-slayer: +5 XP;
- concessions and declines: 0.

**Anti-farming:**
- There's **no "release territory" action**, so you can't drop land and re-claim it.
- Points are counted once, at the end, from land held then. Changing hands mid-War doesn't pile up points.
- XP for a territory is paid **once per player per territory per War**: re-taking the same land pays no new XP.
- The ping-pong rule (§5), the pair limit of 3 a day, and no XP for concessions all apply.

## 12. Notifications and invitations (owner rule 8)
**Pictures:**
- The approved notification pictures are kept as they are.
- A new **"TERRITORY BATTLE"** picture in the same design language (new logo, "NEW ALERT"-style kicker), not a redesign.
- **The pictures carry no piece counts and no hidden information.**

**War notifications (each opens the battle with the right action):**
| Event | To | Example | Action |
|---|---|---|---|
| You were challenged / attacked | defender | "Ana is attacking your Tech territory: Bear on NVDA, $500, until 4:00 pm" | Accept · Counter-pick · Decline |
| Tie battle started | both | "Tie on Tech! Battle vs Ana at 9:30 am" | Pick your side |
| Challenge accepted / declined / conceded | attacker | "Ben accepted: battle on Tech is live" / "Ben declined (free decline)" | View |
| Response deadline in 30 min | defender | "30 min left to answer Ana's attack on Tech" | Respond |
| Auto-accepted at the deadline | both | "No answer: the battle on Tech is running" | View |
| Battle resolved | both | "You won on Tech: +$500, attack progress 2" / "You held Tech" | View |
| Territory won / lost | both | "Tech is yours" / "Tech fell to Ana" | View map |

Rules for all of these:
- Same inbox/bell and push system as today (`notify_users`, kind `battles`, inline actions like the existing Trade War challenge Accept/Decline).
- One notification per event per person; no duplicates.

**Invitations:** the three kinds the owner listed stay **separate flows**, because their actions differ. They already exist in the invite system (`functions/invites.py` kinds `battle`, `squad`, `join`, `coach`, plus direct challenges in `twInvites`).
| Invitation | Existing flow | What it must show | Actions |
|---|---|---|---|
| **Coaching** | `coach` invite (coach needs Level 3) | who invited you; "coach you" or "be your coach"; what that means (they can see your practice account's trades) | Accept · Decline |
| **Battle** | `battle` invite link / `twInvites` challenge | who; match name, buy-in, days, mode; that it uses a battle slot | Accept · Decline |
| **Team-up** | `squad` invite (and Team Cooperation teams later) | who; which squad/team; what joining means | Join · Decline |

Each card names the inviter, says what you're invited to, and offers only that flow's actions.

## 13. Squad rulesets (v1, unchanged; pending)
One match engine, with a `ruleset` setting:
- **Free-for-all:** classic.
- **Fantasy Draft:** the existing snake draft plus a timer and an optional ban phase.
- **Last Man Standing:** the existing `lms`, with explicit thresholds and realized losses only during the day, unless the host turns on "strict".
- **Team Cooperation:** the team score is the members' average return; teammates see each other's trades.

The app groups them as Together (Team Cooperation) and Compete (the other three).

## 14. Chaos Simulator (v1; 5% approved; the rest pending)
- A separate Solo mode with its own virtual $10,000.
- Generated wild charts on real timeframes (20% days), labelled "Simulated prices".
- Prices are made bar by bar on the server, so nobody can see ahead.
- **5% payout (owner-approved number)** to the Solo account when a session closes. **Proposed:** losses count at 5% too, and at most 1 paid session a day.

## 15. Conflicts with what exists or was decided before
| # | Conflict | Proposed resolution |
|---|---|---|
| C1 | List A said "ties stay neutral". | Rule 2 (newer, from the owner) wins: ties start a tie battle. |
| C2 | List D's enemy-presence warning during deployment vs rule 1 (no seeing opponents' choices while claiming). | Drop it during claiming; offer a safe after-reveal hint instead (**W1**). |
| C3 | v1 neutral challenges "against the market", with the stake removed. | Replaced by direct neutral claims (§11). |
| C4 | v1 "most territories wins". | Most **points** wins (§11), because rule 7 needs neutral land to be worth less. |
| C5 | Tie battles must start "immediately", but prices only move in market hours. | They start at once if the market is open, otherwise at the next open, with players notified right away. |
| C6 | Existing matches use `status` only; the War needs `stage`, `owners`, `deploy`, `territoryLog`, `challenges`. | New fields and sub-collections only; existing matches and the classic site are unaffected. |
| C7 | New XP sources. | Added to the server XP tables with daily caps (no client XP). |
| C8 | Existing Whale-mode Shield Tokens. | Not used in War (to keep one defence mechanic, the counter-pick). |
| C9 | Existing Trade War rules flag `shortSelling: False`. | Unchanged: Bull/Bear battles aren't share short selling; no shares are borrowed or sold. |

## 16. Acceptance criteria and tests (for Phases 11–13)
- **Visibility:**
  - rules tests: a player can't read another player's `deploy`, before or after the start;
  - the owners map appears only after the start;
  - no count appears in the events ticker, notifications or the territory log (payload tests).
- **Resolution:**
  - unit tests for highest-wins, 2-way and 3-way ties, and empty territories becoming neutral;
  - start happens once (a double Start or the deadline job running alongside Start changes nothing twice).
- **Tie battles:**
  - the random stock is from the territory's list;
  - the coin-flip pick and the 30-minute auto-pick work;
  - the no-draw rule and the tie-breakers are applied in order;
  - the Redeploy pass is given, then used or expired.
- **Attacks:**
  - eligibility in both directions (refused without the cash or the performance);
  - stake held then settled, zero-sum, and the loss never above the stake;
  - the 0.10% draw refunds both stakes;
  - progress and capture follow the approved formula;
  - the ping-pong rule and all limits are enforced.
- **Counter-pick:** only stocks from the territory's list, once per trading day, the attacker can't re-pick, one swap per battle.
- **Declines:**
  - the free decline returns the stake and counts no loss;
  - the second decline concedes progress only, with no money, points or XP;
  - no answer means auto-accept;
  - the reminder is sent once, 30 minutes before;
  - only market hours count toward the deadline.
- **Scoring:**
  - 1 / 2 / 3 points by how the land is held;
  - Giant-slayer only on real wins;
  - the leader can't use free declines;
  - tie-breakers for the winner.
- **Anti-farming:** no release action; territory XP once per player per territory per War; concession-only land is worth 1 point.
- **Notifications:** one per event per person; the right action buttons; never counts; push picture uses the approved design.
- **Invitations:** coaching, battle and team-up cards show who, what and the right actions; accepting one doesn't trigger another flow.
- **Every PR:** lint, typecheck, unit, build, Playwright phone and desktop with axe, rules tests, functions e2e; screenshots or video for the owner.
