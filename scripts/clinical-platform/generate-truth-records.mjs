import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { sha256CanonicalFile } from './canonical-hash.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'truthRecordSchema.ts'),
  path.join(ROOT, 'src'),
)
const recordsRoot = path.join(ROOT, 'content', 'guided-cases', 'records')
const outputFile = path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json')
const reportFile = path.join(ROOT, 'reports', 'clinical-platform', 'truth-record-migration.json')

const stable = (value) => JSON.stringify(sortKeys(value))
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const toPosix = (value) => value.split(path.sep).join('/')

const sources = ['published', 'drafts'].flatMap((directory) => {
  const root = path.join(recordsRoot, directory)
  return fs.readdirSync(root).filter((name) => name.endsWith('.json')).sort().map((name) => ({
    file: path.join(root, name),
    kind: directory,
  }))
})

const objectiveDomains = new Set([
  'objective-finding', 'neurological-finding', 'movement-finding', 'test-finding',
  'investigation-finding', 'management', 'safety-netting', 'escalation', 'prognosis',
])
const withheldDomains = new Set(['likely-diagnosis', 'condition-link'])

const records = sources.map(({ file, kind }) => {
  const sourceBytes = fs.readFileSync(file)
  const source = JSON.parse(sourceBytes.toString('utf8'))
  const sourceHash = sha256CanonicalFile(file)
  const moduleId = `module.${source.caseId.slice('case.'.length)}.presentation`
  const baseSource = {
    recordId: source.caseId,
    repositoryPath: toPosix(path.relative(ROOT, file)),
    revision: String(source.contentRevision),
    hash: sourceHash,
  }
  const items = schemas.truthDomainSchema.options.map((domain) => {
    const id = `truth.${source.caseId.slice('case.'.length)}.${domain}`
    if (domain === 'presenting-complaint' || domain === 'volunteered-fact') {
      return {
        id,
        domain,
        value: source.learnerPresentation.initialPresentation,
        state: 'positive',
        source: baseSource,
        disclosureStage: 'initial',
        volunteered: true,
        retrievalIntents: domain === 'presenting-complaint'
          ? ['opening', 'presenting-complaint', 'tell-me-more']
          : ['volunteered-information'],
        synonyms: domain === 'presenting-complaint' ? ['what brings you in', 'tell me what happened'] : [],
        patientKnowledge: 'knows',
        uncertainty: 'none-recorded',
        clinicalRole: 'context',
        moduleId,
        moduleRevision: 1,
      }
    }
    if (withheldDomains.has(domain)) {
      return {
        id,
        domain,
        value: null,
        state: 'intentionally-withheld',
        source: baseSource,
        disclosureStage: 'final-reveal',
        volunteered: false,
        retrievalIntents: [domain],
        synonyms: [],
        patientKnowledge: 'does-not-know',
        uncertainty: 'not-applicable',
        clinicalRole: 'diagnosis',
        moduleId: null,
        moduleRevision: null,
      }
    }
    const state = objectiveDomains.has(domain) ? 'not-yet-assessed' : 'unavailable-in-case'
    return {
      id,
      domain,
      value: null,
      state,
      source: baseSource,
      disclosureStage: objectiveDomains.has(domain) ? 'objective' : 'subjective',
      volunteered: false,
      retrievalIntents: [domain],
      synonyms: [],
      patientKnowledge: state === 'not-yet-assessed' ? 'not-applicable' : 'does-not-know',
      uncertainty: 'not-applicable',
      clinicalRole: objectiveDomains.has(domain) ? 'objective' : 'gap',
      moduleId: null,
      moduleRevision: null,
    }
  })

  const withoutHash = {
    schemaVersion: 1,
    recordId: `patient-truth.${source.caseId.slice('case.'.length)}`,
    caseId: source.caseId,
    caseRevision: source.contentRevision,
    seedBasis: `${source.caseId}@${source.contentRevision}:${source.contentHash}`,
    lifecycle: kind === 'published' ? 'baseline-published' : 'draft',
    publicModeEligibility: kind === 'published',
    immutableWithinSession: true,
    items,
    gaps: items.filter((item) => ['unavailable-in-case', 'not-yet-assessed', 'intentionally-withheld'].includes(item.state)).map((item) => ({
      domain: item.domain,
      state: item.state,
      reason: item.state === 'intentionally-withheld'
        ? 'Diagnosis-bearing truth remains governed by the final reveal boundary.'
        : 'The source record does not provide a reviewed atomic value for this domain.',
    })),
    governance: {
      sourceCaseHash: sourceHash,
      sourceCaseRevision: source.contentRevision,
      migrationKind: kind === 'published' ? 'baseline-meaning-preserved' : 'private-pilot-draft',
      clinicalReview: kind === 'published' ? 'baseline-carried-forward' : 'required',
      evidenceReview: kind === 'published' ? 'baseline-carried-forward' : 'required',
      publicationReview: kind === 'published' ? 'baseline-carried-forward' : 'required',
      limitations: [
        'Only the source-supported opening presentation is atomic in this migration.',
        'All other domains remain explicit gaps until reviewed source mapping occurs.',
      ],
      unresolvedIssues: source.evidenceHub.unresolvedEvidenceGaps,
    },
  }
  return schemas.patientTruthRecordSchema.parse({
    ...withoutHash,
    authoritativeHash: sha(Buffer.from(stable(withoutHash), 'utf8')),
  })
})

const library = schemas.patientTruthLibrarySchema.parse({
  schemaVersion: 1,
  authority: 'patient-truth-records',
  records: records.sort((left, right) => left.recordId.localeCompare(right.recordId)),
})

const report = {
  schemaVersion: 1,
  sourceRecordCount: sources.length,
  migratedPublicRecords: records.filter((record) => record.publicModeEligibility).length,
  migratedPrivatePilots: records.filter((record) => !record.publicModeEligibility).length,
  truthItems: records.reduce((sum, record) => sum + record.items.length, 0),
  explicitGaps: records.reduce((sum, record) => sum + record.gaps.length, 0),
  implicitNegatives: 0,
  publicRoutesChanged: 0,
  clinicalMeaningChanged: false,
}

writeJson(outputFile, library)
writeJson(reportFile, report)
console.log(`Patient Truth Records generated: ${records.length} (${report.migratedPublicRecords} public baseline, ${report.migratedPrivatePilots} private pilots).`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
