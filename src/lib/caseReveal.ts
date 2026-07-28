export interface CaseRevealSection {
  heading: string
  slug: string
}

export interface CaseRevealFeedbackConfig {
  badgeLabel: string
  conceptGroups: {
    hypothesis: string[]
    supportingFeatures: string[]
    cautionSafety: string[]
    nextAssessment: string[]
    localOnlyPattern?: string[]
  }
}

export interface CaseRevealPayload {
  schemaVersion: 1
  revealId: string
  actualTitle: string
  conditionLabel?: string
  conditionHref?: string
  sections: CaseRevealSection[]
  contentHtml: string
  enhancedFeedback?: CaseRevealFeedbackConfig
}

export function resolveCaseRevealUrl(pathname: string, revealId: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '')
  const casesIndex = normalizedPath.indexOf('/cases/')
  const basePath = casesIndex >= 0 ? normalizedPath.slice(0, casesIndex) : ''
  return `${basePath}/case-reveals/${encodeURIComponent(revealId)}.json`
}

export async function loadCaseReveal(
  revealId: string,
  pathname: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CaseRevealPayload> {
  const response = await fetchImpl(resolveCaseRevealUrl(pathname, revealId), {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Unable to load the case reveal (${response.status}).`)
  }

  return parseCaseRevealPayload(await response.json(), revealId)
}

export function parseCaseRevealPayload(
  value: unknown,
  expectedRevealId?: string,
): CaseRevealPayload {
  if (!isRecord(value)) throw new Error('Case reveal payload must be an object.')
  if (value.schemaVersion !== 1) throw new Error('Unsupported case reveal payload version.')
  if (!isNonEmptyString(value.revealId)) throw new Error('Case reveal payload is missing its identifier.')
  if (expectedRevealId && value.revealId !== expectedRevealId) {
    throw new Error('Case reveal payload does not match this case.')
  }
  if (!isNonEmptyString(value.actualTitle)) throw new Error('Case reveal payload is missing its title.')
  if (!isNonEmptyString(value.contentHtml)) throw new Error('Case reveal payload is missing its content.')
  if (!Array.isArray(value.sections) || !value.sections.every(isSection)) {
    throw new Error('Case reveal payload has invalid section navigation.')
  }
  if (value.conditionLabel !== undefined && !isNonEmptyString(value.conditionLabel)) {
    throw new Error('Case reveal payload has an invalid condition label.')
  }
  if (value.conditionHref !== undefined && !isRootRelativePath(value.conditionHref)) {
    throw new Error('Case reveal payload has an invalid condition link.')
  }
  if (value.enhancedFeedback !== undefined && !isFeedbackConfig(value.enhancedFeedback)) {
    throw new Error('Case reveal payload has invalid enhanced feedback.')
  }

  return value as unknown as CaseRevealPayload
}

function isSection(value: unknown): boolean {
  return isRecord(value) &&
    isNonEmptyString(value.heading) &&
    isNonEmptyString(value.slug)
}

function isFeedbackConfig(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.badgeLabel) || !isRecord(value.conceptGroups)) {
    return false
  }

  const groups = value.conceptGroups
  return (
    isStringArray(groups.hypothesis) &&
    isStringArray(groups.supportingFeatures) &&
    isStringArray(groups.cautionSafety) &&
    isStringArray(groups.nextAssessment) &&
    (groups.localOnlyPattern === undefined || isStringArray(groups.localOnlyPattern))
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function isRootRelativePath(value: unknown): value is string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
