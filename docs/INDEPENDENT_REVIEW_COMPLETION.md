# Independent review completion ledger

The final independent technical review decision for the Version 1 conversational clinical platform is **Ready for human merge decision**. It is not a clinical, evidence, source-clearance, licensing, legal, accessibility, beta, publication, release, or deployment approval.

The machine-readable ledger is maintained at `ai-manager/clinical-platform/reviews/independent-review-findings.json`.

## Resolution summary

| ID | Severity | Resolution | Focused proof | Remaining limitation |
| --- | --- | --- | --- | --- |
| F-1 | Medium | Build-invocation-dependent observed bundle bytes were removed from the tracked quality report. Stable limits remain tracked and each current build is still measured and enforced. | `npm run test:quality-v1` injects a synthetic 3 KiB bundle variance and proves the tracked report remains byte-identical. | Exact observed bytes are ephemeral build evidence rather than a currentness input. |
| F-2 | Low | Full-index Git state capture now uses an explicit 200 MiB child-process buffer. | `npm run test:currentness` captures a synthetic 2.9 MB patch successfully. | Changes above 200 MiB fail closed. |

Both corrections are in commit `acce15519dfa93d0871f1500fa3ccf034b43e514`. The full clinical-platform currentness check, type-check, lint, quality tests, and fail-closed release test passed after remediation.

## Preserved governance state

- 96 exact-revision review targets produce 431 pending human review decisions.
- 500 blockers remain across eight release gates.
- Publication approval is false and deployment remains disallowed.
- No reviewer finding or technical remediation changes any human-authority approval state.
