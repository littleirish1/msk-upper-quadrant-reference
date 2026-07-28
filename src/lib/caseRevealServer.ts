import { createHash } from 'node:crypto'

export function getCaseRevealId(region: string, publicSlug: string): string {
  return createHash('sha256')
    .update(`case-reveal-v1:${region}:${publicSlug}`)
    .digest('hex')
    .slice(0, 24)
}
