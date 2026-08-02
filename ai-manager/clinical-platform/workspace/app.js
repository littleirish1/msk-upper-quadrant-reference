const state = { snapshot: null, queue: null, filter: '' }
const counts = document.querySelector('#counts')
const queues = document.querySelector('#queues')
const tableWrap = document.querySelector('#table-wrap')
const activeLabel = document.querySelector('#active-label')

const response = await fetch('/api/snapshot', { cache: 'no-store' })
if (!response.ok) throw new Error(`Snapshot unavailable (${response.status})`)
state.snapshot = await response.json()
render()

document.querySelector('#filter').addEventListener('input', (event) => { state.filter = event.target.value.toLowerCase(); renderTable() })
document.querySelector('#download').addEventListener('click', () => {
  const packet = {
    schemaVersion: 1,
    generatedFrom: state.snapshot.authority,
    selectedQueue: state.queue,
    records: selectedRecords(),
    reviewerNote: document.querySelector('#note').value,
    humanDecisionRecorded: false,
  }
  const blob = new Blob([`${JSON.stringify(packet, null, 2)}\n`], { type: 'application/json' })
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'clinical-review-packet.json' })
  link.click()
  URL.revokeObjectURL(link.href)
})

function render() {
  counts.innerHTML = Object.entries(state.snapshot.counts).map(([label, value]) => `<article><strong>${value}</strong><span>${escapeHtml(label)}</span></article>`).join('')
  queues.innerHTML = Object.entries(state.snapshot.queueCounts).map(([label, value]) => `<button type="button" data-queue="${escapeHtml(label)}" aria-pressed="${state.queue === label}"><span>${escapeHtml(label)}</span><strong>${value}</strong></button>`).join('')
  queues.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { state.queue = state.queue === button.dataset.queue ? null : button.dataset.queue; render() }))
  activeLabel.textContent = state.queue ? `${state.queue} queue` : 'Inventory'
  renderTable()
}

function selectedRecords() {
  const records = Object.entries(state.snapshot.groups).flatMap(([group, items]) => items.map((item) => ({ group, ...item })))
  const queued = state.queue ? new Set(state.snapshot.queues[state.queue]) : null
  return records.filter((item) => !queued || queued.has(item.id)).filter((item) => JSON.stringify(item).toLowerCase().includes(state.filter))
}

function renderTable() {
  const rows = selectedRecords()
  tableWrap.innerHTML = `<table><thead><tr><th>Group</th><th>ID</th><th>Revision</th><th>Lifecycle</th><th>Publication</th><th>Hash</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.group)}</td><td><code>${escapeHtml(item.id)}</code></td><td>${escapeHtml(String(item.revision))}</td><td>${escapeHtml(item.lifecycle)}</td><td>${escapeHtml(item.publication)}</td><td><code>${escapeHtml(item.hash?.slice(0, 14) ?? 'pending')}</code></td></tr>`).join('')}</tbody></table><p class="result-count">${rows.length} records shown</p>`
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])) }
