export interface ConversationTruthItem {
  id: string
  domain: string
  value: string | null
  state: 'positive' | 'negative' | 'unknown-to-patient' | 'unavailable-in-case' | 'not-yet-assessed'
  retrievalIntents: string[]
  volunteered: boolean
}

export interface ConversationProjection {
  schemaVersion: 1
  caseId: string
  publicSlug: string
  truthHash: string
  openingTruthId: string
  items: ConversationTruthItem[]
}

export interface PatientAuditEvent {
  turn: number
  intentId: string
  retrievedTruthIds: string[]
  templateId: string
  adapterUsed: boolean
  adapterValidated: boolean
}

export interface PatientSession {
  readonly caseId: string
  readonly truthHash: string
  readonly projection: ConversationProjection
  disclosedTruthIds: Set<string>
  audit: PatientAuditEvent[]
}

export interface AdapterOutput {
  intentId: string
  paraphrase?: string
}

const intentPatterns: Array<{ intentId: string; patterns: RegExp[] }> = [
  { intentId: 'presenting-complaint', patterns: [/what brings you/i, /tell me (?:more|what happened)/i, /presenting complaint/i, /why are you here/i] },
  { intentId: 'symptom-location', patterns: [/where (?:is|does).*\b(?:pain|hurt|symptom)/i, /point to (?:the|your) (?:pain|symptom)/i, /pain location/i] },
  { intentId: 'laterality', patterns: [/which side/i, /left or right/i, /what side/i] },
  { intentId: 'distribution', patterns: [/does (?:it|the pain) (?:spread|travel|radiate)/i, /where.*spread/i, /distribution/i] },
  { intentId: 'quality', patterns: [/what does (?:it|the pain) feel like/i, /describe (?:it|the pain)/i, /pain quality/i] },
  { intentId: 'intensity', patterns: [/how (?:bad|severe|strong)/i, /out of ten/i, /pain score/i] },
  { intentId: 'irritability', patterns: [/how easily.*provok/i, /how long.*settle/i, /irritab/i] },
  { intentId: 'onset', patterns: [/how did (?:it|this) start/i, /sudden or gradual/i, /onset/i] },
  { intentId: 'mechanism', patterns: [/injur|trauma|accident|fall|collision|mechanism/i] },
  { intentId: 'progression', patterns: [/getting (?:better|worse)/i, /chang(?:e|ed|ing) over time/i, /progress/i] },
  { intentId: 'twenty-four-hour-pattern', patterns: [/night|sleep|morning|during the day|24.hour/i] },
  { intentId: 'medication', patterns: [/medicat(?:ion|ons|on)/i, /\bmeds?\b/i, /tablet/i] },
  { intentId: 'medical-history', patterns: [/medical history/i, /health condition/i, /past history/i] },
  { intentId: 'red-flag-history', patterns: [/red flag/i, /weight loss/i, /fever/i, /night sweat/i] },
  { intentId: 'bladder-bowel-saddle', patterns: [/bladder/i, /bowel/i, /saddle/i] },
  { intentId: 'neurological-finding', patterns: [/numb|tingl|pins and needles|weakness in (?:the|your) arm|neck symptom/i] },
  { intentId: 'function', patterns: [/function/i, /daily activit/i, /work/i, /sport/i] },
  { intentId: 'aggravating-factor', patterns: [/worse/i, /aggravat/i, /bring.*on/i] },
  { intentId: 'easing-factor', patterns: [/better/i, /eas(?:e|ing)/i, /relie/i] },
  { intentId: 'duration', patterns: [/how long/i, /duration/i, /when.*start/i] },
  { intentId: 'objective-request', patterns: [/examin/i, /objective/i, /special test/i, /test result/i] },
]

const injectionPattern = /ignore (?:all |the )?(?:previous|above)|system prompt|developer message|reveal hidden|print.*truth|jailbreak/i
const diagnosisPattern = /diagnos|what (?:is|do) (?:i|you) have|final answer|linked condition/i

export function createPatientSession(projection: ConversationProjection): PatientSession {
  return {
    caseId: projection.caseId,
    truthHash: projection.truthHash,
    projection: structuredClone(projection),
    disclosedTruthIds: new Set<string>(),
    audit: [],
  }
}

