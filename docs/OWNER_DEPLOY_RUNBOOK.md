# Owner deploy runbook: Marketstack + server XP + account deletion (PR B)

Claude can't deploy to Firebase (no credentials), so these steps are yours. They take about
15 minutes. **Order matters:** deploy the backend first, then merge the PR. Merging publishes
the new pages on GitHub Pages immediately, and those pages need the new functions, data and
rules to already be live.

Do the steps back to back. Between step 4 (deploy) and step 6 (merge), the old pages are
still live and the new rules refuse their XP and arcade-score writes, so XP and arcade
scores pause for those few minutes. Nothing is lost.

## Before you start
- Merge **PR A** ("Docs match the real repo; add CI checks") first. It changes no pages.
- A **Marketstack** account on a paid plan (Basic is enough) and its API key
  (marketstack.com → Dashboard → API key).
- An email address the SEC can contact (SEC asks every API user for one; it is kept secret).

## 1. Open Cloud Shell and get the branch
Go to https://shell.cloud.google.com and run:
```
cd ~/Zelos 2>/dev/null || git clone https://github.com/Zelousey/Zelos.git ~/Zelos && cd ~/Zelos
git fetch origin
git checkout claude/marketstack-security
git pull
```

## 2. Python packages for the functions
```
python3.12 -m venv functions/venv 2>/dev/null || python3 -m venv functions/venv
source functions/venv/bin/activate
pip install -r functions/requirements.txt
```

