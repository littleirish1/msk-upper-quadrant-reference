# V1 Baseline Commit Plan

## 1. Harden V1 clinical and evidence content

Clinical source and governed evidence changes:

- `content/cervical/cervical-artery-dysfunction.mdx`
- `content/cervical/cervical-myelopathy.mdx`
- `content/cervical/cervical-radiculopathy.mdx`
- `content/cervical/cervicogenic-headache.mdx`
- `content/cervical/mechanical-neck-pain.mdx`
- `content/cervical/whiplash-associated-disorders.mdx`
- `content/elbow/cubital-tunnel-syndrome.mdx`
- `content/elbow/elbow-osteoarthritis.mdx`
- `content/elbow/lateral-epicondylalgia.mdx`
- `content/elbow/medial-epicondylalgia.mdx`
- `content/elbow/olecranon-bursitis.mdx`
- `content/elbow/radial-tunnel-syndrome.mdx`
- `content/shoulder/acromioclavicular-joint.mdx`
- `content/shoulder/adhesive-capsulitis.mdx`
- `content/shoulder/calcific-tendinitis.mdx`
- `content/shoulder/labral-tears.mdx`
- `content/shoulder/rotator-cuff-tear.mdx`
- `content/shoulder/rotator-cuff-tendinopathy.mdx`
- `content/shoulder/shoulder-instability.mdx`
- `content/shoulder/subacromial-pain-syndrome.mdx`
- `content/evidence-hub/conditions/condition.shoulder.adhesive-capsulitis.json`
- `content/evidence-hub/conditions/condition.shoulder.rcrsp.json`
- `ai-manager/private-review-portal/v1-claim-canonicalization.mjs`
- `ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs`
- `ai-manager/private-review-portal/v1-critical-review-adoption.mjs`
- `ai-manager/private-review-portal/v1-major-review-adoption.mjs`
- `ai-manager/private-review-portal/v1-publication-minimum.mjs`
- `scripts/apply-v1-critical-independent-review.mjs`
- `scripts/apply-v1-major-independent-review.mjs`
- `scripts/test-v1-clinical-evidence-audit.mjs`
- `scripts/test-v1-critical-independent-review-adoption.mjs`
- `scripts/test-v1-major-independent-review-adoption.mjs`
- `reports/publication-readiness/v1-clinical-evidence-audit.json`
- `reports/publication-readiness/V1-CRITICAL-INDEPENDENT-REVIEW-ADOPTION.json`
- `reports/publication-readiness/V1-MAJOR-INDEPENDENT-REVIEW-ADOPTION.json`

## 2. Add governed V1 publication review workflow

Private review application, exact-revision workflow, and non-approving review records:

- `ai-manager/private-review-portal/README.md`
- `ai-manager/private-review-portal/content-studio.mjs`
- `ai-manager/private-review-portal/domain.mjs`
- `ai-manager/private-review-portal/server.mjs`
- `ai-manager/private-review-portal/static/app.js`
- `ai-manager/private-review-portal/static/index.html`
- `ai-manager/private-review-portal/static/styles.css`
- `ai-manager/private-review-portal/v1-final-condition-confirmation.mjs`
- `ai-manager/private-review-portal/v1-independent-final-recommendations.mjs`
- `ai-manager/private-review-portal/v1-publication-review.mjs`
- `scripts/generate-v1-final-condition-confirmation.mjs`
- `scripts/generate-v1-final-human-evidence-decisions.mjs`
- `scripts/generate-v1-human-clinical-evidence-review.mjs`
- `scripts/generate-v1-priority-a-claim-review.mjs`
- `scripts/generate-v1-publication-review.mjs`
- `scripts/test-v1-final-condition-confirmation.mjs`
- `scripts/test-v1-final-human-evidence-decisions.mjs`
- `scripts/test-v1-human-clinical-evidence-review.mjs`
- `scripts/test-v1-priority-a-claim-review.mjs`
- `scripts/test-v1-publication-review.mjs`
- `scripts/private-review-portal/test-portal.mjs`
- all tracked records under `reports/publication-readiness/` not assigned to commit 1

## 3. Add V1 review validation and reporting

Integration fixes, private 3D provenance controls, generated platform records, documentation, and this checkpoint packet:

- `ai-manager/clinical-platform/anatomy-3d/attribution-template.json`
- `ai-manager/clinical-platform/anatomy-3d/source-candidates.json`
- `ai-manager/clinical-platform/anatomy-3d/upstream-comparison.json`
- `ai-manager/clinical-platform/release/v1-release-candidate.json`
- `ai-manager/clinical-platform/reviews/review-ledger.json`
- `ai-manager/clinical-platform/shoulder/evidence-map.json`
- `ai-manager/clinical-platform/shoulder/module-library.json`
- `ai-manager/clinical-platform/shoulder/source-inventory.json`
- `ai-manager/clinical-platform/workspace/snapshot.json`
- `ai-manager/private-review-portal/anatomy-candidate-pipeline.mjs`
- `content/wrist-hand/carpal-tunnel-syndrome.mdx`
- `content/wrist-hand/de-quervains-tenosynovitis.mdx`
- `content/wrist-hand/dupuytrens-contracture.mdx`
- `content/wrist-hand/scaphoid-fracture.mdx`
- `content/wrist-hand/tfcc-injury.mdx`
- `content/wrist-hand/thumb-cmc-osteoarthritis.mdx`
- `content/wrist-hand/trigger-finger.mdx`
- `docs/3D_ASSET_PROVENANCE.md`
- `docs/GOVERNED_ANATOMY_3D.md`
- `docs/MOVEMENT_MODULES.md`
- `docs/product/UPPER_QUADRANT_COMPLETION_MATRIX.md`
- `package.json`
- `public/search-index.json`
- `reports/clinical-platform/review-packet-index.json`
- `reports/clinical-platform/review-queues.json`
- `reports/governance/project-inventory.json`
- `reports/programmes/upper-quadrant-production.json`
- `reports/release/exact-revision-review-matrix.json`
- `reports/release/maintenance-status.json`
- `reports/release/release-candidate-summary.md`
- `reports/release/release-candidate.json`
- `reports/reviews/pre-commit-v1-baseline/`
- `scripts/audit-learner-export.mjs`
- `scripts/check-accessibility-smoke.mjs`
- `scripts/check-external-links-live.mjs`
- `scripts/clinical-platform/test-anatomy-3d.mjs`
- `scripts/clinical-platform/test-anatomy-candidates.mjs`
- `scripts/private-review-portal/check-public-private-separation.mjs`
- `scripts/private-review-portal/inspect-glb.mjs`
- `scripts/test-learner-export-audit.mjs`
- `scripts/test-search-engine.mjs`
- `scripts/test-search-indexing.mjs`
- `src/components/layout/Header.tsx`
- `src/components/mdx/MDXComponents.tsx`
- `src/lib/search.ts`

Protected and excluded from every commit:

- `docs/reviews/current/platform-v2-independent-review/`
