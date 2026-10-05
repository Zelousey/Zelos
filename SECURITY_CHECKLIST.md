# AgenticTrading.info — Security Checklist

> Security is a release gate, not a final polish step.

## Core principle
Assume all frontend code can be inspected and manipulated.

Never trust the client for:
- Prices
- User IDs
- Permissions
- Token balances
- Quotas
- Payment status
- Portfolio balances
- Trade results
- Administrative privileges

Critical validation must occur server-side.

## Authentication
- [ ] Passwords are handled only by trusted authentication infrastructure.
- [ ] No plaintext passwords.
- [ ] Password reset is tested.
- [ ] Session expiration is appropriate.
- [ ] OAuth configuration reviewed.
- [ ] Account deletion works.
- [ ] Unauthorized sessions are rejected.
- [ ] Admin accounts have stronger protections where appropriate.

## Authorization
- [ ] Every privileged Cloud Function checks authorization.
- [ ] Firestore rules prevent cross-user access.
- [ ] Admin routes are protected.
- [ ] Ownership is verified server-side.
- [ ] IDOR/BOLA paths are tested.
- [ ] Multi-tenant/community data isolation is tested.

## Firestore
- [ ] No unintended public reads.
- [ ] No unintended public writes.
- [ ] User documents cannot be modified by arbitrary users.
- [ ] Token balances cannot be client-written.
- [ ] Payment states cannot be client-written.
- [ ] Trade outcomes cannot be client-forged.
- [ ] Sensitive collections have restrictive rules.
- [ ] Rules are tested with unauthorized scenarios.
- [ ] Indexes are intentional.

## Cloud Functions
- [ ] Functions validate authentication.
- [ ] Functions validate input.
- [ ] Functions do not trust client financial values.
- [ ] Secrets are server-side only.
- [ ] Webhook signatures are verified.
- [ ] Expensive functions have abuse controls.
- [ ] Logs do not expose secrets.
- [ ] Errors do not expose internals.
- [ ] Time-sensitive functions handle cold starts appropriately.

## Secrets
- [ ] No secrets in source.
- [ ] No secrets in `.env` committed to Git.
- [ ] No secrets in frontend bundles.
- [ ] No API keys in public JavaScript unless intentionally public.
- [ ] GitHub secrets are used appropriately.
- [ ] Firebase/server secrets are protected.
- [ ] Secret rotation procedure exists.
- [ ] Git history has been checked for accidental exposure.

## Input security
Review:
- [ ] XSS
- [ ] NoSQL injection
- [ ] SQL injection where applicable
- [ ] CSRF where applicable
- [ ] Path traversal
- [ ] SSRF
- [ ] Command injection
- [ ] Insecure deserialization
- [ ] Mass assignment
- [ ] Malformed JSON/input
- [ ] File upload abuse

## File uploads
- [ ] Size limits
- [ ] MIME/type validation
- [ ] Extension validation
- [ ] Content validation
- [ ] Storage isolation
- [ ] No executable uploads
- [ ] No server-side script execution
- [ ] Malware/abuse strategy where appropriate

## API / abuse protection
- [ ] Authentication endpoints rate-limited.
- [ ] Public forms rate-limited.
- [ ] Expensive scans rate-limited.
- [ ] Token-consuming actions rate-limited.
- [ ] Abuse monitoring exists.
- [ ] API request validation exists.
- [ ] Quotas are server-enforced.

## Web security
Review:
- [ ] HTTPS
- [ ] Security headers
- [ ] CSP where appropriate
- [ ] CORS
- [ ] Cookie configuration
- [ ] Source maps
- [ ] Debug endpoints
- [ ] Production error messages
- [ ] Exposed environment variables

## Dependencies
- [ ] `npm audit` reviewed.
- [ ] Dependabot configured if appropriate.
- [ ] Dependency sources are trusted.
- [ ] New packages are reviewed before installation.
- [ ] Suspicious/unnecessary packages are removed.
- [ ] Lockfile is committed.

## AI security
- [ ] AI tools receive minimum necessary access.
- [ ] AI tools cannot access secrets unnecessarily.
- [ ] AI tools cannot deploy to production without approval.
- [ ] Prompt injection risks are considered.
- [ ] Tool permissions are restricted.
- [ ] AI-generated code is reviewed.
- [ ] AI cannot independently alter security/payment/legal architecture.

## Privacy
- [ ] Minimal data collection.
- [ ] Sensitive data inventory exists.
- [ ] Retention is defined.
- [ ] Analytics reviewed.
- [ ] Session replay reviewed.
- [ ] Sensitive fields are masked.
- [ ] Third-party SDK data flows reviewed.

## Monitoring / recovery
- [ ] Audit logs.
- [ ] Security monitoring.
- [ ] Error monitoring.
- [ ] Backup strategy.
- [ ] Restore testing.
- [ ] Incident response procedure.
- [ ] Production access review.

## Release gate
No production release should proceed if a critical authentication, authorization, payment, secret-exposure, data-integrity, or cross-user-access issue remains unresolved.
