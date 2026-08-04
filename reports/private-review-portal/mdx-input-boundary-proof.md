# `next-mdx-remote` input-boundary proof

Date: 2026-08-04
Reviewed candidate: `2caea5c3f907a53c21b0b655b017ec5509d702de` / tree `a5e09fe3c19cc1d1e4e733284b28176d08fe1d96`

## Result

PASS. The repository has exactly three `next-mdx-remote` compiler/render entry points. Every entry point receives content read during the static build from regular, Git-tracked files under `content/**/*.mdx`. No request body, URL, portal upload, private document, derived output or arbitrary filesystem path reaches an MDX compiler.

`npm run check:mdx-input-boundary` enforces this allowlist, source provenance, tracked-file requirement, symlink rejection and portal/compiler separation. It runs directly in preflight and at the start of the `prebuild` hook, so both complete validation and the normal production build fail closed if the boundary changes.

## Entry-point trace

| Entry point | Compiler input | Provenance |
|---|---|---|
| `src/app/[region]/[condition]/page.tsx` | `result.content` | `getPublicConditionContent` first resolves an exact record from taxonomy-aligned files enumerated below `content/<region>/*.mdx`, then reads that record. Static parameters are derived from the same records and `dynamicParams` is false. |
| `src/app/cases/[region]/[caseSlug]/page.tsx` | `casePresentationContent` | The public slug must resolve against files enumerated below `content/cases/<region>/*.mdx`; `getCaseContent` reads that resolved file. The rendered presentation is a deterministic extraction from its sanitized content. |
| `scripts/build-case-reveal-payloads.mjs` | `revealContent` | `collectCaseFiles` recursively enumerates `content/cases/**/*.mdx`; `readCaseFrontmatter` reads the selected file and schema-validates its frontmatter. The reveal is a deterministic extraction from that content. |

At proof time the check found 45 regular MDX files on disk, all 45 tracked, with zero untracked or symlinked MDX files.

## Private-input exclusion

The separate private portal contains zero `next-mdx-remote`, `MDXRemote` or `compileMDX` imports/calls. Its data root is rejected if it falls inside the repository. A clean text/Markdown/CSV upload may produce only a non-overwriting inert `.txt` preview under the external private data root; that preview is served as `text/plain` and has no path into `content/` or the learner build.

## Residual boundary and trigger

This is a controlled build-time acceptance, not a claim that the affected dependency is safe. `next-mdx-remote@5.0.0` remains affected by GHSA-g4xw-jxrg-5f6m. Re-review is due by 2026-09-03 and must happen earlier if a compiler entry point changes, any non-tracked input is proposed, a request-time renderer is introduced, the portal is connected to learner content, or the deployment moves away from static export.
