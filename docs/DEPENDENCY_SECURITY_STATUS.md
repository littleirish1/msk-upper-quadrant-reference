# Dependency Security Status

## Current Pins

- `next`: `14.2.35`.
- `eslint-config-next`: `14.2.5`.
- `next-mdx-remote`: existing 5.x range.
- Lockfile version: 3.

The current pins passed the prior scoped Next.js remediation build and the
integrated type/Evidence Hub checks. No React Three or Three.js runtime
dependency is present.

## Last Reviewed Audit Baseline

Review 0010 recorded 22 advisory records after the Next.js 14.2.35 patch. It
reported 10 vulnerable package entries: 2 moderate and 8 high, with no critical
entry. Direct affected packages were Next.js, `next-mdx-remote`,
`eslint-config-next`, and PostCSS. Transitive affected packages included the
Next ESLint plugin, TypeScript ESLint parser packages, Glob, js-yaml, and
Minimatch.

That baseline also recorded that npm still classified Next.js as high severity
and proposed a major-version upgrade for complete remediation. Major upgrades
of Next.js, `next-mdx-remote`, and `eslint-config-next` remain outside this
integration scope.

## Current Audit Limitation

A fresh `npm audit --json` request was attempted under Node `20.20.2`. The
sandboxed npm audit endpoint was unavailable, and approval for an unsandboxed
registry query was denied because it would transmit dependency metadata. npm's
offline audit mode had no usable cached response. The current advisory set is
therefore not re-verified by this generator run and must not be described as
current or resolved.

## Risk And Next Action

Static export reduces exposure to server-only execution paths, but does not
prove that an advisory is unreachable. Keep the repository private, retain the
current tested patch line for this integration, and use a separate dependency
remediation branch to:

1. run a fresh audit in an approved network environment;
2. map each advisory to build-time, development-time, or shipped client code;
3. test compatible non-breaking updates first;
4. plan major framework upgrades separately with route, bundle, static-export,
   accessibility, and preflight regression review.

No `npm audit fix` was run.
