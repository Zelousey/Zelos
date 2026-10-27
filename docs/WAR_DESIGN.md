# War, challenges, Squad rulesets and Chaos Simulator: design for approval

**Version 3.1 (2026-10-27): v3 plus the owner's answers to D1–D10 and the leftovers.**
**Status: DRAFT. Not approved as a whole.** The owner approved some decisions one by one (§0). The whole
specification, including **Section 9**, stays **pending** until the owner explicitly approves it. No code until then.
It belongs with `AGENTICTRADING_MASTER_SPEC.md`, ADDENDUM 2026-10-27, §4b and §4c.

**How to read the labels:**
- **Owner-approved:** the owner decided it. Don't change it without a specific, written reason.
- **(proposed):** my recommendation, waiting for the owner.
- **(explore):** the owner asked for options, not a final rule.
- ⚖️ marks anything that affects fairness, money/accounting or security.

## 0. Approval status
| Item | Status |
|---|---|
| v1 numbers: 100 pieces (now "soldiers"), 2–10 players, sector territories, map 6/8/10, stake 5% of the buy-in, capture after 1 + soldiers÷20 wins, Chaos 5% | **Owner-approved** |
| Capture model; Bull/Bear short side only in battles, with a fixed max loss | **Owner-approved** |
| Notification pictures; new logo | **Owner-approved** |
| W1 Ownership hidden during claiming; enemy-presence warning without revealing positions or strength | **Owner-approved** (the details in §3 are proposed) |
| W1 Pay to conceal positions; bonus points and hints for valuable stocks | **(explore)**: §3 |
| W2 Ties trigger a battle (now, or at the next open); no money at stake; **the winner gets a bonus** | **Owner-approved** (the bonus amount is proposed) |
| W2 Not too granular; soldiers give an advantage but contested spots are still battled | **Owner direction**: design in §4 |
| W3 1% qualifying winning trade | **Owner: provisional** (definition in §5) |
| W4 Counter-pick | **Owner-approved** |
| W5 Decline policy | **Owner-approved** |
| W6 Comeback rules | **Owner-approved** |
| W7 Neutral-territory rules and reduced rewards | **Owner-approved** |
| W8 Notification updates and invitation types | **Owner-approved** |
| W9 Soldiers: show your counts; losing costs soldiers; capturing earns soldiers | **Owner direction**: terms and balance in §6 (proposed) |
| W10 Redeploy pass | **Owner-approved** |
| W11 Chaos Mode rules | **Owner-approved** |
| W12 Chaos losses count in the 5% rule, with one paid session | **Owner-approved**: exact accounting in §14 |
| Victory mainly from good trading; Respect / Battle Level; more uses for resources; fast matches | **Owner direction**: §10, §17–§19 (proposed) |
| Real-market vs always-on simulated market | **Not decided:** both options kept (§20) |
| XP values (v2 "W8": neutral 2, win 10, defence 10, Giant-slayer +5) | **Still open:** the owner's "W8" approved notifications, not these (see §21) |
| Ping-pong rule (v2 "W11") | **Still open:** the owner's "W11" approved Chaos, not this (see §21) |
| D1 "Heavy enemy presence" (30+) | **Owner-approved** |
| D2 Camouflage paid in soldiers (5 each, max 2), not tokens | **Owner-approved** |
| D3 Hot zones | **Owner-approved** |
| D4 Contested margin 80% + Command | **Owner-approved** |
| D5 Name "Soldiers" | **Owner-approved** |
| D6 Everyone starts every War with the same soldiers (no carry-over) | **Owner-approved** |
| D7 War Score 60% trading / 40% strategy, −10%…+10% scale | **Owner-approved** |
| D9 Name: **"Battle Level"** (for now) | **Owner-approved** |
| Soldier numbers (+10 / +5 / +3 / −5 / retreat at half), contested-win bonus (+5 soldiers, +1 point), Rally (15 soldiers) | **Owner-approved** |
| XP amounts (neutral 2, win 10, defence 10, Giant-slayer +5) | **Owner-approved** |
| One-day wait before attacking back land you just lost | **Owner-approved** |
| Paying tokens to skip or shorten that wait | **Owner direction**: price and limits open (§5, decision E2) |
| War length: no longer than a week | **Owner-approved** (§8) |
| Chaos: "a week at most" | **Owner answer**: read as a session lasting up to 7 days (§14, decision E3 to confirm) |
| D10 Market mode | **Not decided.** The owner is leaning towards a **simulated War zone**; pros and cons are in §20 |
| **Section 9 / the whole specification** | **NOT approved: pending** |

