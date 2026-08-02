import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const programme = read('ai-manager/clinical-platform/beta/programme.json')
const fixtures = read('ai-manager/clinical-platform/beta/synthetic-feedback-fixtures.json')
const readiness = read('reports/clinical-platform/beta-readiness.json')
const releaseBeta = read('reports/release/beta-framework.json')

assert.equal(programme.taskScripts.length, 16)
assert.equal(new Set(programme.taskScripts.map((task) => task.taskId)).size, 16)
assert.deepEqual(programme.realResults, { participantCount: 0, sessionCount: 0, feedbackCount: 0 })
assert.equal(programme.publicationApprovalGranted, false)
assert.equal(fixtures.fixtureOnly, true)
assert.equal(fixtures.fixtures.length, 4)
assert.ok(fixtures.fixtures.every((fixture) => fixture.fixture === true && fixture.sessionId.startsWith('synthetic-session-') && fixture.containsHealthData === false))
assert.equal(readiness.syntheticFixturesExcludedFromResults, true)
assert.equal(readiness.realParticipantCount + readiness.realSessionCount + readiness.realFeedbackCount, 0)
assert.equal(releaseBeta.resultsRecorded, false)
assert.equal(releaseBeta.feedbackItems.length, 0)
assert.ok(!JSON.stringify({ programme, fixtures, readiness }).match(/@[a-z0-9.-]+|[A-Z]:\\|\/Users\//i))
console.log('Beta programme tests passed: 4 groups, 16 tasks, 4 labelled synthetic fixtures, 0 real results, privacy and consent fail closed.')
