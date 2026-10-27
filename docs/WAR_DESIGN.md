# War, challenges, Squad rulesets and Chaos Simulator: design for approval

Status: **DRAFT, waiting for the owner's approval (2026-10-27).** No code until it's approved.
It belongs with `AGENTICTRADING_MASTER_SPEC.md`, ADDENDUM 2026-10-27 (list A, and Phases 10–13).

Every number marked **(proposed)** is my suggestion. Change any of them and the design still holds.
Items marked ⚖️ affect **fairness, money/accounting or security**. Look at those first.

## Owner decisions this design is built on (2026-10-27)
- No War spec existed, so this is the design.
- Capture model approved: **winning trading challenges earns attack progress; hidden deployment stays the main way to hold land.**
- Short side only inside challenges, with a **fixed, known maximum loss** ("more like a put"). It's shown as simple "Bull / Bear" sides, not calls and puts, so new users get it. Everything is virtual money.
- **Solo** means trading on your own. Your Solo account keeps running while you're also in a Battle, a Squad match or a War, and every match has its own separate money.

---

## 1. War in one paragraph
A War is a Trade War match with a **map**.
- Every player gets the same number of **deployment pieces** and secretly places them on territories before the War starts.
- When it starts, the server counts the pieces: the most pieces owns a territory, and a tie leaves it **neutral**. Nobody ever sees anyone else's counts.
- During the War, everyone trades their equal virtual buy-in like any Trade War.
- Territory owners can **challenge** each other: a quick Bull-vs-Bear call on one stock. Wins build **attack progress** on the enemy's territory; enough progress flips it.
- When the War ends, **the player holding the most territories wins.** Ties are broken by account return %.

## 2. The map
- **Territories are market sectors**, each holding a few stocks from the existing 30-stock list. Examples: Tech (AAPL, MSFT, NVDA…), Finance, Health, Energy, Consumer, Communication, Industrials, Index (SPY, QQQ). That keeps the game about trading, not just a board.
- Map size grows with the number of players **(proposed)**:
  - 2–3 players: 6 territories;
  - 4–6 players: 8 territories;
  - 7–10 players: 10 territories.
- Players: **min 2, max 10** **(proposed)**.
- There's no adjacency in the first version: any territory can be challenged. (A real map with borders could come later.)

## 3. Hidden deployment ⚖️ (security)
- Every player gets **100 pieces** **(proposed)** and must place all of them, with **at least 1 territory empty and no more than 50 in one territory** **(proposed;** this stops one giant stack).
- Placing happens in the lobby. Once you press **Lock in**, your placement can't change.
- At the start, the server resolves every territory once: the highest total owns it, and a tie for the highest leaves it neutral. Neutral territories can be taken through challenges (see §5).
- **What players can see:**
  - who owns each territory, or that it's neutral;
  - their own placement;
  - **never** another player's counts, not even after the War. **(Proposed:** never revealed. Tell me if you'd like a reveal on the results screen.)
- **Enemy-presence warning (list D):** while you place your pieces, a territory can show **"Enemy presence"** when at least one opponent who already locked in put any pieces there.
  - It's a yes/no only, with no numbers and no names.
  - The server works it out and writes it to a document that only you can read.
  - It updates when someone locks in, so it never reveals who's still placing.
- **Where it's stored:**
  - Each player's placement is in `tradeWars/{id}/deploy/{uid}`: **readable only by that player, written only by the server.**
  - The totals exist only inside the server function and are never saved where a browser can read them.
  - Notifications and the ticker never mention counts.
  - Rules tests will prove that opponent reads are refused.

## 4. The queued lobby (lifecycle) ⚖️ (fairness)
The stored status names stay the same as today (`lobby / active / ended / cancelled`), so old matches and the classic website keep working. A new `stage` field gives the finer steps, and the app shows those names.

| Shown as | Stored | What happens |
|---|---|---|
| Configuring | `lobby` + `stage: configuring` | The organizer picks the settings and places and locks their own pieces. Nobody can join yet. |
| Queued / Recruiting | `lobby` + `stage: recruiting` | The War is listed (public) or reachable by code (private). Players join, place, then lock in ("Ready"). |
| Ready | `lobby` + `stage: ready` | At least the minimum number of players are joined and **locked in**. The organizer can press Start. |
| Starting | inside one server transaction | Territories are resolved and the clock starts. **It happens exactly once:** a second Start, or the deadline job, sees it's already started and does nothing. |
| Active | `active` | Trading plus challenges. |
| Completed | `ended` | Results, XP and leaderboards, as today. |
| Cancelled | `cancelled` | Nothing counts. Battle slots are given back. |

