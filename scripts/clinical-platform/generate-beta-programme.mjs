import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const groups = ['physiotherapy-student', 'band-5-clinician', 'experienced-msk-clinician', 'clinical-educator']
const taskTemplates = [
  { route: '/', instruction: 'Find a reviewed learning pathway and explain the governance status shown for unavailable systems.', observationFocus: ['navigation', 'governance-comprehension'] },
  { route: '/cases', instruction: 'Open a reviewed case and move between Guided, Conversation, and Hybrid modes without revealing the diagnosis early.', observationFocus: ['mode-comprehension', 'diagnosis-disclosure', 'keyboard-flow'] },
  { route: '/anatomy', instruction: 'Locate an available anatomy category and distinguish it from the route-withheld 3D and movement roadmap.', observationFocus: ['content-clarity', 'route-withheld-comprehension'] },
  { route: '/search', instruction: 'Use search to reach a reviewed public record and return to the regional library.', observationFocus: ['search', 'wayfinding', 'mobile-navigation'] },
]

const taskScripts = groups.flatMap((participantGroup) => taskTemplates.map((task, index) => ({
  taskId: `beta-task.${participantGroup}.${String(index + 1).padStart(2, '0')}`,
  revision: 1,
  participantGroup,
  ...task,
  status: 'planned-human-session',
})))

const programme = {
  schemaVersion: 1,
  status: 'planned',
  taskScripts,
  privacy: {
    dataCollection: 'minimum-structured-feedback-no-health-data',
    opaqueSessionIds: true,
    consentTextStatus: 'human-review-required',
    privacyNoticeStatus: 'human-review-required',
    retentionDecisionStatus: 'human-review-required',
  },
  realResults: { participantCount: 0, sessionCount: 0, feedbackCount: 0 },
  publicationApprovalGranted: false,
}

const syntheticFeedback = groups.map((participantGroup, index) => ({
  fixture: true,
  sessionId: `synthetic-session-${String(index + 1).padStart(3, '0')}`,
  participantGroup,
  taskId: `beta-task.${participantGroup}.01`,
  completion: index % 2 === 0 ? 'completed' : 'partial',
  severity: ['observation', 'low', 'medium', 'high'][index],
  category: ['navigation', 'content-clarity', 'accessibility', 'privacy'][index],
  noteCode: `SYNTHETIC_WORKFLOW_FIXTURE_${index + 1}`,
  containsHealthData: false,
}))

const report = {
  schemaVersion: 1,
  status: 'not-started',
  plannedParticipantGroups: groups.length,
  plannedTaskScripts: taskScripts.length,
  syntheticFixtureCount: syntheticFeedback.length,
  realParticipantCount: 0,
  realSessionCount: 0,
  realFeedbackCount: 0,
  syntheticFixturesExcludedFromResults: true,
  escalation: {
    blocker: 'stop-session-and-escalate',
    clinicalConcern: 'clinical-review-queue',
    privacy: 'privacy-governance-queue',
    high: 'product-owner-and-clinical-owner-review',
  },
  blockers: ['consent-text-human-approval', 'privacy-notice-human-approval', 'retention-decision-human-approval', 'recruitment-human-approval'],
}

function write(relativePath, value) {
  const destination = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`)
}

write('ai-manager/clinical-platform/beta/programme.json', programme)
write('ai-manager/clinical-platform/beta/synthetic-feedback-fixtures.json', { schemaVersion: 1, fixtureOnly: true, fixtures: syntheticFeedback })
write('reports/clinical-platform/beta-readiness.json', report)
console.log(`Governed beta programme generated: ${taskScripts.length} planned tasks, ${syntheticFeedback.length} labelled fixtures, 0 real sessions/results.`)
