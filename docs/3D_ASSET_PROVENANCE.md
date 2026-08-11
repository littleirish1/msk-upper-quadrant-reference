# 3D Asset Provenance

The interactive body map / 3D anatomy model is experimental and is not part of the public route tree.

The independent review named four GLB files, but none is present in the current repository tree or Git `HEAD`. No source, author, licence, attribution, modification, anatomical review, or clinical review evidence is available in this repository. Missing values therefore remain explicitly unknown.

| Filename | Current repository location | Original source | Author | Licence | Attribution required | Modifications made | Anatomical review status | Clinical review status | Public eligibility |
|---|---|---|---|---|---|---|---|---|---|
| `hand.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `overview-skeleton.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `upper-limb.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `vertebrae.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |

## Newly Inspected Private Source Candidates

`ai-manager/clinical-platform/anatomy-3d/source-candidates.json` is a metadata-only private-authoring ledger. The source archives and all extracted binaries remain outside Git, `public/`, `src/app/`, search, sitemap, learner JSON, and static output.

| Candidate | Exact evidence | What is now known | What is still blocked | Public eligibility |
|---|---|---|---|---|
| `Z-Anatomy.zip` | SHA-256 `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`; exact Git blob match `f43cabc6f366b2a6058dd2ed4a2b3c7b9b2492cb` at upstream commit `98d6780fed69fa56ee43ff5c4f2f0abe2a12c2a4` | Upstream source licence is CC BY-SA 4.0; required model attribution names Z-Anatomy and BodyParts3D; Microsoft Defender found no threats in the supplied archive | No exact regional derivative selected; no structure-level mapping; derivative attribution/share-alike package, anatomy, accessibility, performance, clinical and publication reviews remain open | false |
| `files (2).zip` biomechanics package | SHA-256 `dc190e05e3818543ede0eea0a6f9fe03d327ecf407401b4552ca05fd5451547f`; five GLB hashes and structural metadata recorded in the ledger; Microsoft Defender found no threats | GLB 2.0 headers and lengths are valid; all five files use Draco compression; the package contains 18 proposed movement definitions | Declared source exports and build scripts are missing; derivative provenance cannot be reproduced; GLBs embed no copyright metadata; licence file/attribution package absent; movements and labels are not visually, anatomically, clinically or evidentially approved | false |

The biomechanics README's reported “mesh” counts are actually closest to GLB node counts. The ledger records node and mesh counts separately. The package README also states that the rig was not visually validated. Its React component defaults to `/models/*` and `/draco/`, so it must not be copied into the learner application unchanged; the focusable WebGL canvas also sits under an `aria-hidden` container and requires accessibility correction before private review use.

The private candidate pipeline deliberately separates the two archive/source-package records from five exact derived-GLB records and 18 movement-definition records. Each derived GLB retains its own hash, parent archive, declared lineage, GLB scene/node/mesh/primitive/material/skin/animation counts, encoded bounds, and empty external-resource list. The five GLBs contain no animation clips, and technical GLB validity is not anatomical or movement approval. Their exact-file licence lineage is unresolved even though the upstream Z-Anatomy licence family is known.

The pipeline is region-agnostic. Candidate regions are validated against `content-studio-config.json`, and governed movement registries are provided as configuration rather than hard-coded region logic. A synthetic hip fixture exercises the same anatomy, movement, provenance, licensing and blocker path used by the real records.

## Quarantine Rule

If any of these assets are recovered, place them under `ai-manager/assets/3d-models/quarantine/` until all provenance and review fields are verified. Do not place them under `public/` and do not include them in a public build.

Large originals and candidate derivatives should remain in the configured external private data root, not Git. The repository quarantine path is a policy marker and may hold metadata only.

## Public Eligibility Gate

Public eligibility remains false until all of the following are complete:

- source and author verified,
- licence and attribution obligations verified,
- modifications documented,
- anatomical review completed,
- clinical review completed,
- compressed and runtime memory sizes measured,
- mobile performance reviewed,
- keyboard and screen-reader controls reviewed,
- reduced-motion behaviour verified,
- WebGL fallback verified,
- educational/not-diagnostic wording approved.

## Private Prototype Governance

Historical prototype code remains recoverable on the preserved deployment and
feature branches. The integrated branch keeps only dependency-free
classification and governance material. A private prototype must not become a
public route, navigation item, search entry, sitemap entry, or static asset.

Before any asset is evaluated, record a stable asset ID, exact checksum, source,
author, licence, redistribution terms, attribution, modification history, and
processing-tool versions. Unknown provenance or rights is a hard stop. Asset
processing must be reproducible from the governed source and must not silently
change geometry, labels, textures, coordinate systems, or units.

Anatomical review must verify region tags, structure identity, laterality,
orientation, attachment/relationship claims, and educational labels.
Movement or biomechanics features require separate verification of axes,
ranges, constraints, assumptions, and limitations; visual plausibility is not
clinical validation.

Technical review must define and measure polygon, texture, download, decoded
memory, and interaction-frame budgets. It must include constrained-mobile and
reduced-motion fallbacks, useful text alternatives, keyboard operation, focus
visibility, assistive-technology behavior, and a non-WebGL route fallback.

Public release requires separate recorded approvals for provenance/licence,
anatomical accuracy, any biomechanics behavior, accessibility, performance,
privacy, and clinical framing. No one approval implies another. Until every
gate is complete, assets stay outside `public/`, `src/app/`, search generation,
and static output.
