# Frontmatter Schema Plan

Phase 3B planning for T3.2: one validated frontmatter schema shared by the app and scripts.

This document is a planning contract only. It does not implement validation, add dependencies, or change runtime behaviour.

## Current Parsing Model

The app and scripts currently parse MDX frontmatter in several ways:

- `src/lib/mdx.ts` uses `gray-matter` for condition and case loading.
- `scripts/check-public-routes.mjs` uses `gray-matter`.
- `scripts/check-no-diagnosis-leak.mjs` uses `gray-matter`.
- `scripts/build-search-index.mjs` uses `gray-matter`.
- `scripts/check-case-source-integrity.mjs` uses hand-rolled `parseMdxFrontmatter` and `parseFlatYaml`.
- `scripts/generate-migration-tracker.mjs` uses hand-rolled `parseFrontmatter`.
- `scripts/generate-source-registry.mjs` uses hand-rolled `readFrontmatter`.
- `scripts/generate-demo-report.mjs` uses hand-rolled `readFrontmatter`.

The implementation phase should replace those hand-rolled parsers with one shared loader and schema layer.

## Dependency Strategy

`zod` is not currently installed.

Recommendation: add `zod` in the implementation phase, not during this planning phase. Use it for runtime validation in scripts and typed inference in app/server-side content loading.

## Proposed Schema Location

Recommended files:

```text
src/lib/frontmatter/schema.ts
src/lib/frontmatter/read.ts
```

`schema.ts` should export:

- `conditionFrontmatterSchema`
- `caseFrontmatterSchema`
- `sourceMetadataSchema`
- inferred TypeScript types

`read.ts` should export shared helpers:

- `readMdxWithFrontmatter(filePath)`
- `readConditionFrontmatter(filePath)`
- `readCaseFrontmatter(filePath)`
- `parseMdxWithSchema(raw, schema, context)`

Scripts can import these helpers so validation rules stay in one place.

## Current Condition Frontmatter Shape

Observed across 33 real condition files:

| Field | Count | Type | Current role |
|---|---:|---|---|
| `title` | 33 | string | Page/search title. |
| `region` | 33 | string | Region slug; should match taxonomy and file path. |
| `category` | 33 | string | Currently `condition`; classification hint. |
| `evidence_level` | 33 | string | Displayed on condition page; legacy snake-case field. |
| `lastUpdated` | 33 | string | Displayed as review/update metadata fallback. |
| `icd10` | 4 | string | Optional coding/reference metadata. |
| `ichd3` | 1 | string | Optional headache classification metadata. |
| `tags` | 3 | array of strings | Optional search/filter/support metadata. |

Template-only condition fields also exist:

- `condition`
- `section`
- `lastReviewed`
- `reviewedBy`
- `evidenceGrade`
- `relatedConditions`
- `citations`

These template fields are not widely present in current real condition files, but some are already referenced by app types/components.

## Current Case Frontmatter Shape

Observed across 9 guided case files:

| Field | Count | Type | Current role |
|---|---:|---|---|
| `title` | 9 | string | Internal diagnosis/teaching title; can be revealed after learner prompt. |
| `region` | 9 | string | Region slug; used for routes and labels. |
| `condition` | 9 | string | Internal linked condition/diagnosis slug. |
| `caseType` | 9 | string | Currently `guided-reasoning`. |
| `difficulty` | 9 | string | Learner-facing difficulty label. |
| `estimatedTime` | 9 | string | Learner-facing timing. |
| `lastReviewed` | 9 | string | Review metadata. |
| `reviewedBy` | 9 | string | Review metadata. |
| `learningFocus` | 9 | array of strings | Internal/educational focus; may contain diagnosis text and must not be displayed pre-reveal unless neutralised. |
| `status` | 9 | string | Publish gate: `published`, `draft`, or `archived`. |
| `publicSlug` | 6 | string | Neutral learner-facing route slug for published cases. |
| `sourceType` | 6 | string | Source provenance. |
| `sourceId` | 6 | string | Source provenance. |
| `sourcePath` | 6 | string | Source provenance. |
| `reviewStatus` | 6 | string | Source/review gate; `reviewed` or `needs-review`. |

## Source Metadata Shape

Source metadata is currently case-specific but should be a reusable schema fragment:

```ts
sourceMetadataSchema = {
  sourceType?: string,
  sourceId?: string,
  sourcePath?: string,
  reviewStatus?: 'reviewed' | 'needs-review',
}
```

For `sourceType: 'legacy-html-case-bank'`, source integrity rules should require:

- `sourceId`
- `sourcePath`
- `reviewStatus`
- existing `sourcePath`
- `sourceId` matching the station filename prefix where possible

Published legacy-derived cases should require `reviewStatus: 'reviewed'`.

## Proposed Zod Schema Sketch

Implementation-phase sketch:

