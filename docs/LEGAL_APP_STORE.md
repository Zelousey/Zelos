# AgenticTrading.info — Legal, Privacy & App Store Readiness

> Planning document. This is not legal advice. Obtain qualified legal review before launch where appropriate.

## Legal documents
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Trading-risk disclosure
- [ ] Token/credit terms
- [ ] Refund/cancellation policy
- [ ] Account deletion instructions
- [ ] Support contact
- [ ] Data request/privacy contact
- [ ] Email unsubscribe
- [ ] Required postal disclosures

## Privacy
Document:
- What information is collected
- Why it is collected
- Where it is stored
- Retention
- Deletion
- Third-party processors
- Analytics
- Session replay
- Market-data providers
- Payment providers
- Authentication providers
- AI/third-party SDKs

## Account deletion
The application should provide a clear path for users to request/delete their account where required.

Deletion must account for:
- Auth account
- User profile
- User-generated content
- Social data
- Tokens/credits
- Trades/simulation data
- Legal retention requirements
- Payment records that must legally be retained

## Payments
Review:
- Web payments
- App Store payments
- In-app digital goods
- Tokens/credits
- Subscriptions
- External checkout
- Refunds
- Renewal
- Cancellation

Do not assume that a payment architecture permitted on the web is automatically permitted inside an iOS app.

## App Store preparation
- [ ] Apple Developer account
- [ ] App Store Connect
- [ ] App privacy disclosures
- [ ] Age rating
- [ ] Privacy URL
- [ ] Terms URL
- [ ] Support URL
- [ ] Account deletion
- [ ] Screenshots
- [ ] App description
- [ ] Review notes
- [ ] Testing/TestFlight
- [ ] Financial/trading-app requirements reviewed

## Review prompt policy
Use Apple's official review mechanism.

Do not manipulate, filter, or incentivize reviews based on user sentiment.

A genuine product feedback/support channel may exist separately.

## Native app security
Apple credentials, certificates, signing keys, and App Store Connect access must remain under direct project-owner control unless a specific service has been reviewed and explicitly approved.
