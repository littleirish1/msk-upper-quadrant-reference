# Human Actions Required

These actions must not be performed unattended by an agent.

1. Keep the GitHub repository private until history and remote-ref exposure is
   resolved and independently verified.
2. Review origin/main and origin/feature/guided-cases, then remove or replace unsafe
   remote branches only after explicit owner approval.
3. Make a verified offline backup before any approved history rewrite.
4. Ask the actual external project owner to rotate, revoke, delete, or restrict the
   historical credential and review usage.
5. Decide with repository, information-governance, and security owners whether Git
   history rewriting is required.
6. If a rewrite is approved, coordinate the force-push, invalidate old clones and
   forks, verify cached views and archive downloads, and rerun the history audit.
7. Confirm source, author, licence, attribution, modifications, performance, and
   governance for every 3D asset before any public reintroduction.
8. Obtain clinician approval for clinical claims, case-specific model answers,
   red-flag guidance, assessment, management, and evidence interpretation.

## Future remediation commands

No destructive command is approved by this document. Any branch deletion, force-push,
history-filtering command, visibility change, or credential-console action requires a
separate reviewed plan and explicit human confirmation at execution time.
