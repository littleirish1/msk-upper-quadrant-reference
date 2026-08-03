import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const out = path.join(root, 'out')
if (!fs.existsSync(out)) throw new Error('Quality gate generation requires out/. Run the production build first.')

function collect(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? collect(item, extension) : entry.isFile() && item.endsWith(extension) ? [item] : []
  })
}

const source = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const scripts = collect(path.join(out, '_next'), '.js')
const html = collect(out, '.html')
const sizes = scripts.map((file) => fs.statSync(file).size)
const routeCount = html.length
const totalJavascriptLimitBytes = 2 * 1024 * 1024
const largestJavascriptChunkLimitBytes = 256 * 1024
const totalJavascriptBytes = sizes.reduce((sum, size) => sum + size, 0)
const largestJavascriptBytes = Math.max(0, ...sizes)
const checks = [
  { id: 'single-main-landmark-and-skip-link', status: source('src/app/layout.tsx').includes('href="#main-content"') && source('src/app/layout.tsx').includes('id="main-content"') ? 'pass' : 'fail', evidence: 'src/app/layout.tsx' },
  { id: 'visible-keyboard-focus', status: source('src/app/globals.css').includes(':focus-visible') ? 'pass' : 'fail', evidence: 'src/app/globals.css' },
  { id: 'case-mode-keyboard-tabs', status: source('src/components/cases/CaseModeExperience.tsx').includes('moveModeFocus') && source('src/components/cases/CaseModeExperience.tsx').includes('tabIndex={mode === item.id ? 0 : -1}') ? 'pass' : 'fail', evidence: 'src/components/cases/CaseModeExperience.tsx' },
  { id: 'minimum-touch-target-token', status: !source('src/components/cases/CaseModeExperience.tsx').includes('min-h-10') ? 'pass' : 'fail', evidence: 'src/components/cases/CaseModeExperience.tsx' },
  { id: 'javascript-total-under-2-mib', status: totalJavascriptBytes <= totalJavascriptLimitBytes ? 'pass' : 'fail', evidence: 'scripts/programmes/check-performance-budget.mjs; limit 2097152 bytes' },
  { id: 'javascript-chunk-under-256-kib', status: largestJavascriptBytes <= largestJavascriptChunkLimitBytes ? 'pass' : 'fail', evidence: 'scripts/programmes/check-performance-budget.mjs; limit 262144 bytes' },
]

const viewports = ['320x568', '375x667', '768x1024', '1024x768', '1440x900']
const report = {
  schemaVersion: 1,
  generatedAt: null,
  automated: {
    routeCount,
    htmlFileCount: html.length,
    performanceBudget: {
      totalJavascriptLimitBytes,
      largestJavascriptChunkLimitBytes,
      enforcementScript: 'scripts/programmes/check-performance-budget.mjs',
      observedBuildMetricsTracked: false,
    },
    checks,
  },
  manualMatrix: viewports.flatMap((viewport) => ['light', 'dark'].map((theme) => ({ viewport, theme, status: 'manual-required' }))),
  humanSignOffRecorded: false,
  releaseEligibility: false,
  blockers: ['keyboard-screen-reader-manual-sign-off-required', 'responsive-visual-manual-sign-off-required', 'two-hundred-percent-zoom-manual-sign-off-required'],
}

const destination = path.join(root, 'reports', 'clinical-platform', 'accessibility-mobile-performance.json')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Quality gates generated: ${checks.filter((check) => check.status === 'pass').length}/${checks.length} automated checks pass; ${report.manualMatrix.length} manual viewport/theme checks remain.`)