## 3. Save the two new secrets
Paste each value when asked (nothing shows while you paste; that's normal):
```
npx -y firebase-tools@latest functions:secrets:set MARKETSTACK_API_KEY --project leaderboard-agentictrading
npx -y firebase-tools@latest functions:secrets:set SEC_CONTACT --project leaderboard-agentictrading
```
Check the key works (it reads the secret you just saved and never prints it; Cloud Shell
already has the `firebase` command it uses):
```
bash scripts/marketstack_check.sh
```

## 4. Deploy functions + both sets of rules
```
npx -y firebase-tools@latest deploy --only functions,firestore:rules,database --project leaderboard-agentictrading
```
- If it asks to **delete `refresh_news`**, answer **Yes** (news is retired until there's a licensed source).
- If it asks to enable an API (Cloud Scheduler, Secret Manager), answer Yes.
- `database` deploys the arcade-leaderboard rules. You no longer have to paste them into the console.

## 5. Fill the market data once
Google Cloud console → **Cloud Scheduler** → the `refresh_market_data` job → **Force run**.
Wait about 2 minutes, then Firebase console → Firestore → `markets` and check these docs exist:
`historyIndex`, `history_0`, `snapshot`, `dailyBars`.
(The first run loads about 2 years of history, roughly 60 Marketstack requests, once.)

## 6. Merge PR B
On GitHub, open the PR "Marketstack data, server-side XP, signed-in arcade scores, account deletion" and merge it.
GitHub Pages publishes within a minute or two.

## 7. Check the live site
- Arcade → Chart Replay: a chart loads.
- Home page: the ticker tape and market overview show prices.
- Open any page while signed in: the daily check-in still gives +3 XP (watch for the toast).
- Arcade game: finishing a game still posts your score.
- My Zelos: a "Delete your account" card is at the bottom. (Don't test it on your own account. Make a throwaway account if you want to try it.)
- Trade War during market hours: the status line says "Live prices".

## If something goes wrong
Put the backend back the way it was:
```
cd ~/Zelos && git checkout main && git pull
npx -y firebase-tools@latest deploy --only functions,firestore:rules,database --project leaderboard-agentictrading
```
If PR B was already merged, use **Revert** on that PR in GitHub too. Then tell Claude what you saw.

## Optional, recommended: lock the public Firebase key to your site
Google Cloud console → APIs & Services → Credentials → the "Browser key" → Application
restrictions → **Websites** → add `https://agentictrading.info/*` and
`https://leaderboard-agentictrading.firebaseapp.com/*` → Save.


---

# Practice account on the server (the practice-server PR)

Same pattern as before: **deploy the backend first, then merge.** About 10 minutes.

Before you start: merge the app PRs that come before it (#34, then #35) if you haven't.

1. Cloud Shell:
   ```
   cd ~/Zelos && git fetch origin && git checkout claude/practice-server && git pull
   source functions/venv/bin/activate && pip install -r functions/requirements.txt
   npx -y firebase-tools@latest deploy --only functions,firestore:rules --project leaderboard-agentictrading
   ```
   It adds five functions (`practice_account`, `practice_order`, `practice_cancel`,
   `practice_reset`, `practice_settings`) and updates `refresh_quotes` and `refresh_market_data`.
   If some functions fail with a permissions/IAM message, run the same command again.
2. Merge the PR on GitHub. The app's Practice screen goes live, and the classic practice page
   becomes the Trade War home with an "Open Practice" button.
3. Check: open https://agentictrading.info/app/practice, sign in, press **Start with $10,000**,
   place a small market order. During market hours it fills at the next price update (within
   about 15 minutes); the Activity list and your balance update by themselves.

Between step 1 and step 2 the classic practice page can still place browser-only trades, but
its leaderboard numbers stop updating (the new rules only let the server write them). Do the
two steps back to back.

**Undo:** `git checkout main && npx -y firebase-tools@latest deploy --only functions,firestore:rules --project leaderboard-agentictrading`, and revert the PR if it was merged.

# Fix: live prices stuck since 2026-10-07 (the marketstack-fix PR)

**What was wrong.** Every 15-minute price refresh asked Marketstack for all 50 stocks in one
intraday request, and that request timed out (`markets/quotes` showed `error: TimeoutError`,
prices frozen at the 2026-10-06 close, practice orders not filling). Daily prices kept working.
Separately, Marketstack sent some daily bars with a $0 low/close (e.g. 2026-04-07/08 and
2026-06-04 for SPY, DIA, META and ~20 others), which drew spikes to zero on charts.

**The fix.** Intraday requests go 10 stocks at a time, wait up to 40 s, retry once on a timeout,
and a group that still fails no longer stops the others. A time budget keeps the run inside its
limit. The after-close job no longer fails (and re-runs all evening) when only the intraday step
fails. Bars with a zero or negative price are never stored, and the next after-close run removes
the bad ones already stored. The app's charts also ignore such bars.

Deploy only the two functions that changed (about 3 minutes), then merge:
```
cd ~/Zelos && git fetch origin && git checkout claude/marketstack-fix && git pull
source functions/venv/bin/activate && pip install -r functions/requirements.txt
npx -y firebase-tools@latest deploy --only functions:refresh_quotes,functions:refresh_market_data --project leaderboard-agentictrading
```
If it shows an IAM/permission error, run the last line again. Then merge the PR on GitHub.

**Check (next market day, after 9:46 am New York time):** open the app's Market tab; the status
line should say the market is open with a recent "updated" time, and prices should move every
15 minutes. If they don't, run `bash scripts/marketstack_check.sh` in Cloud Shell and send Claude
the output (it never prints the key).

**Undo:** `git checkout main` and run the same deploy line.

# News v2 + Practice fix (the news-v2 PR)

**1. Find out why "Start with $10,000" says "internal" (read-only, 1 minute).** In Cloud Shell:
```
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"data":{}}' https://us-central1-leaderboard-agentictrading.cloudfunctions.net/practice_account
npx -y firebase-tools@latest functions:log --only practice_account --project leaderboard-agentictrading | tail -20
```
- `401`: the function runs; the log shows the crash. Send it to Claude. (This PR already fixes one
  crash: old browser practice data in an unexpected shape.)
- `403`: the function isn't open to the app. Fix:
  `gcloud run services add-iam-policy-binding practice-account --region=us-central1 --member=allUsers --role=roles/run.invoker --project=leaderboard-agentictrading`
  (Cloud Run names use dashes; do the same for `practice-order`, `practice-cancel`, `practice-reset`,
  `practice-settings`). Or in the console: Cloud Run → the service → Security → "Allow unauthenticated".
  The owner applied this fix on 2026-10-08.
- `404`: it isn't deployed; step 3 deploys it.

**2. Make sure you're a Zelos admin** (needed for the Post News screen). Firebase console →
Authentication → copy your account's User UID. Firestore → `admins` collection → a document
whose ID is that UID must exist (any field, e.g. `since: 1`). If it's already there for the
sales page, nothing to do.

**3. Deploy (about 5 minutes), then merge:**
```
cd ~/Zelos && git fetch origin && git checkout claude/news-v2 && git pull
source functions/venv/bin/activate && pip install -r functions/requirements.txt
npx -y firebase-tools@latest deploy --only functions:practice_account,functions:news_can_post,functions:news_save,functions:news_delete,functions:refresh_official_news,firestore:rules --project leaderboard-agentictrading
```
If some fail with a permission/IAM message, run the same line again. Then merge the PR.

**4. Check:** open the app → News. "Market News" fills within 30 minutes (Fed releases and SEC
filings). As an admin you see **Post news** at the top of News; try a Market Movers post with an
x.com link. Then Trade War → Start Practice → "Start with $10,000".

**Undo:** `git checkout main` and run the same deploy line (the news functions stay but nothing
in the app calls them).

# Prices every minute (the live-1min PR)

Deploy **after** the News v2 PR (it's built on top of it).

**1. Check your Marketstack plan includes 1-minute bars** (read-only):
```
cd ~/Zelos && git fetch origin && git checkout claude/live-1min && git pull
bash scripts/marketstack_check.sh
```
Both "Intraday, 1-minute bars" and "1-minute bars since a time" must say **works**. If either says
"not in your plan", stop and tell Claude (prices would stay at 15 minutes).

**2. Deploy (about 3 minutes), then merge:**
```
source functions/venv/bin/activate && pip install -r functions/requirements.txt
npx -y firebase-tools@latest deploy --only functions:refresh_quotes,functions:refresh_market_data --project leaderboard-agentictrading
```
If it shows a permission/IAM error, run the last line again. Then merge the PR.

**3. Check (next market day, after 9:32 am New York time):** the app's Market status line says
"updates every minute" and prices change each minute. In the Marketstack dashboard, a full day
should use about 2,000 requests (about 41,000 a month on a 100,000 plan). If usage looks much
higher (for example if Marketstack counts each stock as a request), tell Claude; until then the
daily cap (`MS_DAILY_CALLS=3000` in `functions/.env`) slows updates to every 15 minutes once hit.

**Undo:** set `QUOTE_EVERY_MIN=15` and `MS_INTERVAL=15min` in `functions/.env` and run the deploy line.

# Invites: Battle, Team up, Invite a friend (the invites PR)

What's new on the server: `invite_create`, `invite_send`, `invite_accept`, `invite_cancel` and
`referral_claim`; `tw_challenge`, `tw_join` and `account_delete` changed; new rules for
`invites/*`, and browsers can no longer write `referrals/*` (the server records them now).

**1. Deploy (about 5 minutes), before merging:**
```
cd ~/Zelos && git fetch origin && git checkout claude/invites && git pull
source functions/venv/bin/activate && pip install -r functions/requirements.txt
npx -y firebase-tools@latest deploy --only functions:invite_create,functions:invite_send,functions:invite_accept,functions:invite_cancel,functions:referral_claim,functions:tw_challenge,functions:tw_join,functions:account_delete,firestore:rules --project leaderboard-agentictrading
```
If some fail with a permission/IAM message, run the same line again.

**2. Make sure the new functions are open to the app** (this is what caused the "Start with
$10,000" 403). Paste this whole block into Cloud Shell; each line should print a policy, not an error:
```
for f in invite-create invite-send invite-accept invite-cancel referral-claim; do
  gcloud run services add-iam-policy-binding $f --region=us-central1 --member=allUsers --role=roles/run.invoker --project=leaderboard-agentictrading --quiet >/dev/null && echo "$f ok"
done
```
(Each function still checks who is signed in; this only lets the request reach it.)

**3. Merge the PR.** The website's invite links (`practice/invite.html?ref=`) switch to
`referral_claim` at the same moment.

**4. Check:** in the app, Trade War → **Invite friends** → **Invite a friend** → you get a link.
Open it in a private window: it shows "<your name> invited you". Sign in there with another
Google account → **Accept** → a check with confetti and "+50 XP". Your bell shows "… joined Zelos
from your invite". Battle: pick a buy-in, share the link; the friend lands in the battle lobby.

**Undo:** `git checkout main` and run the step 1 line (the old rules let browsers write
referrals again; invite links stop working).

# Missions on the server (the server-missions PR)

What changes: missions are counted by the server (`functions/missions.py`). New callable
`mission_event`; `xp_award`, `tw_trade`, `refresh_quotes`, `invite_accept` and
`referral_claim` changed; rules make `users/{uid}.missions` server-only.

**1. Deploy (about 5 minutes), before merging.** In Cloud Shell, paste each block on its own:
```
cd ~/Zelos && git fetch origin && git checkout claude/server-missions && git pull origin claude/server-missions && echo "STEP 1 OK"
```
```
source functions/venv/bin/activate && pip install -q -r functions/requirements.txt && npx -y firebase-tools@latest deploy --only "functions:mission_event,functions:xp_award,functions:tw_trade,functions:refresh_quotes,functions:invite_accept,functions:referral_claim,firestore:rules" --project leaderboard-agentictrading
```
It should end with "Deploy complete!". If some functions fail, paste the second block again.

**2. Open the new function to the app and the website:**
```
gcloud run services add-iam-policy-binding mission-event --region=us-central1 --member=allUsers --role=roles/run.invoker --project=leaderboard-agentictrading --quiet >/dev/null && echo "mission-event OK"
```

**3. Merge the PR**, then go back to main: `git checkout main && git pull origin main`.

**4. Check:** in the app, open three different stock charts, then the Dashboard: "Analyze 3 stocks"
shows 3/3 with a check and you got +10 XP. A practice trade that fills ticks "Make 1 Trade War trade".

**Undo:** `git checkout main` (before merging) and run the deploy line again.

# Coaching (the Coach PR)

What changes: Coach / Learn. New callables `coach_refresh`, `coach_task`, `coach_task_update`,
`coach_note`, `coach_end`; `invite_create`, `invite_send`, `invite_accept`, `mission_event`,
`xp_award`, `tw_trade`, `refresh_quotes`, `referral_claim` and `account_delete` changed; rules add
`coachings/*` (only the coach and the student can read) and `coaches/*` (public badge).

**1. Get the branch.** In Cloud Shell, paste this block on its own. It must print `STEP 1 OK` and
a number bigger than 0; if it doesn't, stop and send a screenshot.
```
cd ~/Zelos && git stash -u -q; git fetch -q origin && git checkout -q -B claude/coach origin/claude/coach && grep -c "def coach_task" functions/main.py && echo "STEP 1 OK"
```

**2. Deploy (about 5 minutes), before merging.** Paste on its own:
```
source functions/venv/bin/activate && pip install -q -r functions/requirements.txt && npx -y firebase-tools@latest deploy --only "functions:coach_refresh,functions:coach_task,functions:coach_task_update,functions:coach_note,functions:coach_end,functions:invite_create,functions:invite_send,functions:invite_accept,functions:mission_event,functions:xp_award,functions:tw_trade,functions:refresh_quotes,functions:referral_claim,functions:account_delete,firestore:rules" --project leaderboard-agentictrading
```
It should end with "Deploy complete!". If some functions fail, paste block 2 again.

**3. Open the five new functions to the app.** Paste on its own; it prints five OK lines:
```
for f in coach-refresh coach-task coach-task-update coach-note coach-end; do gcloud run services add-iam-policy-binding $f --region=us-central1 --member=allUsers --role=roles/run.invoker --project=leaderboard-agentictrading --quiet >/dev/null && echo "$f OK"; done
```

**4. Merge the PR**, then go back to main: `git checkout main && git pull origin main`.

**5. Check** (needs a second account, for example a friend): with an account at Level 3 (150 XP)
or more, open the app → ☰ → Coaching → "Invite a student" and send the link. Your friend opens it,
accepts, and lands on the coaching page. You see their trades and can tap 👍 / 👎 / 💡; add a task;
they see it right away.

**Undo:** `git checkout main` (before merging) and run block 2 again.
