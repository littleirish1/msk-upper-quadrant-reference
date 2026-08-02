import { z } from 'zod'

const participantGroup = z.enum(['physiotherapy-student', 'band-5-clinician', 'experienced-msk-clinician', 'clinical-educator'])

export const betaTaskSchema = z.object({
  taskId: z.string().regex(/^beta-task\.[a-z0-9-]+\.[0-9]{2}$/),
  revision: z.literal(1),
  participantGroup,
  route: z.string().startsWith('/'),
  instruction: z.string().min(1),
  observationFocus: z.array(z.string()).min(1),
  status: z.literal('planned-human-session'),
})

export const betaFeedbackSchema = z.object({
  fixture: z.literal(true),
  sessionId: z.string().regex(/^synthetic-session-[0-9]{3}$/),
  participantGroup,
  taskId: z.string().min(1),
  completion: z.enum(['completed', 'partial', 'not-completed']),
  severity: z.enum(['observation', 'low', 'medium', 'high', 'blocker']),
  category: z.enum(['navigation', 'content-clarity', 'diagnosis-disclosure', 'accessibility', 'performance', 'privacy', 'clinical-concern']),
  noteCode: z.string().regex(/^SYNTHETIC_[A-Z0-9_]+$/),
  containsHealthData: z.literal(false),
})

export const betaProgrammeSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal('planned'),
  taskScripts: z.array(betaTaskSchema),
  privacy: z.object({
    dataCollection: z.literal('minimum-structured-feedback-no-health-data'),
    opaqueSessionIds: z.literal(true),
    consentTextStatus: z.literal('human-review-required'),
    privacyNoticeStatus: z.literal('human-review-required'),
    retentionDecisionStatus: z.literal('human-review-required'),
  }),
  realResults: z.object({ participantCount: z.literal(0), sessionCount: z.literal(0), feedbackCount: z.literal(0) }),
  publicationApprovalGranted: z.literal(false),
})
