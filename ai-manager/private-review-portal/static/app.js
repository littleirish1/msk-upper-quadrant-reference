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

const recommendationLabels = Object.freeze({
  'acceptable-for-v1': '✓ Accept V1',
  'future-expansion-non-blocking': '↗ Future expansion',
  'changes-required': '⚠ Changes required',
  blocked: '⛔ Blocked',
  'recommend-publish': '✓ Recommend publish',
  'recommend-hold': '⏸ Recommend hold',
})

function recommendationLabel(value) {
  return recommendationLabels[value] ?? 'Not supplied'
}

function recommendationTone(value) {
  if (value === 'acceptable-for-v1' || value === 'recommend-publish') return 'accept'
  if (value === 'blocked') return 'blocked'
  if (value === 'changes-required' || value === 'recommend-hold') return 'changes'
  if (value === 'future-expansion-non-blocking') return 'future'
  return 'unavailable'
}

function recommendationStatus(value) {
  const output = document.createElement('span')
  output.className = `recommendation-status ${recommendationTone(value)}`
  output.append(text(recommendationLabel(value)))
  return output
}

function technicalDetails(entries, extraContent = []) {
  const details = document.createElement('details')
  details.className = 'technical-details'
  const summary = document.createElement('summary')
  summary.append(text('Technical / audit details'))
  const list = document.createElement('dl')
  for (const [label, value] of entries) {
    const term = document.createElement('dt')
    term.append(text(label))
    const detail = document.createElement('dd')
    detail.append(text(value))
    list.append(term, detail)
  }
  details.append(summary, list, ...extraContent)
  return details
}

function independentRecommendationPanel(record) {
  const recommendation = record.independentRecommendation
  const panel = document.createElement('section')
  panel.className = 'recommendation-panel'
  const heading = document.createElement('h4')
  heading.append(text('Independent reviewer recommendation'))
  const grid = document.createElement('dl')
  const values = [
    ['Clinical accuracy', recommendation?.clinicalAccuracy],
    ['Evidence sufficiency', recommendation?.evidenceSufficiency],
    ['Clinical completeness', recommendation?.clinicalCompleteness],
    ['Publication recommendation', recommendation?.publicationRecommendation],
  ]
  for (const [label, value] of values) {
    const term = document.createElement('dt')
    term.append(text(label))
    const detail = document.createElement('dd')
    detail.append(recommendationStatus(value))
    grid.append(term, detail)
  }
  const note = document.createElement('p')
  note.className = recommendation ? 'reviewer-note' : 'reviewer-note unavailable'
  const noteLabel = document.createElement('strong')
  noteLabel.append(text('Reviewer note: '))
  note.append(noteLabel, text(recommendation?.reviewerNote ?? record.independentRecommendationReason ?? 'No revision-matched independent recommendation is available.'))
  panel.append(heading, grid, note)
  return panel
}

function renderV1ConditionSummaryTable(conditions) {
  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll'
  const table = document.createElement('table')
  table.className = 'condition-summary-table'
  const caption = document.createElement('caption')
  caption.append(text('Independent recommendations and owner-decision status for all 20 Version 1 conditions'))
  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['Condition', 'Clinical', 'Evidence', 'Completeness', 'Recommendation', 'Owner status']) {
    const cell = document.createElement('th')
    cell.scope = 'col'
    cell.append(text(label))
    headRow.append(cell)
  }
  head.append(headRow)
  const body = document.createElement('tbody')
  for (const condition of conditions) {
    const row = document.createElement('tr')
    const titleCell = document.createElement('th')
    titleCell.scope = 'row'
    titleCell.append(text(condition.title))
    const recommendation = condition.independentRecommendation
    const values = [
      recommendation?.clinicalAccuracy,
      recommendation?.evidenceSufficiency,
      recommendation?.clinicalCompleteness,
      recommendation?.publicationRecommendation,
    ]
    row.append(titleCell)
    for (const value of values) {
      const cell = document.createElement('td')
      cell.append(recommendationStatus(value))
      row.append(cell)
    }
    const owner = document.createElement('td')
    owner.append(text(condition.ownerDecision ? 'Recorded · no approval granted' : 'Pending owner decision'))
    row.append(owner)
    body.append(row)
  }
  table.append(caption, head, body)
  wrapper.append(table)
  return wrapper
}

