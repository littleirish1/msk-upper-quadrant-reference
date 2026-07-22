export interface MdxSection {
  heading: string
  slug: string
  content: string
}

/**
 * Escapes numeric comparator tokens in prose without changing code spans,
 * fenced code blocks, or JSX/HTML tags. This keeps clinical notation valid
 * MDX without maintaining phrase-specific replacements.
 */
export function sanitizeMdxContent(content: string): string {
  const lines = content.split('\n')
  let fence: string | null = null

  return lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === marker) fence = null
      else if (fence === null) fence = marker
      return line
    }

    if (fence !== null) return line
    return escapeComparatorsInProse(line)
  }).join('\n')
}

export function parseSections(content: string): MdxSection[] {
  const lines = content.split('\n')
  const sections: MdxSection[] = []
  let currentHeading = ''
  let currentLines: string[] = []

  const flush = () => {
    if (!currentHeading) return
    sections.push({
      heading: currentHeading,
      slug: slugify(currentHeading),
      content: currentLines.join('\n').trim(),
    })
  }

  for (const line of lines) {
    const heading = line.match(/^## (.+)$/)
    if (heading) {
      flush()
      currentHeading = heading[1].trim()
      currentLines = []
    } else if (currentHeading) {
      currentLines.push(line)
    }
  }

  flush()
  return sections
}

export function extractExcerpt(mdx: string, maxLength = 200): string {
  return stripFirstHeading(mdx.replace(/---[\s\S]*?---/, '').trimStart())
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function escapeComparatorsInProse(line: string): string {
  let output = ''
  let index = 0
  let inlineCodeTicks = 0
  let inTag = false
  let tagQuote: string | null = null

  while (index < line.length) {
    const character = line[index]

    if (character === '`') {
      const runLength = countRun(line, index, '`')
      if (inlineCodeTicks === 0) inlineCodeTicks = runLength
      else if (inlineCodeTicks === runLength) inlineCodeTicks = 0
      output += line.slice(index, index + runLength)
      index += runLength
      continue
    }

    if (inlineCodeTicks === 0) {
      if (inTag) {
        if (tagQuote) {
          if (character === tagQuote && line[index - 1] !== '\\') tagQuote = null
        } else if (character === '"' || character === "'") {
          tagQuote = character
        } else if (character === '>') {
          inTag = false
        }
      } else if (character === '<' && /[A-Za-z/!?]/.test(line[index + 1] ?? '')) {
        inTag = true
      } else if ((character === '<' || character === '>') && comparatorHasNumericOperand(line, index + 1)) {
        output += character === '<' ? '&lt;' : '&gt;'
        index += 1
        continue
      }
    }

    output += character
    index += 1
  }

  return output
}

function comparatorHasNumericOperand(line: string, start: number): boolean {
  let index = start
  while (line[index] === ' ' || line[index] === '\t') index += 1
  return /\d/.test(line[index] ?? '')
}

function countRun(value: string, start: number, character: string): number {
  let end = start
  while (value[end] === character) end += 1
  return end - start
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '')
    .replace(/\s/g, '-')
    .trim()
}

function stripFirstHeading(mdx: string): string {
  return mdx.replace(/^# .*(?:\r?\n)+/, '')
}