## 1. War in one paragraph
A War is a short Trade War match (1–5 trading days, proposed) with a **map of sector territories**.
- Each player gets **100 soldiers** and places them **in secret** during claiming. An **enemy-presence** warning hints where rivals are, without saying who or how many.
- When claiming ends, the server resolves each territory:
  - a **clear lead** takes it;
  - **close or tied** claims go to a **contested battle**, where more soldiers gives an advantage but not the win;
  - empty territories are **neutral**.
- Owners are then revealed (counts stay private; you always see your own).
- Players trade their equal virtual buy-in, attack and defend through Bull/Bear battles, claim neutral land, and win or lose soldiers.
- **The final War Score is mostly trading performance (60%) plus strategy (40%: territory points).**
- A persistent **Respect** level grows across Wars.

## 2. The map (owner-approved)
- Sector territories (Tech, Finance, Health, Energy, Consumer, Communication, Industrials, Index…), each with stocks from the 30-stock list.
- 2–3 players: 6 territories; 4–6 players: 8; 7–10 players: 10. Min 2, max 10 players. No borders in the first version.

## 3. Claiming, visibility, warnings and concealment ⚖️
**Placement (from v1):**
- all 100 soldiers;
- at least 1 territory left empty;
- at most 50 soldiers in one territory;
- then **Lock in**.

**Hidden during claiming (owner-approved):**
- Nobody sees opponents' placements or the owners until claiming ends.
- **You always see your own soldiers**, per territory and in total (owner W9).

**Enemy-presence warning (owner-approved; details proposed):**
- While placing, a territory shows **"Enemy presence"** when at least one *locked-in* opponent has soldiers there.
- It shows no names and no numbers. It updates only when someone locks in, so it never reveals who is still deciding.
- Each player's warnings are worked out on the server and written where only that player can read them.
- **Proposed:** a second level, **"Heavy enemy presence"**, when the opponents' total there is 30 or more. It's coarse, so it doesn't reveal exact strength. Open decision **D1**.

**Concealment (explore) ⚖️:** the owner asked whether players could spend coins to hide their positions.
| Option | What it does | Fairness | Recommendation |
|---|---|---|---|
| A. Spend **tokens** (bought with real money) | Your soldiers on one territory don't trigger others' warnings | **Pay-to-win**: it breaks the master rule "preserve equal starting capital / fair competition"; the App Store and players may see it as buying an advantage | **No** |
| B. Spend **soldiers** (earned in the match) | "Camouflage": spend 5 soldiers from your 100 to hide one territory from warnings (max 2 territories) | Same price for everyone; it's a real trade-off (5 fewer soldiers) | **Yes (proposed)** |
| C. Free, once per War | One hidden territory each | Fair, but no decision cost | Fallback |

Open decision **D2**.

**Valuable stocks: bonuses and hints (explore; proposed):**
- **Hot zones:** before claiming, and each trading day, the server marks the **1–2 territories** whose stocks are moving most (from public market data: biggest % move or volume vs normal). Each shows a short hint, e.g. "Hot zone: NVDA +6% on earnings".
- Holding a Hot zone at the day's close is worth **+1 territory point**, and winning a battle there is worth **+1 more**.
- The hints come from market data only, never from opponents' choices.
- Open decision **D3**.

## 4. Resolving claims: clear wins vs contested battles ⚖️ (owner W2)
The owner doesn't want a single soldier's difference to decide ownership automatically.

**Rule (proposed):**
- **Clear win:** the leader has **more than 25% more soldiers** than the runner-up there (e.g. 40 vs 31), and owns it outright.
- **Contested:** the runner-up has **at least 80% of the leader's soldiers** (e.g. 40 vs 32, or an exact tie). The territory goes to a **contested battle**. With 3 or more players within the margin, it's a "best pick" battle (v2).
- **Neutral:** nobody placed soldiers there.
- The margin (80%) is open decision **D4**.

