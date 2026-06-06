import http from 'http'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const PUBLIC_DIR = path.join(__dirname, 'public')

const PORT = 4000

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

    if (url.pathname === '/api/status') {
      return sendJson(res, await getProjectStatus())
    }

    if (url.pathname === '/api/cases') {
      return sendJson(res, getCases())
    }

    if (url.pathname === '/api/tracker') {
      return sendJson(res, getTracker())
    }

if (url.pathname === '/api/station') {
  const id = url.searchParams.get('id')
  return sendJson(res, getStation(id))
}

    if (url.pathname === '/') {
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html')
    }

    const filePath = path.join(PUBLIC_DIR, url.pathname)
    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath)
      const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/plain'
      return sendFile(res, filePath, type)
    }

    res.writeHead(404)
    res.end('Not found')
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: String(error) }, null, 2))
  }
})

server.listen(PORT, () => {
  console.log(`Case Manager running at http://localhost:${PORT}`)
})

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data, null, 2))
}

function sendFile(res, filePath, contentType) {
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(fs.readFileSync(filePath))
}

function run(command, args) {
  const fullCommand = [command, ...args].join(' ')

  return new Promise((resolve) => {
    exec(fullCommand, { cwd: ROOT, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        output: `${stdout}${stderr}`.trim(),
      })
    })
  })
}

async function getProjectStatus() {
  const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git'
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  const git = await run(gitCommand, ['status', '--short'])
  const hygiene = await run(npmCommand, ['run', 'check:hygiene'])

  return {
    git: git.ok ? (git.output || 'clean') : `failed\n${git.output}`,
    hygiene: hygiene.ok ? 'passed' : `failed\n${hygiene.output}`,
  }
}
function getCases() {
  const casesDir = path.join(ROOT, 'content', 'cases')
  const cases = []

  if (!fs.existsSync(casesDir)) return cases

  walk(casesDir, (file) => {
    if (!file.endsWith('.mdx')) return

    const text = fs.readFileSync(file, 'utf8')
    const fm = readFrontmatter(text)

    cases.push({
      title: fm.title || path.basename(file, '.mdx'),
      region: fm.region || path.basename(path.dirname(file)),
      condition: fm.condition || '',
      difficulty: fm.difficulty || '',
      status: fm.status || 'published',
      path: path.relative(ROOT, file),
    })
  })

  return cases.sort((a, b) => a.title.localeCompare(b.title))
}

function getTracker() {
  const trackerPath = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'migration-tracker.md')

  if (!fs.existsSync(trackerPath)) {
    return { pending: [], converted: [] }
  }

  const text = fs.readFileSync(trackerPath, 'utf8')
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| s') || line.startsWith('| manual'))

  const parsed = rows.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
    return {
      id: cells[0] || '',
      title: cells[1] || '',
      third: cells[2] || '',
      fourth: cells[3] || '',
      status: cells[4] || '',
      notes: cells[5] || '',
    }
  })

  return {
    converted: parsed.filter((row) => row.status === 'converted'),
    pending: parsed.filter((row) => row.status === 'pending-review'),
  }
}

function getStation(id) {
  if (!id) {
    return { error: 'Missing station id' }
  }

  const stationsDir = path.join(
    ROOT,
    'content',
    'imports',
    'html-case-bank',
    'extracted',
    'stations'
  )

  if (!fs.existsSync(stationsDir)) {
    return { error: 'Extracted stations folder not found' }
  }

  const files = fs.readdirSync(stationsDir)
  const match = files.find((file) => file.startsWith(`${id}-`) && file.endsWith('.md'))

  if (!match) {
    return { error: `No extracted station file found for ${id}` }
  }

  const filePath = path.join(stationsDir, match)
  const text = fs.readFileSync(filePath, 'utf8')

  return {
    id,
    file: path.relative(ROOT, filePath),
    text,
  }
}
function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath, callback)
    } else {
      callback(fullPath)
    }
  }
}

function readFrontmatter(text) {
  if (!text.startsWith('---')) return {}

  const parts = text.split('---')
  if (parts.length < 3) return {}

  const fm = {}

  for (const line of parts[1].split(/\r?\n/)) {
    if (!line.includes(':')) continue
    const [key, ...rest] = line.split(':')
    fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '')
  }

  return fm
}