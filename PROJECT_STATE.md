# AgenticTrading.info — Project State

> Canonical snapshot of what exists, what is in progress, what is broken, and what must be verified.
> This file is the **current-state document**, not the complete product specification.

## 1. Product
AgenticTrading.info is a financial trading and strategy platform for retail traders, quantitative enthusiasts, and community-driven competitors.

Core areas:
- Dashboard and market overview
- Trading/charting workflows
- Practice trading
- Trade War competitive simulation
- Options scanners and strategy builders
- Crypto strategy/scanning
- Alerts and notifications
- Profiles/social/community
- XP, missions, achievements, and Arcade
- Founders program
- Token/credit monetization
- Authentication and payments
- PWA/mobile experience

## 2. Current architecture
- Frontend: modern reactive web application using a Vite/React-style structure.
- Backend: Firebase.
- Authentication: Firebase Auth.
- Database: Cloud Firestore.
- Server logic: Firebase Cloud Functions.
- Hosting: Firebase Hosting.
- Repository/CI: GitHub and GitHub Actions.
- Market data: Financial Modeling Prep (FMP) is being evaluated/used for required market data.
- PWA: initial setup exists.
- The application is intended to remain a functional web application while being prepared for native mobile packaging.

## 3. Implemented / existing
- Core UI/layout
- Firebase authentication
- Basic charting
- Simulated trading accounts
- Dashboard framework
- Initial navigation
- Firebase backend infrastructure
- Initial PWA infrastructure
- Existing project/repository workflow

## 4. Partially implemented
- Advanced options scanners
- Trade War tournament rules
- Arcade/gamification
- Push notifications
- Mobile app-like page flows
- GitHub Actions/CI/CD hardening
- Comprehensive security audit
- Documentation/handoff system

## 5. Known issues / transition areas
- Legacy long-scroll mobile UX is being replaced with page-based app-like flows.
- Market-data costs and plan limitations need verification.
- Some advanced features require architecture/security review before implementation.
- FMP quote/data integration needs to be verified against the current provider plan and backend implementation.
- Production deployment must move toward controlled CI/CD rather than undocumented manual changes.

## 6. Current direction
Recommended direction: **hybrid web-first/native-ready architecture**.

Continue improving the existing web application while establishing the architecture required for eventual Capacitor-based iOS/Android packaging.

The web application must remain functional independently.

## 7. Important product separations
- Real Trading ≠ Practice Trading.
- Trade War is a separate competitive simulation.
- Social/community features should not clutter the primary solo trading workflow.
- Financial calculations and balances must be trusted only when validated server-side.

## 8. Current priorities
1. Repository and architecture inspection
2. Security audit
3. Legal/privacy/App Store readiness
4. Website vs. native app architecture decision
5. Market-data/provider verification
6. Development tooling and CI/CD
7. App/PWA architecture implementation
8. Performance optimization
9. Testing and user simulation
10. Documentation and handoff maintenance

## 9. Non-negotiable principles
- Never trust client-submitted prices, balances, permissions, quotas, payment states, or user IDs.
- Never commit secrets.
- Do not make major architectural/security/payment/legal/data-provider changes without discussion and approval.
- Test before production deployment.
- Document meaningful architectural changes.
- Security, compliance, data integrity, and reliability take priority over speed.

## 10. Session handoff rule
Update this file whenever a major implementation, architectural decision, security decision, provider change, deployment change, or important bug/fix materially changes the project state.
