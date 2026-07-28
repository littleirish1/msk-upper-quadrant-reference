export function stripPreRevealLinkedConditionSection(content: string): string {
  return content.replace(/\n## Linked evidence and condition pages[\s\S]*$/i, '')
}

export function extractCasePresentationStem(content: string): string {
  const firstRevealIndex = firstIndexOf(content, [
    '<ReasoningPrompt',
    '<RevealAnswer',
  ])
  const stem = firstRevealIndex >= 0 ? content.slice(0, firstRevealIndex) : content

  return stem
    .replace(/^##\s+(case presentation|initial presentation|what you know so far)\s*/i, '')
    .replace(/^##\s+[^\n]+\n+/, '')
    .trim()
}

export function extractCaseRevealContent(content: string): string {
  const firstRevealIndex = firstIndexOf(content, [
    '<ReasoningPrompt',
    '<RevealAnswer',
  ])

  return firstRevealIndex >= 0 ? content.slice(firstRevealIndex).trim() : ''
}

function firstIndexOf(content: string, markers: string[]): number {
  const indexes = markers
    .map((marker) => content.indexOf(marker))
    .filter((index) => index >= 0)

  return indexes.length ? Math.min(...indexes) : -1
}