**Rules (proposed):**
- **Lobby deadline:** the organizer picks 1 h, 6 h, 24 h or 72 h. At the deadline:
  - with at least the minimum of players locked in, it starts with those players, and anyone not locked in is removed and gets their slot back;
  - otherwise it's cancelled.
- **Joining:** only before the start; there's always room for each new player's 100 pieces because the map size is set from the max players.
- **Organizer leaving:** the organizer can't just leave; they can **Cancel** (everyone gets their slot back) up to the start. After the start, the organizer is a normal player.
- **Leaving:** a player who isn't locked in can leave any time before the start. A locked-in player can leave too, and their pieces are removed. Placements are counted only at the start, so nothing leaks.
- **Disconnect / rejoin:** nothing needs you to stay online. Everything is on the server, and you come back by opening the War.
  - In the lobby, if you never lock in, you're dropped at the deadline.
  - In a War, your territories and trades stay as they are.
- The existing rules stay:
  - equal buy-in;
  - battle slots (3 free, 15 tokens extra);
  - the level locks on bigger buy-ins;
  - the Chapter 1 quiz lock;
  - War lengths of 1, 3, 7, 14 or 30 days.

## 5. Trading challenges ⚖️ (money and fairness)
A challenge is a short, fixed-risk Bull-vs-Bear call on one stock.

