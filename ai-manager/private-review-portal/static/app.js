const state = { csrf: null, snapshot: null }
const byId = (id) => document.getElementById(id)
const text = (value) => document.createTextNode(String(value ?? ''))

async function api(path, options = {}) {
  const headers = new Headers(options.headers)
  if (state.csrf && options.method && options.method !== 'GET') headers.set('X-CSRF-Token', state.csrf)
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`)
  return payload
}

function setStatus(message, error = false) {
  const element = byId('global-status')
  element.textContent = message
  element.classList.toggle('error', error)
}

function metric(label, value) {
  const element = document.createElement('div')
  element.className = 'metric'
  const strong = document.createElement('strong')
  strong.append(text(value))
  const span = document.createElement('span')
  span.append(text(label))
  element.append(strong, span)
  return element
}

function detailCard(title, entries, className = '') {
  const card = document.createElement('article')
  card.className = `card ${className}`.trim()
  const heading = document.createElement('h3')
  heading.append(text(title))
  const list = document.createElement('dl')
  for (const [label, value] of entries) {
    const term = document.createElement('dt')
    term.append(text(label))
    const detail = document.createElement('dd')
    detail.append(text(value))
    list.append(term, detail)
  }
  card.append(heading, list)
  return card
}

function renderSnapshot() {
  const { headline, datasets, documents, futureItems } = state.snapshot
  const headlineElement = byId('headline')
  headlineElement.replaceChildren(...Object.entries(headline).map(([label, value]) => metric(label.replace(/([A-Z])/g, ' $1').toLowerCase(), value)))
  byId('datasets').replaceChildren(...datasets.map((dataset) => detailCard(dataset.label, [['Records', dataset.count], ...Object.entries(dataset.summary).slice(0, 3)])))
  renderDocuments(documents)
  renderDatasets(datasets)
  byId('future-items').replaceChildren(...futureItems.map((item) => detailCard(item.title, [
    ['Status', item.status], ['Priority', item.priority], ['Owner role', item.ownerRole], ['Milestone', item.milestone], ['Blockers', item.blockers.join(', ') || 'None'], ['Next action', item.nextAction],
  ])))
}

function renderDocuments(documents) {
  if (!documents.length) {
    byId('documents').replaceChildren(detailCard('No private documents', [['Next action', 'Upload synthetic or permitted project material.']]))
    return
  }
  const cards = documents.map((documentRecord) => {
    const card = detailCard(documentRecord.sourceMetadata.title || documentRecord.originalName, [
      ['Filename', documentRecord.originalName], ['Type', documentRecord.detectedType], ['Size', `${documentRecord.bytes} bytes`], ['SHA-256', documentRecord.sha256], ['Scan', documentRecord.scan.status], ['Quarantine', documentRecord.quarantine], ['Extraction', documentRecord.extraction], ['Duplicate of', documentRecord.duplicateOf || 'No'],
    ])
    const actions = document.createElement('div')
    actions.className = 'actions'
    if (documentRecord.scan.status === 'clean') {
      const download = document.createElement('a')
      download.href = `/api/documents/${documentRecord.id}/download`
      download.textContent = 'Download original'
      download.className = 'button-link'
      const preview = document.createElement('button')
      preview.type = 'button'
      preview.textContent = 'Generate safe text preview'
      preview.addEventListener('click', () => recordAction('queue-extraction', documentRecord.id))
      actions.append(download, preview)
    }
    const note = document.createElement('button')
    note.type = 'button'
    note.textContent = 'Add review note'
    note.addEventListener('click', () => recordAction('add-note', documentRecord.id, 'Review note requested from portal list.'))
    actions.append(note)
    card.append(actions)
    return card
  })
  byId('documents').replaceChildren(...cards)
}

function renderDatasets(datasets) {
  const query = byId('dataset-filter').value.toLowerCase().trim()
  const visible = datasets.filter((dataset) => !query || `${dataset.id} ${dataset.label}`.toLowerCase().includes(query))
  byId('queue-datasets').replaceChildren(...visible.map((dataset) => {
    const entries = [['Derived count', dataset.count], ['Authoritative source', dataset.sourcePath]]
    for (const item of dataset.items.slice(0, 5)) entries.push(['Item', Object.values(item).filter((value) => typeof value !== 'object').slice(0, 4).join(' · ')])
    return detailCard(dataset.label, entries)
  }))
}

async function refresh() {
  state.snapshot = await api('/api/dashboard')
  renderSnapshot()
}

async function recordAction(type, targetId, note = '') {
  try {
    const action = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, targetType: 'document', targetId, note }) })
    setStatus(`Action recorded: ${action.type}. This did not grant approval.`)
    await refresh()
  } catch (error) { setStatus(error.message, true) }
}

function uploadOne(file, metadata, batchId) {
  return new Promise((resolve) => {
    const row = document.createElement('div')
    row.className = 'upload-row'
    const label = document.createElement('strong')
    label.append(text(file.name))
    const progress = document.createElement('progress')
    progress.max = file.size || 1
    progress.value = 0
    const status = document.createElement('div')
    status.className = 'status'
    row.append(label, progress, status)
    byId('upload-list').append(row)
    const send = () => {
      status.textContent = 'Uploading to quarantine…'
      const request = new XMLHttpRequest()
      request.open('POST', '/api/uploads')
      request.withCredentials = true
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      request.setRequestHeader('X-File-Name', file.name)
      request.setRequestHeader('X-Upload-Batch', batchId)
      request.setRequestHeader('X-Upload-Metadata', btoa(unescape(encodeURIComponent(JSON.stringify(metadata)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''))
      request.setRequestHeader('X-CSRF-Token', state.csrf)
      request.upload.addEventListener('progress', (event) => { if (event.lengthComputable) { progress.max = event.total; progress.value = event.loaded } })
      request.addEventListener('load', () => {
        let payload = {}
        try { payload = JSON.parse(request.responseText) } catch {}
        if (request.status === 201) {
          status.textContent = payload.scan.status === 'clean' ? 'Clean-scanned and released to the private library.' : 'Held in quarantine: scanner unavailable or scan not clean.'
          resolve(true)
        } else {
          status.textContent = `Upload rejected: ${payload.error || request.status}`
          const retry = document.createElement('button')
          retry.type = 'button'
          retry.textContent = 'Retry'
          retry.addEventListener('click', () => { retry.remove(); send() }, { once: true })
          row.append(retry)
          resolve(false)
        }
      })
      request.addEventListener('error', () => { status.textContent = 'Network interruption. Use Retry.'; const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => { retry.remove(); send() }, { once: true }); row.append(retry); resolve(false) })
      request.send(file)
    }
    send()
  })
}

byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const status = byId('login-status')
  status.textContent = 'Signing in…'
  try {
    const result = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: byId('passphrase').value }) })
    state.csrf = result.csrf
    byId('passphrase').value = ''
    byId('login-view').hidden = true
    byId('portal-view').hidden = false
    await refresh()
    byId('dashboard-tab').focus()
  } catch (error) { status.textContent = error.message; status.classList.add('error') }
})

byId('logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }) } catch {}
  state.csrf = null
  state.snapshot = null
  byId('portal-view').hidden = true
  byId('login-view').hidden = false
  byId('login-status').textContent = 'Signed out.'
  byId('passphrase').focus()
})

const tabs = [...document.querySelectorAll('[role="tab"]')]
function selectTab(tab) {
  for (const candidate of tabs) {
    const selected = candidate === tab
    candidate.setAttribute('aria-selected', String(selected))
    candidate.tabIndex = selected ? 0 : -1
    byId(candidate.dataset.panel).hidden = !selected
  }
  tab.focus()
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab))
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = tabs.indexOf(tab)
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
    selectTab(next)
  })
}

byId('dataset-filter').addEventListener('input', () => { if (state.snapshot) renderDatasets(state.snapshot.datasets) })
byId('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  const files = [...byId('files').files, ...byId('camera').files]
  if (!files.length) return setStatus('Choose at least one file.', true)
  const metadata = { title: form.get('title'), sourceType: form.get('sourceType'), region: form.get('region'), condition: form.get('condition'), notes: form.get('notes'), tags: String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean) }
  const batchId = crypto.randomUUID()
  for (const file of files) await uploadOne(file, metadata, batchId)
  await refresh()
})

api('/api/session').then(async (session) => {
  state.csrf = session.csrf
  byId('login-view').hidden = true
  byId('portal-view').hidden = false
  await refresh()
}).catch(() => {})
