import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  managerActionPolicySchema,
  privateAuthoringWorkspaceSchema,
  privateIngestionProposalSchema,
} from '../schemas/managerSchemas.mjs'

const root = process.cwd()
const manager = path.join(root, 'ai-manager')
const proposal = JSON.parse(fs.readFileSync(path.join(manager, 'schemas', 'private-ingestion-proposal.example.json'), 'utf8'))
const policy = JSON.parse(fs.readFileSync(path.join(manager, 'config', 'programmes-1-6-manager-policy.json'), 'utf8'))
const workspace = JSON.parse(fs.readFileSync(path.join(manager, 'case-manager', 'workspace.json'), 'utf8'))
let assertions = 0

assert.equal(privateIngestionProposalSchema.safeParse(proposal).success, true); assertions++
assert.equal(privateIngestionProposalSchema.safeParse({ ...proposal, publicationState: 'public' }).success, false); assertions++
assert.equal(privateIngestionProposalSchema.safeParse({ ...proposal, autonomousPublicationAllowed: true }).success, false); assertions++
assert.equal(managerActionPolicySchema.safeParse(policy).success, true); assertions++
assert.equal(policy.prohibitedActions.includes('push'), true); assertions++
assert.equal(policy.prohibitedActions.includes('approve-publication'), true); assertions++
assert.equal(privateAuthoringWorkspaceSchema.safeParse(workspace).success, true); assertions++
assert.equal(workspace.publicRoute, null); assertions++
assert.equal(workspace.staticExportAllowed, false); assertions++

const trackedText = [proposal, policy, workspace].map((value) => JSON.stringify(value)).join('\n')
assert.equal(/[A-Za-z]:[\\/](?:Users|dev)[\\/]/.test(trackedText), false); assertions++
assert.equal(/(?:AKIA|ASIA)[A-Z0-9]{16}/.test(trackedText), false); assertions++

console.log(`Private workflow tests passed. Assertions: ${assertions}; provider calls: 0; public outputs: 0.`)
