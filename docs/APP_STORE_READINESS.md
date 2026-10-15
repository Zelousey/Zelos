# App Store readiness (iPhone app)

Audit of the app (`webapp/`) against Apple's App Review Guidelines, 2026-10-15. Owner
decisions (2026-10-15): fully compliant; Sign in with Apple; tokens sold with Apple in-app
purchase in the iPhone app (the website keeps Square); nothing that looks unfinished.

Status: ✅ done · 🔜 planned PR · ⚠️ needs the owner (Apple / Firebase console)

## Would be rejected

| Guideline | Finding | Fix | Status |
|---|---|---|---|
| 3.1.1 In-app purchase | Token packs sold through Square (`Tokens.tsx`, `tokens_checkout`), dollar prices in the sheet, a link to the website's tokens.html | iPhone app: no Square purchase or website purchase link (the sheet shows how to earn tokens). Next: consumable token packs with StoreKit, server receipt check, tokens never expire | ✅ hidden (PR A1) · 🔜 IAP (PR A4) |
| 4.8 Login services | Google is the only sign-in | Sign in with Apple | 🔜 PR A3 ⚠️ |
| 2.1 Completeness | Google's sign-in pop-up doesn't run inside the iPhone app's web view | Native sign-in plugin for Apple and Google | 🔜 PR A3/A4 |
| 1.2 User content | No Report, no Block, no filter on squad chat, profile names/bios, squad names, coach comments | ⋯ menu (Report, Block) on chat messages, profiles, squads, coaching notes and play comments; Settings → Blocked traders; server word filter (`functions/moderation.py`: chat, profile name/bio, squad name/goal, coaching text, community names); community rules + Terms agreed once per account (`users.termsAt`); reports land in `reports/` and the admins' bell | ✅ PR A2 (deploy) |

## Likely rejected

| Guideline | Finding | Fix | Status |
|---|---|---|---|
| 5.1.1 Privacy | No Privacy Policy or Terms link in the app | Settings → Legal (Privacy Policy, Terms of Use) | ✅ PR A1 |
| 2.1 / 4.2 | "for now", "on the website", "the classic site", "coming soon" screens (module hand-off), "Crypto is paused" | Removed; the module registry only holds built screens | ✅ PR A1 |
| 4.2 Web wrapper | Settings sent account management to the website; strategy pages, Profile looks and unmapped bell links opened website pages | In-app links only; bell links map to app screens or aren't links | ✅ PR A1 |
| 2.3.10 Other platforms | "Try Chrome … or Android" | Removed. "Add to Home Screen" only shows in Safari on the web; the iPhone app hides web push | ✅ PR A1 |
| 4.2 / 2.5.2 | Training drills are website pages in an iframe; the globe downloads a script from the website | Bundle drills and the globe into the app | 🔜 PR A4 |
| 4.5.4 Push | Web push doesn't work in the iPhone app | Apple push (APNs) through Firebase Messaging | 🔜 PR A4 ⚠️ |

## Already fine

- Account deletion inside the app (Settings → Delete account), 5.1.1(v).
- No login wall: guests can browse.
- Simulated money and "not advice" wording throughout; no real-trading module in the app (3.2.1).
- Battles: buy-ins are virtual practice dollars, entry is free, tokens can't be cashed out, so not real-money gaming (5.3). Wording avoids betting terms ("bounty", not "pot").
- No crypto in the app (owner rule).
- No analytics or ad tracking, so no App Tracking Transparency prompt.
- Push permission is only asked after a tap.

## Before submitting (owner, App Store Connect)

- Apple Developer Program membership (owner has one).
- App privacy "nutrition label": email, name, user ID, user content (chat, profile), purchases; no tracking.
- Age rating questionnaire: simulated gambling = none; user-generated content = yes.
- Review notes: a demo account, and that all trading is simulated with virtual money.
- Support URL and Privacy Policy URL: https://agentictrading.info/terms.html and https://agentictrading.info/privacy.html.
