# AgenticTrading.info — Master Product & Development Plan

> This is the **complete long-term product specification and development direction**.
> It contains product requirements, architecture goals, security requirements, UX decisions, tooling decisions, and future plans.
> It is intentionally separate from PROJECT_STATE.md.

## 1. Product vision
Build a professional, interactive financial trading and strategy platform that bridges amateur retail trading and sophisticated quantitative workflows without overwhelming users.

The platform should combine:
- Professional analytics
- Trading/practice tools
- Strategy discovery
- Simulated competition
- Social accountability
- Gamification
- High-quality mobile/PWA UX
- Eventually, native iOS/Android packaging

## 2. Product areas
- Dashboard
- Trading and charts
- Practice trading
- Trade War
- Options scanners
- Multi-leg strategy builders
- Crypto strategy/scanner
- Alerts
- Profiles/social
- XP/missions/achievements
- Arcade
- Founders program
- Tokens/credits
- Authentication
- Payments
- Notifications

## 3. Trade War
Trade War is a separate competitive simulation mode.

Requirements:
- $10,000 simulated starting balances where specified by the game mode
- Separate balance/portfolio/trades
- Leaderboards
- Rank based on defined performance metrics
- Elimination modes
- Friend challenges
- Explicit accept/decline flow
- Clear distinction between battle names and ordinary trades
- No automatic entry into high-stakes challenges
- Rules must be enforced server-side

## 4. Practice trading
Practice accounts are risk-free simulations.

Requirements:
- Clear $10,000 virtual starting-account experience where applicable
- Simulated orders
- Stop-loss/take-profit support
- Pending-order cancellation
- Active trade visibility near chart
- Clear separation from live brokerage execution

## 5. Trading / charts
Requirements:
- Fast chart access
- Professional indicators
- Responsive mobile controls
- Minimal unnecessary scrolling
- Clean trade workflow
- Reliable market-data handling
- Server-side validation of critical calculations

## 6. Options strategies
The platform should support market-wide strategy scanning rather than requiring users to manually select a stock first.

Planned concepts include:
- Bullish butterfly
- Bearish butterfly
- Directional/“iron wing”-style strategies if validated
- Three-leg strategy scanner
- Position builder
- Combined expected P&L
- Clear explanation of risk/reward
- Allocation-based sizing rather than unnecessary manual risk fields
- Tokenized paid scans/strategy access where approved

Jade Lizard is not part of the current preferred strategy set.

## 7. Crypto
Provide a dedicated crypto momentum/pullback strategy/scanner experience.

## 8. Social/community
- Profiles
- Friends/followers
- DMs
- Private theses
- Trade cards
- Friend challenges
- Communities/squads
- Founders program

Community features should remain distinct from the core solo trading workflow.

## 9. Gamification
- XP
- Missions
- Achievements
- Arcade
- Founder rewards
- Token rewards
- Battle-related progression

Gamification should support retention without making the core trading interface cluttered.

## 10. Monetization
Paid strategy/scanner access should use an on-site token/credit system where approved.

Requirements:
- Server-side token ledger
- Server-side spending validation
- No client-authoritative balances
- Clear pricing
- Clear expiration/usage rules
- Refund/cancellation policy
- Payment webhook verification
- Audit trail for token changes

## 11. UX / design
Overall direction:
- Dashboard-first
- Professional
- Intentional
- Fast
- App-like on mobile
- Powerful multi-panel desktop experience
- Consistent component library
- Zelos branding
- Blue/white/black brand palette
- Avoid generic AI-generated visual styles
- Avoid excessive bubbly/cartoon aesthetics
- Smooth transitions and useful loading states

Mobile:
- Page-based flows
- Fewer giant scrolling sections
- Touch-friendly controls
- PWA-ready
- Eventually native-ready

Desktop:
- Preserve powerful web application behavior
- Multi-panel layouts where appropriate
- Efficient chart/trading workflows

## 12. Architecture
Use the existing Firebase architecture unless inspection proves it should change.

Preferred direction:
- Web-first application
- Componentized frontend
- Firebase Auth
- Firestore
- Cloud Functions
- Firebase Hosting
- GitHub Actions
- Secure server-side financial logic
- Capacitor evaluated for native packaging

## 13. Internationalization
Design localization into the architecture before major implementation.

Do not hardcode:
- USD assumptions
- U.S. date formats
- U.S. number formatting
- English-only text assumptions

Prepare for:
- Localized text
- Dates/times
- Currencies
- Notifications
- Onboarding
- Errors
- App Store metadata
- Country-specific requirements

## 14. Analytics/session replay
Do not enable invasive session replay by default.

Before integration, review:
- Consent
- Privacy
- Data retention
- Masking/redaction
- SDK behavior
- Third-party sharing
- Regional requirements
- App Store implications

Never capture:
- Passwords
- Authentication tokens
- Payment information
- API keys
- Private messages
- Financial/account secrets

## 15. App Store / native strategy
Evaluate Capacitor as the primary web-to-native technology.

Native capabilities to evaluate:
- Push notifications
- Secure storage
- Haptics
- App lifecycle
- Deep links
- Networking
- Authentication
- Payments
- Device capabilities

Apple Developer credentials, signing keys, certificates, and App Store Connect access remain under direct control.

## 16. Apple review / feedback
Use Apple's official review mechanism for App Store reviews.

Do not:
- Manipulate reviews
- Filter users based on feedback
- Incentivize positive reviews
- Build a custom system that funnels only happy users to reviews

A genuine Zelos feedback/support mechanism is allowed.

## 17. AI-assisted development
Potential AI development tools such as Lance AI must be evaluated before use.

Review:
- Capabilities
- Pricing
- Security
- Privacy
- Code ownership
- Repository access
- Firebase access
- Apple/App Store access
- API-key access
- Deployment access
- Data handling

AI tools must follow:
**Talk → Research/Inspect → Explain → Decide → Confirm → Implement → Test → Document**

## 18. Tooling
Potential tooling to evaluate:
- GitHub Actions
- Open Terminal/public API research
- Superpower tooling
- Better Icons
- No AI Slop
- NVIDIA NeMo Guardrails
- Capacitor
- Lance AI

Do not install or connect tools simply because they appear on this list. Verify necessity and security first.

## 19. Security
See SECURITY_CHECKLIST.md for the detailed security requirements.

## 20. Performance
Measure before optimizing.

Measure:
- API latency
- Database latency
- Chart latency
- Rendering time
- Network payload size
- Bundle size
- Firestore read/write volume

Optimize through:
- Caching
- Efficient queries
- Indexing
- Avoiding N+1 reads
- Code splitting
- Lazy loading
- Image optimization
- Debouncing
- Virtualization
- CDN/cache usage
- Event subscriptions instead of unnecessary polling

## 21. Legal/compliance
Requirements include:
- Terms of Service
- Privacy Policy
- Account deletion
- Transparent pricing
- Renewal terms
- Cancellation terms
- Credit/token policies
- Email unsubscribe
- Required postal disclosures where applicable
- Trading-risk disclosures
- Copyright/IP review
- Market-data license review
- App Store policy review

## 22. Development philosophy
Major changes follow:
**Talk → Research → Explain → Decide → Confirm → Implement → Test → Document**

Do not build first and investigate later.

## 23. Priority order
1. Understand repository and architecture
2. Security audit
3. Legal/privacy/App Store readiness
4. Architecture decision
5. Data architecture/provider verification
6. Tooling/component libraries
7. App architecture/build
8. Performance
9. User simulation/testing
10. Documentation
