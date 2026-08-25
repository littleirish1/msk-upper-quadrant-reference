# MSK Private Review Portal and Content Review Studio

This is a separate Node.js runtime for private research and project review. It is not a Next.js route and is never part of the learner/static export. It binds to an explicit loopback address only. Remote access, when available, is an authenticated Tailnet HTTPS proxy created by Tailscale Serve; Funnel is prohibited.

## Safety boundary

- Do not upload patient-identifiable, Trust-confidential or clinical-record material.
- Uploading, registering material, adding a note or creating a task never grants clinical, evidence, source-clearance, licensing, accessibility, beta, publication, release or deployment approval.
- The portal reads authoritative governed repository records at request time. It does not copy or mutate clinical truth.
- Originals, derived files, audit logs and the private database stay outside Git.
- A passphrase of at least 16 characters is mandatory and is read only from `MSK_REVIEW_PORTAL_PASSPHRASE`.

## Content Review Studio

The first Studio phase is a generic private registry, not a shoulder application. Regions and content types are declared in `content-studio-config.json`; the browser renders those values without region-specific UI code. The first read-only adapter loads current shoulder cases, conditions, movement slots, anatomy and module records, planned 3D structures, MCQ slots, evidence/source records and compatibility rules without modifying their source files. Additional adapters can return the same registry contract for any configured region or collection.

A second read-only adapter loads the metadata-only anatomy/biomechanics source-candidate ledger. A generic private normalizer keeps pinned upstream archives, local candidate packages, derived GLBs and unadopted movement definitions as separate records, validates any governed movement-slot link against registry paths declared in `content-studio-config.json`, and exposes exact hashes, licence-family evidence, unresolved exact-file lineage, technical inventory and blockers. Provenance can be `PROVEN`, `PARTIALLY PROVEN` or `UNRESOLVED`; `PROVEN` requires binary identity or a reproducible input-to-output transformation, and filename similarity is explicitly rejected. Regions are data, not UI branches: the same pipeline test loads synthetic hip anatomy and movement candidates without adding a route or reviewer component. ZIP, Blend, GLB and unreviewed clinical code stay outside Git and the learner build. Source-licence evidence never changes `grantsApproval: false` and never makes a derivative publicly eligible.

Every item exposes an exact ID, region, content type, lifecycle, publication state, four review states, blockers, human-review tasks, source links, revision hash, completeness and an optional existing learner-route reference. The dashboard and library derive their counts and filters from those records. Missing or ambiguous authority is represented as not recorded or required; it is never inferred as approved.

The private **Version 1 Publication Review** view covers the 20 cervical, shoulder and elbow condition pages and the five baseline-reviewed public cases. Condition records are computed directly from the MDX bytes and use `review-required` / `legacy-publication-review-required` until a separate governed migration is authorised. The view records revision-bound clinical, evidence and publication recommendations, but every record remains `grantsApproval: false`, `publicationAuthorized: false`, and cannot change a learner publication state. Version 1 scope excludes private movement slots, unauthored MCQs, private modules and candidate 3D assets unless a future governance rule expressly makes one mandatory. Their private/fail-closed state is preserved independently.

The final 20-condition confirmation view is generated only after the Critical and Major adoption chains reconcile to each current condition hash. It records four blank, revision-bound human decisions (clinical accuracy, evidence sufficiency, clinical completeness and publication recommendation), rejects stale hashes, keeps future evidence expansion separate and non-blocking, and never turns confirmation into publication authority.

The default confirmation experience is clinician-first: each condition is identified by title and region, followed by the independent recommendation, its plain-English reason and the owner controls. A top-level table summarizes all 20 conditions. Exact hashes, confirmation keys, adoption lineage, canonical IDs and source/revision identifiers remain mandatory internally but appear only inside the collapsed **Technical / audit details** section. When `reports/publication-readiness/V1-INDEPENDENT-FINAL-20-CONDITION-RECOMMENDATIONS.json` is present, the Studio loads it only if it contains all 20 conditions, stays recommendation-only and matches every exact condition revision. A missing record is shown as unavailable; a malformed, over-authoritative or stale record fails closed.

The Content Studio mutations are private reviewer notes, human-review tasks, exact-revision review completion and metadata-only Extra Materials registrations. Approval changes, publication changes, clinical or evidence editing and deletion are not implemented. Notes, tasks and review completion require the current item revision hash and fail on stale revisions. Review completion also requires an explicit no-approval/no-publication declaration. It creates a metadata-only JSON proposal under the external private `exports` folder for later Codex assessment on a feature branch; it copies no governed content, modifies no repository file, and records `grantsApproval: false`, `publicationAuthorized: false` and `repositoryModified: false`. Extra Materials may classify a PDF, PowerPoint, image, video, legacy HTML or teaching note and may link an already quarantined private document; the registration remains in the external database with `publicationState: private` and `grantsApproval: false`.

## Guarded integration automation

An explicitly identified process may receive the `integration-proposer` role through `MSK_REVIEW_PORTAL_ACTOR_ID` and `MSK_REVIEW_PORTAL_ACTOR_ROLES`. A reviewer can then submit a completed exact-revision proposal to the private integration queue. The first policy is deliberately `review-adoption-only`: it creates a metadata-only manifest, never copies uploaded resources, never changes publication state and never grants approval.

`npm run private-portal:integration-worker -- --queue <uuid>` validates the immutable proposal, current repository revision and fail-closed controls, then prepares a private packet without Git or network mutations. Feature-branch execution additionally requires `MSK_REVIEW_INTEGRATION_EXECUTE=feature-branch-pr` and the explicit `--execute` flag in the dedicated worker process. Execution checks GitHub CLI authentication and main/origin identity, creates a generated worktree, stages exactly one allowlisted manifest, pushes only `content-review/<proposal>-<revision>` and opens a pull request. It contains no merge, auto-merge, force-push, direct-main or deployment command.

