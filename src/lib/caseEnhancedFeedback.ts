import type { CaseRevealFeedbackConfig } from './caseReveal'

export function getEnhancedCaseFeedback(
  caseSlug: string,
): CaseRevealFeedbackConfig | undefined {
  if (caseSlug !== 'cervical-radiculopathy-case-01') return undefined

  return {
    badgeLabel: 'Enhanced reasoning feedback preview',
    conceptGroups: {
      hypothesis: [
        'cervical nerve root',
        'cervical radiculopathy',
        'nerve root irritation',
        'nerve root',
        'c6 pattern',
        'radicular pain',
        'radicular',
      ],
      supportingFeatures: [
        'arm pain',
        'dermatomal distribution',
        'dermatome',
        'thumb',
        'index finger',
        'paresthesia',
        'pins and needles',
        'reduced sensation',
        'reflex change',
        'biceps reflex',
        'weakness',
        'myotomal weakness',
        'spurling',
        'distraction relief',
        'ultt',
        'upper limb tension',
        'shoulder abduction relief',
        'bakody',
      ],
      cautionSafety: [
        'myelopathy',
        'bilateral symptoms',
        'gait change',
        'hand clumsiness',
        'upper motor neuron',
        'upper motor neurone',
        'progressive weakness',
        'bowel',
        'bladder',
        'systemic red flags',
        'cancer',
        'fever',
        'weight loss',
      ],
      nextAssessment: [
        'neurological exam',
        'neurological examination',
        'dermatomes',
        'myotomes',
        'reflexes',
        'myelopathy screen',
        'spurling',
        'distraction',
        'ultt',
        'upper limb tension',
        'cervical range of motion',
        'shoulder screen',
      ],
      localOnlyPattern: [
        'shoulder',
        'rotator cuff',
        'impingement',
        'local arm pain',
        'muscle strain',
      ],
    },
  }
}
