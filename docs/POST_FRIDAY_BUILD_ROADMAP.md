# Post-Friday Build Roadmap

This roadmap keeps the Friday demo stable while staging the next architecture work for a broader whole-body physiotherapy clinical reasoning platform.

## Trust-approved AI pathway: Microsoft Copilot-first option

The Trust currently has an agreed Microsoft Copilot licence. Post-demo AI planning should therefore explore Microsoft Copilot, Copilot Studio, and the Trust-approved Microsoft 365 environment before assuming direct OpenAI, LangChain, or external public chatbot integration.

This is a planning preference, not implementation approval. Any AI integration needs local information governance, IT/security, clinical safety, and procurement approval.

Recommended sequence:

1. Keep the public Netlify learner site static and reviewed.
2. Keep `ai-manager` local/private for source and draft workflows.
3. Document Copilot governance questions.
4. If permitted, use Copilot manually to help draft one reviewed case script from non-sensitive teaching content.
5. Explore Copilot Studio only if custom agents and approved source grounding are allowed.
6. Consider external RAG/vector providers only if the Copilot pathway cannot meet requirements and Trust approval exists.

Decision matrix:

| Pathway | Data risk | Complexity | Governance burden | Demo value | Scalability | Timing |
| --- | --- | --- | --- | --- | --- | --- |
| Static reviewed content | Low | Low | Low | High | Medium | Now |
| Local-only `ai-manager` | Low to medium | Medium | Medium | Medium | Medium | Post-demo |
| Microsoft Copilot / Copilot Studio | Medium | Medium | Medium to high | High | High if approved | Preferred institutional exploration |
| External OpenAI/LangChain/RAG | Medium to high | High | High | Medium | High | Later, only if approved |
| Institution-hosted private RAG | Medium | High | High | Medium | High | Later institutional phase |

## Sprint 1: Demo Feedback, UI Bugs, and Lint

Goal: stabilize the current public demo after real user feedback.

Definition of done:

- Public `/demo`, `/cases`, condition pages, and guided cases remain usable.
- Draft and archived cases remain hidden from public routes.
- Known lint warnings are resolved or documented.
- `npm run preflight` passes.
- No clinical case body content is changed without review.

## Sprint 2: Copilot Governance Questions And Local Text Index, No Embeddings

Goal: document the Trust Microsoft Copilot/Copilot Studio governance questions and build a local keyword and metadata search index for source discovery.

Definition of done:

- Trust licence scope, approved data locations, custom agent availability, retention/logging, and review responsibilities are listed for IG/IT discussion.
- Local script scans case MDX, source registry records, legacy stations, and reviewed evidence notes.
- Index is deterministic and inspectable.
- Search runs inside `ai-manager` only.
- No vector database, embeddings, API calls, or public routes are added.

## Sprint 3: PowerPoint Text Extraction Prototype

Goal: prototype local extraction of teaching slide text.

Definition of done:

- Raw PowerPoint files stay under `content/imports/powerpoints/raw`.
- Extracted text is saved under `content/imports/powerpoints/extracted`.
- Each extracted deck has source metadata and draft review state.
- No extracted content is published automatically.

## Sprint 4: Paper and PDF Extraction Prototype

Goal: prototype safe paper metadata and text extraction.

Definition of done:

- Raw papers stay under `content/imports/papers/raw` only when licensing permits.
- Extracted metadata or reviewer notes stay under `content/imports/papers/extracted`.
- Reviewed summaries can be promoted to evidence notes.
- OCR and broad full-text extraction remain out of scope until explicitly approved.

## Sprint 5: Copilot Studio Exploration Or Vector Search Prototype Inside ai-manager Only

Goal: explore Copilot Studio first if Trust approval exists; otherwise test whether local vector search improves source discovery inside `ai-manager`.

Definition of done:

- Copilot Studio custom agent permissions, approved source grounding, and review/audit requirements are confirmed before any Copilot implementation.
- Prototype runs only under `ai-manager`.
- Retrieval results cite `sourceId`, `sourcePath`, and `chunkId`.
- Vector store choice is documented before dependencies are added.
- Public build and Netlify deployment do not depend on vector services.

## Sprint 6: Source-Grounded Case Drafting

Goal: generate draft guided cases from selected reviewed or clearly labelled source material.

Definition of done:

- Generated cases are saved as drafts with `reviewStatus: "needs-review"`.
- Source metadata is preserved.
- Drafts are excluded from public route generation.
- Human review checklist is required before publishing.

## Sprint 7: Source-Grounded Teaching Deck Drafting

Goal: create draft teaching decks from cases, evidence notes, and reviewed source excerpts.

Definition of done:

- Draft deck content is source-linked.
- Reviewer can inspect source support.
- Generated decks are not treated as final teaching material until reviewed.
- Templates remain reusable across body regions and presentation types.

## Sprint 8: Review Queue and GitHub PR Publishing

Goal: make review and publishing auditable.

Definition of done:

- Local/admin review queue tracks draft, needs-review, reviewed, archived, and published states.
- Publishing flow creates a Git branch or pull request.
- Reviewers can see source provenance before approving content.
- Git remains the final audit trail.

## Sprint 9: Shared Admin, Auth, and Database Version

Goal: move beyond local-only tooling when the workflow is proven.

Definition of done:

- Auth, roles, audit tables, and database storage are designed before implementation.
- pgvector or another shared vector store is evaluated only after local prototypes succeed.
- Public learner site remains separate from admin tooling.
- Deployment, backup, and access-control risks are documented.
