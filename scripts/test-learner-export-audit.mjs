import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { auditStaticExport } from './audit-learner-export.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-learner-audit-'))
try {
  write('index.html', page('<nav><a href="/msk-upper-quadrant-reference/cervical/#assessment">Cervical</a></nav><img src="/msk-upper-quadrant-reference/icon.svg" alt="">'))
  write('cervical/index.html', page('<h2 id="assessment">Assessment</h2><a href="/msk-upper-quadrant-reference/">Home</a>'))
  write('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const pass = auditStaticExport(root)
  assert.equal(pass.summary.brokenInternalHyperlinks, 0)
  assert.equal(pass.summary.invalidAnchors, 0)
  assert.equal(pass.summary.missingLocalAssets, 0)
  assert.equal(pass.summary.internalHyperlinks, 2)
  assert.equal(pass.routes.find((item) => item.route === '/cervical')?.navigationVisible, true)
  assert.equal(pass.routes.find((item) => item.route === '/')?.navigationVisible, false)

  write('index.html', page([
    '<a href="/msk-upper-quadrant-reference/missing/">Missing</a>',
    '<a href="/msk-upper-quadrant-reference/cervical/#absent">Absent anchor</a>',
    '<a href="#">Placeholder</a>',
    '<script src="/msk-upper-quadrant-reference/missing.js"></script>',
  ].join('')))
  write('cervical/index.html', page('<div id="duplicate"></div><div id="duplicate"></div>'))
  const fail = auditStaticExport(root)
  assert.ok(fail.findings.some((item) => item.kind === 'broken-internal-href'))
  assert.ok(fail.findings.some((item) => item.kind === 'missing-anchor'))
  assert.ok(fail.findings.some((item) => item.kind === 'placeholder-href'))
  assert.ok(fail.findings.some((item) => item.kind === 'missing-local-asset'))
  assert.ok(fail.findings.some((item) => item.kind === 'duplicate-anchor-id'))

  console.log('Learner export audit regression tests passed.')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

function write(relative, contents) {
  const file = path.join(root, ...relative.split('/'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

function page(body) {
  return `<!doctype html><html><head><title>Test</title></head><body><h1>Test</h1>${body}</body></html>`
}
