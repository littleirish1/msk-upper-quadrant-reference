# Branching Reasoning Model v1

## Model

The authoritative private model is `branchingCaseModelSchema`. It supports:

- presentation, information-request, hypothesis, finding, decision, feedback,
  caution, and outcome nodes;
- predefined learner choices;
- path-specific feedback;
- explicit terminal nodes;
- declared cycles with rationale;
- diagnosis-bearing node classification;
- public eligibility and review state;
- disabled AI free text and no network requirement.

Validation rejects:

- duplicate IDs;
- missing starts, targets, feedback nodes, or terminals;
- dead ends outside declared terminals;
- unreachable nodes;
- undeclared cycles;
- cycle declarations that are not used;
- diagnosis-bearing nodes in initial or ordinary learner-action delivery;
- public models lacking exact approval.

## Projection Boundary

The initial projection excludes diagnosis-bearing, diagnosis-reveal,
post-reveal, and internal-only nodes. The revealed projection still excludes
internal-only nodes.

Static progressive disclosure is pedagogical, not confidential storage. A
future public clinical branch still requires the same delayed-payload and
diagnosis-leak checks as a guided case.

## Learner Component

`BranchingReasoningEngine` consumes a public-safe data model. The current
learner example is non-diagnostic and contains no clinical recommendation.
Responses are predefined choices; no free text is transmitted, stored, or sent
to AI.
