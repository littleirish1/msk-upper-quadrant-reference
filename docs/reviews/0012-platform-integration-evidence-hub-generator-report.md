# Review 0012 - Platform integration and Evidence Hub generator report

## Verdict

Ready for independent review. This is generator evidence, not independent
approval and not approval to merge to production.

## Review Range

- Repaired production base: `4104b7050afa43e9e613459c56301e2f9482a134`.
- Advanced source-ingestion tip merged: `14ef4b4ec55bf21e33579cd69299dc5dee46b37f`.
- Validated implementation snapshot before this evidence-only commit:
  `a8d8264`.
- Integration branch: `integration/platform-v2-source-evidence-hub-v1`.
- Main remained at the repaired production base throughout generation.

## Integration Decisions

- The advanced chain was merged with an explicit merge commit; its historical
  commits were not squashed.
- Conflicts in `package.json`, hygiene and 3D checks, homepage navigation,
  header, mobile navigation, and experimental prototype files were resolved
  individually.
- Main's tracked/staged/public hygiene scope and 10 regression scenarios were
  retained.
- Advanced Platform V2 anatomy and learning navigation was retained without a
  3D link. Mobile Search was retained.
- Public/runtime 3D prototype TSX files were omitted. Dependency-free private
  classification/governance material was retained. The historical prototype
  remains recoverable on preserved branches.
- Next.js remains `14.2.35`. `eslint-config-next` remains the previously tested
  `14.2.5` pin because no compatibility failure justified lockfile churn.
- The Evidence Hub architecture was applied from the clean architecture
  branch. The implementation spike was reviewed and selectively ported rather
  than cherry-picked wholesale.

## MDX Loading

- Added a pure deterministic MDX parsing module and nine assertions covering
  frontmatter, H2 sections, excerpts, malformed/empty input, stable output, and
  case status/neutral slug handling.
- Replaced phrase-specific comparator substitutions with contextual escaping
  outside fenced code, inline code, and JSX/HTML tags.
- Tests cover `<45`, `>90%`, and `p<0.05`.
- Added an authoring guide.
- Corrected the completion-matrix currentness check to compare normalized line
  endings, avoiding a Windows CRLF false stale result without changing content.

## Source Ingestion Closure

- Governed Python tests: 17 passed.
- JavaScript source-policy checks: 60 passed.
- Review-packet redaction scenarios: 29 passed.
- Source-intake validation: 133 unique sources; 10 quarantined; 42 restricted
  pending clearance; 0 candidate references; 2 blocked proposals; 0 public
  eligibility.
- Exact Git object-field exceptions remain narrow; malformed, adjacent,
  telephone-shaped, secret, private-path, raw-source, and binary cases remain
  rejected.
- No source was cleared, no external reference was verified, and no proposal
  was approved or published by this integration.

## Evidence Hub Status

- Architecture and the private core define all ten v1 entities, lifecycle,
  revision/hash-scoped review decisions, relationships, JSON Schema, public
  projection, tests, and disabled pilot placeholders.
- Public Evidence requires explicit `public-evidence-use` source scope.
- Canonical References are explicit Evidence publication dependencies.
- Missing, stale, invalid, restricted, private, unverified, unreviewed, and
  unapproved dependencies fail closed with reasons.
- Relationship validation checks missing IDs, revisions, invalid directions,
  reveal gating, supersession cycles, publication dependency cycles, and
  orphan declared links.
- AI proposals cannot represent approval or public eligibility.
- Public projection strips source locators, source identifiers, checksums,
  internal titles, review metadata, and verification evidence.
- Public app/components imports of the private Evidence Hub are rejected.
- Current dataset: 0 records, 0 relationships, 0 review decisions, 0 proposals,
  2 disabled private placeholders, and 0 public projection records/files.
- Evidence Hub deterministic assertions: 20 passed.

## Deployment And Public Boundaries

