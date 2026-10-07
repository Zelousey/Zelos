# AgenticTrading.info — Development Workflow

## Required workflow

**Talk → Research/Inspect → Explain → Decide → Confirm → Implement → Test → Document**

## Branching
Prefer:
- feature branch
- pull request
- automated checks
- review
- merge
- controlled production deployment

## CI/CD goals
GitHub Actions should eventually verify:
- install
- lint
- type checks if applicable
- tests
- build
- security/dependency checks
- deployment prerequisites

## Production discipline
Never treat an AI-generated change as automatically trusted.

Before production:
- inspect diff
- run tests
- verify security impact
- verify Firebase rules/functions
- verify data-provider behavior
- verify payment behavior if affected
- verify mobile/PWA behavior if affected

## Documentation
Meaningful changes should update:
- PROJECT_STATE.md
- relevant architecture docs
- security docs
- provider docs
- changelog where appropriate

Complex functions/components should include useful documentation.

## Dependency discipline
Before adding a package:
1. Why is it needed?
2. Is existing functionality sufficient?
3. Is it maintained?
4. What permissions/access does it require?
5. What security risks exist?
6. What is its license?
7. What is its bundle/performance cost?
8. Can it be removed easily?

## AI-assisted development
AI can accelerate implementation but does not replace:
- architecture review
- security review
- legal review
- testing
- deployment controls
- human approval

## Session handoff
Every meaningful session should leave:
- current state
- changes
- tests
- known issues
- decisions
- next step
