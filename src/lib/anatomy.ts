import fs from 'node:fs'
import path from 'node:path'
import { anatomyRecordSchema, type AnatomyRecord } from './contentSchemas'

const ANATOMY_DIR = path.join(process.cwd(), 'content', 'anatomy')

export function getAllAnatomyRecords(): AnatomyRecord[] {
  if (!fs.existsSync(ANATOMY_DIR)) return []

  return collectJsonFiles(ANATOMY_DIR).map((file) => {
    const result = anatomyRecordSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (!result.success) {
      const detail = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      throw new Error(`Invalid anatomy record in ${relative(file)}: ${detail}`)
    }
    return result.data
  })
}

export function getPublicAnatomyRecords(): AnatomyRecord[] {
  return getAllAnatomyRecords().filter((record) =>
    record.status === 'published' && record.publicEligibility && record.reviewStatus === 'reviewed',
  )
}

export function getPublicAnatomyRecord(category: string, slug: string): AnatomyRecord | null {
  return getPublicAnatomyRecords().find((record) => record.category === category && record.slug === slug) ?? null
}

function collectJsonFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectJsonFiles(item) : entry.isFile() && entry.name.endsWith('.json') ? [item] : []
  }).sort()
}

function relative(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join('/')
}
