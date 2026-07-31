# Release And Recovery

## Release

1. Start from an independently reviewed exact commit.
2. Run `npm ci` and `npm run preflight` on Node 20.20.2.
3. Generate the blocked release-candidate dossier.
4. Resolve every applicable human gate and rerun exact-revision checks.
5. Inspect a production-equivalent branch preview.
6. Obtain explicit publication approval.
7. Fast-forward the approved branch only.

Netlify remains the deployment platform and must run `npm run preflight` with
`out` as the publish directory. GitHub Actions is validation-only.

## Rollback And Recovery

- Preserve the last reviewed commit and its artifact manifest.
- Roll back by deploying a previously reviewed commit through the normal
  reviewed Git workflow; do not rewrite history.
- Verify routes, Search, reveal boundaries, privacy, and links after rollback.
- Keep repository and source backups subject to owner-approved retention and
  access controls.
- Monitoring adapters may observe availability and broken routes, but remain
  disabled until configured by a human operator.
- Domain, DNS, certificate, backup restoration, and incident communications are
  manual operational checklists.
