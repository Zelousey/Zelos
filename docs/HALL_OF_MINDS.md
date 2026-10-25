# Hall of Minds

**What it is (owner, 2026-10-22):** a ☰ section about history's great minds: how they thought and
acted, and what a trader can take from them. Red cards like the owner's reference images, one per
figure, with tabs for **Market legends** (Livermore, Dow, Newton, J.P. Morgan) and **History**. It
opens with a short book animation that flips through every great mind (owner 2026-10-24: every time
you come in at the grid, not again when you go back to the grid from a figure, not for a link straight
to a figure or lesson; skippable, off with reduced motion).

Each figure's page is a **dashboard** (owner 2026-10-24: "instead of having one long page"): the big
red card, the daily-quote box and six tiles, each opening a short page of its own
(`/minds/:id/story`, `carried`, `learned`, `lessons`, `quotes`, `now`):
- **Their story**, with a picture;
- **How they carried themselves** (accounts from people around them, each with its source), with a picture;
- **Who they learned from**, with those figures' red cards linking to their pages (a teacher who isn't
  a figure here gets a picture, e.g. Plato, or just their name);
- **Lessons**, ending in "Use it in trading" (scroll lessons open on their own page);
- **Quotes**, real ones explained;
- **Then & now**, words only, for figures that have one.

Next/Back links at the bottom (or a sideways swipe on a phone) move between the parts; the last
leads back to the dashboard. A daily-quote notification (`/minds/:id?q=…`) opens the quotes page on
that quote. The pictures are public domain from Wikimedia Commons, toned red by
`scripts/minds/lesson_images.py`, with credits under each picture and in
`webapp/public/minds/CREDITS.txt`; `pictures` in `data/minds.json` picks them per figure.
The head-to-head cards were removed (owner 2026-10-23); "who they learned from" keeps the links.

**The quote card** (owner 2026-10-24, "in-app card"): when someone opens Zelos and hasn't been in the
Hall of Minds for 3 days, a small red card with a random short real quote slides up after a few
seconds, with the figure's name (linking to that quote) and **Open Hall of Minds**. At most once a
day, closable, never inside the Hall of Minds. This device remembers the last visit
(`localStorage` `zelosMindsSeen`, set when the Hall of Minds opens; `zelosMindsCardDay` for the
once-a-day limit), so it's per device and needs no server. Someone who has never been in gets their
first card 3 days after first opening the app, so it doesn't crowd the welcome. The quotes load only
when a card is due (`webapp/src/features/minds/QuoteCard.tsx`).

