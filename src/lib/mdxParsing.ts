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
  const lines = normalizeMdxInput(content).split('\n')
  let fence: string | null = null
  const expressionState = { depth: 0, quote: null as string | null, escaped: false }

  return lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      else if (fence === null) fence = marker
      return line
    }

    if (fence !== null) return line
    return escapeComparatorsInProse(line, expressionState)
  }).join('\n')
}

export function parseSections(content: string): MdxSection[] {
  const lines = normalizeMdxInput(content).split('\n')
  const sections: MdxSection[] = []
  const slugCounts = new Map<string, number>()
  let currentHeading = ''
  let currentLines: string[] = []
  let fence: string | null = null

  const flush = () => {
    if (!currentHeading) return
    const baseSlug = slugify(currentHeading)
    const occurrence = (slugCounts.get(baseSlug) ?? 0) + 1
    slugCounts.set(baseSlug, occurrence)
    sections.push({
      heading: currentHeading,
      slug: occurrence === 1 ? baseSlug : `${baseSlug}-${occurrence}`,
      content: currentLines.join('\n').trim(),
    })
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      else if (fence === null) fence = marker
      if (currentHeading) currentLines.push(line)
      continue
    }

    const heading = fence === null ? line.match(/^##\s+(.+?)\s*#*\s*$/) : null
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

function escapeComparatorsInProse(
  line: string,
  expression: { depth: number; quote: string | null; escaped: boolean },
): string {
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
      if (expression.depth > 0) {
        if (expression.escaped) {
          expression.escaped = false
        } else if (character === '\\') {
          expression.escaped = true
        } else if (expression.quote) {
          if (character === expression.quote) expression.quote = null
        } else if (character === '"' || character === "'" || character === '`') {
          expression.quote = character
        } else if (character === '{') {
          expression.depth += 1
        } else if (character === '}') {
          expression.depth -= 1
        }
      } else if (!inTag && character === '{') {
        expression.depth = 1
      } else
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
  return /^\s*=?\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(line.slice(start))
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

function normalizeMdxInput(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}
