# Guided-Case Authoring Workflow

## Lifecycle

Use this review-first path:

`legacy or authored source -> governed draft -> clinical review -> evidence review -> source clearance -> technical validation -> branch preview -> independent review -> human publication decision`

Schema validation is not clinical approval. Evidence Hub presence is not
evidence approval. AI assistance is not human review. A content revision can
invalidate an earlier approval.

## Authoring Rules

1. Start with a stable neutral case ID, learner number, title and slug.
2. Keep diagnosis, condition identity, source station identity and internal
   learning focus outside the immediate projection.
3. Write learner prompts without diagnosis-bearing wording.
4. Use source-supported model themes as comparison prompts, not rigid marking
   criteria. Do not invent an answer to fill a gap.
5. Record source hashes, transformations, AI assistance and unresolved issues.
6. Keep mechanically converted material `draft`, `publicationEligibility:
   false` and `human-review-required`.
7. Never include unnecessary personal identifiers. Governed sensitive names,
   private paths, credentials and contact identifiers are rejected.
8. `learnerPresentation.stagedDisclosure` is schema-reserved, authoring-only
   until governed staged-delivery projections are implemented. A non-empty
   value blocks publication and is excluded from immediate and reveal
   projections.

## Commands

- `npm run cases:generate`
- `npm run cases:validate`
- `npm run cases:validate:published`
- `npm run cases:validate:drafts`
- `npm run cases:check`
- `npm run cases:preview -- case.example.id`
- `npm run cases:review-packet -- --output=<private-review-directory> --case=case.example.id`

Preview and focused review outputs are reviewer-only and must stay outside
`public/` and `out/`. No public query parameter bypasses diagnosis reveal.

On Windows use the same npm scripts through `npm.cmd`. On Linux/macOS use
`npm`. Node 20 is the governed runtime.