The read-only `.github/workflows/content-integration-gate.yml` runs on those pull requests under Node 20.20.2. It rejects any diff outside `reports/content-integration/proposals/`, requires an exact current revision, runs the portal tests and full preflight, and uploads no artifact. Branch protection and human authority remain external required gates. A future cleared-resource adapter must independently prove source, licensing, malware, derivation and accessibility controls before this policy can ever permit a resource file; private originals remain outside Git.

## Private storage

The Windows default is `C:\dev\msk-private-review-data\`. Override it with `MSK_REVIEW_PORTAL_DATA_ROOT`; the runtime rejects a root inside the repository.

The runtime creates these folders: `incoming`, `quarantine`, `library`, `derived`, `review-packets`, `exports`, `backups`, `logs` and `database`.

Uploads stream to a generated quarantine name, are SHA-256 hashed during streaming, checked by extension/MIME/magic, and scanned before release. Microsoft Defender command-line scanning is detected on Windows. If a scanner is unavailable or does not return clean, the file remains quarantined and cannot be downloaded or processed. Original files are never overwritten; derived outputs receive independent generated identifiers.

Default limits are 25 MiB per file and 100 MiB per browser batch. They may be reduced or increased within hard upper bounds using `MSK_REVIEW_PORTAL_MAX_FILE_BYTES` and `MSK_REVIEW_PORTAL_MAX_BATCH_BYTES`.

## Local start

Use Node 20.20.2 and set a secret in the current process without writing it to a file:

```powershell
$env:MSK_REVIEW_PORTAL_PASSPHRASE = '<at-least-16-random-characters>'
$env:MSK_REVIEW_PORTAL_DATA_ROOT = 'C:\dev\msk-private-review-data'
npm.cmd run private-portal:start
```

Open `http://127.0.0.1:4379`. The server refuses wildcard binding, unrecognised Host/Origin values, and network exposure without an explicit HTTPS origin.

## Tailscale Serve setup (manual gate)

Tailscale is not installed or authenticated automatically.

1. Install Tailscale using the organisation's approved process, authenticate the device, and confirm `tailscale status` shows `Running`.
2. Review `tailscale version`, `tailscale serve --help`, `tailscale serve status` and `tailscale funnel status` for the installed version. Funnel must have no configuration.
3. Apply a Tailnet grant limited to the reviewer user/group and this device's HTTPS service. Do not grant the whole Tailnet unless that is the separately approved access policy.
4. Add the stable Tailnet HTTPS URL to `MSK_REVIEW_PORTAL_ORIGINS`, comma-separated after the local origin, and set `MSK_REVIEW_PORTAL_NETWORK_EXPOSURE=tailscale-serve` before starting the portal.
5. Run `scripts/private-review-portal/tailscale-serve-start.ps1`. It proxies only HTTPS port 443 to `http://127.0.0.1:4379` and refuses to proceed when Funnel may be configured.
6. Run `tailscale-status.ps1` and test login/upload/logout from another authorised Tailnet device. Record the private URL only in a redacted external review log.
7. Use `tailscale-serve-stop.ps1` to stop the HTTPS listener or `tailscale-serve-reset.ps1` to reset Serve configuration. Neither script configures Funnel.

Because CLI syntax can change, compare the scripts with the installed CLI help before the first state-changing command. If syntax differs, stop and update the scripts rather than improvising an exposure command.

## Security design

The session identifier is a 384-bit random token stored only as a SHA-256 digest in memory and sent in an HttpOnly, SameSite=Strict cookie. Tailnet mode adds `Secure`. Sessions expire after 15 minutes of inactivity and eight hours absolute time; logout revokes them immediately. Each session has an independent CSRF token. State-changing requests require an exact configured Origin plus that token.

Requests have per-minute rate limits and explicit JSON, file and batch size limits. Static and API responses send `no-store`, a restrictive Content Security Policy, no-sniff, frame denial, no-index and permissions restrictions. Errors return an opaque request ID; secrets and submitted passphrases are never logged.

Filenames are normalised and sanitised, while storage uses generated UUIDs. Resolved download paths are constrained to the configured root. Request values are never interpolated into a shell. Office files are inspected as inert packages and never executed or actively rendered. SVG, HTML, archives, macro-enabled Office files and executable/script types are rejected.

## Data flow and threat model

```text
Authorised browser on loopback/Tailnet
  -> Host + Origin + session + CSRF + rate/size gates
  -> streamed UUID.part in external quarantine + SHA-256
  -> extension/MIME/magic/package validation
  -> Microsoft Defender scan
     -> clean: immutable UUID original in external library
     -> unavailable/rejected: held in external quarantine
  -> separate derived preview (safe plain text only)
  -> external JSON database + append-only JSONL audit

Governed repository JSON --read-only--> generic content registry + derived counts
Private database ----------private----> documents/notes/tasks/integration proposals/Extra Materials/Future Build
Next.js learner build <---- no imports, routes, records or runtime code
```

Primary threats and controls include public/static leakage (separate runtime plus output scans), traversal and malicious filenames (UUID storage and root-constrained resolution), active content (strict allowlist/magic checks/no active rendering), malware (quarantine and fail-closed scanner state), cross-site actions (Origin/CSRF/SameSite), credential guessing (environment secret/rate limits/timing-safe verification), stale review writes (current registry revision hashes are mandatory), and accidental authority escalation (`grantsApproval` is always false and governed states are read-only).
