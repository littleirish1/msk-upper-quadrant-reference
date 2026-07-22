# Review 0001 - Repository hardening baseline

## Verdict

Baseline recorded from verifiable repository configuration, checks, Git history, and current generated outputs. It is not a retrospective reconstruction of missing reviews.

## Scope Reviewed

- Static public deployment boundary
- Guided-case publication and diagnosis-hiding gates
- Shared frontmatter schema
- Source registry and legacy migration tracker
- Review contracts and existing review logs
- Experimental 3D public boundary
- Current deterministic checks

## Verified Baseline

- Netlify is the public deployment target.
- `netlify.toml` runs `npm run preflight` and publishes `out`.
- GitHub Actions is validation-only.
- The public app uses static export.
- `ai-manager/` is local/private.
- Condition content uses one flat MDX file per condition.
- Guided cases use explicit status and neutral published slugs.
- Draft and archived cases are excluded by route checks.
- Diagnosis no-leak and reveal checks are part of preflight.
- Shared Zod schemas validate condition and guided-case frontmatter.
- Search generation is deterministic through `prebuild`.
- The source registry and migration tracker are metadata-driven.
- No public `/3d-model` route or GLB asset exists in the current repository state.

## Phase Status

| Area | Status | Evidence |
|---|---|---|
| Phase 0 repo-side secret controls | closed | `check:secrets`, redacted import, cross-platform clean script |
| Phase 0 upstream Google key action | blocked / external owner | `docs/RELEASE_BLOCKERS.md` |
| Phase 1 diagnosis-hidden routes and UI | closed for current published cases | `check:no-leak`, `check:routes`, review 0002 |
| Phase 2 deployment alignment | closed | Netlify config, validation-only workflow, deployment docs |
| Phase 3 search determinism | closed | `prebuild`, `check:search` |
| Phase 3 shared frontmatter schema | closed for current loaders/checks | `contentSchemas.ts`, `check:frontmatter`, review 0004 |
| Phase 3 taxonomy code generation | open | no taxonomy code-generation script exists |
| Phase 3 minimal test layer | partial | route, reveal, no-leak, search, source, schema checks exist |
| Phase 3 MDX sanitisation replacement | open | regex-based comparator escaping remains in `src/lib/mdx.ts` |
| Phase 3 raw legacy cleanup | pending at baseline | raw HTML still present before coordinated hardening |
| Phase 4 contracts | partial at baseline | IA/UX/agent contracts exist; content/governance contracts pending |
| Phase 5 periodic review loop | partial | review logs exist but numbering has historical gaps |

## Open Risk Ledger

- Upstream rotation/deletion/restriction of the historical Google credential remains an external-owner action.
- Script-side TypeScript data-URL loading is fragile if shared TS modules gain relative imports.
- Regex-based MDX comparator sanitisation remains a documented parser risk.
- Clinical correctness remains dependent on clinician review.
- 3D asset provenance is unknown; public eligibility is false.
- The reviewed 3D UI prototype is absent from the current repository, so UI-specific accessibility/performance fixes cannot be verified here.
- Historical review entries 0003 and 0005 are absent and must not be fabricated.