function v1ConditionRecommendationCard(condition, reviewCondition) {
  const card = document.createElement('article')
  card.className = 'card clinician-condition-card'
  const heading = document.createElement('h3')
  heading.append(text(condition.title))
  const region = document.createElement('p')
  region.className = 'condition-region'
  region.append(text(humanise(condition.region)))
  const ownerHeading = document.createElement('h4')
  ownerHeading.append(text('Owner decision'))
  const ownerStatus = document.createElement('p')
  ownerStatus.className = 'owner-status'
  ownerStatus.append(text(condition.ownerDecision ? 'Decision recorded for this exact revision. No approval or publication authority was granted.' : 'No owner decision has been recorded for this exact revision.'))
  const audit = condition.technicalAudit ?? {}
  const lineage = condition.lineage ?? {}
  const entries = [
    ['Exact condition revision SHA', condition.exactCurrentRevisionHash],
    ['Confirmation revision key', condition.confirmationRevisionKey],
    ['Critical adoption lineage', JSON.stringify(lineage.criticalAdoption ?? null)],
    ['Major adoption lineage', JSON.stringify(lineage.majorAdoption ?? null)],
    ['Canonical IDs', [audit.canonicalConditionId, ...(audit.canonicalClaimIds ?? [])].filter(Boolean).join(', ') || 'None recorded'],
    ['Source/revision identifiers', [audit.sourceFile, ...(audit.conditionRevisionIdentifiers ?? []), ...(audit.claimRevisionIdentifiers ?? []), ...(audit.sourceIdentifiers ?? [])].filter(Boolean).join(' · ') || 'None recorded'],
  ]
  const extra = []
  const claims = reviewCondition?.reviewCard?.canonicalClaims ?? []
  if (claims.length) {
    const claimsHeading = document.createElement('h4')
    claimsHeading.append(text('Canonical claim audit'))
    extra.push(claimsHeading, stringList(claims.map((claim) => `${claim.severity} · ${claim.id} · ${claim.verificationStatus}`)))
  }
  card.append(heading, region, independentRecommendationPanel(condition), ownerHeading, ownerStatus, v1FinalConditionConfirmationForm(condition), technicalDetails(entries, extra))
  return card
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

function renderV1PublicationReview() {
  const review = state.snapshot.v1PublicationReview
  const regionCards = Object.entries(review.regions).map(([region, summary]) => detailCard(humanise(region), [
    ['Conditions reviewed', `${summary.conditionsReviewed} / ${summary.totalConditions}`],
    ['Clinical reviewed', `${summary.clinicalReviewed} / ${summary.totalConditions}`],
    ['Evidence reviewed', `${summary.evidenceReviewed} / ${summary.totalConditions}`],
    ['Publication recommendations', `${summary.publicationRecommendationsRecorded} / ${summary.totalConditions}`],
    ['Clinical decisions', JSON.stringify(summary.clinicalDecisions)],
    ['Evidence decisions', JSON.stringify(summary.evidenceDecisions)],
    ['Recommendation outcomes', JSON.stringify(summary.publicationRecommendations)],
    ['Remaining decision blockers', summary.remainingDecisionBlockers],
  ]))
  byId('v1-publication-summary').replaceChildren(...regionCards)
  const categoryCard = detailCard('Automated triage', Object.entries(review.categoryCounts).map(([category, count]) => [humanise(category), count]))
  const remaining = review.humanReviewItemsRemaining
  const canonical = review.canonicalReview
  const canonicalCard = detailCard('Canonical Priority A review', [
    ['Priority A raw tasks', canonical.priorityARawTasks],
    ['Canonical claims', canonical.canonicalClaims],
    ['Duplicates/overlaps collapsed', canonical.duplicatesAndOverlapsCollapsed],
    ['Evidence mapped automatically', canonical.evidenceMappedAutomatically],
    ['Human decisions recorded', canonical.humanReviewed],
    ['Human review remaining', canonical.humanReviewRemaining],
    ['CRITICAL unresolved', canonical.critical],
    ['MAJOR unresolved', canonical.major],
    ['Supporting follow-up', canonical.supporting],
    ['grantsApproval', canonical.grantsApproval],
  ])
  const minimum = review.publicationMinimumEvidence
  const criticalAdoption = minimum.criticalOwnerAdoption
  const majorAdoption = minimum.majorOwnerAdoption
  const minimumCard = detailCard('Publication-minimum evidence', [
    ['Starting canonical claims', minimum.startingCanonicalClaims],
    ['Current canonical claims', minimum.currentCanonicalClaims],
    ['Removed/collapsed by content hardening', minimum.removedOrCollapsedByContentHardening],
    ['Final human evidence decisions', minimum.finalHumanEvidenceDecisionsRemaining],
    ['CRITICAL outcomes', JSON.stringify(minimum.severityOutcomes.CRITICAL ?? {})],
    ['Owner-confirmed Critical recommendations', criticalAdoption?.recommendationCount ?? 0],
    ['Revision-bound resulting files', criticalAdoption?.resultingFileCount ?? 0],
    ['Owner-confirmed Major recommendations', majorAdoption?.recommendationCount ?? 0],
    ['Major resulting files', majorAdoption?.resultingFileCount ?? 0],
    ['MAJOR outcomes', JSON.stringify(minimum.severityOutcomes.MAJOR ?? {})],
    ['grantsApproval', minimum.grantsApproval],
    ['publicationAuthorized', minimum.publicationAuthorized],
  ])
  const finalConfirmation = review.finalConditionConfirmation
  const finalConfirmationCard = detailCard('Final 20-condition confirmation', [
    ['Conditions included', `${finalConfirmation?.conditionsIncluded ?? 0} / 20`],
    ['Valid review lineage', `${finalConfirmation?.validReviewLineage ?? 0} / 20`],
    ['Confirmations recorded', `${finalConfirmation?.confirmationsRecorded ?? 0} / 20`],
    ['Confirmations remaining', finalConfirmation?.confirmationsRemaining ?? 20],
    ['Blank decision fields', finalConfirmation?.blankDecisionFieldsRemaining ?? 80],
    ['Manual browser checks remaining', finalConfirmation?.manualBrowserChecksRemaining ?? 90],
    ['Manual accessibility checks remaining', finalConfirmation?.manualAccessibilityChecksRemaining ?? 13],
    ['grantsApproval', finalConfirmation?.grantsApproval ?? false],
    ['publicationAuthorized', finalConfirmation?.publicationAuthorized ?? false],
  ])
  const remainingCard = detailCard('Human review remaining', [
    ['Condition decision fields', remaining.conditionDecisionFields],
    ['Browser viewport/theme reviews', remaining.browserViewportThemeReviews],
    ['Accessibility checks', remaining.accessibilityChecks],
    ['Total review items', remaining.conditionDecisionFields + remaining.browserViewportThemeReviews + remaining.accessibilityChecks],
  ])
  byId('v1-publication-summary').append(finalConfirmationCard, minimumCard, canonicalCard, categoryCard, remainingCard)
  byId('v1-condition-summary-table').replaceChildren(renderV1ConditionSummaryTable(finalConfirmation?.conditions ?? []))
  const unresolvedDecisions = document.createElement('details')
  const unresolvedSummary = document.createElement('summary')
  unresolvedSummary.append(text(`Technical / audit details — publication-minimum decisions (${minimum.humanDecisions.filter((decision) => !decision.humanDecisionRecorded).length})`))
  unresolvedDecisions.append(unresolvedSummary)
  for (const decision of minimum.humanDecisions.filter((item) => !item.humanDecisionRecorded)) {
    unresolvedDecisions.append(detailCard(`${decision.severity} Â· ${decision.id}`, [
      ['Conditions', decision.conditionIds.join(', ')],
      ['Outcome', decision.outcome],
      ['Why it matters', decision.whyItMatters],
      ['Exact learner wording', decision.learnerClaims.join(' | ')],
      ['Proposed evidence bundle', decision.proposedEvidenceBundle ?? 'Human mapping required'],
      ['Exact source section', decision.exactSourceSections.join('; ') || 'Human mapping required'],
      ['Evidence status', decision.supportStatuses.join(', ')],
      ['Suggested safe wording', decision.suggestedSafeWording.join(' | ') || 'None recorded'],
      ['Affected occurrences', decision.occurrences.map((item) => `${item.sourceFile}:${item.sourceLine}`).join(', ')],
      ['Exact revision', decision.revisionHash],
      ['Evidence options', 'supported / partial / unsupported / alternative evidence needed'],
      ['Wording options', 'accept / accept softened wording / modify / remove'],
    ]))
  }
  const resolvedMappings = document.createElement('details')
  const resolvedSummary = document.createElement('summary')
  resolvedSummary.append(text(`Technical / audit details — resolved mappings (${minimum.resolvedMappings.length})`))
  resolvedMappings.append(resolvedSummary, stringList(minimum.resolvedMappings.map((item) => `${item.severity} Â· ${item.id} Â· ${item.outcome} Â· ${item.sourceBundle ?? 'unmapped'} Â· ${item.revisionHash}`)))
  byId('v1-publication-summary').append(unresolvedDecisions, resolvedMappings)
  const reviewById = new Map(review.conditions.map((condition) => [condition.id, condition]))
  byId('v1-condition-review-list').replaceChildren(...(finalConfirmation?.conditions ?? []).map((condition) => v1ConditionRecommendationCard(condition, reviewById.get(condition.conditionId))))
  const build = review.globalBuild
  byId('v1-global-build').replaceChildren(detailCard('Static learner build', build ? [
    ['Learner routes', build.generatedLearnerRoutes],
    ['Internal links', `${build.validInternalHyperlinks} / ${build.internalHyperlinks}`],
    ['Broken internal links', build.brokenInternalHyperlinks],
    ['Invalid anchors', build.invalidAnchors],
    ['Missing local assets', build.missingLocalAssets],
    ['Private marker findings', build.privateMarkerFindings],
    ['Manual exact-build QA', review.manualExactBuildQa],
    ['Manual accessibility', review.manualAccessibility],
  ] : [['Status', 'Run the deterministic learner export audit to populate this panel.']]))
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

function v1PublicationReviewForm(item) {
  const record = item.currentContent?.v1PublicationReview
  if (!record) return null
  const form = document.createElement('form')
  form.className = 'form-grid review-form'
  const fields = [
    ['clinicalDecision', 'Clinical review', [['acceptable', 'Acceptable for Version 1'], ['changes-required', 'Changes required'], ['blocked', 'Blocked']]],
    ['evidenceDecision', 'Evidence review', [['acceptable-for-v1', 'Acceptable for Version 1'], ['follow-up-non-blocking', 'Non-blocking evidence follow-up'], ['changes-required', 'Changes required'], ['blocked', 'Blocked']]],
    ['publicationRecommendation', 'Publication recommendation', [['recommend-publish', 'Recommend publish'], ['recommend-hold', 'Recommend hold']]],
  ]
  for (const [name, label, choices] of fields) {
    const wrapper = document.createElement('label')
    wrapper.append(text(label))
    const select = document.createElement('select')
    select.name = name
    select.required = true
    select.append(option('', 'Choose a decision'), ...choices.map(([value, title]) => option(value, title)))
    wrapper.append(select)
    form.append(wrapper)
  }
  const noteLabel = document.createElement('label')
  noteLabel.className = 'wide'
  noteLabel.append(text('Reviewer notes'))
  const note = document.createElement('textarea')
  note.name = 'note'
  note.maxLength = 3000
  note.rows = 4
  noteLabel.append(note)
  const declarationLabel = document.createElement('label')
  declarationLabel.className = 'wide review-attestation'
  const declaration = document.createElement('input')
  declaration.type = 'checkbox'
  declaration.name = 'reviewDeclaration'
  declaration.required = true
  declarationLabel.append(declaration, text(`I reviewed exact revision ${item.revisionHash}. These are private recommendations only and do not grant approval or change publication state.`))
  const button = document.createElement('button')
  button.type = 'submit'
  button.textContent = 'Record private Version 1 review'
  form.append(noteLabel, declarationLabel, button)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(form).entries())
    try {
      const recorded = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: 'record-v1-publication-review', targetType: 'content-item', targetId: item.id, exactRevisionKey: item.revisionHash,
        clinicalDecision: values.clinicalDecision, evidenceDecision: values.evidenceDecision, publicationRecommendation: values.publicationRecommendation,
        note: values.note, reviewDeclaration: values.reviewDeclaration === 'on',
      }) })
      setStatus(`Version 1 review recorded. grantsApproval=${recorded.grantsApproval}; publicationAuthorized=${recorded.publicationAuthorized}.`)
      await refresh()
      await openItem(item.id, false)
    } catch (error) { setStatus(error.message, true) }
  })
  return form
}

