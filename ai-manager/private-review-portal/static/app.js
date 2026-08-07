const state = { csrf: null, snapshot: null, currentItem: null }
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

function humanise(value) {
  return String(value ?? '').replaceAll('-', ' ').replace(/([A-Z])/g, ' $1').trim()
}

function metric(label, value) {
  const element = document.createElement('div')
  element.className = 'metric'
  const strong = document.createElement('strong')
  strong.append(text(value))
  const span = document.createElement('span')
  span.append(text(humanise(label)))
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

function option(value, label = humanise(value)) {
  const element = document.createElement('option')
  element.value = value
  element.textContent = label
  return element
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
}

function populateSelect(select, values, keepFirst = true) {
  const first = keepFirst ? select.firstElementChild : null
  select.replaceChildren(...(first ? [first] : []), ...values.map((value) => typeof value === 'string' ? option(value) : option(value.id, value.label)))
}

function renderDashboard() {
  const studio = state.snapshot.studio
  byId('studio-metrics').replaceChildren(...Object.entries(studio.summary).map(([label, value]) => metric(label, value)))
  const currentCounts = new Map()
  for (const item of studio.items) currentCounts.set(item.region, (currentCounts.get(item.region) ?? 0) + 1)
  byId('region-summary').replaceChildren(...studio.regions.map((region) => detailCard(region.label, [
    ['Availability', region.availability],
    ['Loaded records', currentCounts.get(region.id) ?? 0],
  ], currentCounts.has(region.id) ? '' : 'muted-card')))
  byId('integration-position').replaceChildren(detailCard('Integration automation', [
    ['Actor ID', studio.actor.id], ['Roles', studio.actor.roles.join(', ')], ['Proposal submission', studio.capabilities.submitIntegrationProposal ? 'Enabled' : 'Disabled'], ['Direct main push', 'Prohibited'], ['Automatic publication', 'Prohibited'],
  ]))
}

function renderDocuments() {
  const documents = state.snapshot.documents
  if (!documents.length) {
    byId('documents').replaceChildren(detailCard('No private documents', [['Next action', 'Upload synthetic or permitted project material.']]))
    return
  }
  byId('documents').replaceChildren(...documents.map((record) => {
    const card = detailCard(record.sourceMetadata.title || record.originalName, [
      ['Private ID', record.id], ['Filename', record.originalName], ['Type', record.detectedType], ['Size', `${record.bytes} bytes`], ['SHA-256', record.sha256], ['Scan', record.scan.status], ['Quarantine', record.quarantine], ['Extraction', record.extraction],
    ])
    const actions = document.createElement('div')
    actions.className = 'actions'
    if (record.scan.status === 'clean') {
      const download = document.createElement('a')
      download.href = `/api/documents/${record.id}/download`
      download.textContent = 'Download original'
      const preview = document.createElement('button')
      preview.type = 'button'
      preview.textContent = 'Generate safe text preview'
      preview.addEventListener('click', () => recordDocumentAction('queue-extraction', record.id))
      actions.append(download, preview)
      if (record.derivedFiles.some((item) => item.type === 'safe-text-preview')) {
        const viewPreview = document.createElement('a')
        viewPreview.href = `/api/documents/${record.id}/preview`
        viewPreview.textContent = 'View safe text preview'
        viewPreview.target = '_blank'
        viewPreview.rel = 'noopener'
        actions.append(viewPreview)
      }
    }
    card.append(actions)
    return card
  }))
}

function contentFilters() {
  return Object.fromEntries(new FormData(byId('content-filters')).entries())
}

function renderContentLibrary() {
  const filters = contentFilters()
  const query = filters.query.toLowerCase().trim()
  const items = state.snapshot.studio.items.filter((item) => {
    if (filters.region && item.region !== filters.region) return false
    if (filters.contentType && item.contentType !== filters.contentType) return false
    if (filters.lifecycle && item.lifecycle !== filters.lifecycle) return false
    if (filters.publicationState && item.publicationState !== filters.publicationState) return false
    if (filters.blockerState === 'blocked' && !item.blockers.length) return false
    if (filters.blockerState === 'clear' && item.blockers.length) return false
    return !query || `${item.id} ${item.title}`.toLowerCase().includes(query)
  })
  byId('content-result-count').textContent = `${items.length} of ${state.snapshot.studio.items.length} loaded items`
  if (!items.length) {
    byId('content-results').replaceChildren(detailCard('No matching items', [['Suggestion', 'Change or clear one or more filters.']]))
    return
  }
  byId('content-results').replaceChildren(...items.map((item) => {
    const proposals = state.snapshot.studio.integrationProposals.filter((proposal) => proposal.targetId === item.id && proposal.exactRevisionKey === item.revisionHash)
    const card = detailCard(item.title, [
      ['Region', humanise(item.region)], ['Type', humanise(item.contentType)], ['Lifecycle', item.lifecycle], ['Publication', item.publicationState], ['Completeness', `${item.completeness.score}%`], ['Blockers', item.blockers.length], ['Integration review', proposals.length ? 'Exact revision reviewed' : 'Not recorded'],
    ])
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Review exact item'
    button.addEventListener('click', () => openItem(item.id))
    card.append(button)
    return card
  }))
}

function section(title, content) {
  const wrapper = document.createElement('section')
  wrapper.className = 'detail-section'
  const heading = document.createElement('h3')
  heading.append(text(title))
  wrapper.append(heading, content)
  return wrapper
}

function stringList(values, emptyText = 'None recorded') {
  if (!values?.length) {
    const paragraph = document.createElement('p')
    paragraph.className = 'muted'
    paragraph.append(text(emptyText))
    return paragraph
  }
  const list = document.createElement('ul')
  for (const value of values) {
    const item = document.createElement('li')
    item.append(text(typeof value === 'string' ? value : JSON.stringify(value)))
    list.append(item)
  }
  return list
}

function reviewForm(item) {
  const form = document.createElement('form')
  form.className = 'form-grid review-form'
  const actionLabel = document.createElement('label')
  actionLabel.append(text('Permitted action'))
  const action = document.createElement('select')
  action.name = 'type'
  action.append(option('add-note', 'Add private reviewer note'), option('create-human-review-task', 'Create human review task'))
  actionLabel.append(action)
  const noteLabel = document.createElement('label')
  noteLabel.className = 'wide'
  noteLabel.append(text('Note or task instruction'))
  const note = document.createElement('textarea')
  note.name = 'note'
  note.maxLength = 3000
  note.rows = 4
  note.required = true
  noteLabel.append(note)
  const button = document.createElement('button')
  button.type = 'submit'
  button.textContent = 'Record against exact revision'
  form.append(actionLabel, noteLabel, button)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(form)
    try {
      const recorded = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: values.get('type'), targetType: 'content-item', targetId: item.id, exactRevisionKey: item.revisionHash, note: values.get('note') }) })
      setStatus(`${humanise(recorded.type)} recorded with grantsApproval=false.`)
      form.reset()
      await refresh()
      await openItem(item.id, false)
    } catch (error) { setStatus(error.message, true) }
  })
  return form
}