**Contested battle (the v2 tie battle, updated):**
- **When** (owner-approved): immediately if the market is open, otherwise at the next open, depending on the final timing system (§20).
- **Stock:** random from the territory's list.
- **Soldiers give an advantage, not the win:** the player with more soldiers there gets **Command**. They choose Bull or Bear first and win if the price is exactly unchanged. With equal soldiers, a coin flip decides Command. The market still decides the battle.
- **Money:** none at stake (owner-approved).
- **Draws:** no draw. The side matching the price direction wins, even for a tiny move. If the price is exactly unchanged, Command wins.
- **Winner's bonus** (owner-approved; amounts proposed): **+5 soldiers** to their reserve and **+1 territory point**, on top of the 3 points for battle-won land.
- **Loser:** they get the **Redeploy pass** (owner-approved, v2): one attack without the eligibility check, or one extra neutral claim, within the next trading day.
- **Ownership record:**
  - The territory shows "Contested" until it's settled.
  - Then `owners[territory] = {uid, since, how: "contested-battle"}`, and a line is added to `tradeWars/{id}/territoryLog` (players can read it; only the server writes it).
  - Both players' soldiers there stay; the defence uses the owner's soldiers (1 + soldiers÷20).

## 5. Attacking an owned territory ⚖️ (v2, with the W3 definition)
**Eligibility:**
1. You have the **stake (5% of the buy-in)** in free War cash.
2. **And** one of these:
   - your War return is ≥ 0%; **or**
   - you made a **qualifying winning trade** in the last 2 trading days.

**Qualifying winning trade (W3, provisional 1%):**
- The existing code counts a **"win"** as any sale above your average buy price, of any size, with no percentage (`tw_apply_trade`: `gain > 0`). That stat stays as it is.
- A *qualifying* winning trade is new and stricter, used only for War eligibility: **a sale in this War at least 1% above your average buy price for those shares, after any trading fee** (e.g. a storm fee). Partial sales count on the shares sold.
- The 1% is provisional and should be tuned after test Wars.

**The battle:**
- The attacker picks a stock from the territory and a side; the defender gets the opposite side and may use **Counter-pick** (owner-approved).
- Stakes are held; the window is 1 hour or until the close; the draw band is 0.10%.
- The winner takes both stakes; nobody can lose more than their stake (owner-approved).
- Progress, capture and the defence formula (1 + soldiers÷20) are owner-approved.
- Soldiers won and lost are in §6.

**Limits (v2):**
- 1 attack you started open at a time; 2 incoming at most;
- one battle per territory;
- the same attacker → defender pair at most 3 a day;
- no new attacks in the last hour.
- **One-day wait (owner-approved):** you can't attack back land you just lost for 1 trading day (1 day in a simulated War).
- **Skip the wait with tokens (owner direction; price and limits open, E2) ⚖️:**
  - Proposed: once per War, at a price the owner sets; it only shortens the wait and gives no other advantage.
  - It's the one place tokens touch a War, so it's labelled clearly and logged in the token ledger.
  - It's hidden on iOS until Apple in-app purchase exists (tokens can't be bought there yet).

## 6. Soldiers (owner W9; terms and balance proposed) ⚖️
- **Name:** **Soldiers** (owner-approved, D5).
- **What you see:** your soldiers on each territory, your **reserve** (soldiers not on the map), and your total. Opponents' counts stay hidden (the W1 principle).
- **Start:** 100 each (approved), all placed during claiming, so the reserve starts at 0.

**Earning soldiers (proposed):**
- capture a territory: **+10**;
- win a contested battle: **+5**;
- successful defence: **+3**.

**Losing soldiers (proposed):**
- lose a battle: **−5** (taken from that territory if you have soldiers there, otherwise from your reserve; never below 0);
- lose a territory: the soldiers left there **retreat to your reserve at half** (rounded down).

**Reinforce:** once per trading day, move reserve soldiers onto your own territories. This is hidden from others and raises the defence (1 + soldiers÷20, approved).

**Within one War only (proposed):**
- Soldiers don't carry over to the next War.
- Carrying them over would break the master rule of an **equal start** for every player. The persistent progress is **Respect** (§17), which gives no power inside a match.
- **Owner-approved (D6):** everyone starts every War with the same 100 soldiers, and nothing carries over.

**Balance check:**
- Captures pay more than losses cost, so attacking is worth it.
- A captured territory only takes the attacker's own soldiers there as its defence, so a new owner is fragile until they reinforce. That keeps the map moving without a runaway leader.

