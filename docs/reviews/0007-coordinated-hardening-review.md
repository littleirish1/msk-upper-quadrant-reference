# Review 0007 - Coordinated hardening review

## Initial Verdict

Needs changes before commit.

## Positive Evidence

- Coordinated hardening checks passed before re-review.
- Netlify is configured to run the full preflight gate and publish out.
- Forty-seven raw station IDs matched 47 extracted station files.
- Current local public output excluded the 3D route.
- Current local public output excluded ai-manager.
- No public GLB files existed in the local working tree/export.
- Contracts and deterministic checks were substantially improved.

## Blockers Identified

### B1 - Repository/history exposure requires human control

Open / human action. The deleted legacy blob remains reachable in Git history and
remote refs. Repository visibility and any history rewrite are owner-controlled.

### B2 - Remote feature and main refs require human review

Open / human action. The fetched feature ref contains a public 3D route and four GLB
objects. The fetched remote main tip also contains a public 3D route. No remote ref
was changed by this pass.

### B3 - First review packet included deleted private source body

Pending independent supplement review. The unsafe locally generated packet was removed.
Review workflow now requires filtered patches and a separate deletion summary.
A deterministic redaction scanner/exporter is included. The first replacement packet
passed content inspection but omitted the three changed security-tooling files that
implement its guarantees. A complete supplement must include their source and diff,
pass deterministic self-scan tests, and pass independent review before B3 can close.

### B4 - Stable legacy source fingerprint was missing

Closed in repository. The approved source ID, Git blob ID, exact-byte SHA-256,
station count, and public-ineligibility state are recorded. Extractors reject
fingerprint mismatches.

### B5 - Generated metadata currentness was not mandatory

Closed in repository. Preflight now regenerates tracker and registry against exact
snapshots, restores prior bytes, and fails on drift. GitHub validation no longer
pre-generates the registry before preflight.

### B6 - Malformed import README heading

Closed in repository. The first line is exactly the required heading and is UTF-8.

## Acceptance Requirements

- B4, B5, and B6 closed in repository.
- B3 remains pending until the security-tooling supplement passes independent review.
- B1 and B2 remain explicit human actions.
- A redacted replacement packet is produced and reports zero findings.
- Full preflight passes.
- No clinical body content changes.
- No local public 3D route/assets.
- Source accounting remains 47/47.

## Repository Blockers Closed By This Pass

B4, B5, and B6 are closed. B3 remains pending independent supplement review.

## Remaining Human Blockers

B1 and B2 remain open. External credential action, repository visibility, history
rewriting, remote-ref cleanup, 3D licensing, and clinical approval are also human
controlled.

## Re-review Status

Repository validation and the first packet content review passed, but the security
tooling evidence gap remains. No commit or push is approved pending independent review
of the complete supplement. B1 and B2 remain human-controlled.
