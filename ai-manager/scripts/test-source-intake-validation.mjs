import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { scanSensitiveText } from './sensitiveDataPolicy.mjs'
import { scanTrackedText, sourceAllowsScope, validateMarkdownGovernance } from './validate-source-intake-pilot.mjs'
import { clearanceLedgerSchema, securityFalsePositiveDecisionsSchema } from '../schemas/sourceIntakeSchemas.mjs'

const hygiene = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ai-manager', 'content-hygiene-names.json'), 'utf8'))
const governed = hygiene.termsToFlag[0]
const fixtures = [
  ['email-address', `fixture${'@'}example.test`],
  ['telephone-number', ['+44', '7123', '456', '789'].join(' ')],
  ['uk-postcode', ['AB1', '2CD'].join(' ')],
  ['date-of-birth', ['DOB:', '01/02/1990'].join(' ')],
  ['student-or-candidate-identifier', ['student id:', 'ZZ12345'].join(' ')],
  ['governed-sensitive-name', governed],
  ['private-absolute-path', ['C:', 'Users', 'fixture', 'private.txt'].join('\\')],
  ['unc-path', '\\\\fixture-server\\private-share\\file.txt'],
  ['credential-value', `${['gh', 'p_'].join('')}${'A'.repeat(24)}`],
  ['bidi-or-control-character', `safe${String.fromCharCode(0x202e)}unsafe`],
]
const contexts = ['citationText', 'headingsDetected', 'url', 'logicalPath', 'occurrencePath', 'markdown']
let checks = 0
for (const [category, value] of fixtures) {
  assert(scanSensitiveText(value).includes(category), `policy missed ${category}`)
  for (const context of contexts) {
    const findings = scanTrackedText(JSON.stringify({ [context]: value }), context)
    assert(findings.some((item) => item.includes(category)), `${context} missed ${category}`)
    checks += 1
  }
}
assert.equal(scanTrackedText(JSON.stringify({ summary: { suppressedEmailCount: 2 } })).length, 0)
const restricted = { sourceId: 'src-bbbbbbbbbbbb', sensitivity: 'restricted-pending-clearance', clearanceScopes: [], extractionStatus: 'restricted' }
const quarantined = { sourceId: 'src-cccccccccccc', sensitivity: 'quarantined', clearanceScopes: [], extractionStatus: 'quarantined' }
const clearedCitation = { sourceId: 'src-dddddddddddd', sensitivity: 'cleared-for-private-evidence-processing', clearanceScopes: ['citation-extraction'], extractionStatus: 'extracted' }
assert.equal(sourceAllowsScope(restricted, 'citation-extraction'), false)
assert.equal(sourceAllowsScope(restricted, 'private-proposal-support'), false)
assert.equal(sourceAllowsScope(quarantined, 'citation-extraction'), false)
assert.equal(sourceAllowsScope(clearedCitation, 'citation-extraction'), true)
assert.equal(sourceAllowsScope(clearedCitation, 'private-proposal-support'), false)
const checksum = `sha256:${'a'.repeat(64)}`
const entry = { checksum, sourceId: 'src-aaaaaaaaaaaa', decision: 'clear-for-private-evidence-processing', clearanceScope: ['citation-extraction'], decidedBy: 'fixture-reviewer', decisionDate: '2026-01-01', reason: 'fictional test decision', previousStatus: 'restricted-pending-clearance', currentStatus: 'cleared-for-private-evidence-processing' }
assert.equal(clearanceLedgerSchema.safeParse({ schemaVersion: 1, publicationApprovalRepresented: false, entries: [entry] }).success, true)
assert.equal(clearanceLedgerSchema.safeParse({ schemaVersion: 1, publicationApprovalRepresented: false, entries: [{ ...entry, previousStatus: 'quarantined' }] }).success, false)
assert.equal(clearanceLedgerSchema.safeParse({ schemaVersion: 1, publicationApprovalRepresented: false, entries: [entry, entry] }).success, false)
const securityEntry = { checksum, sourceId: 'src-aaaaaaaaaaaa', detectorRuleId: 'aws-access-key-shaped', matchCount: 4, decision: 'false-positive-confirmed', decisionScope: 'credential-stop-override-for-exact-checksum-only', reviewedBy: 'operator-manual-review', decisionDate: '2026-01-01', rationale: 'Fictional fixture manually reviewed and not operational.' }
const securityBase = { schemaVersion: 1, publicationApprovalRepresented: false, copyrightApprovalRepresented: false, clinicalApprovalRepresented: false }
assert.equal(securityFalsePositiveDecisionsSchema.safeParse({ ...securityBase, entries: [securityEntry] }).success, true)
assert.equal(securityFalsePositiveDecisionsSchema.safeParse({ ...securityBase, entries: [securityEntry, securityEntry] }).success, false)
assert.equal(securityFalsePositiveDecisionsSchema.safeParse({ ...securityBase, publicationApprovalRepresented: true, entries: [securityEntry] }).success, false)

const marker = (role, scope, line) => `<!-- source-list role=${role} scope=${scope} -->\n${line}\n<!-- /source-list -->`
const restrictedLine = `- sourceId=${restricted.sourceId}; governance=${restricted.sensitivity}; extraction=${restricted.extractionStatus}`
const quarantinedLine = `- sourceId=${quarantined.sourceId}; governance=${quarantined.sensitivity}; extraction=${quarantined.extractionStatus}`
assert(validateMarkdownGovernance(marker('eligible', 'citation-extraction', restrictedLine), [restricted]).findings.some((item) => item.includes('ineligible source')))
assert.equal(validateMarkdownGovernance(marker('restricted', 'citation-extraction', restrictedLine), [restricted]).findings.length, 0)
assert(validateMarkdownGovernance(marker('eligible', 'citation-extraction', quarantinedLine), [quarantined]).findings.some((item) => item.includes('ineligible source')))
assert(validateMarkdownGovernance(marker('restricted', 'citation-extraction', '- sourceId=src-eeeeeeeeeeee; governance=restricted-pending-clearance; extraction=restricted'), [restricted]).findings.some((item) => item.includes('unknown source ID')))
assert(validateMarkdownGovernance(marker('restricted', 'citation-extraction', `- sourceId=${restricted.sourceId}; governance=review-required; extraction=restricted`), [restricted]).findings.some((item) => item.includes('status mismatch')))
assert.equal(validateMarkdownGovernance(marker('eligible', 'citation-extraction', '- none'), [restricted]).findings.length, 0)
assert.equal(sourceAllowsScope({ ...restricted, securityFalsePositiveDecision: 'false-positive-confirmed' }, 'citation-extraction'), false)
console.log(`Source-intake output validation fixtures passed: ${checks} context checks.`)
