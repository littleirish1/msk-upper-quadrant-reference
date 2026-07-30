# Review Workflow

This workflow keeps review focused on the change being proposed, not on re-reviewing the whole repository every time.

## Review Unit

The review unit is a pull request, branch diff, or phase milestone.

Reviewers should check the claim against:

- the diff and changed files,
- `AGENTS.md`,
- `docs/MASTER_BUILD_AND_REVIEW_BRIEF.md`,
- relevant contracts such as `docs/UX_INVARIANTS.md` and `docs/IA_AND_ROUTES.md`,
- the previous relevant `docs/reviews/` entry.

Use the previous review log as the baseline. Record whether open items were closed, held, regressed, or replaced by new risks.

## Review Depth

### Routine Diff-Based Review

Most changes should use routine diff-based review. The reviewer checks only the changed files plus the relevant contracts and prior review notes.

Use this for:

- small UI changes,
- scripts/check improvements,
- docs updates,
- source pipeline refinements,
- focused bug fixes with preflight output.

### Review Packet

Risky changes should include a review packet so the reviewer can inspect the exact repo state without re-running discovery.

A review packet should include:

- `git status`
- recent commits
- diff stat
- full diff
- preflight output
- relevant contracts
- previous review log

Require a review packet for changes involving:

- diagnosis hiding,
- case reveal flow,
- public routes,
- build/deploy configuration,
- schema or parser refactors,
- clinical case structure,
- large multi-file UI changes,
- phase boundaries.

### Deeper Repo Or Connector Review

Phase-boundary changes can use deeper repo or connector review when the diff changes architecture, review contracts, deployment gates, or source-pipeline assumptions.

This is not the default for routine changes. Use it when the reviewer needs to confirm that a new contract or milestone still fits the wider system.

## Optional Review Packet Cases

A review packet is optional for:

- simple docs,
- typo fixes,
- small non-runtime planning changes,
- one-file check improvements with preflight passing.

## Clinical Sign-Off

Agents can draft, refactor, and audit structure. They cannot clinically approve content.

Clinical content changes require clinician sign-off before publication, especially if they alter:

- diagnosis,
- management advice,
- red flags,
- assessment reasoning,
- differential diagnosis,
- case facts,
- model answers or feedback.

## Reviewer Checklist

For each review, confirm:

- The PR/task claim matches the diff.
- The change follows `AGENTS.md`.
- Public site remains static.
- `ai-manager/` remains local/private and absent from public output.
- Draft/private/archived cases remain excluded.
- Diagnosis is not leaked before reveal.
- Public routes remain neutral where guided cases are involved.
- Secrets, PII, and local paths are not introduced.
- Clinical content changes, if any, are marked for clinician review.
- Validation output is present and appropriate for the risk level.

## Review Output

For substantive reviews, add a new file under `docs/reviews/` using the existing review-log style:

```text
docs/reviews/000N-short-topic-review.md
```

Each review log should include:

- verdict,
- scope reviewed,
- findings or blockers,
- validation,
- closed items,
- remaining follow-ups.

For small routine changes, a PR review comment can be enough if no new follow-up needs tracking.

## Sensitive Deletions And Packet Redaction

Sensitive paths include:

- content/imports/html-case-bank/raw/
- private import sources
- credential-bearing files
- ai-manager private assets
- quarantined 3D assets
- environment files
- private clinical or source material

A review packet must never contain the deleted body of a sensitive file. For a
sensitive deletion, include only the repository path, deletion status, prior byte and
line counts where safely calculable, Git blob ID, approved checksum, accounting
result, and the reason the body was omitted.

Do not capture an unfiltered git diff or base-to-HEAD diff when it includes a
sensitive deletion. Export a filtered patch that excludes sensitive paths and add a
separate sensitive-deletion summary.

Packets must not contain secret values, credential-like values, governed sensitive
names, private local paths, raw private source bodies, binary model assets, or
environment-file content. Run the packet redaction scanner before distribution.

### Exact Artifacts

Code-bearing files, JSON, JSON Schema, lockfiles, fixtures, generated code, and
Git patches are exact artifacts. Packet generation must scan them and then copy
or write them byte-for-byte. It must never redact a substring, normalize line
endings, alter syntax, or rewrite Git object IDs. A sensitive finding in an
exact artifact blocks packet generation until the source or packet selection is
corrected.

Narrative summaries and selected human-readable logs may use deterministic
placeholder redaction. Unsupported or binary files fail closed unless an
explicit reviewed handler permits them. A complete patch must use full Git
object IDs, pass `git apply --check` against its recorded baseline, and
reproduce the expected changed-file hashes.
