# Hall of Minds

**What it is (owner, 2026-10-22):** a ☰ section about history's great minds: how they thought and
acted, and what a trader can take from them. Red cards like the owner's reference images, one per
figure, with head-to-head cards (two faces melting into each other) mixed into the grid.

## Rules the owner set
- **Historical figures only.** Modern people's photos belong to photographers, and their faces carry
  publicity rights (Steve Jobs's estate included); Apple also rejects apps for it.
- **Real quotes only.** Each quote has its source, then "In plain words" and "In trading". Many
  quotes found online were never said by the person: check the source before adding one.
- **Lessons are free** and pay 10 XP once each, at most 20 a day (xp_award type `mind`).
- **Daily quotes cost 15 tokens for 30 days per figure** (`minds_follow`). Each person gets at
  most one quote a day, whoever they follow (`minds_daily_quote`, 9:05 am New York). It goes to the
  bell and, if "Daily quotes" is on in notification settings, as a push.

## Where things live
| What | Where |
|---|---|
| Content (figures, lessons, quotes, pairs, grid order) | `data/minds.json` (copied to `functions/minds.json` by `python3 scripts/build_practice.py`) |
| Portraits | `webapp/public/minds/<id>.webp`, credits in `webapp/public/minds/CREDITS.txt` |
| App screens | `webapp/src/features/minds/` (`/minds`, `/minds/:id`, `/minds/vs/:id`) |
| Server | `functions/minds.py` (pure rules), `minds_follow` + `minds_daily_quote` in `functions/main.py` |
| Reading progress | `users/{uid}.mindsDone` (`"napoleon:speed"`, `"vs:edison-tesla"`) |
| Daily-quote subscriptions | `wallets/{uid}.mindQuotes` `{figure: until ms}`, `mindQuotesUntil` |

## Adding a figure (from the owner's research)
1. Add the figure to `data/minds.json`: id, name, role, years, tagline, `portrait: "<id>.webp"`,
   4–6 lessons (title, 2 short paragraphs, "trading" takeaway), and quotes with `source`, `plain`
   and `trading`. Put its id in `order`.
2. Portrait: a public-domain painting, sculpture or pre-1929 photograph from Wikimedia Commons.
   Crop to head and shoulders, remove the background (transparent WebP, black and white), and add
   it to CREDITS.txt.
3. `python3 scripts/build_practice.py`, then `python3 scripts/minds_test.py` (it checks every
   quote has a source and the two copies match).
