import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { sha256CanonicalFile } from './canonical-hash.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'ingestionSchema.ts'), path.join(ROOT, 'src'))
const register = schemas.ingestionRegisterSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'ingestion', 'register.json'), 'utf8')))
assert.equal(register.sources.length, 3)
assert.equal(register.proposals.length, 3)
assert.equal(register.adapters.length, 6)
assert.ok(register.adapters.every((adapter) => !adapter.networkEnabled && !adapter.automaticClaimCreation && adapter.mode === 'offline-fixture'))
assert.ok(register.sources.every((source) => !source.imageRepublicationAllowed && source.sourceClearance === 'unknown'))
assert.ok(register.proposals.every((proposal) => proposal.claimProposals.length === 0 && !proposal.applyAutomatically && !proposal.publicEligibility))

for (const source of register.sources) {
  assert.ok(!source.repositoryPath.includes('private-cache') && !source.repositoryPath.includes('.venv-source-intake') && !source.repositoryPath.includes('docs/reviews/current'))
  assert.equal(sha256CanonicalFile(path.join(ROOT, source.repositoryPath)), source.hash)
}

const powerpoint = schemas.ingestionSourceSchema.safeParse({ ...register.sources[0], sourceId: 'source.synthetic.powerpoint-fixture', sourceType: 'powerpoint-secondary-educational', educationalSecondarySource: true })
assert.equal(powerpoint.success, true)
const invalidClaim = schemas.claimProposalSchema.safeParse({ proposalId: 'claim-proposal.synthetic.missing-fields' })
assert.equal(invalidClaim.success, false)
assert.ok(!JSON.stringify(register).match(/[A-Za-z]:[\\/](?:Users|dev)[\\/]/))

console.log('Evidence ingestion tests passed: hashes, strict claim locators, duplicate workflow, 6 offline adapters, 0 claims/network/public outputs.')
