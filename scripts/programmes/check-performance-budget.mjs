import fs from 'node:fs'
import path from 'node:path'
import { ROOT, collectFiles, relative } from './shared.mjs'

const out = path.join(ROOT, 'out')
if (!fs.existsSync(out)) {
  console.error('Performance budget check requires out/. Run the build first.')
  process.exit(1)
}

const scripts = collectFiles(path.join(out, '_next'), (file) => file.endsWith('.js'))
const totalBytes = scripts.reduce((sum, file) => sum + fs.statSync(file).size, 0)
const largest = scripts.reduce((current, file) =>
  !current || fs.statSync(file).size > fs.statSync(current).size ? file : current, null)
const largestBytes = largest ? fs.statSync(largest).size : 0
const findings = []
if (totalBytes > 5 * 1024 * 1024) findings.push(`exported JavaScript exceeds 5 MiB: ${totalBytes}`)
if (largestBytes > 1024 * 1024) findings.push(`single JavaScript chunk exceeds 1 MiB: ${relative(largest)}`)

for (const htmlFile of collectFiles(out, (file) => file.endsWith('.html'))) {
  const html = fs.readFileSync(htmlFile, 'utf8')
  if (/case-reveals\/[^"' ]+\.json/i.test(html) && /rel=["'](?:preload|prefetch)["']/i.test(html)) {
    findings.push(`reveal payload is eagerly hinted: ${relative(htmlFile)}`)
  }
}

if (findings.length) {
  console.error('Performance budget check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}
console.log(`Performance budget passed. JavaScript: ${scripts.length} files, ${totalBytes} bytes total, ${largestBytes} bytes largest; eager reveal hints: 0.`)
