# Clinical Module Library

`src/lib/clinical-platform/moduleSchema.ts` is the authoritative schema and projection policy for reusable clinical modules. The deterministic catalogue in `ai-manager/clinical-platform/modules/module-library.json` is private authoring input and is never imported by the learner application.

The initial six records mechanically preserve the public presentation text of the six governed baseline cases. They are new module revisions, so they remain `draft`, require exact-revision clinical/evidence/publication review, and produce no public learner, conversation, tutor, or case-generation projection.

Supported types cover symptoms, history, examination, investigations, management, safety, presentation variants, differentials, communication, movement, anatomy, muscle roles, and accessible explanations. Every top-level field has one of four explicit visibility classes. Strict schemas reject unknown fields; publication fails closed if an approval hash, approved revision, source state, or human review is absent or stale.

Projections are intentionally separate for learner, conversation, tutor, authoring, evidence review, and case generation. Authoring and evidence-review projections retain internal governance fields. Public projections are empty until the exact module revision is approved for public use.

## Validation

- `npm run modules:generate`
- `npm run test:modules`

These checks cover schema strictness, duplicate IDs, source/evidence links, stale approvals, sensitive names, hashes, and the public boundary.
