import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const engine = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'conversation.ts'), path.join(ROOT, 'src'))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'public-case-registry.json'), 'utf8'))
const publicRoot = path.join(ROOT, 'public', 'case-conversations')
const mappingFile = path.join(ROOT, 'src', 'data', 'case-conversation-assets.json')
const transcriptFile = path.join(ROOT, 'reports', 'clinical-platform', 'provider-free-transcripts.json')
fs.mkdirSync(publicRoot, { recursive: true })

const mappings = []
const transcripts = []
for (const record of truth.records.filter((item) => item.publicModeEligibility).sort((a, b) => a.caseId.localeCompare(b.caseId))) {
  const publicCase = registry.find((item) => item.caseId === record.caseId)
  if (!publicCase) throw new Error(`Missing public registry mapping for ${record.caseId}`)
  const opening = record.items.find((item) => item.domain === 'presenting-complaint')
  const safeUnavailable = record.items.filter((item) => !['likely-diagnosis', 'condition-link'].includes(item.domain)).map((item) => ({
    id: item.id,
    domain: item.domain,
    value: item.disclosureStage === 'initial' && item.value ? item.value : null,
    state: item.disclosureStage === 'initial' ? item.state : item.state === 'positive' || item.state === 'negative' ? 'unavailable-in-case' : item.state,
    retrievalIntents: item.retrievalIntents,
    volunteered: item.volunteered,
  }))
  const projection = {
    schemaVersion: 1,
    caseId: record.caseId,
    publicSlug: publicCase.publicSlug,
    truthHash: record.authoritativeHash,
    openingTruthId: opening.id,
    items: safeUnavailable,
  }
  const opaque = crypto.createHash('sha256').update(`${record.authoritativeHash}|conversation-v1`).digest('hex').slice(0, 24)
  const assetPath = `/case-conversations/${opaque}.json`
  fs.writeFileSync(path.join(publicRoot, `${opaque}.json`), `${JSON.stringify(sortKeys(projection), null, 2)}\n`, 'utf8')
  mappings.push({ caseId: record.caseId, publicSlug: publicCase.publicSlug, assetPath, truthHash: record.authoritativeHash })

  const session = engine.createPatientSession(projection)
  const turns = [
    engine.answerPatientQuestion(session, 'Tell me more about what brought you in.'),
    engine.answerPatientQuestion(session, 'What medication are you taking?'),
    engine.answerPatientQuestion(session, 'What is the diagnosis?'),
  ]
  transcripts.push({ caseId: record.caseId, truthHash: record.authoritativeHash, turns, tutor: engine.reviewConversation(session.audit), audit: session.audit })
}

write(mappingFile, { schemaVersion: 1, assets: mappings })
write(transcriptFile, { schemaVersion: 1, providerCalls: 0, learnerIdentifiersStored: 0, transcripts })
console.log(`Conversation projections generated: ${mappings.length}; private pilots exported: 0; provider calls: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
