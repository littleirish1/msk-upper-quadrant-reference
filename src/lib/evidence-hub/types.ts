import type { z } from 'zod'
import type {
  aiProposalSchema,
  anatomySchema,
  claimSchema,
  clinicalTestSchema,
  conditionSchema,
  evidenceHubRecordSchema,
  evidenceSchema,
  exerciseSchema,
  guidedCaseSchema,
  hubRelationshipSchema,
  mediaAssetSchema,
  outcomeMeasureSchema,
  pilotPlaceholderSchema,
  referenceSchema,
  reviewDecisionSchema,
} from './schemas'

export type EvidenceRecord = z.infer<typeof evidenceSchema>
export type ClaimRecord = z.infer<typeof claimSchema>
export type ConditionRecord = z.infer<typeof conditionSchema>
export type AnatomyRecord = z.infer<typeof anatomySchema>
export type ExerciseRecord = z.infer<typeof exerciseSchema>
export type ClinicalTestRecord = z.infer<typeof clinicalTestSchema>
export type OutcomeMeasureRecord = z.infer<typeof outcomeMeasureSchema>
export type GuidedCaseRecord = z.infer<typeof guidedCaseSchema>
export type ReferenceRecord = z.infer<typeof referenceSchema>
export type MediaAssetRecord = z.infer<typeof mediaAssetSchema>
export type EvidenceHubRecord = z.infer<typeof evidenceHubRecordSchema>
export type HubRelationship = z.infer<typeof hubRelationshipSchema>
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>
export type AiProposal = z.infer<typeof aiProposalSchema>
export type PilotPlaceholder = z.infer<typeof pilotPlaceholderSchema>

export interface GraphFinding {
  code: string
  message: string
  recordId?: string
  relationshipId?: string
}

export interface GraphValidationResult {
  valid: boolean
  findings: GraphFinding[]
  recordCount: number
  relationshipCount: number
}

export interface PublicationDecision {
  entityId: string
  entityRevision: number
  eligible: boolean
  reasons: string[]
  dependencyIds: string[]
}

export interface EvidenceHubDataset {
  records: EvidenceHubRecord[]
  relationships: HubRelationship[]
  reviewDecisions: ReviewDecision[]
  proposals: AiProposal[]
}
