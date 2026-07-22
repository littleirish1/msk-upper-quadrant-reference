# Release Blockers

This note records Phase 0 release-blocker status for the MSK Clinical Reasoning Lab.

## T0.1 Leaked Google Credential In Imported Legacy Material

Status: blocked / external owner.

An AIza-style Google credential was found in imported legacy HTML material under `content/imports/html-case-bank/raw/index.html`. The credential belongs to a separate Google Cloud project and is not visible in the current Google Cloud Console account.

Repo-side action is complete:

- The credential was redacted before repository-side validation.
- The raw imported HTML copy has now been removed after verifying that all 47 indexed
  stations are represented in the extracted station files, source registry, and tracker.
- A repo-side scan is part of preflight and blocks known credential patterns and forbidden credential variable tokens.
- Future source imports must remain in approved private storage and be secret-scanned
  before commit.

Required external action:

- Notify the owner of the original Google Cloud project.
- Ask that owner to rotate, delete, or restrict the exposed credential.
- Ask that owner to review usage, quotas, and billing for suspicious activity.

## T0.2 Repo-Side Secret Scan

Status: implemented.

`npm run check:secrets` scans committed text-like project files for common credential patterns and is included in `npm run preflight`.

## T0.3 Cross-Platform Build Cleanup

Status: confirmed.

`npm run clean:build` uses `scripts/clean-build.mjs` and Node `fs.rmSync` to remove `.next` and `out`. It does not rely on Windows-only shell commands.

## T0.4 Hygiene Rule File Exclusions

Status: confirmed.

`scripts/check-content-hygiene.mjs` normalises paths to POSIX-style separators before comparing ignored files, so the hygiene config and admin rule files are excluded consistently on Linux and Windows.
