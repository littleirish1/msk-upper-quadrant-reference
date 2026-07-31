import {
  BranchingReasoningEngine,
  type LearnerBranchNode,
} from './BranchingReasoningEngine'

export function DecisionTree() {
  return (
    <BranchingReasoningEngine
      title="Decision-tree framework"
      description="A non-diagnostic demonstration of optional information requests, hypothesis revision, staged findings, and path-linked feedback."
      startNodeId="start"
      nodes={publicProcessBranch}
    />
  )
}

const publicProcessBranch: LearnerBranchNode[] = [
  {
    id: 'start',
    type: 'decision',
    text: 'What should you do first in a structured reasoning workflow?',
    options: [
      { id: 'request', label: 'Request authored information', nextNodeId: 'information' },
      { id: 'hypothesis', label: 'Record an initial hypothesis', nextNodeId: 'hypothesis' },
    ],
  },
  {
    id: 'information',
    type: 'information',
    text: 'Request only information that the reviewed case author has made available.',
    options: [
      { id: 'update', label: 'Update the hypothesis', nextNodeId: 'hypothesis' },
    ],
  },
  {
    id: 'hypothesis',
    type: 'decision',
    text: 'Have you compared support, contradiction, and cannot-miss considerations?',
    options: [
      { id: 'more', label: 'Request different information', nextNodeId: 'information' },
      {
        id: 'findings',
        label: 'Plan the next assessment step',
        nextNodeId: 'findings',
        feedback: 'The selected path keeps information requests connected to a decision.',
      },
    ],
  },
  {
    id: 'findings',
    type: 'information',
    text: 'A governed case can reveal authored findings here after an explicit learner action.',
    options: [
      { id: 'decision', label: 'Make a proportionate decision', nextNodeId: 'decision' },
    ],
  },
  {
    id: 'decision',
    type: 'decision',
    text: 'Would you proceed, seek more information, or use a reviewed escalation pathway?',
    options: [
      {
        id: 'review',
        label: 'Review the reasoning process',
        nextNodeId: 'complete',
        feedback: 'Feedback describes the chosen process and does not generate a diagnosis or competence score.',
      },
      { id: 'revisit', label: 'Revisit the hypothesis', nextNodeId: 'hypothesis' },
    ],
  },
  {
    id: 'complete',
    type: 'outcome',
    text: 'Reflect on how the information changed the reasoning path.',
    options: [],
  },
]
