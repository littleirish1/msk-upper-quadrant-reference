# Remote Main Integration Plan

This plan records a future human-controlled integration sequence. It does not approve
or execute any merge, rebase, reset, branch deletion, history rewrite, force-push, or
remote-ref change.

## Current state

- Local `main` is behind `origin/main`.
- The audited `origin/main` tip contains a public 3D route.
- The current local hardening diff does not delete that remote-only route because the
  route is not present at the local base commit.
- The repository must remain private while history and remote exposure are unresolved.

## Required integration sequence

1. Preserve the reviewed hardening work on a dedicated safety branch before changing
   the local integration base.
2. Create a separate integration branch from the reviewed remote-main state.
3. Explicitly revert or remove the remote public 3D route on that integration branch.
4. Apply the reviewed hardening commits without restoring private source material,
   public 3D assets, or local admin tooling.
5. Run the complete preflight gate and repeat route, 3D-boundary, history, and packet
   review against the integrated result.
6. Push `main` only after the integration diff and validation evidence receive explicit
   human approval.

## Approval boundary

No step above is approved for unattended execution. Remote integration, visibility,
branch handling, and any history remediation remain repository-owner actions.
