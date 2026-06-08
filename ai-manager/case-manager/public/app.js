let dashboardState = {
  status: null,
  cases: [],
  tracker: { pending: [], draftCreated: [], converted: [], archived: [] },
  sourceRegistry: {
    summary: {},
    unlinkedCases: [],
  },
}

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

function button(label, attrs = '') {
  return `<button class="small-button" ${attrs}>${escapeHtml(label)}</button>`
}

function caseRow(item, actions = '') {
  return `
    <div class="row">
      <div class="row-main">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          <div class="meta">${escapeHtml(item.region)} · ${escapeHtml(item.difficulty)} · ${escapeHtml(item.path)}</div>
        </div>
        <div class="row-actions">${actions}</div>
      </div>
    </div>
  `
}

function stationRow(item) {
  return `
    <div class="row">
      <div class="row-main">
        <div>
          <strong>${escapeHtml(item.id)} — ${escapeHtml(item.title)}</strong>
          <div class="meta">${escapeHtml(item.region)} · ${escapeHtml(item.priority)} · ${escapeHtml(item.notes || '')}</div>
        </div>
        <div class="row-actions">
          ${button('Preview', `data-station-id="${escapeHtml(item.id)}"`)}
        </div>
      </div>
    </div>
  `
}

function convertedRow(item) {
  return `
    <div class="row">
      <strong>${escapeHtml(item.id)} — ${escapeHtml(item.title)}</strong>
      <div class="meta">${escapeHtml(item.region || '')} · ${escapeHtml(item.priority || '')} · ${escapeHtml(item.status || '')}</div>
      <div class="meta">${escapeHtml(item.target || item.notes || '')}</div>
    </div>
  `
}

