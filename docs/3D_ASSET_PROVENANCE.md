# 3D Asset Provenance

The interactive body map / 3D anatomy model is experimental and is not part of the public route tree.

The independent review named four GLB files, but none is present in the current repository tree or Git `HEAD`. No source, author, licence, attribution, modification, anatomical review, or clinical review evidence is available in this repository. Missing values therefore remain explicitly unknown.

| Filename | Current repository location | Original source | Author | Licence | Attribution required | Modifications made | Anatomical review status | Clinical review status | Public eligibility |
|---|---|---|---|---|---|---|---|---|---|
| `hand.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `overview-skeleton.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `upper-limb.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |
| `vertebrae.glb` | Not present | unknown | unknown | unknown | unknown | unknown | unknown / no verified record | unknown / no verified record | false |

## Quarantine Rule

If any of these assets are recovered, place them under `ai-manager/assets/3d-models/quarantine/` until all provenance and review fields are verified. Do not place them under `public/` and do not include them in a public build.

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
