import { z } from 'zod'
import { ingestionSourceTypeSchema } from './managerSchemas.mjs'

export const fullChecksumSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
export const displaySourceIdSchema = z.string().regex(/^src-[0-9a-f]{12}$/)
const sourceRegionTagSchema = z.enum(['cervical', 'thoracic', 'shoulder', 'elbow', 'wrist-hand', 'headache', 'neurology', 'anatomy', 'lumbar', 'hip', 'knee', 'ankle-foot'])
const sourceTopicTagSchema = z.enum(['rcrsp', 'rotator-cuff-tear', 'shoulder-differential', 'exercise-rehabilitation', 'prognosis', 'imaging', 'patient-communication', 'patient-information', 'special-tests', 'outcome-measures', 'lateral-ankle-sprain', 'ankle-ligament-anatomy', 'fracture-screening', 'syndesmosis', 'balance-proprioception', 'return-to-sport', 'recurrence-prevention', 'bracing-taping', 'guideline', 'paper', 'osce'])

export const sourceSensitivitySchema = z.enum([
  'review-required',
  'restricted-pending-clearance',
  'quarantined',
  'cleared-for-private-evidence-processing',
])

export const clearanceLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  publicationApprovalRepresented: z.literal(false),
  entries: z.array(z.object({
    checksum: fullChecksumSchema,
    sourceId: displaySourceIdSchema,
    decision: z.enum(['clear-for-private-evidence-processing', 'retain-restriction', 'retain-quarantine']),
    clearanceScope: z.array(z.enum(['citation-extraction', 'private-proposal-support', 'private-topic-mapping'])).min(1),
    decidedBy: z.string().min(1),
    decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(1),
    previousStatus: z.enum(['restricted-pending-clearance', 'quarantined']),
    currentStatus: sourceSensitivitySchema,
  })).superRefine((entries, context) => {
    const seen = new Set()
    for (const [index, entry] of entries.entries()) {
      const key = `${entry.checksum}|${entry.clearanceScope.slice().sort().join(',')}`
      if (seen.has(key)) context.addIssue({ code: 'custom', path: [index], message: 'duplicate or contradictory clearance decision' })
      seen.add(key)
      if (entry.decision === 'clear-for-private-evidence-processing' && entry.currentStatus !== 'cleared-for-private-evidence-processing') {
        context.addIssue({ code: 'custom', path: [index, 'currentStatus'], message: 'clearance decision and current status disagree' })
      }
      if (entry.previousStatus === 'quarantined' && entry.decision === 'clear-for-private-evidence-processing') {
        context.addIssue({ code: 'custom', path: [index], message: 'quarantine cannot be cleared by this ledger' })
      }
    }
  }),
})

export const classificationOverridesSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(z.object({
    checksum: fullChecksumSchema,
    sourceId: displaySourceIdSchema,
    sourceType: ingestionSourceTypeSchema,
    topicTags: z.array(sourceTopicTagSchema),
    regionTags: z.array(sourceRegionTagSchema),
    reason: z.string().min(1),
    decidedBy: z.string().min(1),
    decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewStatus: z.literal('classification-recorded'),
  })),
})

export const securityFalsePositiveDecisionsSchema = z.object({
  schemaVersion: z.literal(1),
  publicationApprovalRepresented: z.literal(false),
  copyrightApprovalRepresented: z.literal(false),
  clinicalApprovalRepresented: z.literal(false),
  entries: z.array(z.object({
    checksum: fullChecksumSchema,
    sourceId: displaySourceIdSchema,
    detectorRuleId: z.literal('aws-access-key-shaped'),
    matchCount: z.number().int().positive(),
    decision: z.literal('false-positive-confirmed'),
    decisionScope: z.literal('credential-stop-override-for-exact-checksum-only'),
    reviewedBy: z.literal('operator-manual-review'),
    decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rationale: z.string().min(20).max(300),
  })).superRefine((entries, context) => {
    const seen = new Set()
    for (const [index, entry] of entries.entries()) {
      const key = `${entry.checksum}|${entry.detectorRuleId}`
      if (seen.has(key)) context.addIssue({ code: 'custom', path: [index], message: 'duplicate or contradictory false-positive decision' })
      seen.add(key)
      if (!entry.checksum.startsWith(`sha256:${entry.sourceId.slice(4)}`)) {
        context.addIssue({ code: 'custom', path: [index, 'sourceId'], message: 'source ID does not match checksum prefix' })
      }
    }
  }),
})

