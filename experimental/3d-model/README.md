# Experimental 3D Model Scaffold

No public 3D route or model asset is present in the current repository state. This folder holds only dependency-free classification logic that a future reviewed prototype can reuse.

## Public Boundary

- Do not import this folder into `src/app/` while public eligibility remains false.
- Do not place model assets in `public/`.
- Unverified assets belong in `ai-manager/assets/3d-models/quarantine/` and must not be copied into `out/`.
- The experience must remain educational and must not be presented as a diagnostic tool.

## Future Interaction Requirements

A future prototype must:

- classify a selected mesh by walking its ancestor chain,
- classify layer visibility from the nearest recognised ancestor or explicit `userData` value,
- use local ambient, directional, and optional hemisphere lighting,
- avoid remote HDR or environment downloads,
- provide labelled, keyboard-operable controls,
- expose pressed state with `aria-pressed`,
- respect reduced-motion preferences,
- provide a meaningful WebGL-unavailable fallback,
- load only the model needed for the active view.

## Performance Gate

No approved mobile asset-size limit exists yet. Before public eligibility is reconsidered, each asset must have its compressed and decoded size measured, a mobile budget agreed, and representative low-power devices tested.
