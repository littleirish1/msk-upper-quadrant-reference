# Governance And CI Contract

## Public Deployment

Netlify is the only public deployment target.

`netlify.toml` must use:

```toml
[build]
command = "npm run preflight"
publish = "out"
```

GitHub Actions is validation-only. It may run `npm run preflight`, but it must not publish a competing public build.

## Mandatory Publish Gate

`npm run preflight` is the mandatory publish gate. It must not be bypassed or replaced by a narrower build command.

Publication fails when any mandatory check fails, including:

- hygiene or prohibited draft markers,
- source integrity,
- secret scanning,
- frontmatter/content contracts,
- static build,
- search integrity,
- 3D public-boundary checks,
- internal links,
- diagnosis no-leak,
- reveal structure,
- route safety.

## Review And Approval Model

The required sequence is:

```text
Generator -> reviewer -> clinician -> publish
```

- The generator prepares the diff and validation evidence.
- A second agent or human reviewer checks the claim against the diff, contracts, and previous review log.
- A clinician signs off clinical content.
- Only reviewed content that passes preflight may publish.

The review unit is a pull request or phase milestone, not the whole repository. Follow `docs/REVIEW_WORKFLOW.md`.

Risky changes require a review packet, including diagnosis hiding, reveal flow, routes, deployment, schema/parser refactors, clinical case structure, large UI changes, and phase boundaries.

## Clinical Sign-Off

Clinician sign-off is required for changes to:

- clinical facts or case details,
- diagnosis and differential reasoning,
- red flags and escalation,
- assessment and management advice,
- model answers and teaching feedback,
- evidence interpretation.

Agents and automated checks cannot provide clinical approval.

## Secrets And Identifiable Information

Do not commit:

- API keys, credentials, private keys, or environment secrets,
- patient-identifiable information,
- unapproved staff-identifiable information,
- private local paths in public output.

Future imports must pass secret and hygiene scanning before commit. A passing scan does not replace information-governance review.

## External Assets And Licences

External media, 3D models, images, papers, and teaching assets require documented source, author, licence, attribution, modification history, and review status before public use.

Unknown provenance means public eligibility is false. Unverified 3D assets belong in the local/private quarantine described by `docs/3D_ASSET_PROVENANCE.md`.

## Static-Site Boundary

The public learner site remains a static export:

- no runtime AI,
- no public API,
- no database,
- no vector store,
- no learner-answer storage,
- no public admin tooling.

`ai-manager/` is local/private only and must never appear in `out/` or public navigation.

## Acceptance Criteria

- Netlify runs `npm run preflight` and publishes `out`.
- GitHub workflows are validation-only.
- `out/ai-manager` does not exist.
- Unknown-licence assets are absent from public output.
- Draft and archived cases are absent from public output.
- Clinical changes identify whether clinician sign-off is required.
- Review evidence follows `docs/REVIEW_WORKFLOW.md`.

## Sensitive Review Evidence

Review evidence follows the same information-governance boundary as runtime output.

For sensitive deletions, use a filtered patch and a separate deletion summary. The
summary may identify the repository path, object identifier, approved checksum,
prior size/line counts, accounting result, and omission reason. It must not reproduce
the deleted body.

Unfiltered diffs are not distributable when they contain private import material,
credential-bearing files, environment files, private assets, quarantined model
assets, or private clinical/source material. Review packets must pass the
deterministic redaction scanner before sharing.

Generated tracker and registry files are release inputs. Preflight must verify their
byte-currentness by regeneration against snapshots and restore their original bytes;
a workflow must not pre-generate them in a way that masks staleness.
