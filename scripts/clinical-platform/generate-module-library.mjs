import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { sha256CanonicalFile } from './canonical-hash.mjs'

const ROOT = process.cwd()
const schemaFile = path.join(ROOT, 'src', 'lib', 'clinical-platform', 'moduleSchema.ts')
const outputFile = path.join(ROOT, 'ai-manager', 'clinical-platform', 'modules', 'module-library.json')
const publishedDirectory = path.join(ROOT, 'content', 'guided-cases', 'records', 'published')
const schema = await loadTypeScriptTree(schemaFile, path.join(ROOT, 'src'))

const sourceFiles = fs.readdirSync(publishedDirectory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => path.join(publishedDirectory, name))

const modules = sourceFiles.map((sourceFile) => {
  const sourceBytes = fs.readFileSync(sourceFile)
  const source = JSON.parse(sourceBytes.toString('utf8'))
  const sourcePath = path.relative(ROOT, sourceFile).split(path.sep).join('/')
  return {
    schemaVersion: 1,
    id: `module.${source.caseId.slice('case.'.length)}.presentation`,
    type: 'condition-presentation',
    revision: 1,
    lifecycle: 'draft',
    publicationState: 'private',
    publicLabel: source.neutralTitle,
    internalLabel: source.privateDiagnosticIdentity.internalTitle,
    structuredMeaning: {
      kind: 'carried-forward-presentation',
      value: source.learnerPresentation.initialPresentation,
      sourceCaseId: source.caseId,
    },
    patientPhrasing: {
      approved: [source.learnerPresentation.initialPresentation],
      status: 'baseline-carried-forward',
    },
    tutorPhrasing: {
      approved: source.reasoningStages
        .map((stage) => stage.feedback)
        .filter((value) => typeof value === 'string'),
      status: 'baseline-carried-forward',
    },
    synonyms: [],
    questionMappings: ['presenting complaint', 'tell me what brought you in', 'tell me more'],
    applicability: {
      populations: ['source-record population only'],
      settings: ['education'],
      regions: [source.region],
      limitations: ['No applicability beyond the exact carried-forward source case is asserted.'],
    },
    companions: { required: [], prohibited: [] },
    constraints: { temporal: [], severity: [], escalation: [] },
    difficulty: ['foundation', 'intermediate', 'advanced'].includes(source.difficulty)
      ? source.difficulty
      : 'not-rated',
    relationships: {
      sources: [{
        recordId: source.caseId,
        repositoryPath: sourcePath,
        revision: String(source.contentRevision),
        hash: sha256CanonicalFile(sourceFile),
      }],
      evidenceRecordIds: source.evidenceHub.evidenceRecordIds,
      evidenceGapIds: source.evidenceHub.unresolvedEvidenceGaps.map((_, index) =>
        `gap.${source.caseId}.module-presentation-${index + 1}`),
    },
    flags: { aiAssisted: false, humanEdited: true, requiresHumanReview: true },
    reviews: {
      clinical: 'required',
      evidence: 'required',
      source: 'baseline-carried-forward',
      publication: 'required',
      approvalHash: null,
      approvedRevision: null,
      nextReviewDate: null,
      limitations: [
        'The source case approval is preserved; it does not approve this new module revision.',
      ],
      unresolvedIssues: [
        'Exact-revision clinical, evidence and publication review are required.',
      ],
    },
    fieldClassifications: { ...schema.MODULE_FIELD_VISIBILITY },
  }
})

const library = schema.clinicalModuleLibrarySchema.parse({
  schemaVersion: 1,
  authority: 'clinical-module-library',
  generatedFrom: sourceFiles.map((file) => path.relative(ROOT, file).split(path.sep).join('/')),
  modules,
})

const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortKeys(item)]))
    : value

fs.mkdirSync(path.dirname(outputFile), { recursive: true })
fs.writeFileSync(outputFile, `${JSON.stringify(sortKeys(library), null, 2)}\n`, 'utf8')
console.log(`Clinical module library generated: ${modules.length} private review-required modules.`)

if (process.argv[1] && pathToFileURL(process.argv[1]).href !== import.meta.url) process.exit(0)
