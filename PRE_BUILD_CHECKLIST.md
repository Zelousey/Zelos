# AgenticTrading.info — Pre-Build Checklist

> Use this before significant implementation begins. Check items off only after they are actually verified.

## 🟢 DO NOW — FREE / LOW RISK

### Repository
- [ ] Confirm GitHub repository is accessible.
- [ ] Confirm current branch.
- [ ] Confirm working tree status.
- [ ] Create/verify a clean backup or known-good commit.
- [ ] Verify production and development environments are distinguishable.
- [ ] Verify `.gitignore`.
- [ ] Verify no secrets are committed.
- [ ] Verify README exists.
- [ ] Create PROJECT_STATE.md.
- [ ] Create MASTER_PLAN.md.
- [ ] Create SECURITY_CHECKLIST.md.
- [ ] Create DATA_PROVIDERS.md.
- [ ] Create CLAUDE_START.md.

### GitHub
- [ ] Verify GitHub Actions is enabled.
- [ ] Review existing workflows.
- [ ] Require checks before production deployment where appropriate.
- [ ] Review branch protection/rules.
- [ ] Enable Dependabot if appropriate.
- [ ] Enable secret scanning/push protection if available.
- [ ] Review repository collaborators and permissions.

### Local development
- [ ] Verify Node.js version.
- [ ] Verify npm/package manager version.
- [ ] Verify frontend build.
- [ ] Verify Firebase CLI.
- [ ] Verify Git CLI.
- [ ] Verify Cloud Functions build/deploy process.
- [ ] Verify lint/test commands.
- [ ] Verify no unnecessary global packages.

### Firebase
- [ ] Verify Auth configuration.
- [ ] Review Firestore rules.
- [ ] Review Firestore indexes.
- [ ] Review Cloud Functions permissions.
- [ ] Review Firebase Hosting configuration.
- [ ] Review production environment variables/secrets.
- [ ] Confirm development and production projects are not accidentally mixed.
- [ ] Test backup/restore capability.

## 🔵 DOWNLOAD / INSTALL WHEN NEEDED

- [ ] Node.js supported version
- [ ] Git
- [ ] Firebase CLI
- [ ] GitHub CLI if useful
- [ ] Xcode only when iOS native work begins
- [ ] Android Studio only when Android native work begins
- [ ] Capacitor only after architecture compatibility review

Do not install unrelated AI/dev tools just because they appear in the master plan.

## 🟡 ACCOUNTS / SERVICES

### Apple
- [ ] Apple Developer Program
- [ ] App Store Connect
- [ ] Confirm account ownership/control
- [ ] Do not give third-party AI tools unnecessary access

### Email
- [ ] Support email
- [ ] Privacy/legal contact
- [ ] Account deletion contact/process
- [ ] Transactional email solution if required

### Market data
- [ ] Confirm current FMP plan
- [ ] List every required endpoint/data type
- [ ] Verify commercial-use rights
- [ ] Verify real-time limitations
- [ ] Verify request/rate limits
- [ ] Verify options availability
- [ ] Verify news availability
- [ ] Verify earnings availability
- [ ] Verify market movers availability
- [ ] Verify crypto availability
- [ ] Identify missing data before purchasing anything

## 🔐 SECURITY SETUP

- [ ] GitHub secrets configured correctly
- [ ] Firebase secrets configured correctly
- [ ] No API keys in frontend source
- [ ] No secrets in Git history
- [ ] Firestore rules reviewed
- [ ] Cloud Function authorization reviewed
- [ ] Admin routes protected
- [ ] Rate limiting strategy defined
- [ ] Audit logging strategy defined
- [ ] Backup/restore strategy defined
- [ ] Security headers reviewed
- [ ] CORS reviewed
- [ ] Password reset reviewed
- [ ] OAuth reviewed
- [ ] Dependency audit performed

## 🍎 APP STORE PREPARATION

- [ ] Privacy Policy URL
- [ ] Terms URL
- [ ] Support URL
- [ ] Account deletion workflow
- [ ] App privacy disclosures
- [ ] Age-rating preparation
- [ ] App description
- [ ] App icon
- [ ] Screenshot plan
- [ ] Review/feedback mechanism
- [ ] Payment/IAP policy review
- [ ] Financial-app compliance review

## 💳 PAYMENTS

Before implementation:
- [ ] Decide payment provider.
- [ ] Verify whether tokens/credits require special App Store treatment.
- [ ] Define pricing.
- [ ] Define cancellation policy.
- [ ] Define refunds.
- [ ] Define token/credit expiration rules.
- [ ] Verify webhook signature validation.
- [ ] Ensure server-side payment state.
- [ ] Ensure client cannot create/award tokens.

## 📈 DATA PROVIDER

Do not buy a new plan until DATA_PROVIDERS.md is completed.

- [ ] Map required data.
- [ ] Map current provider coverage.
- [ ] Identify missing data.
- [ ] Compare alternative sources.
- [ ] Verify commercial licensing.
- [ ] Estimate request volume.
- [ ] Design caching.
- [ ] Design fallback behavior.
- [ ] Verify real-time requirements.

## 🤖 AI / DEVELOPMENT TOOLS

For each proposed tool:
- [ ] What problem does it solve?
- [ ] Is it actually necessary?
- [ ] What access does it require?
- [ ] Does it access source code?
- [ ] Does it access production?
- [ ] Does it access secrets?
- [ ] Does it access Apple credentials?
- [ ] Does it access Firebase?
- [ ] What does it cost?
- [ ] Can it be removed easily?

Do not connect tools before review.

## 🔴 DO NOT DO YET

- [ ] Do not rewrite the frontend from scratch.
- [ ] Do not migrate Firebase to Supabase without evidence.
- [ ] Do not purchase expensive market-data plans before verification.
- [ ] Do not give AI tools Apple signing/App Store credentials unnecessarily.
- [ ] Do not enable invasive session replay without privacy review.
- [ ] Do not add major third-party SDKs without security review.
- [ ] Do not make production architecture changes without approval.
- [ ] Do not deploy unreviewed AI-generated security/payment code.

## Definition of Ready

Implementation can begin when:
- [ ] Repository state is understood.
- [ ] Security baseline is reviewed.
- [ ] Legal/App Store blockers are identified.
- [ ] Architecture direction is agreed.
- [ ] Data requirements are verified.
- [ ] CI/CD path is understood.
- [ ] Secrets are protected.
- [ ] Backup/recovery is available.
- [ ] Major tools have been vetted.