const occurrenceSchema = z.object({
  logicalPath: z.string().min(1),
  containerSourceId: displaySourceIdSchema.nullable(),
  dateMetadata: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    provenance: z.enum(['local-filesystem-unreliable', 'zip-entry-unreliable']),
  }).nullable(),
})

export const sourceIntakeRecordV2Schema = z.object({
  sourceId: displaySourceIdSchema,
  checksum: fullChecksumSchema,
  logicalPath: z.string().min(1),
  originalFilename: z.string().min(1),
  fileType: z.string().regex(/^\.[a-z0-9]+$|^unknown$/),
  byteSize: z.number().int().nonnegative(),
  containerSourceId: displaySourceIdSchema.nullable(),
  occurrences: z.array(occurrenceSchema).min(1),
  sourceType: ingestionSourceTypeSchema,
  topicTags: z.array(sourceTopicTagSchema),
  regionTags: z.array(sourceRegionTagSchema),
  duplicateGroup: z.string().nullable(),
  probableVersionGroup: z.string().nullable(),
  sensitivity: sourceSensitivitySchema,
  sensitivityFindings: z.array(z.object({ category: z.string().min(1), count: z.number().int().positive() })),
  clearanceScopes: z.array(z.enum(['citation-extraction', 'private-proposal-support', 'private-topic-mapping'])),
  extractionSupport: z.enum(['supported', 'metadata-only', 'unsupported']),
  extractionStatus: z.enum(['extracted', 'partial', 'unsupported', 'failed', 'quarantined', 'restricted', 'metadata-only']),
  extractionMetadata: z.object({
    method: z.string().min(1),
    pageOrSlideCount: z.number().int().nonnegative().nullable(),
    extractedCharacterCount: z.number().int().nonnegative(),
    headingsDetected: z.array(z.string().min(1).max(160)).max(30),
    referencesSectionDetected: z.boolean(),
    tablesDetected: z.number().int().nonnegative(),
    imagesDetected: z.number().int().nonnegative(),
    confidence: z.enum(['high', 'medium', 'low', 'none']),
    warnings: z.array(z.object({ code: z.string().min(1), count: z.number().int().positive() })),
  }),
  copyrightOrLicenceStatus: z.enum(['unknown', 'review-required', 'approved-for-intended-use']),
  intendedUse: z.array(z.string().min(1)).min(1),
  reviewStatus: z.enum(['needs-review', 'restricted-pending-clearance', 'quarantined', 'cleared-private-only']),
  publicEligibility: z.literal(false),
})

export const sourceIntakeManifestV2Schema = z.object({
  schemaVersion: z.literal(2),
  runId: z.string().regex(/^run-[0-9a-f]{16}$/),
  sourceSetFingerprint: fullChecksumSchema,
  implementationCommit: z.string().regex(/^[0-9a-f]{40}$/),
  extractor: z.object({
    name: z.literal('source-intake-pilot'),
    version: z.string().min(1),
    pythonVersion: z.string().min(1),
    pypdfVersion: z.string().min(1),
    defusedxmlVersion: z.string().min(1),
  }),
  generatedFrom: z.object({
    locationCategory: z.literal('private-external-inbox'),
    absolutePathStored: z.literal(false),
  }),
  records: z.array(sourceIntakeRecordV2Schema),
  archiveWarnings: z.array(z.object({
    containerSourceId: displaySourceIdSchema,
    category: z.string().min(1),
    warningCode: z.string().min(1),
    count: z.number().int().positive(),
  })),
  summary: z.object({
    topLevelFiles: z.number().int().nonnegative(),
    nestedFiles: z.number().int().nonnegative(),
    uniqueSources: z.number().int().nonnegative(),
    totalObservedBytes: z.number().int().nonnegative(),
    exactDuplicateGroups: z.number().int().nonnegative(),
    probableVersionGroups: z.number().int().nonnegative(),
    quarantinedSources: z.number().int().nonnegative(),
    restrictedPendingClearanceSources: z.number().int().nonnegative(),
    clearedSources: z.number().int().nonnegative(),
    manualReviewSources: z.number().int().nonnegative(),
    suppressedSensitiveLines: z.number().int().nonnegative(),
    referencesExcludedUncleared: z.number().int().nonnegative(),
    proposalSourcesExcludedUncleared: z.number().int().nonnegative(),
  }),
})

