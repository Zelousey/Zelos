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

## Branch protection for `main` (GitHub → Settings → Rules → Rulesets)
Because GitHub Pages publishes `main`, protecting it is what protects production.
Recommended ruleset (target: default branch, **Enforcement: Active**):
- Bypass list: **only you (Repository admin role)**, so you can fix an emergency. Do not add the Write or Maintain roles, deploy keys or apps.
- Restrict deletions: on.
- Block force pushes: on.
- Require a pull request before merging: on, 0 required approvals (solo owner), require conversation resolution.
- Require status checks to pass: on, add the check named **`checks`** (from `ci.yml`; it appears after CI has run once).
- Do **not** turn on "Restrict updates" or "Restrict creations": with an empty bypass list they block every merge.

## CI
`.github/workflows/ci.yml` runs on every PR and push to `main`: Python syntax, `scripts/*_test.py`,
`node --check` on every `.js`, JSON validity, and a guard against committed secret files.
Run the same locally before pushing:
```
python3 -m py_compile functions/*.py scripts/*.py
for t in scripts/*_test.py; do python3 -I "$t" || break; done
find . -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```
