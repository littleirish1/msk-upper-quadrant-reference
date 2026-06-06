let selectedStation = null

async function loadJson(url, options = undefined) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || `Failed to load ${url}`)
  }

  return data
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

function renderConversionForm(conversion) {
  const target = document.getElementById('conversionDetails')

  if (!conversion) {
    target.innerHTML = '<p class="meta">Select a pending station to prepare draft details.</p>'
    return
  }

  target.innerHTML = `
    <div class="form-grid">
      <label>
        Station ID
        <input id="draftStationId" value="${escapeHtml(conversion.stationId)}" readonly />
      </label>

      <label>
        Region
        <input id="draftRegion" value="${escapeHtml(conversion.suggestedRegion)}" />
      </label>

      <label>
        Case title
        <input id="draftTitle" value="${escapeHtml(conversion.suggestedTitle)}" />
      </label>

      <label>
        Condition slug
        <input id="draftConditionSlug" value="${escapeHtml(conversion.suggestedConditionSlug)}" />
      </label>

      <label>
        Case slug
        <input id="draftCaseSlug" value="${escapeHtml(conversion.suggestedCaseSlug)}" />
      </label>

      <label>
        Difficulty
        <select id="draftDifficulty">
          ${option('early-intermediate', conversion.suggestedDifficulty)}
          ${option('intermediate', conversion.suggestedDifficulty)}
          ${option('advanced', conversion.suggestedDifficulty)}
        </select>
      </label>

      <label>
        Estimated time
        <input id="draftEstimatedTime" value="${escapeHtml(conversion.estimatedTime || '10-15 minutes')}" />
      </label>
    </div>

    <div class="detail-note">
      <p><strong>Target file</strong></p>
      <p id="draftTargetFile">${escapeHtml(conversion.suggestedTargetFile)}</p>
      <p class="${conversion.targetExists ? 'warning' : 'ok'}">
        ${conversion.targetExists ? 'Target already exists — draft creation will be blocked.' : 'Target does not exist yet.'}
      </p>
      <p><strong>Status:</strong> draft</p>
    </div>

    <button class="primary-button" id="createDraftButton" ${conversion.targetExists ? 'disabled' : ''}>
      Create draft case
    </button>

    <div id="createDraftResult" class="detail-note meta">No draft created yet.</div>
  `

  document.getElementById('createDraftButton')?.addEventListener('click', createDraftCase)
}

function option(value, selected) {
  return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`
}

function getDraftPayload() {
  return {
    stationId: document.getElementById('draftStationId').value,
    region: document.getElementById('draftRegion').value,
    title: document.getElementById('draftTitle').value,
    conditionSlug: document.getElementById('draftConditionSlug').value,
    caseSlug: document.getElementById('draftCaseSlug').value,
    difficulty: document.getElementById('draftDifficulty').value,
    estimatedTime: document.getElementById('draftEstimatedTime').value,
  }
}

async function createDraftCase() {
  const result = document.getElementById('createDraftResult')
  const button = document.getElementById('createDraftButton')

  result.textContent = 'Creating draft...'
  result.className = 'detail-note meta'
  button.disabled = true

  try {
    const created = await loadJson('/api/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDraftPayload()),
    })

    result.innerHTML = `
      <p class="success"><strong>Draft created.</strong></p>
      <p>${escapeHtml(created.file)}</p>
      <p>Review the MDX file, remove TODOs, then run hygiene and preflight before publishing.</p>
    `

    await refreshDashboard()
  } catch (error) {
    result.innerHTML = `<p class="error"><strong>Draft creation failed.</strong></p><p>${escapeHtml(error.message)}</p>`
    button.disabled = false
  }
}

async function refreshDashboard() {
  const [status, cases, tracker] = await Promise.all([
    loadJson('/api/status'),
    loadJson('/api/cases'),
    loadJson('/api/tracker'),
  ])

  renderDashboard(status, cases, tracker)
}

function renderDashboard(status, cases, tracker) {
  document.getElementById('status').textContent =
    `Git:\n${status.git}\n\nHygiene:\n${status.hygiene}`

  const published = cases.filter((c) => c.status === 'published').length
  const draft = cases.filter((c) => c.status === 'draft').length
  const archived = cases.filter((c) => c.status === 'archived').length

  document.getElementById('caseCounts').innerHTML = `
    <p>Total: <strong>${cases.length}</strong></p>
    <p>Published: <strong>${published}</strong></p>
    <p>Draft: <strong>${draft}</strong></p>
    <p>Archived: <strong>${archived}</strong></p>
    <p>Pending legacy stations: <strong>${tracker.pending.length}</strong></p>
    <p>Converted legacy stations: <strong>${tracker.converted.length}</strong></p>
  `

  const publishedCases = cases.filter((item) => item.status === 'published')
const draftCases = cases.filter((item) => item.status === 'draft')

document.getElementById('publishedCases').innerHTML = publishedCases.length
  ? publishedCases.map((item) =>
      row(item.title, `${item.region} · ${item.difficulty} · ${item.path}`, item.status)
    ).join('')
  : '<p>No published cases found.</p>'

document.getElementById('draftCases').innerHTML = draftCases.length
  ? draftCases.map((item) =>
      row(item.title, `${item.region} · ${item.difficulty} · ${item.path}`, item.status)
    ).join('')
  : '<p>No draft cases found.</p>'

  document.getElementById('pending').innerHTML = tracker.pending.length
    ? tracker.pending.map((item) =>
        row(`${item.id} — ${item.title}`, `${item.region} · ${item.priority}`, '', item.id)
      ).join('')
    : '<p>No pending stations found.</p>'

  document.getElementById('converted').innerHTML = tracker.converted.length
    ? tracker.converted.map((item) =>
        row(`${item.id} — ${item.title}`, item.target || item.notes, 'published')
      ).join('')
    : '<p>No converted stations found.</p>'
}

async function main() {
  await refreshDashboard()

  document.getElementById('pending').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-station-id]')
    if (!button) return

    const id = button.getAttribute('data-station-id') || ''
    const preview = document.getElementById('stationPreview')
    const stationFile = document.getElementById('stationFile')

    selectedStation = null
    preview.textContent = 'Loading...'
    stationFile.textContent = `Loading ${id}...`
    renderConversionForm(null)

    const station = await loadJson(`/api/station?id=${encodeURIComponent(id)}`)
    selectedStation = station

    if (station.error) {
      stationFile.textContent = 'Error'
      preview.textContent = station.error
      return
    }

    stationFile.textContent = station.file
    preview.textContent = station.text
    renderConversionForm(station.conversion)
  })
}

main().catch((error) => {
  document.body.innerHTML = `<main><pre>${escapeHtml(error.stack || error.message)}</pre></main>`
})