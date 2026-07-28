export function canonicalText(bytes, { allowBom = true } = {}) {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = decoder.decode(bytes)
  if (allowBom && text.startsWith('\uFEFF')) text = text.slice(1)
  return text.replace(/\r\n?/g, '\n')
}

export function artifactsEqual(before, after, options = {}) {
  if (!Buffer.isBuffer(before) || !Buffer.isBuffer(after)) return false
  if (options.kind === 'binary') return before.equals(after)
  return canonicalText(before, options) === canonicalText(after, options)
}
