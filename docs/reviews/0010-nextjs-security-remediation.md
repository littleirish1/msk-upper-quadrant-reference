# Review 0010 - Next.js 14.2 security remediation

## Verdict

Pending independent review

## Review Range

- Base: `33a54a5bc4bdea1ac667bfa8a47160c2d78fecf6`
- Remediation implementation head: `aeb6f09b869caa62395927942a57d55b07d8f2be`
- Branch: `security/next-14-2-35`
- Review evidence is recorded by this follow-up documentation commit and does not alter runtime implementation.

## Package Changes

- Direct dependency `next`: `14.2.5` to `14.2.35`.
- `eslint-config-next`: remains `14.2.5`; no compatibility failure required changing it.
- `next-mdx-remote`: unchanged at the existing 5.x range.
- `@next/env`: `14.2.5` to `14.2.35`.
- Nine optional platform SWC packages: `14.2.5` to `14.2.33`, as selected by Next 14.2.35.
- Lockfile version: remains 3.
- Package additions/removals: none.
- Install-script metadata changes: none.
- `next-env.d.ts`: Next regenerated its documentation URL comment; no type or runtime declaration changed.

The lock diff changes 11 installed-package entries: Next, `@next/env`, and nine optional SWC platform packages. Linux SWC entries also gain current `libc` metadata. Next's own lock metadata updates its dependencies, optional dependencies, and deprecation notice. No unrelated package churn was identified.

## Audit Comparison

| Audit measure | Before (`14.2.5`) | After (`14.2.35`) |
|---|---:|---:|
| Unique advisory records | 34 | 22 |
| Vulnerable package entries | 10 | 10 |
| Moderate package entries | 2 | 2 |
| High package entries | 7 | 8 |
| Critical package entries | 1 | 0 |
| Direct vulnerable packages | 4 | 4 |
| Transitive vulnerable packages | 6 | 6 |

The previously reported critical Next.js roll-up is removed and 12 advisory records are no longer reported. This update does **not** resolve all Next.js advisories. npm still reports 14 Next-specific advisory records, rolls Next up as high severity, and currently proposes Next `16.2.10` as its full fix path, which is a major upgrade and outside this review.

## Remaining Vulnerable Packages

- Direct: `next`, `next-mdx-remote`, `eslint-config-next`, `postcss`.
- Transitive: `@next/eslint-plugin-next`, `@typescript-eslint/parser`, `@typescript-eslint/typescript-estree`, `glob`, `js-yaml`, `minimatch`.

Remaining remediation includes major-version paths for Next, `next-mdx-remote`, and `eslint-config-next`. These require separate compatibility and security review. No automated audit fix was run.

## Build And Bundle Comparison

- Static pages: unchanged at 68.
- Generated HTML files checked: unchanged at 67.
- Shared first-load JavaScript: 87.3 kB to 87.5 kB.
- Learning route: 5.67 kB / 92.9 kB first load to 5.55 kB / 93.0 kB.
- Guided-case route: 9.13 kB / 111 kB first load to 9.02 kB / 112 kB.
- Other route payloads show small compiler/runtime variation, generally lower route-specific size and roughly 1-2.2 kB higher first-load totals.
- Build warnings: none.
- Route additions/removals: none.

## Public And Private Boundaries

- Published guided cases: 6.
- Private guided cases excluded: 3.
- Condition pages checked: 33.
- Public anatomy detail records: 0.
- Public `/3d-model` routes: 0.
- Public/exported GLB files: 0.
- Public `ai-manager` files: 0.
- Draft/private leakage findings: 0.
- Reveal blocks checked: 43.
- Internal links checked: 2,768 across 67 HTML files.

## Validation

The following completed successfully after a clean `npm ci`:

- TypeScript type-check.
- Frontmatter and content contracts.
- Generated-source currentness.
- Hygiene, source integrity, and secret scanning.
- Search, diagnosis no-leak, reveal, route, and internal-link checks.
- 3D, anatomy, learning, AI-manager, and review-packet checks.
- Standalone static build.
- Full `npm run preflight`.
- `git diff --check`.

The build used Next.js `14.2.35`, generated 68 static pages, and emitted no warnings.

## Scope Confirmation

- Clinical content changed: no.
- Public routes or learner behaviour changed: no.
- Major dependencies upgraded: no.
- Tests or security gates weakened: no.
- Independent review folder modified or staged: no.
- Push or merge performed: no.

## Residual Risk

- Next.js remains in npm's high-severity advisory roll-up and requires a separately reviewed major upgrade for the currently reported full remediation.
- `next-mdx-remote` remains high severity; its major upgrade was intentionally deferred.
- Build and development dependencies retain high/moderate advisories.
- Static export reduces exposure to server-only code paths but does not prove the remaining advisories unreachable.

This branch must not be merged until the narrow dependency diff and validation evidence receive independent review.
