# Governed Guided-Case Architecture

The executable Guided Cases v2 contract is `src/lib/guided-cases/schema.ts`.
It supplements the existing MDX teaching source with a strict, versioned record
used for publication decisions, deterministic projections and reviewer reports.

## Boundaries

Every top-level and reasoning-stage field has one declared class:

- `public-immediate`: may enter the initial route, card or search-safe registry.
- `public-after-reveal`: may enter only the opaque delayed reveal payload.
- `internal-only`: must never enter public output.
- `human-review-required`: cannot contribute to publication until the current
  revision has an appropriate human decision.

Unknown fields fail strict schema parsing and cannot become public by default.
`createPublicImmediateCase`, `createPublicRevealPayload` and
`createInternalCaseReviewModel` are the authoritative projections. Publication
also requires a decision pinned to the exact content revision and canonical
hash. A revision change makes the earlier decision stale.

The six established cases use a `baseline-carried-forward` decision. This
preserves their prior public status; it does not create new clinical approval.
The three conversion pilots are draft, ineligible and blocked by clinical,
evidence and source-clearance review.

## Static Disclosure

Progressive disclosure is pedagogical, not confidential storage. Immediate
fields are present in the initial export. Reveal fields are fetched only after
an explicit learner action, but static reveal assets remain retrievable by
anyone who discovers an opaque URL. Internal-only fields must never be emitted.

Evidence Hub stays private. A record's mere existence cannot approve a case.
Relationships and publication decisions must pin the current revisions/hashes;
missing records remain explicit gaps.

## Deterministic Outputs

`npm run cases:generate` produces the JSON Schema, governed records, public-safe
registry and reviewer reports. Ordering and JSON formatting are stable and
machine paths and authoritative timestamps are excluded.

`npm run cases:check` regenerates against byte snapshots, compares canonical
UTF-8 text with LF/CRLF equivalence, and restores the exact prior bytes.
