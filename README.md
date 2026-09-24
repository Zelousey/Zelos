# Zelos site

Static site for Zelos — no build step, no framework, just plain HTML/CSS/JS. Deploy it with GitHub Pages.

## Pages

- `index.html` — main marketing site
- `terms.html` — Terms of Service
- `setup.html` — setup guide (has the terms click-wrap gate)
- `arcade.html` — Zelos Arcade hub
- `games/bull-run.html`, `games/buy-the-dip.html`, `games/setup-spotter.html` — the three mini-games
- `demo.html` — interactive demo alert ticket (safe to click, doesn't write anywhere real)
- `alert.html` — the **real, live** alert ticket. With no `?id=` it shows a labeled sample; with `?id=<strategy>-<date>` it reads that alert straight out of Firestore and renders it. This is what the Zelos scan skills now publish to (see "Real alert data" below) — it's no longer a static snapshot.
- `dashboard.html`, `alert-history.html`, `daily-market.html` — also read live from the same Firestore `alerts` collection.

## Real alert data (Firestore)

The scan skills (Zelos Swing Trader / Breakout Rider / Options Scanner) write real alerts into
this project's Firestore `alerts` collection via the `publish_alert` Cloud Function in
`functions/main.py` — see `docs/data-model.md` for the exact document schema and
`docs/deploying-functions.md` for how to deploy that function and wire the skills up to it. Until
it's deployed and configured, the skills still work exactly as before (notification + a
republished Claude Artifact page) — the Firestore write is additive and self-skipping.

A separate daily job then checks what actually happened to each published alert (hit target?
stopped out? still open?) using real price data, and writes that back via the
`update_alert_outcomes` Cloud Function — see `docs/firestore-alerts-setup.md` for the full
runbook and `scripts/check_alert_outcomes.py` for the decision logic (unit-tested in
`scripts/check_alert_outcomes_test.py`). This is what makes `alert-history.html` an honest,
checkable track record instead of a feed of predictions nobody follows up on.

That same daily job also tracks whether a winning alert ran all the way to its *second* target
(`outcome.target2Hit` — see the TARGET2 / "RUNNER" TRACKING note in
`scripts/check_alert_outcomes.py`), and if one just did, can automatically drop a post into your
own Buffer queue announcing it — with a plain market recap instead on a day with nothing to
announce. See `docs/buffer-automation.md` for the full setup and `scripts/buffer_post_content.py`
(unit-tested in `scripts/buffer_post_content_test.py`) for how the post text itself gets composed.
This is entirely optional and off unless you set the `BUFFER_API_KEY` / `BUFFER_CHANNEL_IDS`
secrets described there.

## Deploy with GitHub Pages

1. Create a new GitHub repository (public repos get free Pages hosting; a private repo needs GitHub Pro/Team/Enterprise for Pages).
2. Push everything in this folder to the repo root (or to a `/docs` folder — either works, you just tell GitHub which one below).
3. In the repo, go to **Settings → Pages**. Under **Build and deployment**, set **Source** to "Deploy from a branch," pick your branch (usually `main`) and the folder (`/root` or `/docs`), then save.
4. GitHub gives you a `https://<username>.github.io/<repo>/` URL within a minute or two — that's your site, live.

## Point your own domain at it

1. In the same repo, add a file named `CNAME` (no extension) at the repo root containing just your domain, e.g. `agentictrading.com` (or `www.agentictrading.com`).
2. At your domain registrar's DNS settings:
   - For an apex domain (`agentictrading.com`), add **A records** pointing to GitHub's IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - For a `www` subdomain, add a **CNAME record** pointing to `<username>.github.io`.
3. Back in **Settings → Pages**, enter your custom domain in the "Custom domain" field and save — GitHub verifies it and can auto-provision HTTPS for you (check "Enforce HTTPS" once it's available).
4. DNS changes can take anywhere from a few minutes to a few hours to propagate.

## After deploying

- Update the **Get Zelos** button in `index.html` if the Gumroad link ever changes.
- If you add a real custom domain, update anything outside this repo that still points at the old `claude.ai/artifact/...` links (Gumroad product description, receipt email template, etc.) to point at the new domain instead.