function reviewCompletionForm(item) {
  const existing = item.integrationProposals?.find((proposal) => proposal.exactRevisionKey === item.revisionHash)
  if (existing) {
    const wrapper = document.createElement('div')
    const summary = document.createElement('p')
    summary.append(text(`This exact revision was marked reviewed at ${existing.review.completedAt}. It remains unapproved and unpublished.`))
    const download = document.createElement('a')
    download.href = existing.downloadUrl
    download.textContent = 'Download private integration proposal'
    wrapper.append(summary, download)
    return wrapper
  }
  const form = document.createElement('form')
  form.className = 'form-grid review-form proposal-controls'
  const noteLabel = document.createElement('label')
  noteLabel.className = 'wide'
  noteLabel.append(text('Review completion note'))
  const note = document.createElement('textarea')
  note.name = 'note'
  note.maxLength = 3000
  note.rows = 4
  note.required = true
  noteLabel.append(note)
  const declarationLabel = document.createElement('label')
  declarationLabel.className = 'review-attestation'
  const declaration = document.createElement('input')
  declaration.type = 'checkbox'
  declaration.name = 'reviewDeclaration'
  declaration.value = 'confirmed'
  declaration.required = true
  declarationLabel.append(declaration, text(`I reviewed exact revision ${item.revisionHash}. I understand this creates a private integration-assessment proposal only and grants no approval or publication authority.`))
  const button = document.createElement('button')
  button.type = 'submit'
  button.textContent = 'Mark reviewed — prepare integration proposal'
  form.append(noteLabel, declarationLabel, button)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = new FormData(form)
    try {
      const recorded = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'mark-review-complete', targetType: 'content-item', targetId: item.id, exactRevisionKey: item.revisionHash, note: values.get('note'), reviewDeclaration: values.get('reviewDeclaration') === 'confirmed' }) })
      setStatus(`Review completed for the exact revision. Proposal ${recorded.integrationProposal.id} is private; grantsApproval=false.`)
      await refresh()
      await openItem(item.id, false)
    } catch (error) { setStatus(error.message, true) }
  })
  return form
}