export function validateAdapterOutput(output: unknown, allowedIntents: Set<string>): AdapterOutput | null {
  if (!output || typeof output !== 'object') return null
  const value = output as Record<string, unknown>
  if (typeof value.intentId !== 'string' || !allowedIntents.has(value.intentId)) return null
  if (value.paraphrase !== undefined && typeof value.paraphrase !== 'string') return null
  if (typeof value.paraphrase === 'string' && (injectionPattern.test(value.paraphrase) || diagnosisPattern.test(value.paraphrase))) return null
  if (Object.keys(value).some((key) => !['intentId', 'paraphrase'].includes(key))) return null
  return { intentId: value.intentId, ...(typeof value.paraphrase === 'string' ? { paraphrase: value.paraphrase } : {}) }
}

export function answerPatientQuestion(
  session: PatientSession,
  question: string,
  adapterOutput?: unknown,
): { response: string; intentId: string; retrievedTruthIds: string[]; clarification: boolean } {
  const clean = question.trim()
  const turn = session.audit.length + 1
  if (!clean || clean.length < 3) return record('clarify-vague', [], 'patient.clarify-vague', 'Could you ask me one specific question?', true, false, false)
  if (injectionPattern.test(clean)) return record('unsafe-request', [], 'patient.boundary', 'I can only answer questions about the information available in this case.', false, false, false)
  if (diagnosisPattern.test(clean)) return record('diagnosis-request', [], 'patient.diagnosis-boundary', "I don't know the diagnosis. Please ask me about my experience or history.", false, false, false)
  if ((clean.match(/\?/g)?.length ?? 0) > 1 || /\band\b.+\band\b/i.test(clean)) {
    return record('clarify-multiple', [], 'patient.clarify-multiple', 'Could you ask those one at a time?', true, false, false)
  }

  const deterministic = intentPatterns.find((entry) => entry.patterns.some((pattern) => pattern.test(clean)))?.intentId
  const allowed = new Set(session.projection.items.flatMap((item) => item.retrievalIntents).concat(intentPatterns.map((item) => item.intentId)))
  const adapter = deterministic ? null : validateAdapterOutput(adapterOutput, allowed)
  const intentId = deterministic ?? adapter?.intentId
  if (!intentId) return record('clarify-unsupported', [], 'patient.clarify-unsupported', "I'm not sure which part of my history you mean. Could you ask more specifically?", true, Boolean(adapterOutput), false)

  const items = session.projection.items.filter((item) => item.retrievalIntents.includes(intentId) || item.domain === intentId)
  const factual = items.filter((item) => item.value !== null && ['positive', 'negative'].includes(item.state))
  if (factual.length === 0) {
    return record(intentId, [], 'patient.unavailable', "That information isn't available in this case.", false, Boolean(adapterOutput), Boolean(adapter))
  }
  const retrieved = factual.map((item) => item.id).sort()
  for (const id of retrieved) session.disclosedTruthIds.add(id)
  return record(intentId, retrieved, 'patient.truth-verbatim', factual.map((item) => item.value).join(' '), false, Boolean(adapterOutput), Boolean(adapter))

  function record(intentId: string, retrievedTruthIds: string[], templateId: string, response: string, clarification: boolean, adapterUsed: boolean, adapterValidated: boolean) {
    session.audit.push({ turn, intentId, retrievedTruthIds, templateId, adapterUsed, adapterValidated })
    return { response, intentId, retrievedTruthIds, clarification }
  }
}

export interface TutorReview {
  exploredDomains: string[]
  omissions: string[]
  clarificationQuality: 'not-assessed' | 'developing' | 'focused'
  optionalHint: string | null
  checkpointFeedback: string
  patientTruthChanged: false
  patientImpersonation: false
}

export function reviewConversation(
  audit: PatientAuditEvent[],
  requiredDomains: string[] = ['presenting-complaint', 'red-flag-history', 'function', 'objective-request'],
): TutorReview {
  const explored = [...new Set(audit.map((event) => event.intentId).filter((intent) => !intent.startsWith('clarify-') && !intent.endsWith('-request')))].sort()
  const omissions = requiredDomains.filter((domain) => !explored.includes(domain)).sort()
  const clarificationTurns = audit.filter((event) => event.intentId.startsWith('clarify-')).length
  return {
    exploredDomains: explored,
    omissions,
    clarificationQuality: audit.length === 0 ? 'not-assessed' : clarificationTurns > Math.floor(audit.length / 2) ? 'developing' : 'focused',
    optionalHint: omissions.length ? `Consider whether you have explored the ${omissions[0].replace(/-/g, ' ')} domain.` : null,
    checkpointFeedback: omissions.length
      ? 'Some reasoning domains remain unexplored. This is process feedback, not a diagnosis or model answer.'
      : 'The configured reasoning domains have been explored. Review the governed case stages before reveal.',
    patientTruthChanged: false,
    patientImpersonation: false,
  }
}
