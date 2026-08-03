import fs from 'node:fs'
import path from 'node:path'

export const allowedExtensions = Object.freeze(new Map([
  ['.pdf', 'application/pdf'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.md', 'text/markdown'],
  ['.txt', 'text/plain'],
  ['.csv', 'text/csv'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]))

export function sanitizeFilename(input) {
  const base = path.basename(String(input ?? '').replaceAll('\\', '/')).normalize('NFKC')
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\p{L}\p{N}._ ()\[\]-]/gu, '_').replace(/\s+/g, ' ').trim().slice(0, 120)
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('A safe filename is required.')
  return cleaned
}

function isText(buffer) {
  if (buffer.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

function inspectOfficeZip(buffer, extension) {
  const content = buffer.toString('latin1')
  const unsafe = ['vbaProject.bin', '/embeddings/', 'oleObject', '.exe', '.dll', '.js', '.vbs', '.ps1']
  if (unsafe.some((token) => content.toLowerCase().includes(token.toLowerCase()))) throw new Error('Office package contains active, embedded, or executable content.')
  if (!content.includes('[Content_Types].xml')) throw new Error('Office package is missing its content-type manifest.')
  if (extension === '.docx' && !content.includes('word/')) throw new Error('DOCX package structure is invalid.')
  if (extension === '.pptx' && !content.includes('ppt/')) throw new Error('PPTX package structure is invalid.')
}

export function inspectFile(file, originalName, declaredType = '') {
  const safeName = sanitizeFilename(originalName)
  const extension = path.extname(safeName).toLowerCase()
  const expectedType = allowedExtensions.get(extension)
  if (!expectedType) throw new Error('File extension is not permitted.')
  const buffer = fs.readFileSync(file)
  let detectedType
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') detectedType = 'application/pdf'
  else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) detectedType = 'image/png'
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) detectedType = 'image/jpeg'
  else if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') detectedType = 'image/webp'
  else if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    inspectOfficeZip(buffer, extension)
    detectedType = expectedType
  } else if (isText(buffer.subarray(0, Math.min(buffer.length, 64 * 1024)))) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 64 * 1024)).toString('utf8').toLowerCase()
    if (/<\s*(?:!doctype\s+html|html|script|svg)\b/.test(sample)) throw new Error('Active HTML or SVG content is not permitted.')
    detectedType = expectedType
  } else throw new Error('File magic is unknown or does not match an allowed type.')

  if (detectedType !== expectedType) throw new Error('Detected file type does not match the filename extension.')
  const normalizedDeclared = String(declaredType).split(';')[0].trim().toLowerCase()
  const generic = new Set(['', 'application/octet-stream', 'binary/octet-stream'])
  const compatibleJpeg = expectedType === 'image/jpeg' && normalizedDeclared === 'image/jpg'
  if (!generic.has(normalizedDeclared) && normalizedDeclared !== expectedType && !compatibleJpeg) throw new Error('Browser-declared MIME type does not match detected content.')
  return { safeName, extension, detectedType }
}
