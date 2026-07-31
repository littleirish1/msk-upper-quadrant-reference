# Security And Dependency Workstream

## Purpose

Dependency findings are governed work items, not an instruction to run an
automatic upgrade. The machine-readable register is generated at:

```text
reports/governance/dependency-risk-register.json
```

It records the installed version, direct or transitive status, affected
surface, static-deployment reachability, available remediation, breaking-change
risk, treatment, and required regression checks.

## Current Policy

- `npm audit --json` and `npm outdated --json` are read-only evidence sources.
- `npm audit fix` is prohibited.
- A dependency change requires a dedicated, explicit lockfile commit.
- Major Next, MDX, ESLint, React, Tailwind, and search upgrades require a
  separate remediation branch and independent review.
- Static-export reachability can reduce operational exposure; it does not
  resolve an installed vulnerable dependency.
- A clean secret scan confirms only the current tracked tree. Historical
  credential rotation and Git-history remediation remain human-controlled
  actions documented in `docs/HUMAN_ACTIONS_REQUIRED.md`.

## Commands

```bash
npm run programmes:generate
npm run check:programmes
npm audit --json
npm outdated --json
```

The audit and outdated commands can change as registry advisories change. Their
raw output is validation evidence, while the versioned register captures the
reviewed treatment decision for this repository revision.

## Acceptance Criteria

- Every current audit package entry has a governed risk record.
- The register contains no secret values or private paths.
- No risk is marked resolved without a validated package change.
- Preflight fails when the generated register or inventory is stale.
- Dependency upgrades remain isolated from unrelated product commits.