- Netlify remains the sole documented deployment target.
- `netlify.toml` runs `npm run preflight` and publishes `out`.
- Preflight performs one Next.js production build.
- Static build generated 68 pages and 67 HTML files.
- Public `/3d-model` routes: 0.
- Public GLB, GLTF, and Draco assets: 0.
- Public 3D references: 0.
- Public AI-manager files: 0.
- Private path markers in output: 0.
- Private Evidence Hub markers in output: 0.
- Search entries: 33 conditions; cases remain intentionally excluded.
- Published guided cases: 6; private cases excluded: 3.
- Neutral case routes: 6; diagnosis-leak findings: 0.
- Reveal blocks: 43; renderer remains native closed `details`/`summary`.
- Internal links: 2,168 across 67 HTML files.

## Dependency Status

`npm ci` completed under Node `20.20.2` with npm `10.8.2`, installing 553
packages without changing the lockfile. It reported deprecation warnings for
legacy lint/build dependencies.

A fresh registry-backed `npm audit --json` could not be completed in the
sandbox. The endpoint was unavailable, and unsandboxed dependency-metadata
egress was denied. Offline mode had no cached response. Review 0010's prior
baseline remains the last reviewed result: 22 advisory records and 10 affected
package entries (2 moderate, 8 high, 0 critical). This is not asserted as a
current audit. No `npm audit fix` was run.

## Validation

| Command | Result |
|---|---|
| `git diff --check` | Passed |
| `npm ci` | Passed; 553 packages; lockfile unchanged |
| `npm run type-check` | Passed |
| `npm run test:mdx` | Passed; 9 assertions |
| `npm run test:source-intake` in governed environment | Passed; 17 Python tests and 60 JS checks |
| `npm run test:review-redaction` | Passed; 29 scenarios |
| `npm run check:hygiene` | Passed; 10 scope scenarios and repository scan |
| `npm run check:sources` | Passed |
| `npm run check:secrets` | Passed |
| `npm run check:frontmatter` | Passed; 33 conditions and 9 cases |
| `npm run check:generated-sources` | Passed; 47/47 legacy stations |
| `npm run check:platform-content` | Passed; 33 conditions, 9 cases, 7 stable IDs |
| `npm run check:source-intake` | Passed; fail-closed counts above |
| `npm run test:evidence-hub` | Passed; 20 assertions |
| `npm run check:evidence-hub` | Passed; no public records/files |
| `npm run check:anatomy` | Passed; 9 private records, 0 public details |
| `npm run check:learning` | Passed; 6 private examples |
| `npm run check:ai-manager` | Passed; provider disabled, no public files/network requirement |
| `npm run preflight` | Passed in 196 seconds with one 68-page build |
| Post-build output inspection | Passed; boundary counts above |

Output-dependent content-contract, search, 3D, link, no-leak, reveal, and route
checks all passed inside the final preflight against the fresh export.

## Branch Housekeeping

No branch, tag, worktree, remote, or history was deleted or rewritten. All
advanced milestone branches listed in `docs/BRANCH_STATUS.md` were confirmed as
ancestors of the integration branch. The architecture and implementation-spike
branches were selectively applied and remain review references. The historical
3D remote branch and safety worktree remain separate and untouched.

## Unresolved Human And External Gates

- Independent code, privacy, publication-boundary, and UX review.
- Human inspection of a Netlify branch preview.
- Approved network audit and a separately scoped dependency-remediation plan.
- Clinician approval for clinical/anatomy/learning content before publication.
- External source/reference verification, licence review, and any credential
  rotation by the responsible owner.
- Human decisions about repository visibility, remote branch cleanup, and any
  history remediation.
- No Linux/Netlify run was performed locally; Windows success does not prove
  Linux behavior.

## Independent Review Focus

- Reproduce the resolved hygiene and deployment boundaries.
- Review MDX comparator parsing against real authored edge cases.
- Audit Evidence Hub publication dependencies, recursive cycles, private-field
  stripping, and public-runtime disconnection.
- Re-run source-intake and packet exactness tests in the governed environment.
- Inspect homepage/header/mobile/case learning flows at mobile and desktop
  sizes with keyboard and screen-reader semantics.
- Run a fresh approved dependency audit.
- Inspect the Netlify branch preview before considering a human merge.
