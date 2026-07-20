# Remote Ref And History Audit

Audit date: 2026-07-18

This is a path/object audit only. No branch was checked out, deleted, merged, reset, or
rewritten. No source body, credential value, private source path, or sensitive name
is reproduced here.

## Current working tree

Status: repository-side boundary safe, uncommitted.

- The sensitive legacy HTML working-tree copy is removed.
- No src/app/3d-model route exists in the local working tree.
- No public GLB exists in the local working tree.
- The current local static export excludes 3D and ai-manager paths.

## Current public build

Status: local export safe.

The validated local export contains no 3D route, GLB, ai-manager route, or private
asset. This statement applies to the local working tree export, not necessarily to
the current remote main tip.

## Ref inventory

No tags were present after fetch.

| Ref | Commit | Legacy blob reachable at tip | Public 3D route | GLB assets |
|---|---|---:|---:|---:|
| refs/heads/main | 3e8791911ac0f385728ec42db5c635cf37adb8d0 | yes | 0 | 0 |
| refs/remotes/origin/main | 638c153665a28dbe9cbfff3bdf1a203851db4ec6 | yes | 3 files | 0 |
| refs/remotes/origin/feature/guided-cases | 37ef52fe13e8f45d80ae17a79ff5e3394bafedcc | yes | 3 files | 4 |

The remote main tip is one commit ahead of the local HEAD. It introduces a public
3D viewer route. This pass does not merge or reverse that human-controlled remote
change.

## Exposed path objects

Remote main 3D route objects:

- src/app/3d-model/BodyModelPage.tsx - b4addd38e6e24df62bf1c8406f8aa5299dade730
- src/app/3d-model/InteractiveBodyModel.tsx - 0e4c8b09cd18fe724ad7ab97c2451240ba4b51e4
- src/app/3d-model/page.tsx - 5a2c2f0efde1568ca015152bd230d6e9f1ed3784

Feature branch 3D route objects:

- src/app/3d-model/BodyModelPage.tsx - 8a1d97ddeeb0b433f6415100763a26e46130204a
- src/app/3d-model/InteractiveBodyModel.tsx - 27571f8d1008dfef2d8f600b3b3a1bc0e7dd7f0a
- src/app/3d-model/page.tsx - 5a2c2f0efde1568ca015152bd230d6e9f1ed3784

Feature branch model objects:

- public/models/hand.glb - 5cb435309234f62815eab3a0b02cda1dce5b65cd
- public/models/overview-skeleton.glb - f404b515a3cf5f3b649acef26c8b33f2d159ae86
- public/models/upper-limb.glb - 7f7defe439590363d7d2cc29c45f50745de71ad8
- public/models/vertebrae.glb - d4ab22c9938ea876d1090c12e8103689595ee40c

These object IDs record exposure only. They do not establish licence, provenance,
clinical suitability, or public eligibility.

## Legacy history exposure

The sensitive legacy HTML path remains reachable from local main, origin/main, and
origin/feature/guided-cases.

- Current tip blob ID: 4b107b93aee91d7f012d97aa42e6b8b7d19a638b
- Reachable path-history commits found: 3
- Earliest relevant commit: bdaaa4c31b311cd01b885938aaf4e35e60eec479
- Latest relevant commit: 4391cef1738198c9ffb824d407ac5bfed2da71e9

A safe pattern-only check found no live AIza-style credential pattern in the raw blob
at the three audited ref tips. This does not prove older exposure harmless and does
not replace external credential rotation/restriction by the actual project owner.

## Human remediation boundary

Git history, remote branches, repository visibility, cached archive views, forks,
clones, and external credential rotation require explicit human control. Follow
docs/HUMAN_ACTIONS_REQUIRED.md. Re-run this audit after any approved remediation.
