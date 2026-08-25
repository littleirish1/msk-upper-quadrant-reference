import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const reportFile = path.join(ROOT, 'reports', 'publication-readiness', 'learner-export-audit.json')
const outputFile = path.join(ROOT, 'reports', 'publication-readiness', 'external-link-live-audit.json')

if (!fs.existsSync(reportFile)) {
  console.error('Missing learner export audit. Run npm run check:learner-export-audit first.')
  process.exit(1)
}

const source = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
const results = []

for (const item of source.externalLinks) {
  const result = await checkUrl(item.url)
  results.push({ ...item, ...result })
  console.log(`${result.ok ? 'OK' : 'REVIEW'} ${item.url} -> ${result.status ?? result.error}${result.finalUrl && result.finalUrl !== item.url ? ` (${result.finalUrl})` : ''}`)
}

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  deterministicBuildDependency: false,
  note: 'Live availability is informational and is not used by the deterministic build or preflight gate.',
  summary: {
    urls: results.length,
    reachable: results.filter((item) => item.ok).length,
    redirected: results.filter((item) => item.redirected).length,
    requiresReview: results.filter((item) => !item.ok).length,
  },
  results,
}

fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(`External link live audit written: ${path.relative(ROOT, outputFile)}`)

async function checkUrl(url) {
  try {
    let response = await fetchWithTimeout(url, 'HEAD')
    if ([400, 403, 405].includes(response.status)) response = await fetchWithTimeout(url, 'GET')
    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      finalUrl: response.url,
      redirected: response.redirected || response.url !== url,
      error: null,
    }
  } catch (error) {
    return { ok: false, status: null, finalUrl: null, redirected: false, error: error.message }
  }
}

async function fetchWithTimeout(url, method) {
  return fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'user-agent': 'MSK-Clinical-Reasoning-Lab-Link-Audit/1.0' },
    signal: AbortSignal.timeout(15_000),
  })
}