function renderItemDetail(item) {
  const container = document.createElement('article')
  container.className = 'item-detail'
  const title = document.createElement('h3')
  title.append(text(item.title))
  const metadata = detailCard('Metadata', [
    ['Exact ID', item.id], ['Region', item.region], ['Content type', item.contentType], ['Lifecycle', item.lifecycle], ['Publication state', item.publicationState], ['Revision hash', item.revisionHash], ['Completeness', `${item.completeness.score}% · ${item.completeness.status}`], ['grantsApproval', item.grantsApproval],
  ])
  const review = detailCard('Review requirements', [
    ['Clinical', item.clinicalReview], ['Evidence', item.evidenceReview], ['Accessibility', item.accessibilityReview], ['Licensing/source', item.licensingReview],
  ])
  const current = document.createElement('pre')
  current.className = 'content-preview'
  current.append(text(JSON.stringify(item.currentContent, null, 2)))
  const privateActions = (item.privateReviewActions ?? []).map((action) => `${action.createdAt} · ${humanise(action.type)} · ${action.status} · grantsApproval=${action.grantsApproval}`)
  const proposals = (item.integrationProposals ?? []).map((proposal) => `${proposal.review.completedAt} · ${proposal.status} · ${proposal.exactRevisionKey} · publicationAuthorized=${proposal.controls.publicationAuthorized}`)
  const queue = (item.integrationQueue ?? []).map((entry) => `${entry.submittedAt} · ${entry.operation} · ${entry.status} · directMainPush=${entry.controls.directMainPush}`)
  container.append(title, metadata, review, section('Missing or incomplete fields', stringList(item.completeness.missingFields)), section('Blockers', stringList(item.blockers)), section('Existing human-review tasks', stringList(item.reviewTasks)), section('Private reviewer actions', stringList(privateActions)), section('Private integration proposals', stringList(proposals)), section('Integration queue', stringList(queue)), section('Authoritative source links', stringList(item.sourceLinks)), section('Current governed content (read-only)', current))
  if (item.learnerPreview) {
    const preview = document.createElement('div')
    const label = document.createElement('strong')
    label.append(text(item.learnerPreview.label))
    const route = document.createElement('code')
    route.append(text(item.learnerPreview.route))
    preview.append(label, document.createElement('br'), route)
    container.append(section('Existing learner-facing preview reference', preview))
  }
  container.append(section('Private review action', reviewForm(item)), section('Complete review for this exact revision', reviewCompletionForm(item)))
  byId('item-detail').replaceChildren(container)
}

async function openItem(id, changeTab = true) {
  try {
    state.currentItem = await api(`/api/content/${encodeURIComponent(id)}`)
    renderItemDetail(state.currentItem)
    if (changeTab) selectTab(byId('detail-tab'))
  } catch (error) { setStatus(error.message, true) }
}

function renderExtraMaterials() {
  const items = state.snapshot.studio.items.filter((item) => item.contentType === 'extra-materials')
  byId('extra-materials').replaceChildren(...(items.length ? items.map((item) => {
    const card = detailCard(item.title, [['Region', humanise(item.region)], ['Type', item.currentContent?.materialType ?? 'registered material'], ['Publication', item.publicationState], ['Revision', item.revisionHash]])
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Review registration'
    button.addEventListener('click', () => openItem(item.id))
    card.append(button)
    return card
  }) : [detailCard('No Extra Materials registered', [['State', 'Private registry is ready for metadata-only registrations.']])]))
}