## Rules the owner set
- **Historical figures only.** Modern people's photos belong to photographers, and their faces carry
  publicity rights (Steve Jobs's estate included); Apple also rejects apps for it.
- **Real quotes only.** Each quote has its source, then "In plain words" and "In trading". Many
  quotes found online were never said by the person: check the source before adding one.
- **Modern people in words only** (owner 2026-10-23): a "Then & now" section, no photos, never a
  card, with the note that they aren't connected to Zelos.
- **Lessons are free** and pay 10 XP once each, at most 20 lessons a day (xp_award type `mind`).
- **Scroll lessons**, played as **swipe pages** (owner 2026-10-23, swipe pages 2026-10-24). One swipe
  (or one scroll, an arrow key, or the Next button) moves exactly one page. Each slide is a story page
  (its painting and lines) that slides in sideways, then a task page that comes up from below; the next
  page waits until the task is done. Sitting on an open page for 4 seconds shows "Swipe left/up for the
  next one". A swipe that starts on an unfinished task is that task's own drag, never a page turn.
  The player is `webapp/src/features/minds/ScrollLesson.tsx` (GSAP moves the pages); with reduced
  motion pages switch without moving.
  Every drag also has a button that does the same. Each task pays **2 XP** once
  (xp_award type `mind-step`, refId `<figure>:<lesson>:<task>`), about 10 per lesson as before,
  at most 100 steps a day. A scroll lesson is not also paid the old 10 XP at the end.
  - Content: a lesson's `scroll` in data/minds.json (`image`, `credit`, `slides` with `lines`,
    an optional own `image` + `credit`, and an optional `task`). Task kinds
    (`webapp/src/features/minds/LessonTasks.tsx`): `hold` (scene `march` or `rally`; optional
    `from`/`to` labels), `quiz`, `drag` (the figure over the Alps, or `scene: "river"` with
    `from`/`to`/`who`), `level` (a buy line onto support), `collect` (drag items
    into one place; `wrong` ones bounce back), `tap` (find it in a painting; spots are
    fractions of the image), `target` (drag to the one right zone; zones are buttons too),
    `pick` (choose exactly `need` right options). scripts/minds_test.py checks the shape.
  - All four Napoleon lessons are scroll lessons (owner 2026-10-23): Study the greats (books,
    Maxim 78, the names David carved on the rocks), Speed is a weapon (Alps), Bring everything
    to one point (Austerlitz, the Pratzen Heights), The mind wins three quarters (Arcole).
  - All four Caesar lessons are scroll lessons (owner 2026-10-24): Cross the Rubicon (hold to
    decide, drag him across the river, pick what to decide before you buy), People believe what
    they want to (Sabinus and the fake deserter, Gallic War III.17-19; facts vs wishes), Small
    causes, big changes (Dyrrachium's wrong wall, the warning note he never read, sizing for
    surprises), Write it down (the Commentaries, find Caesar at Alesia, a trading journal).
  - All four Alexander lessons are scroll lessons (owner 2026-10-24): Learn from the best
    (Aristotle, turning Bucephalus toward the sun, the Iliad under his pillow), Move before
    the other side is ready (the march on Thebes, a plan before the open), Cut the knot
    (Gordium; your stop is the sword), Lead from the front (the Granicus, find him in the
    Alexander Mosaic, the Malli wall).
  - All four Aristotle lessons are scroll lessons (owner 2026-10-24): You become what you
    practice (find him in Raphael's School of Athens, an every-trade checklist), The golden
    middle (courage between coward and reckless, 1% risk), One good day is not a season (the
    swallow; judge a strategy on 20 trades), Feel it, but aim it (Achilles' rage, the four
    "rights", revenge trading).
  - All four Franklin lessons are scroll lessons (owner 2026-10-24): Money makes money (Advice
    to a Young Tradesman, his 200-year bequest, the 50% loss), Time is money (his daily
    schedule, alerts instead of screen-watching), Track yourself (the 13 virtues chart, a daily
    scorecard for the plan), Haste makes waste (Poor Richard, wait for the pullback).
  - Pictures: public-domain paintings from Wikimedia Commons (licence checked on Commons),
    toned red-and-black by `scripts/minds/lesson_images.py` into `webapp/public/minds/lessons/`,
    always with the credit line. A credit never covers something to tap.
  - A slide taller than the screen scrolls instead of pinning, so its task is always reachable.
  - With reduced motion nothing moves and pins; the tasks still gate the slides.
  - Every answer says **Correct!** or **Not quite.** before its explanation (owner 2026-10-24).
  - Lesson paintings fill their box; a tall portrait is cut from the top so the face sits at the
    top (owner 2026-10-24: cropped from the middle, it cut off Napoleon's head on a wide screen).
- **Daily quotes cost 15 tokens for 30 days per figure** (`minds_follow`). Each person gets at
  most one quote a day, whoever they follow (`minds_daily_quote`, 9:05 am New York). It goes to the
  bell and, if "Daily quotes" is on in notification settings, as a push.

## Where things live
| What | Where |
|---|---|
| Content (figures, story, accounts, lessons, quotes, grid order) | `data/minds.json`, generated by `scripts/minds/make_content.py` (+ `deep.py`, `market.py`); copied to `functions/minds.json` by `python3 scripts/build_practice.py` |
| Portraits | `webapp/public/minds/<id>.webp`, credits in `webapp/public/minds/CREDITS.txt` |
| App screens | `webapp/src/features/minds/` (`/minds`, `/minds/:id` dashboard, `/minds/:id/:section`, `/minds/:id/learn/:lesson`; `/minds/vs/…` goes to the grid) |
| Server | `functions/minds.py` (pure rules), `minds_follow` + `minds_daily_quote` in `functions/main.py` |
| Reading progress | `users/{uid}.mindsDone` (`"napoleon:speed"`) |
| Daily-quote subscriptions | `wallets/{uid}.mindQuotes` `{figure: until ms}`, `mindQuotesUntil` |

## Adding a figure (from the owner's research)
1. Add the figure to `data/minds.json`: id, name, role, years, tagline, `portrait: "<id>.webp"`,
   4–6 lessons (title, 2 short paragraphs, "trading" takeaway), and quotes with `source`, `plain`
   and `trading`. Put its id in `order`.
2. Portrait: a public-domain painting, sculpture or pre-1929 photograph from Wikimedia Commons.
   Add its crop to `scripts/minds/portraits.py` and run it (crop, background removal, black and
   white, grain), and add it to CREDITS.txt.
3. `python3 scripts/build_practice.py`, then `python3 scripts/minds_test.py` (it checks every
   quote has a source and the two copies match).
