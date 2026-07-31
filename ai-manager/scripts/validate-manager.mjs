import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  contentProposalSchema,
  ingestionManifestSchema,
  managerConfigSchema,
  managerActionPolicySchema,
  privateAuthoringWorkspaceSchema,
  privateIngestionProposalSchema,
} from '../schemas/managerSchemas.mjs'

const ROOT = process.cwd()
const MANAGER_DIR = path.join(ROOT, 'ai-manager')
const findings = []

validateJson('config/manager.example.json', managerConfigSchema)
validateJson('schemas/ingestion-manifest.template.json', ingestionManifestSchema)
validateJson('schemas/content-proposal.template.json', contentProposalSchema)
validateJson('config/programmes-1-6-manager-policy.json', managerActionPolicySchema)
validateJson('schemas/private-ingestion-proposal.example.json', privateIngestionProposalSchema)
validateJson('case-manager/workspace.json', privateAuthoringWorkspaceSchema)

const invalidApproval = JSON.parse(fs.readFileSync(path.join(MANAGER_DIR, 'schemas', 'content-proposal.template.json'), 'utf8'))
invalidApproval.status = 'approved-for-commit'
invalidApproval.decision = 'pending'
invalidApproval.reviewer = null
invalidApproval.finalDiffPath = null
assert.equal(contentProposalSchema.safeParse(invalidApproval).success, false, 'unreviewed proposal approval must fail')

const ignoreText = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').replace(/\\/g, '/')
for (const required of ['ai-manager/inbox/**', 'ai-manager/archive/**', 'ai-manager/reports/**', 'ai-manager/config/local.*']) {
  if (!ignoreText.includes(required)) findings.push(`missing private ignore rule: ${required}`)
}

const inbox = path.join(MANAGER_DIR, 'inbox')
const pendingManifests = fs.existsSync(inbox)
  ? fs.readdirSync(inbox).filter((name) => name.endsWith('.json')).length
  : 0

if (findings.length) {
  console.error('AI knowledge-manager validation failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log(`AI knowledge-manager validation passed. Pending local intake manifests: ${pendingManifests}. Provider mode: disabled.`)

function validateJson(relative, schema) {
  const file = path.join(MANAGER_DIR, relative)
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  const result = schema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) findings.push(`${relative} ${issue.path.join('.')}: ${issue.message}`)
  }
}
