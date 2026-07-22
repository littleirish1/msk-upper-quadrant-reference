# PR Review Checklist

## PR / Task Claim

What does this PR claim to change?

## Linked Phase / Task

- Phase/task:
- Related review log or issue:

## Files Changed

List the main files changed and why.

## Contracts Touched

Check any relevant contracts:

- [ ] `AGENTS.md`
- [ ] `docs/MASTER_BUILD_AND_REVIEW_BRIEF.md`
- [ ] `docs/UX_INVARIANTS.md`
- [ ] `docs/IA_AND_ROUTES.md`
- [ ] `docs/REVIEW_WORKFLOW.md`
- [ ] Other:

## Validation Output

Paste the relevant validation output.

- [ ] `npm run preflight` passed
- [ ] Focused checks run, if applicable:

## Safety Impact

### Diagnosis-Leak Impact

- [ ] No guided-case diagnosis is exposed before reveal
- [ ] Case routes and visible labels remain neutral
- [ ] Condition pages do not link to matching unrevealed guided cases
- [ ] Not applicable

Notes:

### Draft / Private Route Impact

- [ ] Draft/private/archived cases remain excluded from public routes
- [ ] Published cases remain discoverable from `/cases`
- [ ] Not applicable

Notes:

### `ai-manager` / Public Exposure Impact

- [ ] `ai-manager/` remains local/private only
- [ ] No admin tooling, local paths, or private endpoints are exposed publicly
- [ ] Not applicable

Notes:

### Secrets / PII Impact

- [ ] No secrets, API keys, private keys, or local credentials added
- [ ] No patient-identifiable or staff-identifiable information added
- [ ] Not applicable

Notes:

### Clinical Content Impact

- [ ] No clinical content changed
- [ ] Clinical structure changed but clinical facts did not
- [ ] Clinical content changed and clinician sign-off is required

Notes:

## Reviewer Notes

Reviewer should compare the diff against the relevant contracts and previous `docs/reviews/` baseline.

## Clinician Sign-Off Needed?

- [ ] No
- [ ] Yes

If yes, describe what needs clinician review:

## Sensitive Deletion / Review Packet

- [ ] No sensitive file is deleted or changed
- [ ] Sensitive deletion is represented only by a deletion summary
- [ ] Full patch excludes private sources, environment files, private assets, and binaries
- [ ] Packet redaction check reports zero findings
- [ ] No private local path, secret value, governed sensitive name, or raw source body is included
- [ ] Not applicable

Do not attach an unfiltered diff when a sensitive deletion is present.