**Flow:**
1. You own at least one territory and choose an enemy (or neutral) territory to attack.
2. You pick one stock **from that territory's list**, your side (**Bull**: it goes up / **Bear**: it goes down), and the window. The defender gets the other side automatically.
3. **The stake** is the same fixed amount for both sides. It's taken from each player's War cash when the challenge starts and held aside. **(Proposed:** 5% of the buy-in, e.g. $500 on $10,000.)
4. The defender has **2 market hours** to Accept or Decline. **(Proposed:** one free decline per defender per trading day; after that, or with no answer, it's accepted automatically.) Neutral territories have no defender: the challenge runs against the market (see below).
5. The window **(proposed):** 1 hour, or "until today's close". It only runs in market hours.
6. **Result:** the server compares its own start and end prices.
   - Up more than 0.10% → Bull wins.
   - Down more than 0.10% → Bear wins.
   - Anything in between is a **draw**, and both stakes are returned.

**Money:**
- The winner gets **both stakes**; the loser loses **exactly their stake, never more**. That's the "set amount" you asked for, and it's the same for Bull and Bear.
- Total money in the War doesn't change (one player's loss is the other's win), so the equal-buy-in fairness holds.
- No borrowing, no margin, and the stock isn't actually bought or sold: there's no real short selling anywhere in the app.

**Capture (approved model):**
- Each territory needs a hidden number of attack wins to flip: **1 + (owner's pieces there ÷ 20, rounded down)** **(proposed)**. Strong hidden stacks are harder to take, and attackers never know exactly how many wins they need.
- Attackers see "Attack progress: 2 wins". When a territory flips, the attacker owns it.
- **(Proposed:)** the new owner's defence there is the attacker's own pieces in it, or 1 if they had none.
- A defender win removes one attack win from that attacker (never below 0).
- **Neutral territory:** the attacker plays against the market. 2 wins **(proposed)** take it, and a lost stake goes to nobody: it's removed, which is the only place money leaves a War. **⚖️ Alternative:** neutral challenges cost no stake. Please choose.

**Limits (proposed):**
- each player can have **1 challenge they started** open at a time, and receive at most **2**;
- one open challenge per territory;
- the same attacker → defender pair at most 3 times a day;
- no new challenges in the War's last hour;
- you need enough cash to cover the stake;
- knocked-out or surrendered players can't challenge or be challenged.

**Surrender:**
- **Forfeit a challenge:** you lose your stake and it counts as a challenge loss.
- **Surrender the War:** your open challenges are forfeited, and your territories become neutral.

**Notifications** (never revealing piece counts):
- "Ana challenged you for Tech: Bull on NVDA, $500, until 4:00 pm."
- "You won: +$500, attack progress on Tech is now 2."
- "Tech fell to Ana."

**Security:**
- The parameters are locked when the challenge is created.
- Results come only from server prices.
- Resolution happens in a transaction with a `resolved` guard, so a challenge can't pay twice.
- The 5-minute job settles any challenge whose window has ended.

## 6. Squad rulesets: one engine, rules as settings
There are no separate game engines. A match gets a `ruleset` field, and one table on the server turns each ruleset into the **settings the engine already understands** (`lms`, `modes.draftPicks`, …). Old matches without a ruleset behave exactly as today.

| Ruleset | Built from | New settings |
|---|---|---|
| **Free-for-all** | classic | none |
| **Fantasy Draft** | existing snake draft | picks 2/3/5 (exists); pick timer 30/45/90 s; **ban phase** off/on: each player bans 1 stock before picks **(proposed default: off)** |
| **Last Man Standing** | existing `lms` | an explicit floor % and check times shown before you join. **(Proposed:** only *realized* losses plus cash count toward the floor during the day; the full account is checked at the close. A temporary dip during the day doesn't knock you out unless the host turns on "strict".) |
| **Team Cooperation** | new | 2 teams (or more). **(Proposed:** the team score is the **average** return % of its members; teammates can see each other's trades; the team with the best average wins.) |

The app's Squad section groups them as **Together** (Team Cooperation) and **Compete** (Free-for-all, Fantasy Draft, Last Man Standing).

Future modes stay listed in this document only. They don't appear in the app until they're built.

## 7. Chaos Simulator (Solo) ⚖️ (fairness, farming)
From your description:
- It's a **separate Solo mode** with its own $10,000 virtual account, so it never mixes with Solo Real Market.
- **Prices are generated** on the same timeframes as real charts, with much bigger swings: 20% days, sudden spikes and crashes. Everything is labelled **"Simulated prices"**.
  - **(Proposed** for the first version: generated charts only.)
  - Replays of real wild days (e.g. famous crashes) could come later if the price data for them is available without a new paid provider.
- **Fair play:** the server makes the prices bar by bar while you play, so nobody can peek ahead.
- **Payout:**
  - **(Proposed:)** when you close a Chaos session, **5% of your profit** is added to your Solo Real Market account as a bonus (you said 5–10%; I'd start at 5%).
  - ⚖️ **Losses also count at 5%.** Otherwise someone could play Chaos over and over and keep only the wins (free money). Please confirm.
  - **(Proposed:)** at most 1 paid-out Chaos session a day.
- XP: the normal trade XP, with the same daily caps.

## 8. Charts (decided 2026-10-27)
- **Candles are the default on every chart.** The line style is still one tap away.
- **Green up / red down by default.** The website already has free colour choices (Green/Red, Blue/Orange for colour-blind users, and more). The app gets the same choice in **Settings**. Paid chart themes still work on top.

## 9. What to approve
1. The War basics: sector territories, 100 pieces, min 2 / max 10 players, most territories wins.
2. Never revealing piece counts (even after the War), and the yes/no enemy-presence warning.
3. The lobby rules: deadline choices, start with the ready players, cancel if too few.
4. Challenge money: an equal fixed stake (5% of the buy-in), the winner takes both, a 0.10% draw band.
5. Capture numbers: 1 + pieces÷20 wins, and a defender win removes 1. Neutral territories: a stake that's removed, or free?
6. The challenge limits and defender options above.
7. The Squad rulesets as settings; Team score = average return; Last Man Standing counts realized losses during the day.
8. Chaos Simulator: generated prices first, 5% payout with losses counted the same way, 1 paid session a day.

## 10. Build order once approved
Each step is its own PR, with screenshots:
- **Lobby (Phase 11):** status/stage, ready, deadline, start once. Rules tests and functions tests.
- **Territories and hidden deployment (Phase 12):** the placement screen, the presence warning, resolution at the start. **Leak tests first.**
- **Challenges (Phase 13):** create, accept or decline, resolve, capture, limits, notifications. Unit tests for the money math.
- **Squad rulesets (Phase 10):** these can come before the War work. They reuse existing code, so they're lower risk.
- **Chaos Simulator:** a separate PR after the Dashboard/hub phases.