function v1FinalConditionConfirmationForm(item) {
  const record = item.currentContent?.finalConditionConfirmation ?? item
  const ownerDecision = item.ownerDecision ?? null
  if (!record) return null
  const form = document.createElement('form')
  form.className = 'form-grid review-form'
  const fields = [
    ['clinicalAccuracyDecision', 'Clinical accuracy', [['acceptable-for-v1', '✓ Accept V1'], ['changes-required', '⚠ Changes required'], ['blocked', '⛔ Blocked']]],
    ['evidenceSufficiencyDecision', 'Evidence sufficiency', [['acceptable-for-v1', '✓ Accept V1'], ['changes-required', '⚠ Changes required'], ['blocked', '⛔ Blocked']]],
    ['clinicalCompletenessDecision', 'Clinical completeness', [['acceptable-for-v1', '✓ Accept V1'], ['future-expansion-non-blocking', '↗ Future expansion'], ['changes-required', '⚠ Changes required'], ['blocked', '⛔ Blocked']]],
    ['publicationRecommendation', 'Publication recommendation', [['recommend-publish', '✓ Recommend publish'], ['recommend-hold', '⏸ Recommend hold']]],
  ]
  for (const [name, label, choices] of fields) {
    const wrapper = document.createElement('label')
    wrapper.append(text(label))
    const select = document.createElement('select')
    select.name = name
    select.required = true
    select.append(option('', 'Choose a decision'), ...choices.map(([value, title]) => option(value, title)))
    const ownerField = name.replace(/Decision$/, '')
    if (ownerDecision?.[ownerField]) select.value = ownerDecision[ownerField]
    wrapper.append(select)
    form.append(wrapper)
  }
  const noteLabel = document.createElement('label')
  noteLabel.className = 'wide'
  noteLabel.append(text('Owner note'))
  const note = document.createElement('textarea')
  note.name = 'note'
  note.maxLength = 3000
  note.rows = 4
  note.value = ownerDecision?.note ?? ''
  noteLabel.append(note)
  const declarationLabel = document.createElement('label')
  declarationLabel.className = 'wide review-attestation'
  const declaration = document.createElement('input')
  declaration.type = 'checkbox'
  declaration.name = 'reviewDeclaration'
  declaration.required = true
  declarationLabel.append(declaration, text('I reviewed the exact governed condition revision and its independent recommendation. This records an owner decision only and does not authorise publication.'))
  const button = document.createElement('button')
  button.type = 'submit'
  button.textContent = ownerDecision ? 'Record updated owner decision' : 'Record owner decision'
  form.append(noteLabel, declarationLabel, button)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(form).entries())
    try {
      const recorded = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: 'record-v1-final-condition-confirmation', targetType: 'v1-final-condition', targetId: record.conditionId,
        exactRevisionKey: record.exactCurrentRevisionHash, confirmationRevisionKey: record.confirmationRevisionKey,
        clinicalAccuracyDecision: values.clinicalAccuracyDecision, evidenceSufficiencyDecision: values.evidenceSufficiencyDecision,
        clinicalCompletenessDecision: values.clinicalCompletenessDecision, publicationRecommendation: values.publicationRecommendation,
        note: values.note, reviewDeclaration: values.reviewDeclaration === 'on',
      }) })
      setStatus(`Final condition confirmation recorded. grantsApproval=${recorded.grantsApproval}; publicationAuthorized=${recorded.publicationAuthorized}.`)
      await refresh()
      await openItem(item.id, false)
    } catch (error) { setStatus(error.message, true) }
  })
  return form
}

