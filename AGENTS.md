# Agent Instructions

Read `docs/MASTER_BUILD_AND_REVIEW_BRIEF.md` first. Treat it as the standing build, review, and safety contract for this repository.

## Project Boundaries

- The public learner site must stay static.
- `ai-manager/` is local/private back-office tooling only and must not be exposed as a public route or static export.
- Do not add APIs, databases, vector stores, runtime AI, analytics, or external services unless explicitly approved for the task.
- Git remains the audit trail.

## Content Safety

- Do not publish draft, private, or archived cases.
- Draft/private case routes must not appear in the public build.
- Diagnosis must not leak before the learner reveal step.
- Condition pages must not link directly to matching unrevealed guided cases.
- Guided cases must use neutral public routes and neutral learner-facing labels.
- Clinical content requires clinician approval before publication.
- Do not change clinical facts or case body content during UI/tooling-only tasks.

## Workflow Rules

- Do not auto-commit.
- Do not run `npm audit fix` unless the task explicitly scopes dependency remediation.
- Do not weaken hygiene, source, secret, frontmatter, no-leak, reveal, route, search, or preflight checks.
- If a reveal mechanism changes, update `check:reveal` and `check:no-leak` in the same diff.
- If public routing changes, update `check:routes` in the same diff.

## Validation

Run:

```bash
npm run preflight
```

When relevant, also run focused checks such as:

```bash
npm run check:frontmatter
npm run check:no-leak
npm run check:reveal
npm run check:routes
```

## Reporting

Final reports should include:

- Changed files
- Validation output
- Residual risks
- Suggested commit message

