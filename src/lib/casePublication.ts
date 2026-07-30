export const CASE_FRONTMATTER_VISIBILITY = Object.freeze({
  publicPreReveal: [
    'region',
    'difficulty',
    'estimatedTime',
    'publicSlug',
    'status',
  ],
  revealGated: [
    'title',
    'condition',
  ],
  privateInternal: [
    'guidedCaseId',
    'schemaVersion',
    'contentRevision',
    'learningFocus',
    'sourceType',
    'sourceId',
    'sourcePath',
    'reviewStatus',
    'reviewedBy',
    'lastReviewed',
  ],
} as const)

const RESTRICTED_PUBLIC_SUMMARY_FIELDS = new Set<string>([
  ...CASE_FRONTMATTER_VISIBILITY.revealGated,
  ...CASE_FRONTMATTER_VISIBILITY.privateInternal,
])

export interface PublicCaseSummary {
  region: string
  publicSlug: string
  displayTitle: string
  difficulty?: string
  estimatedTime?: string
  excerpt: string
}

export function createPublicCaseSummary(
  value: PublicCaseSummary & Record<string, unknown>,
): PublicCaseSummary {
  for (const field of RESTRICTED_PUBLIC_SUMMARY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`Restricted guided-case metadata cannot enter a public summary: ${field}`)
    }
  }

  return {
    region: requiredString(value.region, 'region'),
    publicSlug: requiredString(value.publicSlug, 'publicSlug'),
    displayTitle: requiredString(value.displayTitle, 'displayTitle'),
    ...(optionalString(value.difficulty) ? { difficulty: value.difficulty } : {}),
    ...(optionalString(value.estimatedTime) ? { estimatedTime: value.estimatedTime } : {}),
    excerpt: requiredString(value.excerpt, 'excerpt'),
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Public guided-case summary requires ${field}`)
  }
  return value
}

function optionalString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
