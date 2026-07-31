# Governed Content Production System

## Scope

Programme 2 extends the existing schemas and generators without changing public
clinical assertions. It provides:

- an upper-quadrant structural production policy;
- deterministic condition gap reporting;
- 3-5 station legacy review batches;
- source-readiness summaries that contain counts and field availability, not
  source bodies or personal identifiers;
- one authorable branching model;
- one private governed MCQ contract example;
- a 20-item MCQ authoring plan;
- whole-region curriculum scaffolding from the canonical taxonomy.

## Upper-Quadrant Workflow

The production policy in
`content/curriculum/upper-quadrant-production-policy.json` defines recommended
domains. The generator reports missing domains and blank sections without
inserting clinical text.

Existing reviewed public pages remain available. A missing recommended domain
is a review queue item, not permission to invent content or silently revoke the
reviewed baseline.

## Legacy Case Batches

`reports/programmes/legacy-case-batches.json` assigns every remaining
unclassified station to a private batch containing 3-5 items. The batch record
stores:

- neutral station ID;
- proposed region when already present in governed metadata;
- source extraction status;
- anonymisation state;
- schema mapping state;
- duplicate/merge signal when an exact taxonomy-title match exists;
- blockers and next action.

`legacy-case-readiness.json` records checksums, byte counts, neutral section
availability flags, and sensitive-name counts only. It does not contain the
source body, source filename, personal name, or private path.

No batch creates a public case. Conversion remains:

```text
source readiness
-> anonymised governed draft
-> clinical review
-> evidence review
-> source clearance
-> technical validation
-> independent review
-> human publication decision
```

## Commands

```bash
npm run programmes:generate
npm run test:programmes:content
npm run check:programmes:content
```

## Limits

- No new case has been published.
- No clinical gap has been filled automatically.
- No legacy source has been cleared or clinically approved.
- No source station ID is exposed as a learner-facing case number.
