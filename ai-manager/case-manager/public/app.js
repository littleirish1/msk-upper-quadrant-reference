async function loadJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}`)
  return res.json()
}

function row(title, meta = '', status = '', id = '') {
  const button = id
    ? `<button class="small-button" data-station-id="${escapeHtml(id)}">Preview</button>`
    : ''

  return `
    <div class="row">
      <div class="row-main">
        <div>
          <strong>${escapeHtml(title)}</strong>
          ${status ? `<span class="badge ${escapeHtml(status)}">${escapeHtml(status)}</span>` : ''}
          ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
        </div>
        ${button}
      </div>
    </div>
  `
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function main() {
  const [status, cases, tracker] = await Promise.all([
    loadJson('/api/status'),
    loadJson('/api/cases'),
    loadJson('/api/tracker'),
  ])

  document.getElementById('status').textContent =
    `Git:\n${status.git}\n\nHygiene:\n${status.hygiene}`

  const published = cases.filter((c) => c.status === 'published').length
  const draft = cases.filter((c) => c.status === 'draft').length

  document.getElementById('caseCounts').innerHTML = `
    <p>Total: <strong>${cases.length}</strong></p>
    <p>Published: <strong>${published}</strong></p>
    <p>Draft: <strong>${draft}</strong></p>
  `

  document.getElementById('cases').innerHTML = cases.map((item) =>
    row(item.title, `${item.region} · ${item.difficulty} · ${item.path}`, item.status)
  ).join('')

 document.getElementById('pending').innerHTML = tracker.pending.length
  ? tracker.pending.map((item) => row(`${item.id} — ${item.title}`, `${item.third} · ${item.fourth}`, '', item.id)).join('')
  : '<p>No pending stations found.</p>'

  document.getElementById('converted').innerHTML = tracker.converted.length
    ? tracker.converted.map((item) => row(`${item.id} — ${item.title}`, item.third, 'published')).join('')
    : '<p>No converted stations found.</p>'
}

document.getElementById('pending').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-station-id]')
  if (!button) return

  const id = button.getAttribute('data-station-id') || ''
  console.log('Preview station id:', id)

  const preview = document.getElementById('stationPreview')
  const stationFile = document.getElementById('stationFile')

  preview.textContent = 'Loading...'
  stationFile.textContent = `Loading ${id}...`

  const station = await loadJson(`/api/station?id=${encodeURIComponent(id)}`)

  if (station.error) {
    stationFile.textContent = 'Error'
    preview.textContent = station.error
    return
  }

  stationFile.textContent = station.file
  preview.textContent = station.text
})

main().catch((error) => {
  document.body.innerHTML = `<main><pre>${escapeHtml(error.stack || error.message)}</pre></main>`
})