```ts
const statusSchema = z.enum(['published', 'draft', 'archived']).default('published')
const reviewStatusSchema = z.enum(['reviewed', 'needs-review'])
const regionSlugSchema = z.enum(['cervical', 'thoracic', 'shoulder', 'elbow', 'wrist-hand'])

const sourceMetadataSchema = z.object({
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  sourcePath: z.string().optional(),
  reviewStatus: reviewStatusSchema.optional(),
})

const conditionFrontmatterSchema = z.object({
  title: z.string().min(1),
  region: regionSlugSchema,
  category: z.literal('condition').optional(),
  evidence_level: z.string().optional(),
  evidenceGrade: z.enum(['A', 'B', 'C', 'D', 'GPP']).optional(),
  lastUpdated: z.string().optional(),
  lastReviewed: z.string().optional(),
  reviewedBy: z.string().optional(),
  icd10: z.string().optional(),
  ichd3: z.string().optional(),
  tags: z.array(z.string()).optional(),
  relatedConditions: z.array(z.string()).optional(),
  citations: z.array(citationSchema).optional(),
})

const caseFrontmatterSchema = z.object({
  title: z.string().min(1),
  region: regionSlugSchema,
  condition: z.string().min(1),
  status: statusSchema,
  caseType: z.string().optional(),
  difficulty: z.string().optional(),
  estimatedTime: z.string().optional(),
  lastReviewed: z.string().optional(),
  reviewedBy: z.string().optional(),
  learningFocus: z.array(z.string()).default([]),
  publicSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
}).merge(sourceMetadataSchema)
```

## Validation Rules

Condition validation should eventually enforce:

- `title` is present.
- `region` is a known taxonomy region.
- File path region matches frontmatter `region`.
- Condition file slug exists in taxonomy or is intentionally marked as draft/planned in a future contract.
- `lastUpdated` and/or `lastReviewed` is present before production hardening.
- `evidence_level` and `evidenceGrade` should be normalised or one should become canonical.

Case validation should eventually enforce:

- `title`, `region`, `condition`, and `status` are present.
- `status` is one of `published`, `draft`, or `archived`.
- File path region matches frontmatter `region`.
- Published cases must have a neutral `publicSlug`.
- `publicSlug` contains only lowercase letters, numbers, and hyphens.
- Published case public slug must not include its linked condition slug.
- Draft and archived cases must not be generated as public routes.
- Published legacy-derived cases must have `reviewStatus: 'reviewed'`.
- Legacy-derived cases must include valid `sourceType`, `sourceId`, and `sourcePath`.

Diagnosis-hiding checks should remain separate from schema validation because they inspect rendered output and public routes, not only frontmatter shape.

## Inconsistent Or Transitional Fields

Known inconsistencies:

- Conditions use `lastUpdated`; templates and cases use `lastReviewed`.
- Conditions use `evidence_level`; templates/types also mention `evidenceGrade`.
- `learningFocus` may contain diagnosis-bearing text and should be treated as internal unless neutralised before display.
- Some case `condition` values may not map to a public condition taxonomy entry yet, especially draft/imported cases.
- Source metadata exists only on legacy-derived cases.

Recommendation:

1. Keep accepting existing fields in the first validation pass.
2. Add warnings for preferred canonical fields.
3. Only make stricter migrations after a separate content metadata cleanup sprint.

## Implementation Sequence

1. Add `zod`.
2. Create `src/lib/frontmatter/schema.ts`.
3. Create `src/lib/frontmatter/read.ts` using `gray-matter` plus Zod parsing.
4. Add a non-preflight audit command that validates all current MDX and reports warnings.
5. Update scripts one at a time to use the shared reader:
   - `check-case-source-integrity.mjs`
   - `generate-source-registry.mjs`
   - `generate-migration-tracker.mjs`
   - `generate-demo-report.mjs`
   - route/no-leak/search checks if useful
6. Update `src/lib/mdx.ts` to use validated frontmatter internally.
7. Add the schema validation command to `preflight` only after all current content passes.
8. Remove retired hand-rolled parser functions.

## Migration Risks

- Over-strict schemas could block build on currently accepted metadata aliases.
- Validating all condition files against taxonomy may surface planned/future content that needs explicit status handling.
- Published case requirements must not accidentally publish or hide content by changing status defaults.
- `learningFocus` is educational metadata but can reveal diagnoses; schema should not make it learner-facing by implication.
- Script imports from `src/` must work in Node ESM without depending on Next path aliases unless configured carefully.

## Acceptance Criteria For The Implementation Phase

- `zod` schema exists and is the single source for condition/case frontmatter validation.
- Existing content passes validation or has documented warnings.
- Hand-rolled YAML/frontmatter parsers are removed from scripts.
- `src/lib/mdx.ts` and scripts use the shared reader.
- Invalid frontmatter fails with file path and actionable message.
- `npm run preflight` remains green.
- No draft/archived case routes are generated.
- No diagnosis leak checks are weakened.
- No clinical body content is changed as part of schema rollout.

## Example Valid Condition Frontmatter

```yaml
---
title: "Cervical Radiculopathy"
region: "cervical"
category: "condition"
evidence_level: "high"
lastUpdated: "2026-03-28"
tags:
  - cervical
  - neurological screening
---
```

## Example Valid Case Frontmatter

```yaml
---
title: "Cervical Case 01: Neck and Arm Pain"
region: "cervical"
condition: "cervical-radiculopathy"
caseType: "guided-reasoning"
difficulty: "intermediate"
estimatedTime: "10-15 minutes"
status: "published"
publicSlug: "case-01-neck-arm-symptoms"
lastReviewed: "2026-06-03"
reviewedBy: "Reviewer name"
learningFocus:
  - neurological screening
  - differential diagnosis
---
```

## Example Legacy Source Metadata Fragment

```yaml
sourceType: "legacy-html-case-bank"
sourceId: "s20"
sourcePath: "content/imports/html-case-bank/extracted/stations/s20-example.md"
reviewStatus: "reviewed"
```
