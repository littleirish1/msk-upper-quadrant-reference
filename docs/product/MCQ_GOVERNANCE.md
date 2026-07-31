# MCQ Governance

## Version 1 Contract

A governed single-best-answer question records:

- stable ID;
- region and related content IDs;
- learning objectives;
- prompt;
- at least three options;
- exactly one best answer;
- an explanation for every option;
- difficulty;
- evidence and reference IDs;
- clinical, evidence, and source-clearance states;
- lifecycle and publication eligibility;
- answer reveal after submission;
- prohibition on competence claims.

The initial question projection omits correctness and explanations. The answer
projection is separate and is unavailable unless the exact question revision is
publication eligible.

## Twenty-Question Baseline

The repository now contains 20 governed authoring slots, not 20 completed
clinical questions. This preserves the intended target without fabricating
questions, distractors, explanations, sources, or approvals.

One private non-clinical contract fixture validates the schema and projection
logic. Public question count remains zero.

## Publication Gate

A question cannot become public unless:

- lifecycle is `published`;
- clinical review is approved;
- evidence review is approved;
- source clearance permits public use;
- schema and answer-leak checks pass;
- an independent review and human publication decision are complete.

Technical scoring is deterministic. It must not be represented as proof of
clinical competence or formal accreditation.
