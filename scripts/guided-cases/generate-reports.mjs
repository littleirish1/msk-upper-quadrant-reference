import fs from 'node:fs'
import path from 'node:path'
import { canonicalCaseHash, readRecords, REPORTS_DIR, stableJson } from './shared.mjs'

const { records: loaded, findings } = await readRecords()
if (findings.length) throw new Error(findings.join('\n'))
const records = loaded.map(({ record }) => record).sort((a, b) => a.caseId.localeCompare(b.caseId))
fs.rmSync(REPORTS_DIR, { recursive: true, force: true })
fs.mkdirSync(path.join(REPORTS_DIR, 'cases'), { recursive: true })
fs.mkdirSync(path.join(REPORTS_DIR, 'pilots'), { recursive: true })

const summary = {
  schemaVersion: 1,
  total: records.length,
  published: records.filter((record) => record.publicationEligibility).length,
  drafts: records.filter((record) => !record.publicationEligibility).length,
  evidenceHubVerifiedRelationships: 0,
  records: records.map((record) => ({
    caseId: record.caseId,
    learnerCaseNumber: record.learnerCaseNumber,
    neutralTitle: record.neutralTitle,
    region: record.region,
    lifecycleState: record.lifecycleState,
    publicationEligibility: record.publicationEligibility,
    contentRevision: record.contentRevision,
    contentHash: record.contentHash,
    clinicalReviewStatus: record.governance.clinicalReviewStatus,
    evidenceReviewStatus: record.governance.evidenceReviewStatus,
    sourceClearanceStatus: record.governance.sourceClearanceStatus,
    unresolvedIssueCount: record.governance.unresolvedIssues.length,
    unresolvedEvidenceGapCount: record.evidenceHub.unresolvedEvidenceGaps.length,
  })),
}
fs.writeFileSync(path.join(REPORTS_DIR, 'summary.json'), stableJson(summary), 'utf8')
fs.writeFileSync(path.join(REPORTS_DIR, 'evidence-relationship-catalogue.json'), stableJson({
  schemaVersion: 1,
  publicProjection: false,
  verifiedRelationshipCount: 0,
  relationships: records.map((record) => ({
    caseId: record.caseId,
    caseRevision: record.contentRevision,
    caseHash: record.contentHash,
    conditionRecordId: record.evidenceHub.conditionRecordId,
    evidenceRecordIds: record.evidenceHub.evidenceRecordIds,
    relationshipIds: record.evidenceHub.relationshipIds,
    reviewDecisionId: record.evidenceHub.reviewDecisionId,
    status: 'blocked-unresolved',
    gaps: record.evidenceHub.unresolvedEvidenceGaps,
  })),
}), 'utf8')

for (const record of records) {
  const report = {
    caseId: record.caseId,
    schemaVersion: record.schemaVersion,
    contentRevision: record.contentRevision,
    contentHash: record.contentHash,
    hashRecomputed: canonicalCaseHash(record),
    lifecycleState: record.lifecycleState,
    publicationEligibility: record.publicationEligibility,
    publicRoute: record.publicationEligibility
      ? `/cases/${record.region}/${record.publicSlug}/`
      : null,
    learnerCaseNumber: record.learnerCaseNumber,
    governance: record.governance,
    evidenceHub: record.evidenceHub,
    generatedArtifacts: record.publicationEligibility
      ? ['public immediate projection', 'delayed reveal projection']
      : ['internal review model only'],
  }
  fs.writeFileSync(path.join(REPORTS_DIR, 'cases', `${record.caseId}.json`), stableJson(report), 'utf8')
  if (!record.publicationEligibility && record.learnerCaseNumber.startsWith('Pilot ')) {
    fs.writeFileSync(path.join(REPORTS_DIR, 'pilots', `${record.caseId}-migration.json`), stableJson({
      caseId: record.caseId,
      sourceStationId: record.privateDiagnosticIdentity.internalSourceStationId,
      sourceHash: record.provenance.sourceRevisionOrHash,
      transformations: record.provenance.transformationHistory,
      omittedOrUnsupportedContent: record.governance.unresolvedIssues,
      evidenceQuestions: record.evidenceHub.unresolvedEvidenceGaps,
      publicationBlockers: [
        record.governance.clinicalReviewStatus,
        record.governance.evidenceReviewStatus,
        record.governance.sourceClearanceStatus,
      ],
      publicOutputExpected: false,
    }), 'utf8')
  }
}

console.log(`Generated ${records.length} guided-case reviewer reports.`)
