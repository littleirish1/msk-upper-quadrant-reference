import { z } from 'zod'

const checkSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'manual-required']),
  evidence: z.string().min(1),
})

export const qualityGateSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.null(),
  automated: z.object({
    routeCount: z.number().int().nonnegative(),
    htmlFileCount: z.number().int().nonnegative(),
    javascriptFileCount: z.number().int().nonnegative(),
    totalJavascriptBytes: z.number().int().nonnegative(),
    largestJavascriptBytes: z.number().int().nonnegative(),
    checks: z.array(checkSchema),
  }),
  manualMatrix: z.array(z.object({
    viewport: z.string().min(1),
    theme: z.enum(['light', 'dark']),
    status: z.literal('manual-required'),
  })),
  humanSignOffRecorded: z.literal(false),
  releaseEligibility: z.literal(false),
  blockers: z.array(z.string()).min(1),
})
