# AI Knowledge Manager Architecture

## Boundary

The knowledge manager is private, local/back-office tooling under `ai-manager`. It reads the repository through an operator-supplied `PROJECT_PATH`; it is never imported by the public Next.js app, bundled for the browser, copied into `out`, or exposed through Netlify.

The public site remains static. No provider, database, vector store, API, or network service is required for validation. Future adapters for Trust-approved Microsoft Copilot, local tools, or other approved providers remain optional and disabled by default.

## Operating Contract

- Human review precedes every content change and clinical publication.
- Evidence and provenance must travel with every proposal.
- Generated work stays outside public content until accepted.
- Operators inspect a Git diff before commit.
- The manager cannot commit, push, publish, or self-approve.
- Clinical publication still passes schema, source, secret, hygiene, route, diagnosis, reveal, link, and preflight gates.
- No patient-identifiable data or private source path is recorded in tracked files.

## Local Workflow

1. Intake a manifest and private source locally.
2. Hash exact source bytes.
3. Record copyright/licence and identifiable-material status.
4. Extract text locally when an approved tool exists.
5. Classify evidence and map claims to sources.
6. Compare against existing content IDs.
7. Produce a draft proposal outside public content.
8. Verify citations and limitations.
9. Obtain clinical review.
10. Generate and inspect a final diff.
11. Commit only through the normal Git workflow.
12. Archive the local source and decision record under approved retention rules.

## Provider Strategy

The preferred institutional exploration remains the Trust-approved Microsoft environment, subject to IG, IT, security, clinical-safety, procurement, licence-scope, retention, and data-location approval. Local tools such as Codex, Aider, OpenClaw, Odysseus, or Ollama may support approved back-office work, but provider choice does not alter the publication gate.

## Roles And Separation Of Duties

- Intake agent: validates manifests, hashes, and source restrictions.
- Evidence agent: extracts claims with source locations and limitations.
- Citation agent: verifies title, identifier, and claim-to-source consistency.
- Content-drafting agent: proposes changes but cannot write public content directly.
- QA agent: runs deterministic checks and compares the proposal with contracts.
- Reviewer assistant: assembles evidence for a human reviewer.
- Human clinician/reviewer: accepts, rejects, or requests revision.

No agent may approve its own clinical output.

## Future Retrieval

Start with deterministic metadata and lexical search. Chroma, pgvector, or other vector options remain future choices after local governance and data-flow approval. Public builds must never depend on those services.