## 7. Declines (owner-approved, v2)
- The defender has 2 market hours to answer, with a reminder at 30 minutes.
- The first decline each trading day is free.
- Later declines concede 1 progress only: no money, points, XP or soldiers.
- No answer means auto-accept.
- The leader (1st on War Score) gets no free declines (W6).

## 8. Lobby and lifecycle (v2; length shortened, proposed)
- The stored statuses stay `lobby / active / ended / cancelled`, with a new `stage` (configuring, recruiting, ready). Start happens once.
- **War length (owner: no longer than a week):** **1, 2, 3 or 5 trading days** on the real market; **1, 2, 3, 5 or 7 days** in a simulated War zone. Normal Battles keep their lengths.
- **Lobby deadline (proposed):** 1 h, 6 h or 24 h (72 h dropped).
- At the deadline it starts with the locked-in players if there are at least 2; otherwise it's cancelled and battle slots are returned. The organizer can cancel before the start.

## 9. What to approve — **NOT APPROVED (pending the owner's explicit approval of the whole revised spec)**
The individually approved items are in §0. Still needed:
1. **D10** (market mode), **E1–E3** (spec §4d), and the token wait-skip.
2. The War Score formula (§10).
3. Soldiers economy (§6).
4. Respect (§17).
5. Resource uses (§18).
6. War length (§8).
7. Then a final "approve the revised specification".

## 10. Scoring: mostly trading, plus strategy ⚖️ (owner: "victory should primarily reward good trading")
**War Score (0–100, proposed) = 60% Trading + 40% Strategy.**
- **Trading (0–100):** your War return, on a straight scale: **−10% → 0, 0% → 50, +10% → 100** (capped at both ends). It uses the size of your return, not your rank, so a 0.1% edge isn't a big jump.
- **Strategy (0–100):** your territory points ÷ the highest territory points in the War × 100.
  - Territory points (owner-approved W7): neutral 1, deployed 2, battle-won or defended 3.
  - Plus Hot zones, Giant-slayer (W6) and the contested-battle winner's bonus.
- **Example:** a +6% trader holding half the leader's land scores 60%×80 + 40%×50 = **68**. A −2% trader holding the most land scores 60%×40 + 40%×100 = **64**. Good trading wins, but land still matters.
- **Ties:** higher return %, then more battle wins.
- The 60/40 split and the ±10% scale are open decision **D7** (to tune after test Wars).
- **Comeback rules (owner-approved W6) still apply:** Giant-slayer bonuses, the leader can't use free declines, and points are counted at the end.

## 11. Neutral territories (owner-approved W7)
- Claim with no battle and no stake: **1 a day** (the Redeploy pass gives one extra). The same eligibility as attacking.
- Worth 1 point; it becomes contested after its first battle. A defended or captured territory is worth 3.
- **Anti-farming:**
  - no release action;
  - territory XP once per player per territory per War;
  - land taken only through concessions is worth 1 point.

## 12. Notifications and invitations (owner-approved W8)
- **Pictures:** the approved ones, plus a "TERRITORY BATTLE" picture in the same style. No counts on any picture.
- **War events:**
  - challenged / attacked;
  - contested battle starting (with "pick your side" when you have Command);
  - accepted / declined / conceded;
  - 30 minutes to the deadline;
  - auto-accepted;
  - resolved;
  - territory won / lost;
  - soldiers gained or lost;
  - a new Hot zone (one a day at most).
- **Invitations:** coaching, battle and team-up stay separate flows (existing invite kinds `coach`, `battle`, `squad`, plus `twInvites`). Each card says who, what, and only that flow's actions.

## 13. Squad rulesets (v1; pending)
One engine with a `ruleset` setting: Free-for-all, Fantasy Draft (draft + timer + optional bans), Last Man Standing (explicit thresholds, realized losses during the day unless "strict"), Team Cooperation (average return; teammates see trades).

## 14. Chaos Simulator (owner-approved W11, W12): exact accounting ⚖️
- A separate Solo mode with generated wild prices on real timeframes, labelled "Simulated prices". Prices are made bar by bar on the server.

**Session:**
- Each session starts a fresh **$10,000 Chaos account**, separate from Solo Real Market.
- One open session at a time.

**Paid session:** the **first session you close each day** (New York calendar day) is the paid one. Later sessions that day are practice: no transfer.

