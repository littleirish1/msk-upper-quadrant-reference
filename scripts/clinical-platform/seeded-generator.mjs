import crypto from 'node:crypto'

export function stableJson(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function generatePatient({ recipe, truthRecord, seed, purpose = 'private-preview' }) {
  if (typeof seed !== 'string' || seed.length < 8) throw new Error('Seed must be an opaque string of at least eight characters.')
  if (truthRecord.recordId !== recipe.truthRecordId || truthRecord.authoritativeHash !== recipe.truthHash) {
    throw new Error('Recipe and authoritative truth revision do not match; generation failed closed.')
  }
  if (recipe.allowedVariation !== 'cosmetic') {
    throw new Error('Clinical and complex variation require approved variant modules and rules; none are authorised.')
  }
  if (purpose === 'public') {
    const approvalReady = recipe.lifecycle === 'approved'
      && recipe.governance.approvedRevision === recipe.recipeRevision
      && recipe.governance.recipeApprovalHash
      && recipe.governance.clinicalReview === 'approved'
      && recipe.governance.evidenceReview === 'approved'
      && recipe.governance.publicationReview === 'approved'
      && recipe.moduleRevisions.every((module) => module.approvalHash)
    if (!approvalReady) throw new Error('Public generation requires exact recipe, module, rule, truth, evidence, and publication approvals.')
  }

  const seedHash = sha256(Buffer.from(seed, 'utf8'))
  const suffix = Number.parseInt(seedHash.slice(0, 8), 16) % 1000
  const letters = `${String.fromCharCode(65 + (Number.parseInt(seedHash.slice(8, 10), 16) % 26))}${String.fromCharCode(65 + (Number.parseInt(seedHash.slice(10, 12), 16) % 26))}`
  const instanceId = `pt-${sha256(`${seed}|${recipe.recipeId}|${recipe.recipeRevision}|${recipe.truthHash}|${recipe.ruleDigest}`).slice(0, 16)}`
  const authoritative = {
    truthRecord,
    recipe: {
      recipeId: recipe.recipeId,
      recipeRevision: recipe.recipeRevision,
      moduleRevisions: recipe.moduleRevisions.map(({ moduleId, revision }) => ({ moduleId, revision })),
      ruleCatalogueRevision: recipe.ruleCatalogueRevision,
      ruleDigest: recipe.ruleDigest,
    },
  }
  const evidenceGapCount = truthRecord.gaps.length
  const disclosureViolationCount = truthRecord.items.filter((item) =>
    item.state === 'intentionally-withheld' && item.value !== null,
  ).length
  return {
    manifest: {
      schemaVersion: 1,
      instanceId,
      seedHash,
      recipeId: recipe.recipeId,
      recipeRevision: recipe.recipeRevision,
      truthRecordId: truthRecord.recordId,
      truthHash: truthRecord.authoritativeHash,
      moduleRevisions: recipe.moduleRevisions.map(({ moduleId, revision }) => ({ moduleId, revision })),
      ruleCatalogueRevision: recipe.ruleCatalogueRevision,
      ruleDigest: recipe.ruleDigest,
      variationLevel: recipe.allowedVariation,
      purpose,
      publicEligibility: purpose === 'public',
      patientAlias: `Patient ${letters}-${String(suffix).padStart(3, '0')}`,
      authoritativeOutputHash: sha256(stableJson(authoritative)),
      scans: {
        contradictionCount: 0,
        escalationRequirementCount: 0,
        disclosureViolationCount,
        evidenceGapCount,
      },
    },
    authoritative,
  }
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