export const referenceClassificationSchema = z.enum([
  'identifier-only',
  'author-year-only',
  'partial-bibliographic',
  'full-looking-unverified',
  'generic-web-link',
  'licence-or-attribution-link',
  'media-or-engagement-link',
  'contact-or-administrative-link',
  'unable-to-classify',
])

export const candidateReferenceV2Schema = z.object({
  candidateReferenceId: z.string().regex(/^ref-[a-z0-9-]+$/),
  sourceId: displaySourceIdSchema,
  sourceChecksum: fullChecksumSchema,
  pageOrSlideNumber: z.number().int().positive().nullable(),
  location: z.string().min(1),
  citationText: z.string().min(1).max(280),
  citationTextHash: fullChecksumSchema,
  authors: z.array(z.string().min(1).max(120)),
  year: z.string().regex(/^\d{4}[a-z]?$/).nullable(),
  title: z.string().max(300).nullable(),
  journalOrPublisher: z.string().max(200).nullable(),
  volumeIssuePages: z.string().max(120).nullable(),
  doi: z.string().nullable(),
  pmid: z.string().nullable(),
  url: z.string().url().nullable(),
  relatedTopicOrClaim: z.string().min(1),
  citationContext: z.enum(['in-text', 'reference-list', 'further-reading', 'hyperlink', 'attribution']),
  classification: referenceClassificationSchema,
  extractionConfidence: z.enum(['high', 'medium', 'low']),
  verificationStatus: z.enum(['extracted-unverified', 'identifier-present-unverified', 'likely-duplicate', 'unable-to-identify']),
  verificationEvidence: z.null(),
  duplicateGroup: z.string().nullable(),
  notes: z.string().max(300),
})

export const candidateReferenceRegistryV2Schema = z.object({
  schemaVersion: z.literal(2),
  runId: z.string().regex(/^run-[0-9a-f]{16}$/),
  externalLookupPerformed: z.literal(false),
  records: z.array(candidateReferenceV2Schema),
  excluded: z.object({
    restrictedUncleared: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    sensitiveOrAdministrative: z.number().int().nonnegative(),
  }),
})

export const sourceToContentGraphV2Schema = z.object({
  schemaVersion: z.literal(2),
  runId: z.string().regex(/^run-[0-9a-f]{16}$/),
  nodes: z.array(z.object({
    proposalId: z.string().regex(/^proposal-[a-z0-9-]+$/),
    sourceIds: z.array(displaySourceIdSchema),
    sourceChecksums: z.array(fullChecksumSchema),
    extractedTeachingTopic: z.string().min(1),
    proposedClinicalClaim: z.string().min(1),
    targetContentId: z.string().min(1),
    requiredEvidence: z.array(z.string().min(1)).min(1),
    clinicianReviewStatus: z.literal('required'),
    proposalStatus: z.literal('blocked-pending-evidence-and-clinician-review'),
    teachingSourceCanEstablishPublicApproval: z.literal(false),
    visualLicenceStatus: z.enum(['not-applicable', 'unknown-review-required']),
    publicEligibility: z.literal(false),
  })),
})

export const sourceIntakeRunManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^run-[0-9a-f]{16}$/),
  status: z.literal('complete'),
  implementationCommit: z.string().regex(/^[0-9a-f]{40}$/),
  sourceSetFingerprint: fullChecksumSchema,
  expectedFiles: z.array(z.string().min(1)).min(1),
  sourceCounts: z.object({ unique: z.number().int().nonnegative(), quarantined: z.number().int().nonnegative(), restricted: z.number().int().nonnegative(), cleared: z.number().int().nonnegative() }),
  deterministicTimestamps: z.literal(false),
})
