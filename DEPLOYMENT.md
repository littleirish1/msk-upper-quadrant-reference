# Deployment

This project is prepared for a Netlify trial demo as a static Next.js export. The current public content is Phase 1 of a broader MSK Clinical Reasoning Lab, with future whole-body physiotherapy scope.

## Local Working Directory

Use the local project copy at:

```powershell
C:\dev\msk-upper-quadrant-reference
```

Avoid running deployment or Case Manager commands from older synced copies.

## Install

```powershell
npm install
```

## Local Validation

Run these from `C:\dev\msk-upper-quadrant-reference` before a demo or deployment:

```powershell
npm run registry:sources
npm run tracker:legacy
npm run preflight
```

`npm run preflight` runs:

```powershell
npm run clean:build
npm run check:hygiene
npm run check:sources
npm run build
```

## Netlify Settings

Build command:

```powershell
npm run preflight
```

Publish directory:

```powershell
out
```

The project uses `output: 'export'` in `next.config.mjs`, so `next build` writes the static learner site to `out`.

`next.config.mjs` currently sets `basePath: '/msk-upper-quadrant-reference'`. `netlify.toml` includes small rewrite rules so those base-path URLs resolve against the static files in `out` during the Netlify trial.

## Public Surface

Public:

- Published learner site pages.
- Published condition, region, red-flag, search, and guided case pages.
- Public demo/status page for the trial build.

Not public:

- Draft cases.
- Archived cases.
- `ai-manager` local Case Manager tooling.
- Source notes, TODO material, and unreviewed draft material.

The local Case Manager can show source registry and metadata-driven tracker state, but it is not part of the public Netlify export.

## Draft Route Check

After `npm run preflight`, confirm draft-created cases are absent from `out` and published cases are present:

```powershell
Test-Path "out\cases\cervical\craniocervical-instability-ra-patient-case-01\index.html"
Test-Path "out\cases\cervical\cervical-radiculopathy-case-01\index.html"
```

The draft route check should return `False`; the published route check should return `True`.

## Known Non-Blocking Warnings

- `src/components/Header.tsx`: unused `cn`.
- `src/components/Sidebar.tsx`: unused `pathname`.

These warnings should be cleaned up, but they do not currently block the Netlify trial build.

## If Preflight Fails

Do not bypass the failing check. Read the first failing command in the output, fix the underlying issue, and rerun:

```powershell
npm run registry:sources
npm run tracker:legacy
npm run preflight
```

Common failure categories:

- `check:hygiene`: source notes, TODO text, or generated draft markers leaking into published content.
- `check:sources`: missing or inconsistent source metadata on legacy-derived cases.
- `build`: route, MDX, TypeScript, or static export errors.

## Trial URL Note

For a longer-lived Netlify root-domain deployment, review whether the current `basePath` should stay. Removing it would be a separate routing/config decision from this trial-demo setup.
