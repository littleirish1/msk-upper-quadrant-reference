import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'ingestionSchema.ts'), path.join(ROOT, 'src'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'ingestion', 'register.json')
const packetOutput = path.join(ROOT, 'reports', 'clinical-platform', 'ingestion-review-packet.json')
const sourceDefinitions = [
  { sourceId: 'source.repository.evidence-pilot-lateral-ankle-sprain', sourceType: 'textbook-educational', repositoryPath: 'content/evidence-hub/pilots/lateral-ankle-sprain.json', educationalSecondarySource: true },
  { sourceId: 'source.repository.evidence-pilot-rcrsp', sourceType: 'textbook-educational', repositoryPath: 'content/evidence-hub/pilots/rcrsp.json', educationalSecondarySource: true },
  { sourceId: 'source.repository.legacy-source-registry', sourceType: 'repository-registry', repositoryPath: 'content/imports/source-registry.json', educationalSecondarySource: false },
]

const sources = sourceDefinitions.map((definition) => {
  const file = path.join(ROOT, definition.repositoryPath)
  const bytes = fs.readFileSync(file)
  return schemas.ingestionSourceSchema.parse({
    schemaVersion: 1,
    ...definition,
    revision: 1,
    hash: crypto.createHash('sha256').update(bytes).digest('hex'),
    registrationState: 'registered',
    extractionState: 'metadata-only',
    sourceClearance: 'unknown',
    imageRepublicationAllowed: false,
    blockers: [
      'Clinical claims and source identifiers have not been independently verified.',
      'Source clearance and exact-locator extraction review remain required.',
    ],
  })
})

const duplicateGroups = new Map()
for (const source of sources) {
  const entries = duplicateGroups.get(source.hash) ?? []
  entries.push(source.sourceId)
  duplicateGroups.set(source.hash, entries)
}
const proposals = sources.map((source) => schemas.ingestionProposalSchema.parse({
  schemaVersion: 1,
  proposalId: `ingestion.${source.sourceId.slice('source.'.length)}`,
  sourceId: source.sourceId,
  sourceRevision: source.revision,
  extracted: { textStored: false, headingCount: 0, tableCount: 0, noteCount: 0, referenceCount: 0, claimCount: 0, populations: [], settings: [], limitations: [], presentationFeatures: [] },
  duplicateSourceIds: (duplicateGroups.get(source.hash) ?? []).filter((id) => id !== source.sourceId),
  supersedesSourceIds: [],
  claimProposals: [],
  proposedModuleRevisions: [],
  proposedRuleRevisions: [],
  licensingIssues: ['Public-use rights are not established; embedded images must not be republished.'],
  reviewState: 'required',
  applyAutomatically: false,
  publicEligibility: false,
}))
const adapterIds = ['doi-crossref-like', 'pubmed-like', 'europe-pmc-like', 'guideline-metadata', 'user-list', 'google-scholar-discovery-only']
const register = schemas.ingestionRegisterSchema.parse({
  schemaVersion: 1,
  authority: 'private-evidence-to-module-ingestion',
  sources,
  proposals,
  adapters: adapterIds.map((adapterId) => ({ adapterId, mode: 'offline-fixture', networkEnabled: false, automaticClaimCreation: false })),
})
const packet = {
  schemaVersion: 1,
  registeredSources: sources.length,
  verifiedHashes: sources.length,
  extractedClaimProposals: 0,
  proposedModuleRevisions: 0,
  proposedRuleRevisions: 0,
  automaticApplications: 0,
  duplicateGroups: [...duplicateGroups.values()].filter((group) => group.length > 1).length,
  supersessionDecisions: 0,
  adapters: adapterIds,
  networkCalls: 0,
  publicOutputs: 0,
  reviewQueue: proposals.map((proposal) => ({ proposalId: proposal.proposalId, sourceId: proposal.sourceId, reviewState: proposal.reviewState, blockers: sources.find((source) => source.sourceId === proposal.sourceId).blockers })),
}
write(output, register)
write(packetOutput, packet)
console.log(`Evidence ingestion register generated: ${sources.length} genuine tracked sources; claim proposals: 0; network calls: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