function unlinkedCaseRow(item) {
  return `
    <div class="row">
      <strong>${escapeHtml(item.title || item.path)}</strong>
      <div class="meta">${escapeHtml(item.status || '')} · ${escapeHtml(item.reason || '')}</div>
      <div class="meta">${escapeHtml(item.path || '')}</div>
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
  const buttonEl = document.getElementById('createDraftButton')

  result.textContent = 'Creating draft...'
  result.className = 'detail-note meta'
  buttonEl.disabled = true

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
    buttonEl.disabled = false
  }
}

async function updateCaseStatus(path, status) {
  const label = status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'restore to draft'
  const confirmed = window.confirm(`Are you sure you want to ${label} this case?\n\n${path}`)

  if (!confirmed) return

  await loadJson('/api/case-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, status }),
  })

  await refreshDashboard()
}

async function copyText(text) {
  await navigator.clipboard.writeText(text)
}

async function runPreflight() {
  const output = document.getElementById('preflightOutput')
  const buttonEl = document.getElementById('runPreflightButton')

  output.textContent = 'Running preflight...'
  buttonEl.disabled = true

  try {
    const result = await loadJson('/api/preflight', { method: 'POST' })
    output.textContent = result.output || (result.ok ? 'Preflight passed.' : 'Preflight failed.')
    await refreshDashboard()
  } catch (error) {
    output.textContent = error.message
  } finally {
    buttonEl.disabled = false
  }
}

async function generateRegistry() {
  const output = document.getElementById('registryOutput')
  const buttonEl = document.getElementById('generateRegistryButton')

  output.textContent = 'Generating source registry...'
  buttonEl.disabled = true

  try {
    const result = await loadJson('/api/source-registry/regenerate', { method: 'POST' })
    output.textContent = result.output || (result.ok ? 'Source registry generated.' : 'Source registry generation failed.')
    await refreshDashboard()
  } catch (error) {
    output.textContent = error.message
  } finally {
    buttonEl.disabled = false
  }
}

async function refreshDashboard() {
  const [status, cases, tracker, sourceRegistry] = await Promise.all([
    loadJson('/api/status'),
    loadJson('/api/cases'),
    loadJson('/api/tracker'),
    loadJson('/api/source-registry'),
  ])

  dashboardState = { status, cases, tracker, sourceRegistry }
  renderDashboard()
}

function renderDashboard() {
  const { status, cases, tracker, sourceRegistry } = dashboardState

  document.getElementById('status').textContent =
    `Project root:\n${status.projectRoot || 'unknown'}\n\nGit:\n${status.git}\n\nHygiene:\n${status.hygiene}`

  const published = cases.filter((c) => c.status === 'published')
  const draft = cases.filter((c) => c.status === 'draft')
  const archived = cases.filter((c) => c.status === 'archived')

  document.getElementById('caseCounts').innerHTML = `
    <p>Total: <strong>${cases.length}</strong></p>
    <p>Published: <strong>${published.length}</strong></p>
    <p>Draft: <strong>${draft.length}</strong></p>
    <p>Archived: <strong>${archived.length}</strong></p>
    <p>Pending legacy stations: <strong>${tracker.pending.length}</strong></p>
    <p>Draft-created legacy stations: <strong>${tracker.draftCreated.length}</strong></p>
    <p>Converted legacy stations: <strong>${tracker.converted.length}</strong></p>
    <p>Archived legacy stations: <strong>${tracker.archived.length}</strong></p>
  `

  renderSourceRegistry(sourceRegistry)

  document.getElementById('publishedCases').innerHTML = published.length
    ? published.map((item) =>
        caseRow(item, button('Copy path', `data-copy-path="${escapeHtml(item.path)}"`))
      ).join('')
    : '<p>No published cases found.</p>'

  document.getElementById('draftCases').innerHTML = draft.length
    ? draft.map((item) =>
        caseRow(
          item,
          [
            button('Copy path', `data-copy-path="${escapeHtml(item.path)}"`),
            button('Mark published', `data-case-path="${escapeHtml(item.path)}" data-case-status="published"`),
            button('Archive', `data-case-path="${escapeHtml(item.path)}" data-case-status="archived"`),
          ].join('')
        )
      ).join('')
    : '<p>No draft cases found.</p>'

  document.getElementById('archivedCases').innerHTML = archived.length
    ? archived.map((item) =>
        caseRow(
          item,
          [
            button('Copy path', `data-copy-path="${escapeHtml(item.path)}"`),
            button('Restore draft', `data-case-path="${escapeHtml(item.path)}" data-case-status="draft"`),
          ].join('')
        )
      ).join('')
    : '<p>No archived cases found.</p>'

  renderPending()
  renderDraftCreated()
  renderConverted()
}

function renderSourceRegistry(sourceRegistry) {
  const summary = sourceRegistry.summary || {}

  document.getElementById('sourceRegistrySummary').innerHTML = sourceRegistry.missing
    ? `<p class="warning">${escapeHtml(sourceRegistry.message || 'Source registry not found.')}</p>`
    : `
      <p>Total sources: <strong>${summary.totalSources ?? 0}</strong></p>
      <p>Pending review: <strong>${summary.pendingReview ?? 0}</strong></p>
      <p>Draft created: <strong>${summary.draftCreated ?? 0}</strong></p>
      <p>Converted: <strong>${summary.converted ?? 0}</strong></p>
      <p>Archived: <strong>${summary.archived ?? 0}</strong></p>
      <p>Linked cases: <strong>${summary.linkedCases ?? 0}</strong></p>
      <p>Unlinked cases: <strong>${summary.unlinkedCases ?? 0}</strong></p>
    `

  const unlinkedCases = Array.isArray(sourceRegistry.unlinkedCases)
    ? sourceRegistry.unlinkedCases
    : []

  document.getElementById('unlinkedCases').innerHTML = unlinkedCases.length
    ? unlinkedCases.map(unlinkedCaseRow).join('')
    : '<p>No unlinked cases found.</p>'
}

function renderPending() {
  const search = document.getElementById('stationSearch').value.toLowerCase().trim()
  const filter = document.getElementById('stationFilter').value

  const filtered = dashboardState.tracker.pending.filter((item) => {
    const haystack = `${item.id} ${item.title} ${item.region} ${item.priority} ${item.notes}`.toLowerCase()
    const matchesSearch = !search || haystack.includes(search)
    const matchesFilter =
      filter === 'all' ||
      item.priority.toLowerCase() === filter ||
      item.region.toLowerCase() === filter

    return matchesSearch && matchesFilter
  })

  document.getElementById('pending').innerHTML = filtered.length
    ? filtered.map(stationRow).join('')
    : '<p>No pending stations match this filter.</p>'
}

function renderDraftCreated() {
  document.getElementById('draftCreated').innerHTML = dashboardState.tracker.draftCreated.length
    ? dashboardState.tracker.draftCreated.map(convertedRow).join('')
    : '<p>No draft-created legacy stations found.</p>'
}

function renderConverted() {
  document.getElementById('converted').innerHTML = dashboardState.tracker.converted.length
    ? dashboardState.tracker.converted.map(convertedRow).join('')
    : '<p>No converted stations found.</p>'
}

async function previewStation(id) {
  const preview = document.getElementById('stationPreview')
  const stationFile = document.getElementById('stationFile')

  preview.textContent = 'Loading...'
  stationFile.textContent = `Loading ${id}...`
  renderConversionForm(null)

  const station = await loadJson(`/api/station?id=${encodeURIComponent(id)}`)

  if (station.error) {
    stationFile.textContent = 'Error'
    preview.textContent = station.error
    return
  }

  stationFile.textContent = station.file
  preview.textContent = station.text
  renderConversionForm(station.conversion)
}

async function main() {
  await refreshDashboard()

  document.getElementById('refreshButton').addEventListener('click', refreshDashboard)
  document.getElementById('runPreflightButton').addEventListener('click', runPreflight)
  document.getElementById('generateRegistryButton').addEventListener('click', generateRegistry)
  document.getElementById('stationSearch').addEventListener('input', renderPending)
  document.getElementById('stationFilter').addEventListener('change', renderPending)

  document.body.addEventListener('click', async (event) => {
    const stationButton = event.target.closest('[data-station-id]')
    if (stationButton) {
      await previewStation(stationButton.getAttribute('data-station-id'))
      return
    }

    const copyButton = event.target.closest('[data-copy-path]')
    if (copyButton) {
      await copyText(copyButton.getAttribute('data-copy-path'))
      return
    }

    const statusButton = event.target.closest('[data-case-path][data-case-status]')
    if (statusButton) {
      await updateCaseStatus(
        statusButton.getAttribute('data-case-path'),
        statusButton.getAttribute('data-case-status')
      )
    }
  })
}

main().catch((error) => {
  document.body.innerHTML = `<main><pre>${escapeHtml(error.stack || error.message)}</pre></main>`
})
