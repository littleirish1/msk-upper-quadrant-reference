import { z } from 'zod'

export const INGESTION_SCHEMA_VERSION = 1 as const
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ingestionSourceTypeSchema = z.enum([
  'guideline',
  'systematic-review',
  'primary-study',
  'textbook-educational',
  'powerpoint-secondary-educational',
  'teaching-pdf-secondary-educational',
  'local-policy',
  'visual-source',
  'user-list',
  'repository-registry',
])

export const ingestionSourceSchema = z.strictObject({
  schemaVersion: z.literal(INGESTION_SCHEMA_VERSION),
  sourceId: z.string().regex(/^source\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  revision: z.number().int().positive(),
  sourceType: ingestionSourceTypeSchema,
  repositoryPath: z.string().min(1),
  hash: sha256Schema,
  registrationState: z.literal('registered'),
  extractionState: z.enum(['metadata-only', 'extracted-review-required', 'blocked']),
  sourceClearance: z.enum(['required', 'cleared-private-processing', 'approved-public-use', 'restricted', 'unknown']),
  imageRepublicationAllowed: z.literal(false),
  educationalSecondarySource: z.boolean(),
  blockers: z.array(z.string().min(1)),
})

export const claimProposalSchema = z.strictObject({
  proposalId: z.string().regex(/^claim-proposal\./),
  sourceId: z.string().regex(/^source\./),
  sourceRevision: z.number().int().positive(),
  locator: z.strictObject({
    page: z.number().int().positive().nullable(),
    slide: z.number().int().positive().nullable(),
    heading: z.string().min(1).nullable(),
    passageHash: sha256Schema,
  }),
  compliantExcerpt: z.string().min(1).max(300),
  paraphrase: z.string().min(1),
  studyType: z.string().min(1),
  population: z.string().min(1),
  setting: z.string().min(1),
  limitations: z.array(z.string().min(1)).min(1),
  applicability: z.array(z.string().min(1)).min(1),
  affectedModuleIds: z.array(z.string().regex(/^module\./)),
  conflictIds: z.array(z.string().min(1)),
  proposedAction: z.enum(['create-module-revision', 'create-rule-revision', 'record-gap', 'reject']),
  reviewState: z.literal('required'),
  publicEligibility: z.literal(false),
})

export const ingestionProposalSchema = z.strictObject({
  schemaVersion: z.literal(INGESTION_SCHEMA_VERSION),
  proposalId: z.string().regex(/^ingestion\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  sourceId: z.string().regex(/^source\./),
  sourceRevision: z.number().int().positive(),
  extracted: z.strictObject({
    textStored: z.boolean(),
    headingCount: z.number().int().nonnegative(),
    tableCount: z.number().int().nonnegative(),
    noteCount: z.number().int().nonnegative(),
    referenceCount: z.number().int().nonnegative(),
    claimCount: z.number().int().nonnegative(),
    populations: z.array(z.string().min(1)),
    settings: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    presentationFeatures: z.array(z.string().min(1)),
  }),
  duplicateSourceIds: z.array(z.string().regex(/^source\./)),
  supersedesSourceIds: z.array(z.string().regex(/^source\./)),
  claimProposals: z.array(claimProposalSchema),
  proposedModuleRevisions: z.array(z.string().regex(/^module\./)),
  proposedRuleRevisions: z.array(z.string().regex(/^rule\./)),
  licensingIssues: z.array(z.string().min(1)),
  reviewState: z.literal('required'),
  applyAutomatically: z.literal(false),
  publicEligibility: z.literal(false),
})

export const ingestionRegisterSchema = z.strictObject({
  schemaVersion: z.literal(INGESTION_SCHEMA_VERSION),
  authority: z.literal('private-evidence-to-module-ingestion'),
  sources: z.array(ingestionSourceSchema),
  proposals: z.array(ingestionProposalSchema),
  adapters: z.array(z.strictObject({
    adapterId: z.enum([
      'doi-crossref-like', 'pubmed-like', 'europe-pmc-like', 'guideline-metadata',
      'user-list', 'google-scholar-discovery-only',
    ]),
    mode: z.literal('offline-fixture'),
    networkEnabled: z.literal(false),
    automaticClaimCreation: z.literal(false),
  })),
})
