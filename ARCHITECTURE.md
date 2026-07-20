# Architecture

## Current Shape

The MSK Clinical Reasoning Lab is a static Next.js learner site plus local-only back-office tooling. The current public content is Phase 1 upper-quadrant material; the source pipeline and docs are being kept broad enough for future whole-body physiotherapy reasoning content.

The public app is intentionally simple:

- Next.js App Router with static export.
- No public backend.
- No public AI, vector, database, or admin endpoints.
- Reviewed MDX content rendered at build time.
- Netlify deploys the static `out` directory after `npm run preflight`.

## Content Model

### Conditions

Condition content is stored as one flat MDX file per condition:

```text
content/{region}/{condition}.mdx
```

`src/lib/mdx.ts` reads that file with `getConditionContent(region, condition)`, parses frontmatter with `gray-matter`, sanitizes MDX notation, and splits the body into in-page sections by `##` headings.

Those sections are page anchors. They are not separate MDX files and they are not separate routes.

Public condition route:

```text
/{region}/{condition}
```

Example:

```text
/cervical/cervical-radiculopathy
```

### Guided Cases

Guided case content is stored separately:

```text
content/cases/{region}/{caseSlug}.mdx
```

`src/lib/mdx.ts` reads case files, excludes draft and archived cases from public lists/routes, and maps internal case slugs to neutral `publicSlug` values when present.

Public case route:

```text
/cases/{region}/{publicSlug}
```

Internal case filenames and source metadata remain available for provenance, but learner-facing public routes and case cards should avoid revealing the diagnosis before the reveal step.

## Route Generation

Static routes are generated from source files and taxonomy metadata:

- Region pages come from the taxonomy.
- Condition pages come from flat MDX files and taxonomy routes.
- Case routes come from published guided case files only.
- Draft and archived cases are excluded.
- `ai-manager` is never imported into the public app and must not appear in `out`.
- Anatomy detail records, planned regions, and private learning examples do not generate public routes.

Route and no-leak checks validate these invariants after build:

```bash
npm run check:no-leak
npm run check:routes
```

Both are included in `npm run preflight`.

## Source Pipeline

Imported and generated source state is metadata-driven:

- Legacy source stations live under `content/imports/html-case-bank/extracted/stations/`.
- Guided cases can reference source metadata with `sourceType`, `sourceId`, `sourcePath`, and `reviewStatus`.
- `npm run registry:sources` generates `content/imports/source-registry.json`.
- `npm run tracker:legacy` generates the migration tracker.
- `npm run check:generated-sources` fails if either committed generated file is stale.
- `npm run check:sources` validates source metadata for legacy-derived cases.

Source files and frontmatter hold the truth. Generated trackers and registries should be refreshed from files rather than hand-maintained.

## Public Site Versus Local Admin

Public learner site:

- Static export only.
- Published/reviewed learner content.
- Neutral case discovery and staged reveal flow.
- No local file paths, secrets, draft notes, or admin controls.

Local admin tooling:

- Lives under `ai-manager/`.
- Can preview source registry and migration state.
- Can support local draft/review workflows.
- Must remain outside public route generation and Netlify output.

## Deployment Architecture

The active deployment target is Netlify.

`netlify.toml`:

```toml
[build]
command = "npm run preflight"
publish = "out"
```

GitHub Actions is not used for deployment. If present, it should run validation only and use the same `npm run preflight` gate.

## Preflight Gate

`npm run preflight` is the single release gate:

```bash
npm run clean:build
npm run check:hygiene
npm run check:sources
npm run check:secrets
npm run check:frontmatter
npm run check:generated-sources
npm run check:platform-content
npm run build
npm run check:search
npm run check:content-contracts
npm run check:anatomy
npm run check:learning
npm run check:ai-manager
npm run check:3d
npm run check:links
npm run check:no-leak
npm run check:reveal
npm run check:routes
```

The gate protects against:

- flagged names or draft markers leaking into scanned content,
- inconsistent source metadata,
- committed secret patterns,
- invalid condition or guided-case frontmatter,
- broken static build output,
- stale or unsafe search index output,
- diagnostic public case URL leakage,
- broken or missing reveal controls,
- draft/archived case routes,
- accidental public `ai-manager` output,
- duplicate or invalid Platform V2 content IDs,
- unreviewed anatomy detail routes,
- invalid learning step order or missing review metadata.

## Platform V2 Foundations

- `src/data/taxonomy.ts` is the canonical source for live and planned regions.
- `src/lib/contentSchemas.ts` contains shared lifecycle, relationship, anatomy, and learning schemas.
- `/anatomy` exposes reviewed category navigation; detail routes remain held until a record meets public requirements.
- `/learning` hosts static client-side learning mechanics. Learner free text remains in memory and is neither transmitted nor persisted.
- Private JSON briefs under `content/**/private` and `content/plans` validate future structures without becoming public content.
- `ai-manager` is an offline proposal and ingestion framework. Provider mode is disabled and no public runtime imports it.

## Future Architecture Direction

Future work can add PowerPoint imports, paper/evidence imports, AI-assisted draft generation, and shared/admin review workflows. Those systems should remain source-traceable and review-first:

- AI can draft; humans review.
- Drafts stay private.
- Published content must pass the same preflight gate.
- Git remains the audit trail until a future approved shared/admin workflow replaces or augments it.