**Settlement of the paid session:**
- Result = final Chaos account value − $10,000.
- **5% of the result** goes to your Solo Real Market account's **cash**:
  - a profit adds to cash; a **loss is taken from cash** (owner W12);
  - rounded to the cent;
  - a loss can't push Solo cash below $0. If cash is short, only what's there is taken; nothing else is sold.
- **One ledger line** in the Solo account history: "Chaos session: +$X / −$X (5% of +$Y / −$Y)".
- Idempotent per session: it can't be paid twice.

**No dodging:**
- A session left open closes automatically at the end of its day **and still counts** as that day's paid session if it's the first.
- Abandoning a losing session therefore doesn't avoid the 5% loss.

XP: normal trade XP within the existing daily caps.

**Session length (owner: "a week at most"):** read as **a Chaos session can stay open for up to 7 days**. Confirm with **E3**.
- If that reading is right, a session ends when you close it or **automatically after 7 days, and it still counts**, so a loss can't be dodged.
- Payment happens on the day it closes, still at most one paid close a day.

## 15. Conflicts with earlier rules or code
| # | Conflict | Resolution |
|---|---|---|
| C1 | List A: "ties stay neutral" | Replaced: ties and close claims go to a contested battle (owner W2). |
| C2 | v2 proposed dropping the enemy-presence warning | Reversed by the owner (W1): the warning stays, without names or numbers. |
| C3 | v1 neutral challenges against the market | Replaced by direct neutral claims (W7). |
| C4 | v2 "most points wins" | Replaced by the War Score: 60% trading + 40% strategy (owner direction). |
| C5 | "Immediately" vs market hours | Now if open, else at the next open; it depends on the market-mode decision (§20). |
| C6 | New War fields (`stage`, `owners`, `deploy`, `territoryLog`, `challenges`, soldiers) | Added only; old matches and the classic site are unaffected. |
| C7 | New XP sources | Server XP tables with daily caps; values still open (§21). |
| C8 | Whale-mode Shield Tokens | Not used in War. |
| C9 | `shortSelling: False` | Unchanged: Bull/Bear battles aren't share short selling. |
| C10 | Existing "wins" = any profitable sale | Kept; the 1% "qualifying win" is a new, separate War rule (W3). |
| C11 | "Spend coins to conceal" vs the master rule of equal starting capital and fair competition | Recommend spending soldiers, not tokens (D2). |
| C12 | Persistent soldiers vs an equal start | Soldiers stay within one War; Respect is the persistent part (D6). |
| C13 | Existing War/Battle lengths 1/3/7/14/30 days vs "fast matches" | War uses 1/2/3/5 trading days; Battles unchanged. |
| C14 | The checklist's §26/§36 "Trader Reputation: separate from XP, based only on actual statistics" | Respect is War-only and earned only from real results, so it fits as part of reputation (D9). |
| C15 | Always-on simulated market vs "real market data" rules and labels | Kept as an option only; it must be labelled simulated and use server-generated prices (§20). |

## 16. Acceptance criteria and tests
**Everything from v2, plus:**
- **Warnings:**
  - only from locked-in opponents, with no names or numbers;
  - Camouflage hides it;
  - rules tests show a player can read only their own warnings.
- **Clear vs contested:**
  - unit tests at the 80% and 125% edges, exact ties, and 3-way contests;
  - Command goes to the player with more soldiers, or a coin flip when equal.
- **Contested battle:** no money; no draw; the winner gets +5 soldiers and +1 point; the loser gets the Redeploy pass.
- **Qualifying win:** ≥ 1% after fees on the shares sold, within 2 trading days; the old `wins` stat is unchanged.
- **Soldiers:**
  - +10 / +5 / +3 and −5 never go below 0;
  - the retreat at half;
  - reinforcing once a day, hidden;
  - the defence recalculates.
- **War Score:** the formula, the caps at −10% and +10%, the 60/40 weights, the tie-breakers.
- **Hot zones:** at most 2 a day, from market data only; the points are added once.
- **Chaos:**
  - only the first close of the day pays;
  - gains and losses at 5%;
  - Solo cash never below 0;
  - one ledger line; no double pay;
  - an abandoned session auto-closes and counts.
- **Respect:** only real results add to it; there's no in-match effect.
- **Every PR:** lint, typecheck, unit, build, Playwright phone and desktop with axe, rules tests, functions e2e; screenshots or video.

