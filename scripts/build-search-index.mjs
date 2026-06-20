/**
 * build-search-index.mjs
 *
 * Run at build time to generate /public/search-index.json.
 * Usage: node scripts/build-search-index.mjs
 *
 * Content structure: content/{region}/{condition}.mdx (flat files)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CONTENT_DIR = join(ROOT, 'content')
const PUBLIC_DIR = join(ROOT, 'public')
const OUT_FILE = join(PUBLIC_DIR, 'search-index.json')
const TAXONOMY_FILE = join(ROOT, 'src', 'data', 'taxonomy.ts')

function stripMdx(text) {
  return text
    .replace(/---[\s\S]*?---/, '')      // frontmatter
    .replace(/<[^>]+>/g, ' ')           // JSX
    .replace(/[#*`[\]|()]/g, '')        // markdown / table pipes
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

function slugToLabel(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getRegionSlugsFromTaxonomy() {
  if (!existsSync(TAXONOMY_FILE)) {
    throw new Error(`Missing taxonomy file: ${TAXONOMY_FILE}`)
  }

  const raw = readFileSync(TAXONOMY_FILE, 'utf-8')
  const regionSlugs = Array.from(raw.matchAll(/^    slug:\s*'([^']+)'/gm), (match) => match[1])

  if (regionSlugs.length === 0) {
    throw new Error('No region slugs found in src/data/taxonomy.ts')
  }

  return regionSlugs.sort((a, b) => a.localeCompare(b))
}

if (!existsSync(PUBLIC_DIR)) {
  mkdirSync(PUBLIC_DIR, { recursive: true })
}

const entries = []

if (!existsSync(CONTENT_DIR)) {
  console.warn('No content/ directory found — search index will be empty.')
  writeFileSync(OUT_FILE, JSON.stringify([]))
  process.exit(0)
}

const regions = getRegionSlugsFromTaxonomy()

for (const region of regions) {
  const regionDir = join(CONTENT_DIR, region)
  if (!existsSync(regionDir)) {
    continue
  }

  const files = readdirSync(regionDir, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.mdx'))
    .map(f => f.name)
    .sort((a, b) => a.localeCompare(b))

  for (const file of files) {
    const condition = file.replace('.mdx', '')
    const raw = readFileSync(join(regionDir, file), 'utf-8')
    const { content, data } = matter(raw)

    entries.push({
      id: `${region}/${condition}`,
      title: typeof data.title === 'string' ? data.title : slugToLabel(condition),
      region,
      condition,
      section: '',
      content: stripMdx(content),
      href: `/${region}/${condition}`,
    })
  }
}

entries.sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2))
console.log(`✓ Search index built: ${entries.length} entries → ${OUT_FILE}`)