function v1CanonicalClaimReviewForm(item) {
  const claims = item.currentContent?.v1PublicationReview?.clinicalEvidenceAudit?.canonicalClaims ?? []
  if (!claims.length) return null
  const form = document.createElement('form')
  form.className = 'form-grid review-form'
  const claimLabel = document.createElement('label')
  claimLabel.className = 'wide'
  claimLabel.append(text('Canonical claim'))
  const claimSelect = document.createElement('select')
  claimSelect.name = 'canonicalClaimId'
  claimSelect.required = true
  claimSelect.append(option('', 'Choose a revision-bound claim'), ...claims.map((claim) => option(claim.id, `${claim.severity} · ${claim.verificationStatus} · ${claim.canonicalClaim}`)))
  claimLabel.append(claimSelect)
  const evidenceLabel = document.createElement('label')
  evidenceLabel.append(text('Evidence relationship'))
  const evidence = document.createElement('select')
  evidence.name = 'evidenceRelationshipDecision'
  evidence.required = true
  evidence.append(option('', 'Choose a decision'), option('confirm-supported', 'Confirm supported'), option('partial-support', 'Partial support'), option('unsupported', 'Unsupported'), option('needs-alternative-evidence', 'Needs alternative evidence'))
  evidenceLabel.append(evidence)
  const wordingLabel = document.createElement('label')
  wordingLabel.append(text('Clinical wording'))
  const wording = document.createElement('select')
  wording.name = 'clinicalWordingDecision'
  wording.required = true
  wording.append(option('', 'Choose a decision'), option('accept-as-written', 'Accept as written'), option('soften-wording', 'Soften wording'), option('change-required', 'Change required'), option('remove', 'Remove'))
  wordingLabel.append(wording)
  const noteLabel = document.createElement('label')
  noteLabel.className = 'wide'
  noteLabel.append(text('Reviewer rationale'))
  const note = document.createElement('textarea')
  note.name = 'note'
  note.maxLength = 3000
  note.rows = 4
  noteLabel.append(note)
  const declarationLabel = document.createElement('label')
  declarationLabel.className = 'wide review-attestation'
  const declaration = document.createElement('input')
  declaration.type = 'checkbox'
  declaration.name = 'reviewDeclaration'
  declaration.required = true
  declarationLabel.append(declaration, text('I reviewed the selected canonical claim at its exact revision. This records a private recommendation only and grants no approval or publication authority.'))
  const button = document.createElement('button')
  button.type = 'submit'
  button.textContent = 'Record private claim review'
  form.append(claimLabel, evidenceLabel, wordingLabel, noteLabel, declarationLabel, button)
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(form).entries())
    const claim = claims.find((candidate) => candidate.id === values.canonicalClaimId)
    try {
      const recorded = await api('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: 'record-v1-claim-review', targetType: 'canonical-claim', targetId: claim.id, exactRevisionKey: claim.revisionHash,
        evidenceRelationshipDecision: values.evidenceRelationshipDecision, clinicalWordingDecision: values.clinicalWordingDecision,
        note: values.note, reviewDeclaration: values.reviewDeclaration === 'on',
      }) })
      setStatus(`Canonical claim review recorded. grantsApproval=${recorded.grantsApproval}; publicationAuthorized=${recorded.publicationAuthorized}.`)
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
  const finalCondition = item.currentContent?.finalConditionConfirmation
  if (finalCondition) {
    const latestOwnerAction = [...(item.privateReviewActions ?? [])]
      .filter((action) => action.type === 'record-v1-final-condition-confirmation' && action.exactRevisionKey === finalCondition.exactCurrentRevisionHash && action.confirmationRevisionKey === finalCondition.confirmationRevisionKey)
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
      .at(-1)
    const ownerDecision = latestOwnerAction ? {
      clinicalAccuracy: latestOwnerAction.clinicalAccuracyDecision,
      evidenceSufficiency: latestOwnerAction.evidenceSufficiencyDecision,
      clinicalCompleteness: latestOwnerAction.clinicalCompletenessDecision,
      publicationRecommendation: latestOwnerAction.publicationRecommendation,
      note: latestOwnerAction.note,
    } : null
    const conditionView = {
      ...finalCondition,
      independentRecommendation: item.currentContent.independentFinalRecommendation,
      independentRecommendationReason: item.currentContent.independentFinalRecommendation?.reviewerNote ?? 'Independent recommendation record is not available for this exact revision.',
      ownerDecision,
    }
    const region = document.createElement('p')
    region.className = 'condition-region'
    region.append(text(humanise(item.region)))
    const ownerHeading = document.createElement('h4')
    ownerHeading.append(text('Owner decision'))
    const ownerStatus = document.createElement('p')
    ownerStatus.className = 'owner-status'
    ownerStatus.append(text(ownerDecision ? 'Decision recorded for this exact revision. No approval or publication authority was granted.' : 'No owner decision has been recorded for this exact revision.'))
    const claims = item.currentContent?.v1PublicationReview?.clinicalEvidenceAudit?.canonicalClaims ?? []
    const current = document.createElement('pre')
    current.className = 'content-preview'
    current.append(text(JSON.stringify(item.currentContent, null, 2)))
    const technical = technicalDetails([
      ['Exact condition revision SHA', finalCondition.exactCurrentRevisionHash],
      ['Confirmation revision key', finalCondition.confirmationRevisionKey],
      ['Critical adoption lineage', JSON.stringify(finalCondition.lineage?.criticalAdoption ?? null)],
      ['Major adoption lineage', JSON.stringify(finalCondition.lineage?.majorAdoption ?? null)],
      ['Canonical IDs', [item.id, ...claims.map((claim) => claim.id)].join(', ')],
      ['Source/revision identifiers', [finalCondition.sourceFile, ...claims.map((claim) => `${claim.id}:${claim.revisionHash}`)].filter(Boolean).join(' · ')],
    ], [
      section('Current governed content (read-only)', current),
      section('Authoritative source links', stringList(item.sourceLinks)),
      section('Private review action', reviewForm(item)),
      section('Complete review for this exact revision', reviewCompletionForm(item)),
    ])
    container.append(title, region, independentRecommendationPanel(conditionView), ownerHeading, ownerStatus, v1FinalConditionConfirmationForm(conditionView), technical)
    byId('item-detail').replaceChildren(container)
    return
  }
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
  const v1Form = v1PublicationReviewForm(item)
  if (v1Form) container.append(section('Version 1 human review decisions', v1Form))
  const canonicalClaimForm = v1CanonicalClaimReviewForm(item)
  if (canonicalClaimForm) container.append(section('Canonical Priority A claim decision', canonicalClaimForm))
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
  renderV1PublicationReview()
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
