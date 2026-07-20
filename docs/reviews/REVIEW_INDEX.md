# Review Index

This index records review continuity without inventing missing review documents.

| Review | File | Status |
|---|---|---|
| 0001 | `0001-baseline.md` | current repository hardening baseline |
| 0002 | `0002-diagnosis-association-leak-review.md` | safe to commit; follow-ups tracked into later checks |
| 0003 | absent | historical gap; no review file is present and none has been reconstructed |
| 0004 | `0004-app-reader-unification-review.md` | safe after guided-case status blocker was fixed |
| 0005 | absent | historical gap; no review file is present and none has been reconstructed |
| 0006 | `0006-reasoning-checklists-conversation-review.md` | safe to commit; case-specific clinical answers remain future reviewed work |
| 0007 | `0007-coordinated-hardening-review.md` | repository fixes implemented; human history/ref blockers and re-review remain open |

## Current Open Risk Ledger

- Historical Google credential rotation/restriction remains blocked on the external Google Cloud project owner.
- Script-side TypeScript data-URL loading remains fragile if shared TS modules gain relative imports.
- Regex-based MDX comparator sanitisation remains in place pending a safe parser/authoring migration.
- Clinical claims and case-specific model answers still require clinician sign-off.
- 3D asset provenance remains unknown and public eligibility remains false.
- Remote main currently contains a public 3D route, and the feature ref contains that route plus four unverified GLBs.
- The deleted legacy source remains reachable from local and remote Git refs pending human remediation.
- The reviewed 3D UI prototype is absent from the current repository state; only future-safe classification and boundary checks can be maintained here.
- Taxonomy code generation remains unimplemented.
- A reusable scripted conversation framework remains future work.

## Review Rule

Use the most recent relevant review as the baseline for the next PR or phase milestone. Record closed, held, regressed, and new items. Follow `docs/REVIEW_WORKFLOW.md`.
