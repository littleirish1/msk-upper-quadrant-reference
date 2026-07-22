# Content Schema Contract

This contract describes the current condition and guided-case frontmatter model. The executable schema is `src/lib/contentSchemas.ts`; this document explains its publication and governance rules.

## Condition Frontmatter

Required fields:

- `title`: non-empty learner-facing condition title.
- `region`: a region accepted by the shared schema.

Current optional fields include:

- `category`
- `condition`
- `section`
- `evidence_level`
- `evidenceGrade`
- `lastUpdated`
- `lastReviewed`
- `reviewedBy`
- `icd10`
- `ichd3`
- `tags`
- `relatedConditions`
- `citations`

Condition files use the flat path `content/{region}/{condition}.mdx`. Their `##` headings are in-page sections, not separate routes.

## Guided-Case Frontmatter

Required fields:

- `title`: internal teaching title; it may contain the diagnosis and must not be rendered before reveal.
- `region`: case region.
- `condition`: internal linked diagnosis/condition slug.
- `status`: one of `published`, `draft`, or `archived`.

Current optional fields include:

- `caseType`
- `difficulty`
- `estimatedTime`
- `lastReviewed`
- `reviewedBy`
- `learningFocus`
- `publicSlug`
- source/provenance fields.

`learningFocus` defaults to an empty array. It may contain diagnosis-bearing text and must remain internal unless a learner-safe display value is produced.

## Status And Publication

- `status` is always explicit. It has no default.
- `published` cases may be included in `/cases` and static route generation.
- `draft` and `archived` cases are private and must not appear in `/cases`, search, public links, or `out/`.
- The public site has no separate `private` status value; private means a non-public status enforced by route checks.
- Publication fails if frontmatter validation, source integrity, route exclusion, reveal, no-leak, link, secret, or hygiene checks fail.

## Neutral Public Slugs

Every published guided case must have an explicit learner-neutral `publicSlug`.

A public slug must:

- contain only lowercase letters, numbers, and hyphens,
- avoid the linked condition or diagnosis,
- avoid an internal diagnostic filename,
- remain stable once published unless a redirect and route review are explicitly approved.

The internal filename and `condition` metadata remain available for provenance and reveal logic.

## Source And Provenance Metadata

Shared source fields are:

- `sourceType`
- `sourceId`
- `sourcePath`
- `reviewStatus`

If source fields are supplied, `sourceType` is required. For `sourceType: legacy-html-case-bank`, `sourceId`, `sourcePath`, and `reviewStatus` are required. A published legacy-derived case requires `reviewStatus: reviewed`.

Existence, ID/path consistency, duplicates, and legacy-specific publication rules are also enforced by `check:sources`.
The approved legacy source version and exact-byte fingerprint are recorded in
docs/LEGACY_SOURCE_PROVENANCE.md. Extraction rejects any unreviewed fingerprint.

## Model Reasoning And Clinical Approval

Agents may draft structure, prompts, and diagnosis-neutral fallback feedback. They must not invent case-specific clinical model answers.

Clinical claims, diagnoses, red flags, management advice, case facts, model answers, and evidence interpretation require clinician sign-off before publication.

Generated or imported clinical material starts as draft/unreviewed. It cannot bypass the generator -> reviewer -> clinician -> publish sequence.

## Anatomy And Neuro Content

Neuro reasoning, stroke/CVA, spinal cord injury/damage, cranial nerve testing, spinal tracts, and anatomy foundation pages are planned areas. They are not live modules unless taxonomy, reviewed content, routes, and governance checks explicitly support them.

The interactive body map / 3D anatomy model is experimental and publicly ineligible until the gates in `docs/3D_ASSET_PROVENANCE.md` pass.

## Acceptance Criteria

- `npm run check:frontmatter` passes.
- `npm run check:sources` passes.
- `npm run check:content-contracts` passes.
- Published cases have explicit neutral public slugs.
- Draft and archived cases are absent from public output.
- No clinical content is published without clinician sign-off.
