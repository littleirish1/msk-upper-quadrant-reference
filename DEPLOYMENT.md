# Deployment

This project deploys the public learner site as a static Next.js export on Netlify. The local Case Manager and source tooling are not public routes.

## Local Working Directory

Use:

```powershell
C:\dev\msk-upper-quadrant-reference
```

Avoid running deployment commands from older synced copies.

## Install

```powershell
npm install
```

## Required Local Validation

Before a deploy or demo:

```powershell
npm run preflight
```

`preflight` checks generated tracker/registry currentness before the build. Do not
pre-generate those files immediately before the gate, because that would mask stale
committed output.

When source metadata intentionally changes, regenerate in dependency order, review
the diff, and then run the currentness gate:

```powershell
npm run tracker:legacy
npm run registry:sources
npm run check:generated-sources
npm run preflight
```

`preflight` is the same gate used by Netlify:

```powershell
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

## Deploy Target

The active deploy target is Netlify.

`netlify.toml`:

```toml
[build]
command = "npm run preflight"
publish = "out"
```

The app uses `output: 'export'` in `next.config.mjs`, so `next build` writes static files to `out`. The config also uses `trailingSlash: true` and the repository base path `/msk-upper-quadrant-reference`; `netlify.toml` publishes `out` and includes redirects so existing base-path URLs resolve on the Netlify-hosted public site.

GitHub Pages is not the deployment target. Any GitHub workflow should be validation-only and should run `npm run preflight`, not a separate deploy command.

## Public Surface

Public:

- Reviewed learner pages.
- Region and condition pages.
- Published guided cases using neutral public case slugs.
- Demo/status pages intended for the public trial build.

Not public:

- Draft cases.
- Archived cases.
- `ai-manager` local Case Manager tooling.
- Imported source notes and unreviewed TODO material.
- Local file paths, secrets, or admin-only details.

## Content And Route Reality

Condition pages use flat MDX files:

```text
content/{region}/{condition}.mdx
```

The sections inside those files are parsed from `##` headings and rendered as in-page anchor navigation. They are not separate files or separate routes.

Guided cases live under:

```text
content/cases/{region}/{caseSlug}.mdx
```

Published cases may have a neutral `publicSlug`. Public routes use that neutral slug, while internal filenames and metadata remain available for source tracking.

## Route Safety Checks

After build, `check:no-leak` and `check:routes` confirm that:

- required public routes exist,
- published cases have public routes,
- draft and archived case routes are absent,
- diagnostic internal case routes are not generated when a neutral `publicSlug` is used,
- `/ai-manager` is absent from the public export.

Run them directly if needed:

```powershell
npm run check:no-leak
npm run check:routes
```

## Manual Spot Checks

After `npm run preflight`, expected public case routes include neutral labels such as:

```powershell
Test-Path "out\cases\cervical\case-01-neck-arm-symptoms\index.html"
```

Expected private/diagnostic routes should be absent:

```powershell
Test-Path "out\cases\cervical\craniocervical-instability-ra-patient-case-01\index.html"
Test-Path "out\cases\cervical\cervical-radiculopathy-case-01\index.html"
Test-Path "out\ai-manager"
```

These should return `False` for draft/private, diagnostic internal, and admin routes.

## If Preflight Fails

Do not bypass the failing check. Fix the first failing command and rerun `preflight`.
If `check:generated-sources` reports stale output, deliberately regenerate and
review only those outputs:

```powershell
npm run tracker:legacy
npm run registry:sources
npm run check:generated-sources
npm run preflight
```

Common failure categories:

- `check:hygiene`: flagged names, TODO text, or generated draft markers in scanned content.
- `check:sources`: missing or inconsistent source metadata.
- `check:secrets`: committed secret-like strings.
- `build`: route, MDX, TypeScript, or static export errors.
- `check:no-leak` or `check:routes`: public route safety regression.
