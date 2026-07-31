import {
  branchingCaseModelSchema,
  type BranchingCaseModel,
} from './schemas'

export interface BranchingValidationResult {
  valid: boolean
  findings: string[]
  reachableNodeIds: string[]
}

export function validateBranchingModel(input: unknown): BranchingValidationResult {
  const parsed = branchingCaseModelSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      findings: parsed.error.issues.map((issue) =>
        `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
      reachableNodeIds: [],
    }
  }

  const model = parsed.data
  const findings: string[] = []
  const byId = new Map(model.nodes.map((node) => [node.id, node]))
  if (byId.size !== model.nodes.length) findings.push('node IDs must be unique')
  if (!byId.has(model.startNodeId)) findings.push(`start node is missing: ${model.startNodeId}`)

  const terminalIds = new Set(model.terminalNodeIds)
  for (const terminalId of terminalIds) {
    const terminal = byId.get(terminalId)
    if (!terminal) findings.push(`terminal node is missing: ${terminalId}`)
    else if (terminal.choices.length > 0) findings.push(`terminal node has outgoing choices: ${terminalId}`)
  }

  for (const node of model.nodes) {
    if (node.diagnosisBearing && !['diagnosis-reveal', 'post-reveal', 'internal-only'].includes(node.revealPolicy)) {
      findings.push(`diagnosis-bearing node crosses the initial boundary: ${node.id}`)
    }
    if (!terminalIds.has(node.id) && node.choices.length === 0) {
      findings.push(`non-terminal node is a dead end: ${node.id}`)
    }
    const choiceIds = new Set<string>()
    for (const choice of node.choices) {
      if (choiceIds.has(choice.id)) findings.push(`duplicate choice ID ${choice.id} in ${node.id}`)
      choiceIds.add(choice.id)
      if (!byId.has(choice.nextNodeId)) findings.push(`choice target is missing: ${node.id} -> ${choice.nextNodeId}`)
      if (choice.feedbackId) {
        const feedback = byId.get(choice.feedbackId)
        if (!feedback) findings.push(`feedback target is missing: ${choice.feedbackId}`)
        else if (feedback.kind !== 'feedback') findings.push(`feedback target is not a feedback node: ${choice.feedbackId}`)
      }
    }
  }

  const reachable = reachableNodes(model, byId)
  for (const node of model.nodes) {
    if (!reachable.has(node.id)) findings.push(`unreachable node: ${node.id}`)
  }

  const allowedCycles = new Set(
    model.allowedCycleEdges.map((edge) => `${edge.fromNodeId}->${edge.toNodeId}`),
  )
  for (const edge of findCycleEdges(model, byId)) {
    if (!allowedCycles.has(edge)) findings.push(`undeclared cycle edge: ${edge}`)
  }
  for (const edge of allowedCycles) {
    if (!findCycleEdges(model, byId).has(edge)) findings.push(`declared cycle edge is not cyclic: ${edge}`)
  }

  return {
    valid: findings.length === 0,
    findings: [...new Set(findings)].sort(),
    reachableNodeIds: [...reachable].sort(),
  }
}

export function createInitialBranchingProjection(input: unknown) {
  const model = parseValid(input)
  assertPublic(model)
  return {
    schemaVersion: model.schemaVersion,
    id: model.id,
    title: model.title,
    startNodeId: model.startNodeId,
    terminalNodeIds: model.terminalNodeIds,
    nodes: model.nodes
      .filter((node) =>
        !node.diagnosisBearing
        && node.revealPolicy !== 'diagnosis-reveal'
        && node.revealPolicy !== 'post-reveal'
        && node.revealPolicy !== 'internal-only',
      )
      .map(projectNode),
  }
}

export function createRevealedBranchingProjection(input: unknown) {
  const model = parseValid(input)
  assertPublic(model)
  return {
    schemaVersion: model.schemaVersion,
    id: model.id,
    title: model.title,
    startNodeId: model.startNodeId,
    terminalNodeIds: model.terminalNodeIds,
    nodes: model.nodes
      .filter((node) => node.revealPolicy !== 'internal-only')
      .map(projectNode),
  }
}

function parseValid(input: unknown): BranchingCaseModel {
  const parsed = branchingCaseModelSchema.parse(input)
  const validation = validateBranchingModel(parsed)
  if (!validation.valid) throw new Error(validation.findings.join('\n'))
  return parsed
}

function assertPublic(model: BranchingCaseModel) {
  if (!model.publicEligibility || model.status !== 'published' || model.reviewState !== 'approved') {
    throw new Error('branching model is not eligible for public projection')
  }
}

function projectNode(node: BranchingCaseModel['nodes'][number]) {
  return {
    id: node.id,
    kind: node.kind,
    prompt: node.prompt,
    revealPolicy: node.revealPolicy,
    choices: node.choices.map(({ id, label, nextNodeId, feedbackId }) => ({
      id,
      label,
      nextNodeId,
      feedbackId,
    })),
  }
}

function reachableNodes(
  model: BranchingCaseModel,
  byId: Map<string, BranchingCaseModel['nodes'][number]>,
) {
  const reachable = new Set<string>()
  const queue = [model.startNodeId]
  while (queue.length) {
    const id = queue.shift() as string
    if (reachable.has(id)) continue
    reachable.add(id)
    const node = byId.get(id)
    if (!node) continue
    for (const choice of node.choices) {
      queue.push(choice.nextNodeId)
      if (choice.feedbackId) queue.push(choice.feedbackId)
    }
  }
  return reachable
}

function findCycleEdges(
  model: BranchingCaseModel,
  byId: Map<string, BranchingCaseModel['nodes'][number]>,
) {
  const cycleEdges = new Set<string>()
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    visiting.add(id)
    const node = byId.get(id)
    for (const choice of node?.choices ?? []) {
      const targets = [choice.nextNodeId, choice.feedbackId].filter(Boolean) as string[]
      for (const target of targets) {
        const edge = `${id}->${target}`
        if (visiting.has(target)) cycleEdges.add(edge)
        else visit(target)
      }
    }
    visiting.delete(id)
    visited.add(id)
  }

  visit(model.startNodeId)
  return cycleEdges
}
