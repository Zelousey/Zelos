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
