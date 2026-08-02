# Version 1 completion integration

## One generation surface

`npm run clinical-platform:generate` rebuilds the governed guided-case source, clinical modules, truth records, compatibility catalogue, seeded patients, conversation projections, 3D and movement registries, ingestion and Evidence Hub metadata, legacy and regional matrices, MCQ slots, beta programme, private authoring snapshot, exact-revision reviews, measured quality report, and fail-closed release candidate in dependency order.

## One focused validation surface

`npm run test:clinical-platform` executes the focused tests for every Version 1 subsystem. It does not replace the repository-wide preflight; preflight runs the focused suite after the production build and then performs deterministic currentness verification.

## Currentness

The currentness check captures repository status, regenerates all Version 1 artefacts, and requires byte-equivalent status afterwards. It includes untracked paths in the comparison without reading their contents, so pre-existing protected review material remains untouched while new or changed generated artefacts fail the check.

## Release boundary

Successful automation establishes build integrity, not clinical approval. Exact-revision human review, beta governance, accessibility sign-off, dependency treatment, independent review, and publication approval remain release blockers.
