# MSK Private Review Portal

This is a separate Node.js runtime for private research and project review. It is not a Next.js route and is never part of the learner/static export. It binds to an explicit loopback address only. Remote access, when available, is an authenticated Tailnet HTTPS proxy created by Tailscale Serve; Funnel is prohibited.

## Safety boundary

- Do not upload patient-identifiable, Trust-confidential or clinical-record material.
- Uploading, linking, accepting or reviewing a proposal never grants clinical, evidence, source-clearance, licensing, accessibility, beta, publication, release or deployment approval.
- The portal reads authoritative governed repository records at request time. It does not copy or mutate clinical truth.
- Originals, derived files, audit logs and the private database stay outside Git.
- A passphrase of at least 16 characters is mandatory and is read only from `MSK_REVIEW_PORTAL_PASSPHRASE`.

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

Governed repository JSON --read-only--> derived dashboard counts
Private database ----------private----> documents/actions/Future Build
Next.js learner build <---- no imports, routes, records or runtime code
```

Primary threats and controls include public/static leakage (separate runtime plus output scans), traversal and malicious filenames (UUID storage and root-constrained resolution), active content (strict allowlist/magic checks/no active rendering), malware (quarantine and fail-closed scanner state), cross-site actions (Origin/CSRF/SameSite), credential guessing (environment secret/rate limits/timing-safe verification), stale approval (ledger-backed exact-revision validation), and accidental authority escalation (`grantsApproval` is always false and governed states are read-only).
