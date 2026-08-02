import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.MSK_AUTHORING_PORT ?? 4378)
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/api/snapshot', ['snapshot.json', 'application/json; charset=utf-8']],
])

const server = http.createServer((request, response) => {
  const host = String(request.headers.host ?? '').split(':')[0].replace(/^\[|\]$/g, '')
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return send(response, 403, 'Loopback access only.')
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, 'Read-only workspace.')
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const entry = files.get(pathname)
  if (!entry) return send(response, 404, 'Not found.')
  const [name, contentType] = entry
  const file = path.join(directory, name)
  if (!fs.existsSync(file)) return send(response, 503, 'Run npm run authoring:generate-v1 first.')
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  })
  if (request.method === 'HEAD') return response.end()
  fs.createReadStream(file).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Private authoring workspace: http://127.0.0.1:${port}`)
})

function send(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(message)
}
