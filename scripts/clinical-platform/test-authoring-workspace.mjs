import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const root = path.join(ROOT, 'ai-manager', 'clinical-platform', 'workspace')
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'snapshot.json'), 'utf8'))
for (const group of ['modules', 'truthRecords', 'rules', 'recipes', 'transcripts', 'regions', 'mcqs', 'evidence', 'ingestion', 'movement', 'anatomy3d', 'legacy', 'betaTasks']) assert.ok(snapshot.counts[group] >= 0, `missing group ${group}`)
for (const group of ['shoulderSources', 'shoulderModules', 'shoulderTruth', 'shoulderRules', 'shoulderMovement', 'shoulderMcqs']) assert.ok(snapshot.counts[group] > 0, `missing shoulder group ${group}`)
assert.equal(snapshot.counts.betaTasks, 16)
for (const queue of ['clinical', 'evidence', 'source', 'licensing', 'accessibility', 'anatomy', 'movement', 'staleApproval', 'betaIssue', 'dependencyRisk', 'publicationDecision']) assert.ok(Array.isArray(snapshot.queues[queue]), `missing queue ${queue}`)
assert.ok(Array.isArray(snapshot.queues.shoulderReview) && snapshot.queues.shoulderReview.length > 0)
for (const [queue, items] of Object.entries(snapshot.queues)) assert.equal(snapshot.queueCounts[queue], items.length)
assert.equal(snapshot.publicRoute, null)
assert.equal(snapshot.providerCallsEnabled, false)
assert.equal(snapshot.shoulderWorkspace.publicRoute, null)
assert.equal(snapshot.shoulderWorkspace.autonomousApprovalAllowed, false)
assert.equal(snapshot.shoulderWorkspace.sections.length, 14)
assert.ok(snapshot.shoulderWorkspace.reviewTasks.every((task) => !task.publicEligibility))

const server = fs.readFileSync(path.join(root, 'server.mjs'), 'utf8')
assert.ok(server.includes("server.listen(port, '127.0.0.1'"))
assert.ok(server.includes("request.method !== 'GET' && request.method !== 'HEAD'"))
assert.ok(server.includes('Loopback access only'))
assert.ok(!server.includes('POST') && !server.includes('PUT') && !server.includes('DELETE'))

const publicSources = [path.join(ROOT, 'src', 'app'), path.join(ROOT, 'src', 'components')]
  .flatMap((directory) => collect(directory))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
assert.ok(!publicSources.includes('clinical-platform/workspace'))
assert.ok(!publicSources.includes('private-shoulder-authoring-workspace'))
const search = fs.readFileSync(path.join(ROOT, 'public', 'search-index.json'), 'utf8')
assert.ok(!search.includes('private-clinical-authoring-workspace'))
assert.ok(!search.includes('private-shoulder-authoring-workspace'))
if (fs.existsSync(path.join(ROOT, 'out'))) assert.ok(!fs.existsSync(path.join(ROOT, 'out', 'ai-manager')))
console.log(`Private authoring workspace tests passed: ${Object.keys(snapshot.groups).length} groups, ${Object.keys(snapshot.queues).length} derived queues, no public route/import/Search/output.`)

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? collect(item) : entry.isFile() && /\.(?:ts|tsx|js|jsx|json)$/.test(item) ? [item] : []
  })
}
