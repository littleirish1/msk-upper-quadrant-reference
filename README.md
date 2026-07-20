# MSK Clinical Reasoning Lab

Static learner site and local source-management tooling for a physiotherapy clinical reasoning platform. The current public build focuses on upper-quadrant MSK content as Phase 1, with a longer-term direction toward whole-body clinical reasoning.

## What This Repo Contains

- A static Next.js learner site for reviewed public content.
- Flat condition MDX files under `content/{region}/{condition}.mdx`.
- Guided case MDX files under `content/cases/{region}/{case}.mdx`.
- Local-only Case Manager tooling under `ai-manager/`.
- Metadata-driven source registry, migration tracker, route checks, source checks, hygiene checks, and secret scanning.

The public site is deliberately static. Draft cases, archived cases, imported source notes, and `ai-manager` are not exposed as public routes.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Gate

Use the same gate locally and in Netlify:

```bash
npm run preflight
```

`preflight` currently runs:

```bash
npm run clean:build
npm run check:hygiene
npm run check:sources
npm run check:secrets
npm run check:frontmatter
npm run check:generated-sources
npm run build
npm run check:search
npm run check:content-contracts
npm run check:3d
npm run check:links
npm run check:no-leak
npm run check:reveal
npm run check:routes
```

## Content Model

Condition content is not stored as separate per-section route files. Each condition is one MDX file:

```text
content/{region}/{condition}.mdx
```

Example:

```text
content/shoulder/rotator-cuff-related-shoulder-pain.mdx
```

The route is:

```text
/{region}/{condition}
```

Inside each file, `##` headings become in-page sections for the sidebar and anchor navigation. Links such as Overview, Pathophysiology, Assessment, Management, and Outcome Measures are in-page section links, not separate MDX routes.

Guided cases live separately:

```text
content/cases/{region}/{internal-case-slug}.mdx
```

Published cases can define a neutral `publicSlug` so learner-facing routes do not reveal the diagnosis before the reveal step. Draft and archived cases are excluded from static route generation.

## Adding Or Updating A Condition

1. Add or update the condition entry in `src/data/taxonomy.ts`.
2. Create or edit `content/{region}/{condition}.mdx`.
3. Use `##` headings for learner sections.
4. Keep clinical changes reviewed and source-traceable.
5. Run `npm run preflight`.

Do not create `content/{region}/{condition}/{section}.mdx` files for public condition sections. That older model is no longer how the app works.

## Adding Or Updating A Guided Case

Guided cases are MDX files under `content/cases/`. Public cases should use safe learner-facing labels and neutral public slugs. Keep internal metadata, source metadata, and provenance intact.

Draft or archived cases must stay private:

```yaml
status: "draft"
```

or

```yaml
status: "archived"
```

The route and no-leak checks protect against draft routes and diagnosis-revealing public case URLs.

## Deployment

The active deployment target is Netlify.

- Build command: `npm run preflight`
- Publish directory: `out`
- Config: `netlify.toml`

`next.config.mjs` uses static export, `trailingSlash: true`, and the repository base path. Netlify publishes the generated `out` directory and keeps compatibility redirects for base-path URLs.

GitHub Actions may run validation, but GitHub Pages is not the deployment target.

## Project Structure

```text
content/
  cervical/*.mdx                 # Flat condition files
  shoulder/*.mdx
  thoracic/*.mdx
  elbow/*.mdx
  wrist-hand/*.mdx
  cases/{region}/*.mdx           # Guided cases
  imports/                       # Imported source material and registries
ai-manager/                      # Local-only admin/source tooling
scripts/                         # Registry, tracker, safety, and route checks
src/app/                         # Next.js App Router pages
src/lib/mdx.ts                   # File readers and section parsing
src/data/taxonomy.ts             # Region and condition taxonomy
```

## Clinical Disclaimer

This resource is for qualified, registered health professionals. It is educational support and does not replace clinical judgement, patient-specific assessment, local governance, or appropriate supervision.
