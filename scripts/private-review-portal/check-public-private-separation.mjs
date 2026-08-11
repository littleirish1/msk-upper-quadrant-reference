import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const scanRoots = ['out', 'public'].map((entry) => path.join(root, entry)).filter((entry) => fs.existsSync(entry))
const sourceRoot = path.join(root, 'src')
const sourceCandidatePath = path.join(root, 'ai-manager', 'clinical-platform', 'anatomy-3d', 'source-candidates.json')
const sourceCandidateMarkers = fs.existsSync(sourceCandidatePath)
  ? ((ledger) => [
      ...ledger.candidates.flatMap((candidate) => [
        candidate.id,
        candidate.title,
        candidate.archive?.filename,
        candidate.archive?.sha256,
        ...(candidate.artifacts ?? []).flatMap((artifact) => [artifact.id, artifact.filename, artifact.sha256]),
      ]),
      ...(ledger.movementCandidates ?? []).flatMap((candidate) => [candidate.id, candidate.title]),
      ledger.movementSource?.originalFilename,
      ledger.movementSource?.sha256,
    ].filter(Boolean))(JSON.parse(fs.readFileSync(sourceCandidatePath, 'utf8')))
  : []
const forbidden = [
  'private-review-portal',
  'Private Review Portal',
  'Content Review Studio',
  'msk-private-review-data',
  'MSK_REVIEW_PORTAL_',
  '/api/uploads',
  '/api/content/',
  '/api/integration-proposals/',
  'ready-for-integration-assessment',
  'submit-integration-proposal',
  'review-adoption-only',
  'content-review/',
  'movement.shoulder.joint.flexion',
  'mcq-slot.shoulder-slice.01',
  '3d-plan.structure.shoulder.scapula',
  'extra-material.',
  'msk_review_session',
  '.ts.net',
  '127.0.0.1:4379',
  'ai-manager/.venv-source-intake',
  'ai-manager/private-cache',
  'docs/reviews/current',
  ...sourceCandidateMarkers,
  ...process.argv.filter((argument) => argument.startsWith('--marker=')).map((argument) => argument.slice('--marker='.length)).filter(Boolean),
]
const textExtensions = new Set(['.html', '.js', '.json', '.txt', '.xml', '.map', '.css', '.svg', '.md', '.webmanifest'])

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const candidate = path.join(current, entry.name)
      if (entry.isDirectory()) visit(candidate)
      else files.push(candidate)
    }
  }
  visit(directory)
  return files
}

const violations = []
for (const directory of [...scanRoots, sourceRoot]) {
  for (const file of filesUnder(directory)) {
    const relativePath = path.relative(root, file).replaceAll('\\', '/')
    if (directory !== sourceRoot && /(?:private-review-portal|content-review-studio|reviewer-studio)/i.test(relativePath)) violations.push(`${relativePath} is a reviewer-only path in public output`)
    if (directory !== sourceRoot && /(?:\.glb|\.gltf|\.drc)$/i.test(relativePath)) violations.push(`${relativePath} is a candidate 3D/Draco asset in public output`)
    if (directory !== sourceRoot && /(?:^|\/)draco(?:\/|$)/i.test(relativePath)) violations.push(`${relativePath} is a Draco runtime asset in public output`)
    if (!textExtensions.has(path.extname(file).toLowerCase()) && directory !== sourceRoot) continue
    const content = fs.readFileSync(file, 'utf8')
    for (const marker of forbidden) if (content.includes(marker)) violations.push(`${path.relative(root, file)} contains ${JSON.stringify(marker)}`)
  }
}

const tracked = spawnSync('git', ['ls-files', '--', 'ai-manager/private-review-portal'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
if (tracked.error || tracked.status !== 0) throw tracked.error ?? new Error(tracked.stderr)
for (const file of tracked.stdout.split(/\r?\n/).filter(Boolean)) {
  if (/\.(?:pdf|pptx|docx|png|jpe?g|webp|sqlite|db)$/i.test(file)) violations.push(`${file} is a private-data file tracked under the portal runtime`)
}
if (violations.length) throw new Error(`Public/private separation failed:\n${violations.join('\n')}`)
console.log(`Public/private separation passed: scanned ${scanRoots.length} public roots plus learner source for ${forbidden.length} private markers and reviewer-only paths; no private document formats are tracked under the portal runtime.`)
