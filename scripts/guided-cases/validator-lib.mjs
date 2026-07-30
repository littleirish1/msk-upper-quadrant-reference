export function validateRecordSet(records, options = {}) {
  const findings = []
  const ids = new Set()
  const numbers = new Set()
  const routes = new Set()
  const publicRecords = []
  const draftRecords = []

  for (const record of records) {
    duplicate(findings, ids, record.caseId, 'case ID')
    duplicate(findings, numbers, record.learnerCaseNumber, 'learner case number')
    duplicate(findings, routes, `${record.region}/${record.publicSlug}`, 'case route')

    if (record.publicationEligibility) {
      publicRecords.push(record)
      if (record.lifecycleState !== 'published') findings.push(`${record.caseId}: eligible case is not published`)
      if (record.learnerCaseNumber.startsWith('Pilot ')) findings.push(`${record.caseId}: pilot cannot be public`)
    } else {
      draftRecords.push(record)
      if (record.governance.publicationDecision.status !== 'blocked') {
        findings.push(`${record.caseId}: ineligible case must have a blocked publication decision`)
      }
    }

    if (record.publicSlug.includes(record.privateDiagnosticIdentity.associatedConditionId)) {
      findings.push(`${record.caseId}: public slug contains the associated condition ID`)
    }
    if (record.evidenceHub.pinnedCaseRevision !== record.contentRevision
      || record.evidenceHub.pinnedCaseHash !== record.contentHash) {
      findings.push(`${record.caseId}: Evidence Hub case pin is stale`)
    }
    if (record.evidenceHub.conditionRecordId || record.evidenceHub.evidenceRecordIds.length
      || record.evidenceHub.relationshipIds.length || record.evidenceHub.reviewDecisionId) {
      findings.push(`${record.caseId}: references an Evidence Hub entity that this zero-record baseline cannot verify`)
    }
  }

  if (options.expectedPublic !== undefined && publicRecords.length !== options.expectedPublic) {
    findings.push(`expected ${options.expectedPublic} public records, found ${publicRecords.length}`)
  }
  if (options.expectedDraft !== undefined && draftRecords.length !== options.expectedDraft) {
    findings.push(`expected ${options.expectedDraft} draft records, found ${draftRecords.length}`)
  }

  return { findings, publicRecords, draftRecords }
}

function duplicate(findings, seen, value, label) {
  if (seen.has(value)) findings.push(`duplicate ${label}: ${value}`)
  seen.add(value)
}
