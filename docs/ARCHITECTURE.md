# AgenticTrading.info — Architecture Direction

## Current foundation
- Vite/React-style frontend
- Firebase Auth
- Firestore
- Cloud Functions
- Firebase Hosting
- GitHub
- GitHub Actions
- PWA

## Preferred direction
Continue with the current web application and evolve it into:
1. A high-quality desktop web application.
2. A high-quality mobile PWA.
3. A native-ready web architecture.
4. A Capacitor-based iOS/Android application if evaluation confirms it is appropriate.

## Native strategy
Do not rewrite the application solely to make a native app.

Evaluate Capacitor for:
- Notifications
- Secure storage
- Haptics
- Lifecycle
- Deep links
- Networking
- Authentication
- Payments
- Device APIs

Keep the web application independently functional.

## Backend principle
Firebase remains the default backend unless inspection demonstrates a concrete reason to change.

Migration to another database is not a goal by itself.

## Financial integrity
Server-side systems own:
- Token balances
- Payment state
- Trade outcomes
- Simulated account balances
- Permissions
- Quotas
- Critical calculations

## Data flow
Preferred:

Client
→ authenticated request
→ Cloud Function/server
→ provider/API
→ validated/cached result
→ client

Do not place sensitive provider credentials in the client.

## Component architecture
Use reusable components and consistent design tokens.

Avoid:
- duplicated page-specific implementations
- mystery utilities
- undocumented business logic
- giant monolithic components
- hardcoded localization-sensitive strings

## Localization
Prepare user-facing strings, numbers, dates, times, and currencies for localization before large-scale UI expansion.

## Performance
Measure first, then optimize:
- bundle size
- rendering
- network payloads
- Firestore reads/writes
- API latency
- chart latency
