# Branch Status

This is a non-destructive branch inventory for the Platform V2, private source
ingestion, and Evidence Hub integration. No listed branch is approved for
deletion. Branch removal requires independent review of the integrated branch,
a human-inspected Netlify branch preview, and a human-approved production
merge.

| Branch | Recorded SHA | Role | Containment at this snapshot | Archive later? | Required before deletion |
|---|---|---|---|---|---|
| `main` | `4104b7050afa43e9e613459c56301e2f9482a134` | Green production baseline | Ancestor of integration | No | Superseding production merge and rollback decision |
| `integration/platform-v2-source-evidence-hub-v1` | `97f75efc2be9ab23a1cfd993fba674c8336c694e` | Active generator integration snapshot | Active | No | Independent review, branch preview, and approved merge |
| `docs/evidence-hub-v1-architecture-clean` | `e2da44d0886399bebaca162327ab5e7669ae3a0f` | Evidence Hub architecture reference | Content applied by cherry-pick as `71d1509`; not an ancestor | Yes, later | Confirm integrated architecture is accepted |
| `wip/evidence-hub-v1-implementation-spike` | `a975d3c82a145812cc5afad5a9c6f8d39bd7e166` | Unapproved implementation reference | Selectively ported and corrected; not an ancestor | Yes, later | Independent comparison of omitted and ported work |
| `fix/source-ingestion-review-v3-scanner-git-object` | `14ef4b4ec55bf21e33579cd69299dc5dee46b37f` | Advanced source-ingestion reference | Ancestor of integration | Yes, later | Independent integrated scanner review |
| `integration/foundation-hardening` | `199e2498b9b66bbbd24a2ee1ab10e98258607187` | Foundation milestone | Ancestor of integration | Yes, later | Production migration and rollback decision |
| `feature/clinical-learning-platform-v2` | `33a54a5bc4bdea1ac667bfa8a47160c2d78fecf6` | Platform V2 milestone | Ancestor of integration | Yes, later | Platform V2 integrated review |
| `security/next-14-2-35` | `716dec2c96e9378cc323e5e6f44496956c4bd696` | Dependency remediation milestone | Ancestor of integration | Yes, later | Dependency audit and integrated build review |
| `feature/private-source-ingestion-pilot` | `72fb2ed30d9b71b7c0b34d481d60d751cf2038cd` | Initial private intake milestone | Ancestor of integration | Yes, later | Source-ingestion integrated review |
| `fix/source-ingestion-pilot-hardening` | `63cdfec7f9dba987bb0ff3a8652830dbc7b7e2ba` | Privacy hardening milestone | Ancestor of integration | Yes, later | Source-ingestion integrated review |
| `fix/source-ingestion-final-review-corrections` | `1146098c9f89730bd0a04be70d6b2bdcbdb2b33b` | Final correction milestone | Ancestor of integration | Yes, later | Review-v3 reconciliation accepted |
| `fix/source-ingestion-review-v3-packet-exactness` | `2ebb7a56b54ee6bee10f39ad13f692e5d39ce967` | Packet exactness milestone | Ancestor of integration | Yes, later | Packet integrity independently reproduced |
| `fix/production-deployment-boundary` | `4104b7050afa43e9e613459c56301e2f9482a134` | Deployment recovery and 3D reference | Ancestor of integration | Retain for now | Integrated production migration complete |
| `origin/feature/guided-cases` | `37ef52fe13e8f45d80ae17a79ff5e3394bafedcc` | Historical, unapproved public 3D work | Not contained | Not yet | Human review and remote cleanup approval |
| `safety/coordinated-hardening` | `1dd911b4bf161eebbbe88f4687da0c2274b033f6` | Preserved safety worktree | Not contained by ancestry | No | Separate human-controlled retention decision |

The recorded integration SHA is the reviewed snapshot before this status file's
own commit. Future reports must record the newer integration tip. The safety
worktree at `C:/dev/msk-upper-quadrant-reference` must remain untouched.
