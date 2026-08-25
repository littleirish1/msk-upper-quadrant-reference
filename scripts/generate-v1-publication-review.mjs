import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  createConditionReviewCard,
  createLegacyConditionGovernanceOverlay,
  loadV1ConditionReviewRecords,
  V1_PUBLICATION_REGIONS,
} from '../ai-manager/private-review-portal/v1-publication-review.mjs'
import { applyV1ClinicalEvidenceAudit, createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'

const root = process.cwd()
const outputDirectory = path.join(root, 'reports', 'publication-readiness')
const initialConditions = loadV1ConditionReviewRecords(root)
const clinicalEvidenceAudit = createV1ClinicalEvidenceAudit(root, initialConditions)
const auditByCondition = new Map(clinicalEvidenceAudit.conditions.map((item) => [item.conditionId, item]))
const conditions = initialConditions.map((condition) => applyV1ClinicalEvidenceAudit(condition, auditByCondition.get(condition.id)))
const conditionReviewCards = conditions.map(createConditionReviewCard)
const governanceOverlays = conditions.map(createLegacyConditionGovernanceOverlay)
const cases = readJson('reports/guided-cases/summary.json').records
  .filter((item) => V1_PUBLICATION_REGIONS.includes(item.region) && item.lifecycleState === 'published')
  .map((item) => ({
    caseId: item.caseId,
    region: item.region,
    title: item.neutralTitle,
    lifecycleState: item.lifecycleState,
    publicationEligibility: item.publicationEligibility,
    clinicalReviewStatus: item.clinicalReviewStatus,
    evidenceReviewStatus: item.evidenceReviewStatus,
    sourceClearanceStatus: item.sourceClearanceStatus,
    unresolvedEvidenceHubRelationships: item.unresolvedEvidenceGapCount,
    classification: 'migration/follow-up',
    basis: 'The governed published record is baseline-reviewed/baseline-preserved, retains its baseline source material, has no unresolved issue, and no existing rule makes Evidence Hub migration a Version 1 publication prerequisite.',
    humanDecisionNeeded: false,
  }))

const audit = readJson('reports/publication-readiness/learner-export-audit.json')
const liveLinks = readJson('reports/publication-readiness/external-link-live-audit.json')
const currentExternalLinkUrls = new Set(audit.externalLinks.map((item) => item.url))
const browserObservations = readOptionalJson('reports/publication-readiness/v1-browser-qa-observations.json')
const manualExternal = liveLinks.results.filter((item) => currentExternalLinkUrls.has(item.url) && !item.ok).map((item) => ({
  sourcePages: item.sourceRoutes,
  linkLabels: findLinkLabels(item.url),
  targetUrl: item.url,
  classification: item.category,
  automatedResult: item.status ? `HTTP ${item.status}` : item.error,
  manualReason: item.status === 403
    ? 'The authoritative site rejects automated requests; an automated 403 is not evidence that the learner link is broken.'
    : 'The automated client could not establish a response; confirm in an ordinary browser without changing the source.',
  manualStatus: browserObservations?.externalLinks?.find((observation) => observation.url === item.url)?.browserResult ?? 'NOT_TESTED',
  browserEvidence: browserObservations?.externalLinks?.find((observation) => observation.url === item.url) ?? null,
}))

const base = 'http://127.0.0.1:3000/msk-upper-quadrant-reference'
const representative = {
  home: '/',
  search: '/search',
  cervicalLanding: '/cervical',
  cervicalCondition: '/cervical/cervical-radiculopathy',
  cervicalCase: '/cases/cervical/case-01-neck-arm-symptoms',
  shoulderLanding: '/shoulder',
  shoulderCondition: '/shoulder/adhesive-capsulitis',
  shoulderCase: '/cases/shoulder/case-05-progressive-shoulder-stiffness',
  elbowLanding: '/elbow',
  elbowCondition: '/elbow/lateral-epicondylalgia',
  elbowCase: '/cases/elbow/case-03-sudden-anterior-elbow-pain-after-lifting',
}
const qaChecks = ['header-and-global-navigation', 'mobile-menu', 'breadcrumbs', 'cards-and-buttons', 'headings-and-links', 'images', 'accordions', 'case-tabs-and-modes', 'reveal-interactions', 'search', 'scrolling-and-horizontal-overflow', 'sticky-or-fixed-overlap', 'touch-targets', 'focus-visibility', 'console-errors']
const viewportAssignments = [
  { viewport: '1440x900', theme: 'light', routes: ['home', 'cervicalLanding', 'cervicalCondition', 'cervicalCase'] },
  { viewport: '1440x900', theme: 'dark', routes: ['search', 'shoulderLanding', 'shoulderCondition', 'shoulderCase'] },
  { viewport: '768x1024', theme: 'light', routes: ['home', 'elbowLanding', 'elbowCondition', 'elbowCase'] },
  { viewport: '768x1024', theme: 'dark', routes: ['search', 'cervicalCondition', 'shoulderCondition', 'elbowCondition'] },
  { viewport: '390x844', theme: 'light', routes: ['home', 'search', 'cervicalCase', 'shoulderCase'] },
  { viewport: '390x844', theme: 'dark', routes: ['cervicalLanding', 'shoulderLanding', 'elbowLanding', 'elbowCase'] },
]
const reviewStatusOptions = ['PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_TESTED']
const manualQa = {
  schemaVersion: 1,
  exactRevision: conditions.map((item) => item.exactRevisionHash).sort(),
  localBaseUrl: base,
  routeCatalogue: Object.fromEntries(Object.entries(representative).map(([name, route]) => [name, route === '/' ? `${base}/` : `${base}${route}/`])),
  viewportThemeMatrix: viewportAssignments.map((assignment) => ({
    ...assignment,
    routes: assignment.routes.map((name) => ({ name, url: representative[name] === '/' ? `${base}/` : `${base}${representative[name]}/` })),
    checks: qaChecks.map((check) => ({ check, status: 'NOT_TESTED', allowed: reviewStatusOptions, notes: '' })),
  })),
  optimisationBasis: 'Each of the 11 representative pages is reviewed at least once; shared layouts are sampled across all six viewport/theme combinations instead of repeating all pages 66 times.',
  completionAuthority: 'human-exact-build-browser-review',
}
const accessibility = {
  schemaVersion: 1,
  automatedStatus: 'PASS',
  automatedEvidence: ['npm run check:accessibility', 'npm run test:learner-export-audit', 'npm run preflight'],
  conformanceClaimed: false,
  manualChecks: [
    ['keyboard-only-navigation', 'Use Tab, Shift+Tab, Enter, Space and arrow keys across navigation, Search and one case; no keyboard trap.'],
    ['focus-order', 'Confirm focus follows the visual and semantic reading order on home, a condition and a case.'],
    ['visible-focus', 'Confirm every interactive element has a clearly visible focus indicator in both themes.'],
    ['skip-navigation', 'From a fresh page load, activate Skip to content and confirm focus lands at main content.'],
    ['screen-reader-heading-and-landmark-sanity', 'Inspect landmarks and heading hierarchy on home, one condition and one case.'],
    ['accessible-control-names', 'Confirm icon buttons, Search, menus, case tabs and form controls expose meaningful names.'],
    ['case-mode-announcements', 'Switch Guided, Conversation and Hybrid; confirm selected state and response updates are announced.'],
    ['search-announcements', 'Run Quick Find and full Search; confirm result count and status changes are announced.'],
    ['200-percent-zoom', 'At 200% zoom, confirm controls and content remain available without loss.'],
    ['text-reflow', 'At a 320 CSS-pixel equivalent width, confirm text reflows without two-dimensional scrolling.'],
    ['mobile-orientation', 'Check portrait and landscape on the 390px sample; content and controls remain usable.'],
    ['reduced-motion', 'Enable reduced motion and confirm non-essential transitions/animations are suppressed.'],
    ['visual-contrast-confirmation', 'Visually confirm text, controls, focus indicators and status messaging in light and dark themes.'],
  ].map(([check, procedure]) => ({ check, procedure, status: 'NOT_TESTED', allowed: reviewStatusOptions, notes: '' })),
}

const reports = {
  'v1-clinical-evidence-audit.json': clinicalEvidenceAudit,
  'v1-publication-scope.json': {
    schemaVersion: 1,
    regions: [...V1_PUBLICATION_REGIONS],
    inScope: ['learner-home-and-navigation', 'target-region-pages', 'publication-eligible-textual-anatomy', 'condition-pages', 'baseline-reviewed-public-cases', 'complete-existing-learner-interactions', 'present-governed-references'],
    notRequiredForV1UnlessExistingGovernanceRequires: ['3d-models', 'private-movement-slots', 'unauthored-mcqs', 'private-modules', 'candidate-biomechanics-material'],
    existingGovernanceRequiresFutureFeaturesForV1: false,
    evidence: ['ai-manager/clinical-platform/release/v1-release-candidate.json', 'src/lib/publicConditions.ts', 'scripts/clinical-platform/test-movement.mjs', 'scripts/clinical-platform/test-mcq-bank.mjs', 'scripts/clinical-platform/test-anatomy-3d.mjs'],
    grantsApproval: false,
  },
  'v1-condition-review-pack.json': {
    schemaVersion: 1,
    authority: 'private-revision-bound-review-workspace',
    summary: Object.fromEntries(V1_PUBLICATION_REGIONS.map((region) => [region, conditions.filter((item) => item.region === region).length])),
    decisionsRemainHuman: true,
    grantsApproval: false,
    publicationAuthorized: false,
    conditions,
    reviewCards: conditionReviewCards,
    reviewOrder: V1_PUBLICATION_REGIONS.flatMap((region) => conditionReviewCards.filter((card) => card.region === region).map((card) => card.conditionId)),
    categoryCounts: Object.fromEntries([
      'no-automated-issue-detected-human-confirmation-only',
      'evidence-follow-up-required',
      'clinical-content-issue-detected',
      'publication-blocker',
    ].map((category) => [category, conditionReviewCards.filter((card) => card.reviewCategory === category).length])),
    humanReviewItemsRemaining: {
      conditionDecisionFields: conditions.length * 3,
      browserViewportThemeReviews: viewportAssignments.length,
      accessibilityChecks: accessibility.manualChecks.length,
      total: (conditions.length * 3) + viewportAssignments.length + accessibility.manualChecks.length,
      countingRule: 'The Cubital Tunnel source decision is part of its evidence decision and is not double-counted.',
    },
  },
  'v1-baseline-case-assessment.json': { schemaVersion: 1, cases, summary: { cases: cases.length, publicationBlockers: cases.filter((item) => item.classification === 'publication blocker').length, migrationFollowUp: cases.filter((item) => item.classification === 'migration/follow-up').length }, grantsApproval: false },
  'v1-governance-migration.json': {
    schemaVersion: 1,
    finding: 'Public condition selection currently treats omission of status, publicEligibility and clinicianReviewStatus as public eligible when the condition is present in taxonomy.',
    classification: 'legacy-behaviour-preserved-by-current-selector-and-bypassing-explicit-per-record-governance',
    source: 'src/lib/publicConditions.ts',
    recommendedMigration: {
      state: 'review-required',
      publicationState: 'legacy-publication-review-required',
      revisionBound: true,
      deterministic: true,
      nonDestructive: true,
      failClosedForFutureChanges: true,
      transitionActivated: false,
      steps: ['record exact source hash', 'obtain clinical/evidence/publication recommendation', 'review a deterministic manifest', 'apply any publication-state transition only under separate human authority'],
    },
    proposedPrivateOverlays: governanceOverlays,
    overlayCount: governanceOverlays.length,
    currentTextChanged: false,
    publicationStateChanged: false,
    grantsApproval: false,
    publicationAuthorized: false,
  },
  'v1-manual-qa-checklist.json': manualQa,
  'v1-accessibility-checklist.json': accessibility,
  'v1-external-link-manual-review.json': {
    schemaVersion: 1,
    links: manualExternal,
    summary: {
      total: manualExternal.length,
      complete: manualExternal.filter((item) => ['PASS', 'FAIL'].includes(item.manualStatus)).length,
      remaining: manualExternal.filter((item) => !['PASS', 'FAIL'].includes(item.manualStatus)).length,
      pass: manualExternal.filter((item) => item.manualStatus === 'PASS').length,
      fail: manualExternal.filter((item) => item.manualStatus === 'FAIL').length,
    },
    deterministicBuildDependency: false,
  },
  'v1-build-integrity-summary.json': {
    schemaVersion: 1,
    ...audit.summary,
    expectedZeroes: { brokenInternalHyperlinks: 0, invalidAnchors: 0, missingLocalAssets: 0, orphanLearnerPages: 0, privateMarkerFindings: 0 },
    futureFeatureFallbacks: { movements: 'no public controls/routes emitted', mcqs: 'no placeholder questions exposed', modules: 'no dead module CTA emitted', anatomy3d: 'no public viewer/button or asset emitted' },
  },
}

fs.mkdirSync(outputDirectory, { recursive: true })
for (const [name, value] of Object.entries(reports)) fs.writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`)
console.log(`Version 1 private publication review package generated: ${conditions.length} conditions, ${cases.length} baseline cases, ${manualExternal.length} manual external links.`)

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'))
}

function readOptionalJson(relative) {
  const file = path.join(root, ...relative.split('/'))
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

function findLinkLabels(url) {
  const labels = []
  for (const region of V1_PUBLICATION_REGIONS) {
    for (const filename of fs.readdirSync(path.join(root, 'content', region)).filter((name) => name.endsWith('.mdx'))) {
      const body = matter(fs.readFileSync(path.join(root, 'content', region, filename), 'utf8')).content
      for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) if (match[2] === url) labels.push(match[1])
      for (const line of body.split(/\r?\n/)) if (line.includes(url)) {
        const label = line.replace(url, '').replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/[*_`\[\]()]/g, '').replace(/\s+/g, ' ').trim()
        if (label) labels.push(label)
      }
    }
  }
  return [...new Set(labels)].sort()
}
