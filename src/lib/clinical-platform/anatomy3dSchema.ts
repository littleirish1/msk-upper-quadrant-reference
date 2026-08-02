import { z } from 'zod'

export const ANATOMY_3D_SCHEMA_VERSION = 1 as const

export const anatomyStructureTypeSchema = z.enum([
  'bone',
  'joint',
  'articular-surface',
  'ligament',
  'tendon',
  'muscle',
  'origin',
  'insertion',
  'nerve',
  'vessel',
  'landmark',
  'plane',
  'axis',
  'regional-relationship',
])

export const anatomy3dAssetSchema = z.strictObject({
  schemaVersion: z.literal(ANATOMY_3D_SCHEMA_VERSION),
  id: z.string().regex(/^asset3d\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  revision: z.number().int().positive(),
  region: z.enum(['cervical', 'shoulder', 'elbow', 'wrist-hand', 'lumbar', 'hip', 'knee', 'ankle-foot']),
  title: z.string().min(1),
  assetPath: z.string().min(1).nullable(),
  assetHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  source: z.string().min(1),
  creator: z.string().min(1),
  licence: z.string().min(1),
  permittedUse: z.enum(['none', 'private-review', 'public']),
  attribution: z.string().min(1),
  structures: z.array(z.strictObject({
    id: z.string().regex(/^structure\./),
    type: anatomyStructureTypeSchema,
    publicLabel: z.string().min(1),
    accessibleDescription: z.string().min(1),
    reviewState: z.enum(['required', 'approved', 'stale', 'blocked']),
  })),
  interactions: z.array(z.enum([
    'rotate', 'zoom', 'pan', 'reset', 'isolate', 'hide-show', 'transparency',
    'select', 'labels', 'origin-insertion', 'muscle-actions', 'related-content', 'keyboard-controls',
  ])),
  relatedMovementIds: z.array(z.string().regex(/^movement\./)),
  relatedConditionIds: z.array(z.string().min(1)),
  relatedCaseIds: z.array(z.string().regex(/^case\./)),
  nonVisualEquivalent: z.strictObject({
    structureBrowser: z.boolean(),
    textRelationships: z.boolean(),
    keyboardOperation: z.boolean(),
    transcriptRequired: z.boolean(),
    webglFallbackRequired: z.boolean(),
  }),
  budgets: z.strictObject({
    maxMobileTriangles: z.number().int().positive(),
    maxTextureBytes: z.number().int().positive(),
    maxDecodedBytes: z.number().int().positive(),
    lazyLoadRequired: z.literal(true),
    unrelatedRouteBundleBytes: z.literal(0),
    budgetReviewState: z.enum(['required', 'approved', 'stale']),
  }),
  reviews: z.strictObject({
    provenance: z.enum(['required', 'approved', 'stale', 'blocked']),
    licence: z.enum(['required', 'approved', 'stale', 'blocked']),
    anatomy: z.enum(['required', 'approved', 'stale', 'blocked']),
    clinical: z.enum(['required', 'approved', 'stale', 'blocked']),
    accessibility: z.enum(['required', 'approved', 'stale', 'blocked']),
    performance: z.enum(['required', 'approved', 'stale', 'blocked']),
    publication: z.enum(['required', 'approved', 'stale', 'blocked']),
  }),
  publicEligibility: z.boolean(),
  blockers: z.array(z.string().min(1)),
}).superRefine((asset, context) => {
  if (asset.publicEligibility) {
    if (!asset.assetPath || !asset.assetHash || asset.permittedUse !== 'public') {
      context.addIssue({ code: 'custom', path: ['publicEligibility'], message: 'public 3D requires a hashed asset and public-use rights' })
    }
    for (const [domain, state] of Object.entries(asset.reviews)) {
      if (state !== 'approved') context.addIssue({ code: 'custom', path: ['reviews', domain], message: 'every 3D review domain must be approved' })
    }
    if (asset.structures.some((structure) => structure.reviewState !== 'approved')) {
      context.addIssue({ code: 'custom', path: ['structures'], message: 'every public structure label must be reviewed' })
    }
  }
  if (!asset.assetPath && asset.structures.length > 0) {
    context.addIssue({ code: 'custom', path: ['structures'], message: 'placeholder scenes cannot invent anatomy labels' })
  }
})

export const anatomy3dRegistrySchema = z.strictObject({
  schemaVersion: z.literal(ANATOMY_3D_SCHEMA_VERSION),
  authority: z.literal('governed-anatomy-3d-registry'),
  privateAuthoringOnly: z.literal(true),
  assets: z.array(anatomy3dAssetSchema),
})