function renderIntegrationProposals() {
  const proposals = state.snapshot.studio.integrationProposals
  if (!proposals.length) {
    byId('integration-proposals').replaceChildren(detailCard('No integration proposals', [['Next action', 'Open an exact content item, complete the review declaration and prepare a private proposal.']]))
    return
  }
  byId('integration-proposals').replaceChildren(...proposals.map((proposal) => {
    const queueEntry = state.snapshot.studio.integrationQueue.find((entry) => entry.proposalId === proposal.id)
    const card = detailCard(proposal.item.title, [
      ['Region', humanise(proposal.item.region)], ['Type', humanise(proposal.item.contentType)], ['Status', humanise(proposal.status)], ['Queue', queueEntry ? humanise(queueEntry.status) : 'Not submitted'], ['Exact revision', proposal.exactRevisionKey], ['Reviewed', proposal.review.completedAt], ['Approval granted', proposal.controls.grantsApproval], ['Publication authorised', proposal.controls.publicationAuthorized],
    ])
    const actions = document.createElement('div')
    actions.className = 'actions'
    const inspect = document.createElement('button')
    inspect.type = 'button'
    inspect.textContent = 'Inspect exact item'
    inspect.addEventListener('click', () => openItem(proposal.targetId))
    const download = document.createElement('a')
    download.href = proposal.downloadUrl
    download.textContent = 'Download proposal JSON'
    actions.append(inspect, download)
    card.append(actions)
    if (queueEntry) {
      const queued = document.createElement('p')
      queued.className = 'muted'
      queued.append(text(`Queued as ${queueEntry.operation}. The worker may prepare a feature-branch pull request; direct main push and publication remain prohibited.`))
      card.append(queued)
    } else if (proposal.item.contentType === 'extra-materials') {
      const held = document.createElement('p')
      held.className = 'muted'
      held.append(text('Resource integration remains held until a cleared-resource adapter can prove source, licensing and derived-file controls.'))
      card.append(held)
    } else if (state.snapshot.studio.capabilities.submitIntegrationProposal) {
      const form = document.createElement('form')
      form.className = 'form-grid compact-submit-form'
      const noteLabel = document.createElement('label')
      noteLabel.className = 'wide'
      noteLabel.append(text('Integration request note'))
      const note = document.createElement('textarea')
      note.name = 'note'
      note.maxLength = 3000
      note.rows = 3
      note.required = true
      noteLabel.append(note)
      const declarationLabel = document.createElement('label')
      declarationLabel.className = 'review-attestation'
      const declaration = document.createElement('input')
      declaration.type = 'checkbox'
      declaration.name = 'integrationDeclaration'
      declaration.value = 'confirmed'
      declaration.required = true
      declarationLabel.append(declaration, text('Queue this exact revision for review-adoption only. I understand the worker may push a feature branch and open a PR, but cannot push main, merge, publish or import resource files.'))
      const submit = document.createElement('button')
      submit.type = 'submit'
      submit.textContent = 'Submit for guarded integration'
      form.append(noteLabel, declarationLabel, submit)
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const values = new FormData(form)
        try {
          const result = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'submit-integration-proposal', targetType: 'integration-proposal', targetId: proposal.id, exactRevisionKey: proposal.exactRevisionKey, note: values.get('note'), reviewDeclaration: values.get('integrationDeclaration') === 'confirmed' }) })
          setStatus(`Proposal queued as ${result.queueEntry.operation}. Direct main push and publication remain prohibited.`)
          await refresh()
        } catch (error) { setStatus(error.message, true) }
      })
      card.append(form)
    } else {
      const unavailable = document.createElement('p')
      unavailable.className = 'muted'
      unavailable.append(text('Submission is disabled because this portal process does not have the integration-proposer role.'))
      card.append(unavailable)
    }
    return card
  }))
}

function renderFutureItems() {
  byId('future-items').replaceChildren(...state.snapshot.futureItems.map((item) => detailCard(item.title, [
    ['Status', item.status], ['Priority', item.priority], ['Owner role', item.ownerRole], ['Milestone', item.milestone], ['Blockers', item.blockers.join(', ') || 'None'], ['Next action', item.nextAction],
  ])))
}

function configureForms() {
  const studio = state.snapshot.studio
  const form = byId('content-filters')
  populateSelect(form.elements.region, studio.regions)
  populateSelect(form.elements.contentType, studio.contentTypes)
  populateSelect(form.elements.lifecycle, uniqueSorted(studio.items.map((item) => item.lifecycle)))
  populateSelect(form.elements.publicationState, uniqueSorted(studio.items.map((item) => item.publicationState)))
  populateSelect(byId('material-form').elements.materialType, studio.extraMaterialTypes, false)
  populateSelect(byId('material-form').elements.region, studio.regions, false)
}

function renderSnapshot(firstLoad = false) {
  if (firstLoad) configureForms()
  renderDashboard()
  renderContentLibrary()
  renderDocuments()
  renderIntegrationProposals()
  renderExtraMaterials()
  renderFutureItems()
}

async function refresh(firstLoad = false) {
  state.snapshot = await api('/api/dashboard')
  renderSnapshot(firstLoad)
}

async function recordDocumentAction(type, targetId) {
  try {
    const action = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, targetType: 'document', targetId }) })
    setStatus(`Document action recorded: ${action.type}. This did not grant approval.`)
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
    await refresh(true)
    byId('dashboard-tab').focus()
  } catch (error) { status.textContent = error.message; status.classList.add('error') }
})

byId('logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }) } catch {}
  state.csrf = null
  state.snapshot = null
  state.currentItem = null
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

byId('content-filters').addEventListener('input', () => { if (state.snapshot) renderContentLibrary() })
byId('material-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries())
  try {
    const material = await api('/api/extra-materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setStatus(`Extra Material registered privately: ${material.title}. grantsApproval=false.`)
    event.currentTarget.reset()
    await refresh()
  } catch (error) { setStatus(error.message, true) }
})
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
  await refresh(true)
}).catch(() => {})