## 17. Respect: persistent battle progression (explore; proposed)
- **Name:** **Respect**, with ranks Recruit → Soldier → Sergeant → Captain → Commander → General. "Battle Level" is the alternative name (D9).
- **Earned only from real results:**
  - battle win +3;
  - successful defence +3;
  - capture +5;
  - Giant-slayer +2;
  - War win +10;
  - top 3 +5.
- **Never lost** (proposed), so nobody is punished for trying. Concessions and neutral claims give none.
- **No power inside a match** (an equal start). It shows as a badge on profiles and leaderboards, and could unlock cosmetic map skins and frames and later matchmaking.
- Server-written, like XP. It's separate from XP and fits the checklist's Trader Reputation (§26/§36).

## 18. More uses for earned resources (explore; proposed)
| Resource | Uses |
|---|---|
| **War cash** (the trading account) | Trading; the **battle stake** (attacking costs money at risk). |
| **Soldiers** | Defence; **Reinforce**; **Camouflage** (5 each, §3); **Rally**: spend 15 reserve soldiers for **one extra attack** that day (max 1 a day). |
| **Territory points** | The score only: they can't be spent, so the score stays honest. |
| **Respect** | Cosmetics and badges outside matches. |
| **Tokens** | Not used for any in-match advantage (fairness); existing slots and revives are unchanged. |

## 19. Keeping matches fast (proposed)
- Wars run 1, 2, 3 or 5 trading days.
- Lobby deadlines are at most 24 h; defenders have 2 market hours to answer.
- Hot zones refresh daily, and Reinforce and the neutral claim reset daily, so there's always something to do.
- The final-hour freeze keeps the finish clean.

## 20. Market mode: NOT DECIDED (both options kept; the owner is leaning towards a simulated War zone)
| | **A. Real market** | **B. Always-on simulated market** |
|---|---|---|
| Prices | Real (Marketstack), market hours only | Generated on the server (the Chaos engine, calmer settings), 24/7 including nights and weekends |
| Battles and ties | During market hours; at the next open otherwise | Any time, immediately |
| Pace | Pauses overnight and on weekends | Always moving; good for fast Wars |
| Skill | Real-market trading skill | Game skill on realistic but simulated prices |
| Must | Use existing quotes within the Marketstack cap | Be labelled "Simulated prices"; the same prices for every player; no peeking ahead |

One possibility is an organizer setting per War. **Both stay in the specification until the owner decides (D10).**

**Pros and cons (for the owner's decision):**
| | Real market | Simulated War zone |
|---|---|---|
| Activity | Quiet nights and weekends; battles wait for the open | **Always on**: battles any time, so more activity (the owner's point) |
| Speed | 5 trading days = a full week | 7 days really is 7 days of play; Wars feel faster |
| Learning | What you learn works on the real market (what Trading 101 promises) | Game skill; less transfer to real trading |
| Fairness and security | Prices nobody controls | The server makes the prices; the method must stay secret and the prices can't be seen ahead (same as Chaos) |
| Cost | Uses the Marketstack quota | **No data cost** |
| Hot zones | From real market news | From simulated events instead |
| Misleading-price risk | None | **Fake prices on real company names (e.g. "NVDA +20%") could confuse people or look like real news.** Recommendation: use **made-up companies per sector** (e.g. "Voltex Energy"), or clearly marked "SIM-" tickers |
| Night-time | No issue | Needs **quiet hours**: no push at night, and response deadlines pause overnight in each player's time zone |
| Deadlines | 2 market hours | Would become 2 hours, paused in quiet hours |

**If simulated is chosen (the owner's lean):** War zone = simulated; Solo Real Market and normal Battles stay on real prices; Chaos and the War zone share one price engine.

## 21. Leftovers from v2 (resolved 2026-10-27)
The XP amounts and the one-day wait are now **owner-approved**. The text below is kept for history.
The owner's answers used the W-numbers differently from my v2 list:
- v2 **W8** was **XP values**, but the owner's W8 approved notifications. → The XP values are **still open**: neutral 2, battle win 10, defence 10, Giant-slayer +5, all within the daily caps.
- v2 **W11** was the **ping-pong rule**, but the owner's W11 approved Chaos. → The ping-pong rule is **still open**: you can't attack back land you just lost for 1 trading day.
