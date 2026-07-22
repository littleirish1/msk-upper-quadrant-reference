# Review 0008 - Foundation integration

## Verdict

Foundation integration is structurally ready for product work. Independent review is still required before any update to `main` or remote push.

## Integration Basis

- Remote basis: `638c153665a28dbe9cbfff3bdf1a203851db4ec6`.
- The remote-only public 3D prototype was reversed in `adfc776`.
- Stable provenance hardening was applied in `58f8e11`.
- Content contracts and public-boundary checks were applied in `350f315`.
- Deterministic source, build, secret, and review gates were applied in `a178afc`.
- Governance contracts were applied in `374f78c`.
- The complete redacted evidence packet remains preserved on the local safety branch and was not copied wholesale into this integration branch.

## Public Boundary

- Netlify uses `npm run preflight` and publishes `out`.
- GitHub Actions is validation-only.
- Public `/3d-model` route: absent.
- Public GLB files: zero.
- Public `ai-manager` output: absent.
- The safe type refinement and `.netlify` ignore entry from the remote commit were retained.

## Content And Source Accounting

- Condition files validated: 33.
- Guided case files validated: 9.
- Published guided cases: 6.
- Private guided cases excluded: 3.
- Legacy source stations accounted for: 47 of 47.
- No clinical case body was deliberately changed during integration.

## Validation

`npm ci` completed using the lockfile. It reported existing dependency audit warnings; no automated remediation was run.

The following passed:

- secret scan;
- generated-source currentness;
- source integrity;
- frontmatter validation;
- content contracts;
- deterministic search;
- diagnosis no-leak;
- reveal smoke checks;
- route checks;
- internal links;
- 3D boundary checks;
- TypeScript type-check;
- static build;
- full preflight.

## Remaining Human Actions

- Keep the repository private while historical source and remote-ref exposure are unresolved.
- Review any future update of `main` explicitly.
- Keep remote branch cleanup, history remediation, credential action, asset licensing, and clinical approval under human control.

## Review Status

Pending independent review. No push occurred.
