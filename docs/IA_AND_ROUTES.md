# Information Architecture And Routes

This contract defines the public route model, current live regions, and planned expansion boundaries for the MSK Clinical Reasoning Lab.

## Route Principles

- The public learner site is a static export.
- `src/data/taxonomy.ts` is the source of truth for live public regions and condition navigation.
- Condition pages use one flat MDX file per condition: `content/{region}/{condition}.mdx`.
- Condition page sections are in-page anchors from `##` headings, not separate route files.
- Guided cases live under `content/cases/{region}/`.
- Future routes must not be created until reviewed content exists.
- `ai-manager/` is local/private tooling only and must never appear in public output.

## Current Live Regions

These region routes are currently live:

- `cervical`
- `thoracic`
- `shoulder`
- `elbow`
- `wrist-hand`

Learner-facing labels may use title case, such as Cervical, Thoracic, Shoulder, Elbow, and Wrist/Hand.

## Current Case Discovery

The neutral guided case index is:

```text
/cases
```

Rules:

- Published guided cases must be discoverable from `/cases`.
- Draft, private, and archived cases must be excluded from `/cases` and from static route generation.
- Case routes and visible case labels must stay neutral and must not reveal the linked diagnosis before reveal.
- The route smoke check must confirm published cases are discoverable and private cases are excluded.

## Condition Pages

Diagnosis names are allowed in the condition reference library. For example, condition pages may use diagnostic names in page titles, body text, search results, and region navigation.

Condition pages must not link directly to a matching guided case when that guided case uses the condition as the hidden answer. Use a general neutral link to `/cases` instead.

Unrevealed guided cases must not link to matching diagnostic condition pages. A condition/reference link may appear only after the diagnosis reveal if it is safely gated.

## Planned Expansion

The following are roadmap items only. They should not become clickable public routes until reviewed content exists and the taxonomy is updated:

- lumbar spine
- hip
- knee
- ankle/foot
- broader spine
- paediatrics
- neuro reasoning
- stroke/CVA
- spinal cord injury/cord damage
- cranial nerve testing
- spinal tracts
- anatomy foundation pages
- interactive body-region map

Future roadmap UI may mention these areas as planned, coming later, or not yet live. It must not create empty pages or broken links.

## Acceptance Criteria

- `npm run check:routes` passes after route or navigation changes.
- `npm run check:no-leak` passes after condition/case linking changes.
- No draft, private, or archived guided case appears in public output.
- No planned expansion route is created without real content and taxonomy support.
- `out/ai-manager` does not exist after build.
