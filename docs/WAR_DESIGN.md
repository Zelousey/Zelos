# War, challenges, Squad rulesets and Chaos Simulator: design for approval

**Version 3.5 (2026-10-29): APPROVED.** The owner approved the whole specification on 2026-10-29 ("approve it all"),
including the details marked *(proposed)*: Battle Level (§17), resource uses (§18), War lengths 1/2/3/5/7 days (§8),
lobby deadlines 1/6/24 h (§8), the realm (§24) and Section 9. Owner also decided (2026-10-29): **War stays hidden from
players until all of it is built** (admins can preview it), and **stored statuses keep their names**
(`lobby/active/ended/cancelled`) with friendlier labels on screen (master spec Q13). Small details still get checked
with the owner as they come up.
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
| W11 Chaos Mode rules | Approved, then **redefined by the owner** (see Chaos below) |
| W12 Chaos losses count in the 5% rule, with one paid session | **Superseded** (to confirm, E3): there are no Chaos sessions any more, so there's no 5% payout |
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
| Chaos | **Owner, redefined:** Chaos isn't a separate Solo mode; it's **wild-market events inside the simulated War zone** (e.g. weekends). §14 |
| D10 Market mode | **Owner-decided:** **War mode only** runs on a **simulated, always-on market** for up to 7 days. Every other mode (Solo, head-to-head and other Battles, Squads) stays on **real prices**. §20 |
| Quiet hours | **Owner-approved:** no night-time notifications; overnight moves are reported in the morning; battles against a sleeping player wait until they're awake. §22 |
| Company names in the War zone (E1) | **Owner-approved:** made-up companies under real sector names |
| Skip the one-day wait (E2) | **Owner-approved: 100 tokens** |
| E3 The Solo Chaos mode, 5% payout and paid sessions are dropped | **Owner-approved** |
| E4 Chaos event rules; E5 quiet hours | **Owner-approved** |
| E6 Squads stay on real prices; they compete against other squads, for a leaderboard place, or both | **Owner-approved** |
| A separate Trade War realm (§24), F1–F8 | **Owner-approved (2026-10-27: "everything sounds good")**, incl. **C18**: level armies (max 150) in open zones, equal armies the default in private Wars |
| **Section 9 / the whole specification** | **Owner-approved 2026-10-29** |

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
- A persistent **Battle Level** grows across Wars.

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
- Carrying them over would break the master rule of an **equal start** for every player. The persistent progress is **Battle Level** (§17), which gives no power inside a match.
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
- **War length (owner):** the War zone is simulated and always on, so Wars run **1, 2, 3, 5 or 7 days** (never longer than a week). Normal Battles keep their lengths and real prices.
- **"Per day" limits in a War** (free decline, neutral claim, Reinforce, Counter-pick, Rally, the one-day wait) use **War days**: 24-hour periods counted from the War's start.
- **Lobby deadline (proposed):** 1 h, 6 h or 24 h (72 h dropped).
- At the deadline it starts with the locked-in players if there are at least 2; otherwise it's cancelled and battle slots are returned. The organizer can cancel before the start.

## 9. What to approve — **APPROVED by the owner on 2026-10-29 (the whole revised spec)**
The individually approved items are in §0. Still needed:
1. **E1–E6** (spec §4e).
2. The War Score formula (§10).
3. Soldiers economy (§6).
4. Battle Level (§17).
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

## 14. Chaos: wild-market events inside the War zone (owner, redefined)
**What Chaos is now:** not a separate mode or session, but **random wild-market events** in the simulated War zone, when the market suddenly "goes crazy". Moves of 10–20% replace the normal 1–2%.

**Proposed rules:**
- **When:** on random days, more often on **weekends** ("Chaos Weekend"). At most **1 event a day**, lasting **1–3 hours**.
- **Warning:** every player gets a heads-up **30 minutes before** ("Chaos incoming: Energy in 30 min"), unless they're in quiet hours. Then it's in their morning summary.
- **Scope:** one territory's stocks, or the whole market.
- **Fairness:**
  - every player sees the same prices at the same time;
  - the server makes the prices bar by bar;
  - nobody can see ahead;
  - when and how big each event is gets decided on the server and stays secret until it's announced.
