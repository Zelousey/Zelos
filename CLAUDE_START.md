# AgenticTrading.info — Claude Session Start

> This is the short, reusable kickoff instruction for a new Claude session.
> Do not paste the entire master plan into every session.

## First instruction

Before writing implementation code:

1. Read `PROJECT_STATE.md`.
2. Read `MASTER_PLAN.md`.
3. Read `PRE_BUILD_CHECKLIST.md`.
4. Read `SECURITY_CHECKLIST.md`.
5. Read `DATA_PROVIDERS.md`.
6. Inspect the actual repository structure.
7. Inspect Git status and recent history.
8. Inspect the build/test scripts: the app in `webapp/` (`webapp/package.json`, `npm run check`, `docs/APP_ARCHITECTURE.md`), the classic site's `scripts/build_*.py` and `scripts/*_test.py`, and `.github/workflows/`.
9. Inspect Firebase configuration.
10. Inspect Firestore rules and indexes.
11. Inspect Cloud Functions.
12. Inspect GitHub Actions workflows.
13. Inspect environment/secrets configuration without exposing secret values.
14. Identify discrepancies between documentation and actual code.
15. Report findings before changing implementation.

## Conversation-first workflow

Follow:

**Talk → Research/Inspect → Explain → Decide → Confirm → Implement → Test → Document**

Do not independently make major decisions about:
- Architecture
- Security
- Payments
- Legal/compliance
- Market-data providers
- App Store strategy
- Production deployment
- Major dependencies

Ask for approval when a decision materially changes the project.

## Security rule

Treat frontend code as attacker-controlled.

Never trust client values for:
- prices
- balances
- tokens
- quotas
- permissions
- payment status
- user identity
- trade outcomes

Validate critical values server-side.

## Deployment rule

Do not deploy directly to production without:
- review
- successful automated checks
- appropriate testing
- documented changes

## AI/tool rule

Do not connect or install new third-party development tools without first determining:
- why they are needed,
- what access they require,
- whether they duplicate existing tooling,
- their security/privacy implications,
- their cost,
- how they can be removed.

## Session handoff rule

At the end of meaningful work:
- Update `PROJECT_STATE.md`.
- Record important decisions.
- Record unresolved issues.
- Record tests performed.
- Record deployment state.
- Record the exact next recommended action.

## Initial response format

The first response after inspection should contain:

### Repository findings
What actually exists.

### Documentation discrepancies
Where the documents differ from the repository.

### Security findings
Critical/high-risk issues requiring attention.

### Architecture findings
Current architecture and conflicts with the intended direction.

### Data findings
Current providers, endpoints, and missing/uncertain capabilities.

### CI/CD findings
Current GitHub Actions/deployment status.

### Blockers
What must be resolved before implementation.

### Recommended next step
One clearly defined next action.

Do not implement anything until the required decision/approval has been obtained.
