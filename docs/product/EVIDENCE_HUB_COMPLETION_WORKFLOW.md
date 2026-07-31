# Evidence Hub Completion Workflow

## Current State

Evidence Hub remains a private, fail-closed repository graph. The Programme 3
generator records exact-revision evidence gaps for every currently public
condition and guided case. It does not create evidence, claims, references,
review decisions, or publication approvals.

Presence in source intake is not evidence approval. Presence in Evidence Hub is
not clinical approval. A relationship is usable only when the exact content,
evidence, source, and review revisions satisfy the existing Evidence Hub gates.

## Private Workflow

1. Record an exact-revision evidence gap.
2. Propose a source or guideline review without network execution.
3. Verify bibliographic identity and source clearance separately.
4. Appraise the source and record limitations.
5. Propose a revision-pinned relationship.
6. Obtain evidence and clinical review for the exact revisions.
7. Run publication and public-boundary checks.
8. Preserve superseded records and prior decisions for audit.

Adapters are disabled by default. Google Scholar may inform later human
discovery, but this repository does not scrape it or treat discovery results as
verified evidence.

## Commands

- `npm run programmes:generate`
- `npm run test:programmes:evidence`
- `npm run check:programmes:evidence`
- `npm run check:evidence-hub`

Generated currentness is checked from a temporary directory with canonical
UTF-8/LF comparison. No generator rewrites public clinical content.