- Chaos events also create **Hot zones** (§3): the stocks a Chaos event hits become hot.
- Battles running during a Chaos event are allowed. Both sides face the same wild prices, so it stays fair, just riskier.

**What this replaces (to confirm, E3):**
- the separate **Solo Chaos Simulator** (list B's "Solo: Real Market / Chaos Simulator");
- the **5% payout to Solo**;
- the **one paid session a day**.

The Solo section becomes Real Market only.

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
| C12 | Persistent soldiers vs an equal start | Soldiers stay within one War; Battle Level is the persistent part (D6). |
| C13 | Existing War/Battle lengths 1/3/7/14/30 days vs "fast matches" | War uses 1/2/3/5 trading days; Battles unchanged. |
| C14 | The checklist's §26/§36 "Trader Reputation: separate from XP, based only on actual statistics" | Battle Level is War-only and earned only from real results, so it fits as part of reputation (D9). |
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
- **Simulated War zone:**
  - every player in a War gets identical prices;
  - no future bars reach a browser (rules and payload tests);
  - the SIMULATED marking is on every War screen, chart, notification and share image.
- **Chaos events:** at most 1 a day; the 30-minute warning (or the morning summary in quiet hours); they create Hot zones.
- **Quiet hours:**
  - no push during them, and one morning summary;
  - attacks on a sleeping player are queued, and their deadline is paused;
  - quiet hours are capped at 10 hours;
  - contested battles start only when everyone involved is awake.
- **Battle Level:** only real results add to it; there's no in-match effect.
- **Every PR:** lint, typecheck, unit, build, Playwright phone and desktop with axe, rules tests, functions e2e; screenshots or video.

## 17. Battle Level: persistent battle progression (name owner-approved, D9; details proposed)
- **Name:** **Battle Level** (owner, for now), with ranks Recruit → Soldier → Sergeant → Captain → Commander → General.
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
| **Battle Level** | Cosmetics and badges outside matches. |
| **Tokens** | Not used for any in-match advantage (fairness); existing slots and revives are unchanged. |

## 19. Keeping matches fast (proposed)
- Wars run 1, 2, 3 or 5 trading days.
- Lobby deadlines are at most 24 h; defenders have 2 market hours to answer.
- Hot zones refresh daily, and Reinforce and the neutral claim reset daily, so there's always something to do.
- The final-hour freeze keeps the finish clean.

## 20. Market mode: DECIDED by the owner (2026-10-27)
| Mode | Prices |
|---|---|
| **War (territories)** | **Simulated, always on**, 24/7, up to 7 days, with Chaos events |
| Solo, head-to-head and other Battles, Squads, everything else | **Real market prices**, as today |

**Why (the owner's reasons):**
- a simulated War zone keeps players coming back, and nights and weekends aren't dead time;
- it also costs nothing in price data.

**Must be obvious to players** (the owner asked for this):
- The War zone looks different: a **"SIMULATED WAR ZONE"** badge on every War screen and chart, and a different chart background.
- Before the first War, a one-time explainer: "Prices in the War zone are simulated. For real-market trading, go head to head in Battles or trade Solo." It has a link to Battles.
- **Every War notification says it's simulated**, and nothing in the War zone uses the word "live".
- Real-market screens stay exactly as they are.

**Price engine:**
- One server engine makes realistic prices for each War zone stock: normal days, trends, and Chaos events.
- The same prices go to every player in that War.
- The settings and the random seed stay secret on the server.
- Stocks start from realistic levels so the charts look natural.

**Conflict C17:** the checklist's Trade War chart and live-price items (§3, §13; FMP/live data). They still apply to **Battles**, which stay on real prices. The War zone is a new mode that is simulated on purpose, by the owner's decision.

## 21. Leftovers from v2 (resolved 2026-10-27)
The XP amounts and the one-day wait are now **owner-approved**. The text below is kept for history.
The owner's answers used the W-numbers differently from my v2 list:
- v2 **W8** was **XP values**, but the owner's W8 approved notifications. → The XP values are **still open**: neutral 2, battle win 10, defence 10, Giant-slayer +5, all within the daily caps.
- v2 **W11** was the **ping-pong rule**, but the owner's W11 approved Chaos. → The ping-pong rule is **still open**: you can't attack back land you just lost for 1 trading day.

## 22. Quiet hours (owner-approved; details proposed)
- **Default quiet hours:** 10 pm–8 am in each player's local time. They can be changed in Settings, but **are never longer than 10 hours** a day, so nobody can hide from battles forever.
- **During quiet hours:**
  - no push notifications;
  - the War keeps running, and anyone awake can still trade.
- **Morning summary:** when your quiet hours end, you get **one notification** listing what happened overnight, e.g. "While you slept: Ana attacked Tech (waiting for you), Chaos hit Energy, you're now 3rd."
- **Battles wait for the defender:**
  - An attack on a player in quiet hours is **queued**. It starts when their quiet hours end.
  - The 2-hour answer time counts only outside quiet hours.
  - The attacker sees "Waiting: Ben is offline until 8:00 am (his time)".
- **Contested battles** start when **all** the players involved are outside quiet hours. With quiet hours capped at 10 hours there's always an overlap; if there isn't one within 24 hours, it starts at the next end of anyone's quiet hours.
- **Chaos warnings** during your quiet hours go into the morning summary instead.
- **Fairness:** a queued attack still counts toward the attacker's limit of 1 open attack, so nobody can pile up attacks against sleepers.

## 23. Company names in the War zone ⚖️ (legal; E1)
The owner wanted real companies but is open to made-up ones, and asked whether real names are legally all right.

This isn't legal advice; it's a question for the lawyer review that's already on the to-do list.

**The concern with real names:**
- Showing **simulated prices** under real names and tickers (e.g. "NVDA −35%") can mislead people.
- A screenshot shared out of context could look like real market news about a real public company. There's risk around trademark and brand use (never use their logos), misleading information, and App Store review of financial content.

**Options:**
| Option | Risk | Feel |
|---|---|---|
| **A. Made-up companies** per sector (e.g. "Voltex Energy", "Nimbus Cloud") | Lowest | Fun and clearly a game; less "real" |
| B. Real sector names only (Tech, Energy…) with made-up stocks inside | Low | Same as A, with real sector labels |
| C. Real names and tickers, marked "SIM" (e.g. "NVDA·SIM"), with a disclaimer on every chart and share image | Higher; **needs the lawyer's OK first** | Most realistic |

**Recommendation:**
- **A + B for launch:** real sector names, made-up companies.
- Ask the lawyer about **C** during the legal review, and switch later if they approve.
- Made-up names also stop people mixing up War zone prices with the real-market Battles.

## 24. The Trade War realm (owner idea, 2026-10-27): F1–F8 APPROVED
**What the owner wants:**
- Trade War is its own gamified, 24/7 simulated "realm", separate from real-market trading.
- It has its own War profile, a bigger War balance, **gold bars** (earned, never bought), its own stats and balance chart.
- Higher ranks get a bigger army, but newcomers can still take them down.
- A new player with no friends can **drop into a War zone** where land is already claimed and either find neutral land or fight for it.
- It must stay simple.

### 24.1 Two worlds, one app
| | **Real trading** (unchanged) | **Trade War realm** (new) |
|---|---|---|
| Prices | Real market | Simulated, 24/7, Chaos events |
| Modes | Solo, head-to-head and other Battles, Squads (vs squads and/or the leaderboard) | Open War zones + private Wars with friends |
| Money | The $10,000 Solo account; each Battle has its own buy-in | **One War balance**, starting at **$100,000** (proposed), with its own chart |
| Level | Main XP and level (everything) | **Battle Level** (War only) |
| Currency | Tokens (bought) | **Gold bars** (earned only; can't be bought, sold or turned into tokens or money) |

### 24.2 XP and levels: the simple rule (proposed)
- **Battle Level** is the War profile's own level, from War results only (§17).
- **War achievements also give main XP**, through the existing `xp_award` with the existing daily caps. A War achievement counts toward your main profile XP like any other achievement (the owner's idea), but the daily caps stop the War from swamping the main level.
- Nothing flows the other way: main XP doesn't change your army or anything in the War.
- **The result:** two levels, each easy to understand, with one small bridge.

### 24.3 Where you play
- **Open War zones (for anyone, including new players with no friends):**
  - Always running, with **weekly seasons**: the land resets every 7 days, so no War lasts longer than a week (owner rule).
  - You can join any time mid-season. You land with your army and can **claim neutral land** or **attack** owned land, using all the approved rules.
  - Up to **30 players per zone** (proposed); a new zone opens when one is full.
  - **New-player shield:** your land can't be attacked for your first 24 hours in a zone.
- **Private Wars with friends:** the existing design (2–10 players, 1–7 days, hidden claiming at the start). The organizer chooses **Equal armies** (default) or **Level armies**.

### 24.4 Bigger armies for higher levels, without making them unbeatable (proposed)
- **Army size** = 100 soldiers + 10 per Battle Level rank above Recruit, **capped at 150**. A General has 1.5× a new player's army, not 10×.
- **Why a newcomer can still win:**
  - Battles are decided by **market calls** (Bull/Bear), not by army size.
  - Soldiers only raise the defence slowly (1 + soldiers÷20): 150 soldiers means 8 wins to take a territory, 100 means 6.
  - **Giant-slayer** bonuses (approved) pay extra for beating higher-ranked players, and a newcomer earns soldiers fast by capturing land.
- **Matchmaking:** Recruit and Soldier ranks first join **Rookie zones** (lower ranks only) and can move to open zones whenever they want.

### 24.5 War balance (proposed)
- It starts at $100,000, and trading in any War or zone uses it. It carries over between seasons, so it keeps growing (or shrinking) with your skill.
- **Fair scoring, even with different balances:**
  - the War Score uses **return %** (approved);
  - battle stakes are a **fixed $5,000** (5% of the $100,000 start; the approved 5% rule);
  - so a rich player has no edge.
- **Going broke:** below $10,000 you can reset to $100,000 once a week. That costs you your season score, and the balance chart shows the reset.

### 24.6 Gold bars (proposed)
- **Earned from:**
  - capturing territory: 3;
  - defending: 2;
  - contested-battle win: 3;
  - season finish: top 3 = 25 / 15 / 10;
  - War achievements.
- **Spent on:**
  - War profile looks (banners, map skins);
  - **Training camp**: +5 starting soldiers in the next season, still inside the 150 cap;
  - an extra Camouflage slot for a season;
  - early Hot zone hints (1 hour sooner).
- **Never:** bought with money or tokens, sold, traded between players, or turned into anything outside the realm. That keeps it from being pay-to-win or anything like gambling.
- Skipping the one-day wait stays **100 tokens** (owner-approved). A gold-bar price could be added too (F7).

### 24.7 Conflicts this creates
- **C18:** D6 ("everyone starts every War with the same soldiers") and the master rule "preserve equal configured starting capital" vs level-based armies and a persistent War balance.
  - **Proposal:** equal armies stay the default for private Wars; level armies apply in open zones, capped at 1.5×.
  - Capital fairness holds through return % scoring and fixed stakes.
  - **This needs the owner's explicit decision.**
- **C19:** "A War lasts at most a week" vs persistent zones. Solved with weekly seasons.
- **C20:** "War = 2–10 players with hidden claiming" vs drop-in zones. Hidden claiming applies to private Wars and to each zone's season start; drop-ins after that see the map and claim neutral land or attack.
- **C21:** the checklist's "Separate Trade War virtual accounts / equal buy-in" (§7–§8) still apply to **Battles**. The realm is a deliberate new design.

### 24.8 Open decisions
- **F1:** two worlds as in §24.1?
- **F2:** War achievements also give main XP within the daily caps, and nothing flows back?
- **F3:** open zones with weekly seasons, 30 players, a 24 h new-player shield, Rookie zones?
- **F4:** army 100 + 10 per rank, capped at 150; equal armies the default in private Wars?
- **F5:** War balance $100,000, fixed $5,000 stakes, a weekly reset below $10,000?
- **F6:** gold bars: earned amounts and what they buy, never purchasable?
- **F7:** should skipping the wait also be possible with gold bars?
- **F8:** names: "War balance", "gold bars", "War profile".

## 25. Build progress (hidden until complete; admins preview)
| Step | What | Status |
|---|---|---|
| W1 | Simulated market engine (21 made-up companies, 7 real sectors, a step a minute, 5-minute bars for 7 days), War profile with a $100,000 War balance and its chart, War zone trading (long only), SIMULATED marking + one-time explainer | Built 2026-10-29 (`functions/warmarket.py`, `war_market_tick`, `war_open`, `war_trade`, `features/war/`) |
| W2 | Chaos events (secret daily plan; 20% of weekdays, 50% of weekend days; one sector or, 1 in 4, the whole market; 10–20% over 1–3 hours; 30-minute warning; Hot for a day after), quiet hours (default 10 pm–8 am in your time zone, at most 10 hours, editable on the War zone page until War goes live, then in Settings), morning summary (one notification when quiet hours end); phone layout puts the chart and ticket first | Built 2026-10-29 (`plan_chaos`, `war_quiet`, `war_notify`, `war_morning_summaries`, `warMarket/chaos`) |
| W3 | Private War lobby: draft (organizer sets name, 1/2/3/5/7 days, 1/6/24 h lobby, 2–10 players) → open lobby (invite by @username; while War is hidden only admins can be invited) → join / decline / ready / leave → the organizer starts once everyone (at least 2) is ready; at the deadline it starts with the ready players or is cancelled; a draft never opened is cancelled after a day; equal armies (100 soldiers; "Level armies" come with Battle Level in W7). Up to 3 private Wars at once per player (a separate limit: battle slots and tokens don't apply to Wars). Bell invite card with Join / Decline | Built 2026-10-29 (`functions/warlobby.py`, `war_lobby`, `wars/{id}`, `/war/:id`) |
| W4a | The map: 3 more sectors (Real Estate, Materials, Utilities; 10 sectors, 30 made-up companies; owner 2026-10-29), 6/8/10 random territories per War; an hour of secret claiming (owner 2026-10-29; ends early when everyone locks in; anyone not locked in gets their saved placement or an even spread); all soldiers placed, max 50 per territory, one left empty; Camouflage (5 soldiers, max 2); Enemy / Heavy enemy presence from locked-in opponents only; the reveal (clear win above 25% more, contested within 80%, neutral) with a map log; placements and warnings readable by their owner only | Built 2026-10-29 (`functions/warmap.py`, `war_lobby` action `place`, `wars/{id}/placements`, `intel`, `log`) |
| W4b | Contested battles: Command (more soldiers; coin flip if equal) picks Bull or Bear within 10 minutes (random if not), a 1-hour battle on a random stock from the territory (owner 2026-10-29), waits for everyone involved to be out of quiet hours; 3+ close players: each picks a stock and side, biggest move their way wins; winner +5 soldiers and +1 point; loser gets the Redeploy pass | Built 2026-10-29 (`functions/warbattle.py`, `war_lobby` action `pick`, `battles` on `wars/{id}`; best picks kept secret in the picker's placement doc until the battle starts; the winner's +5 soldiers go to their private reserve; bonus points and Redeploy passes are counted for W5) |
| W5a | Attacks (owner 2026-10-30: split W5 in three; an attacker's wins are kept until the land is taken or changes hands; the War return is the War balance change during that War, from each player's balance at the War's start): eligibility ($5,000 free War cash + return >= 0% or a +1% sale in this War in the last 2 days, or a Redeploy pass within a day of getting it), the defender's 2 hours to answer outside quiet hours (30-minute reminder, no answer = accepted), Counter-pick once per War day, first decline each War day free then a concession (+1 win, no money), a 1-hour battle with $5,000 stakes (the defender's at most their cash), draw within 0.10%, winner takes both stakes; capture after 1 + defender soldiers ÷ 20 wins (+10 soldiers, the defender's retreat at half), defence +3, a lost battle −5; limits (1 attack open, 2 incoming, one battle per territory, 3 a War day per pair, none in the last hour, the one-day wait on land you lost, skipped once per War for 100 tokens; hidden on iOS) | Built 2026-10-30 (`functions/warattack.py`, `war_lobby` actions `attack`/`answer`/`skipWait`, `attacks` on `wars/{id}` + `wars/{id}/attacks`) |
| W5b | Neutral claims (once a War day, same performance check as attacking; a Redeploy pass gives one more and skips the check; worth 1 point), Reinforce (once a War day, reserve → your own land, secret, max 50 per territory), Rally (15 reserve soldiers → one more attack open for the rest of that War day, once a day), Hot zones (2 per War day: a territory a Chaos event hit first, then the biggest average 24-hour move of its stocks; holding one when the War day ends +1 point, winning a battle there +1 more) | Built 2026-10-30 (`functions/warmoves.py`, `war_lobby` actions `claim`/`reinforce`/`rally`, `hot`/`hotPoints` on `wars/{id}`) |
| W5c | War Score (60% trading on a ±10% scale / 40% land points ÷ the most anyone has; land counted at the end: claimed at the start 2, neutral 1, conceded 1, taken or held in battle 3, + Hot zone, contested-battle and Giant-slayer points; ties: higher return, then more battle wins), live standings on the War (hourly and after battles), final results and a "you finished Nth" notification when the War ends; the leader (1st on the live standings) gets no free decline; beating the leader +1 point, taking their land +1 more | Built 2026-10-30 (`functions/warscore.py`, `standings`/`results` on `wars/{id}`) |
| W6a | Battle Level: War-only points from real results in Wars of 2+ players, never lost (battle won +3, defence +3, capture +5 more, Giant-slayer +2, War win +10, 2nd/3rd +5; nothing for concessions, draws or neutral claims); ranks Recruit 0, Soldier 20, Sergeant 60, Captain 120, Commander 200, General 300; rank-up notification; rank shown in War Score tables and on the War zone page; level armies (100 + 10 per rank, max 150) ready for open zones | Built 2026-10-30 (`functions/warlevel.py`, `warProfiles/{uid}.battlePoints`) |
| W6b1 | Open War zones (owner 2026-10-31: **10 players per zone**, since the map has 10 territories; seasons **Monday 9 am ET** to the next Monday 9 am ET; W6b in two steps). Zones are Wars (`kind: "zone"`) with fixed ids per season (`z` + Monday + `r`/`o` + number), Rookie zones for Recruit and Soldier, open zones for the rest. The first hour of a season is the secret claiming hour (claiming always runs to the end of the hour; a player who never places keeps their army in reserve). After it, drop-ins land with no land and their army in reserve: level army (100 + 10 per rank, max 150) minus 10 per day of the season, at least 50; a 24-hour shield (attacking someone ends it); claim neutral land or attack. One zone at a time (separate from the 3 private Wars); you can leave (your land turns neutral; not mid-battle). Season War Score = the same War Score with each player's return counted from joining. At the season's end everyone who held land or traded is carried into the new season. | Built 2026-10-31 (`functions/warzone.py`, `warProfiles/{uid}.zone`) |
| W6b2 | Season results: each player's finish goes on their War profile (`seasons`, last 10, shown as "Your seasons" with a Top 3 badge) and the top 3 get a "Top 3!" notification (their gold bars arrive in W7). Moving up: a Recruit or Soldier can join an open zone instead (kept as `zonePref`) or move from a Rookie zone to an open zone any time; Sergeants and up always play in open zones, so a rookie who ranks up moves up at the next season (told "You've moved up"). Going broke: below $10,000 (no stakes held) you can reset to $100,000 once a week; it costs this season: you're counted out (score 0, ranked last) in every War and zone you're in, and the Balance card says when you reset. | Built 2026-10-31 (`functions/warzone.py`, `warscore.py` forfeits, war_lobby `reset`) |
| W6c | The War map (owner 2026-10-31, from their mockup): one big map seen through the whole War, territories coloured by owner (yours blue, enemies red, neutral grey, contested gold) with a soft glow and faint texture, no pictures; each territory shows its sector name, a simple sector icon of our own and the owner's name. No real company logos or tickers (trademarks; War prices are simulated). Drawn in code (SVG) so it updates live, works on a phone and can be tapped. | Built 2026-10-31, reworked 2026-11-01 after the owner said the first version didn't look like a map (`webapp/src/features/war/TerritoryMap.tsx`, shapes from `scripts/gen_war_map.py`): one island in a dark sea cut into the 10 territories with natural borders, a raised coast, small islands, a compass, a status box (phase, time left, your soldiers or land) and a legend on the map; a wide island on bigger screens, a tall one on phones; on the claiming screen it shows your planned soldiers, Camouflage and enemy warnings; sectors not in this War are dark; tapping a territory jumps to its card (the actions stay there); a colour legend underneath. App only: no server change. |
| W7 | Battle Level, gold bars, War leaderboards, achievements → main XP, rematch; then War goes live (`WAR_OPEN = True`, a Trade War card and menu entry) | |

