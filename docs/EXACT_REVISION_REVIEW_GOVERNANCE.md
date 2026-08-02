# Exact-revision review governance

## Rule

Human review applies to one entity identifier, revision, and SHA-256 content hash. Approval of an earlier or different hash never transfers. A mismatched approval becomes stale and publication eligibility fails closed.

## Covered targets

The Version 1 ledger includes clinical modules, patient truth records, compatibility rules, provider-free patient/tutor transcripts, MCQ slots, movement records, 3D anatomy slots, evidence metadata, and the learner visual system.

## Decisions and queues

Each target declares the review kinds it requires. All Version 1 decisions begin as `pending`, with no inferred reviewer, date, or approval. Review queues and focused packet indexes are derived from the ledger and are not independent sources of truth.

## Publication

A target is eligible only when every required decision is approved against the current exact-revision key. Source, clinical, safety, licensing, anatomy, accessibility, and publication approvals remain distinct wherever applicable.

## Human boundary

The generated files prepare work for reviewers; they do not claim review occurred. Reviewer identity, decision, rationale, and decision time must be supplied by the accountable human workflow.
