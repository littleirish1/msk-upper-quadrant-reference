export function conditionContentId(region: string, slug: string): string {
  return `condition.${normalizePart(region)}.${normalizePart(slug)}`
}

export function caseContentId(region: string, slug: string): string {
  return `case.${normalizePart(region)}.${normalizePart(slug)}`
}

export function anatomyContentId(category: string, slug: string): string {
  return `anatomy.${normalizePart(category)}.${normalizePart(slug)}`
}

function normalizePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
