# Zelos app (`webapp/`)

The Zelos app: React + TypeScript, built with Vite and served at
**https://agentictrading.info/app/**. It lives beside the classic site (repo root) and
takes over its features one module at a time. Architecture, decisions and the native
(Capacitor) plan: [`docs/APP_ARCHITECTURE.md`](../docs/APP_ARCHITECTURE.md).

## Commands (run inside `webapp/`)
```
npm ci                 # install exactly what package-lock.json says
npm run dev            # local dev server → http://localhost:5173/app/
npm run check          # lint + typecheck + unit tests + production build (what CI runs)
npm run test:e2e       # browser tests (phone + desktop, axe, market flow) against a test build
                       # on the local Firebase emulators seeded with e2e/fixtures/markets.json.
                       # Needs Java. Extra args go to Playwright: npm run test:e2e -- e2e/markets.spec.ts
                       # Claude cloud session: unset the proxy variables and set
                       # PW_CHROMIUM=/opt/pw-browsers/chromium
```
Node 22.22+ is required.

## Adding a screen
1. Create `src/features/<module>/<Name>Page.tsx` (default export).
2. In `src/app/modules.ts`, set that module's `status: 'ready'` and
   `load: () => import('../features/<module>/<Name>Page')`.
3. Use components from `src/ui` and text from `src/lib/i18n.ts`; format numbers and dates
   with `src/lib/format.ts`.
4. Add a unit test next to it, and extend `e2e/` if it changes navigation.

## Rules
- No provider API keys or secrets in this folder. Market data comes from the public
  `markets/*` Firestore docs written by Cloud Functions.
- Never trust a value computed in the browser for money, balances, permissions or
  results: call the existing Cloud Function.
- Practice (solo virtual account) and Trade War (matches) stay separate: separate modules, no shared balances. The app has no real-trading module; it is a simulated trading competition.
- No new dependency without a reason written in the PR.
