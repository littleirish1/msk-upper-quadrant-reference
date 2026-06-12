# Local RAG and Vector Search Plan

This plan describes a future local-only retrieval layer for the MSK Clinical Reasoning Lab. It is an architecture note only. It does not add embeddings, API calls, vector databases, dependencies, runtime code, public routes, or file-writing workflows.

The goal is to help the local Case Manager find and compare source material across legacy stations, PowerPoints, PDFs, evidence notes, and guided case MDX while keeping the public learner site unaffected.

## Trust-approved AI pathway: Microsoft Copilot-first option

The Trust currently has an agreed Microsoft Copilot licence. For institutional AI planning, the first pathway to explore should be Microsoft Copilot, Copilot Studio, and the Trust-approved Microsoft 365 environment, not a direct jump to external OpenAI, LangChain, or public chatbot integration.

This does not approve implementation. Copilot use still requires local information governance, IT/security, clinical safety, and procurement confirmation.

Why Copilot matters:

- The agreed Trust licence may make Copilot or Copilot Studio the safest first institutional AI route.
- It may align with existing Microsoft 365, Entra ID, SharePoint, Teams, Purview, and audit arrangements.
- It may reduce the need to send teaching material to an unapproved external AI provider during early pilots.
- It gives educators a more familiar environment for early source-grounded drafting experiments.

Possible architecture options:

- Option A - Public site remains static, no AI: current safest deployment on Netlify, no user data, no AI processing.
- Option B - Local/back-office AI script-maker: `ai-manager` remains local/private; AI helps draft scripts, cases, red herrings, and feedback rules; human review required.
- Option C - Trust Microsoft Copilot / Copilot Studio integration: a future Trust-approved agent could help educators generate draft cases from approved source material, potentially grounded in SharePoint, Teams, or other approved document stores; output enters a draft/review queue only.
- Option D - External RAG/vector architecture: only if Trust-approved and needed later; requires DPIA, data-flow mapping, contracts, security review, retention policy, and model/provider assessment.

Governance requirements before any AI integration:

- Confirm Trust licence scope.
- Confirm whether Copilot Chat, Microsoft 365 Copilot, or Copilot Studio is available.
- Confirm whether custom agents are allowed.
- Confirm approved data locations.
- Confirm whether teaching materials can be processed.
- Confirm whether patient-like scenarios must be synthetic or anonymised.
- Confirm retention, audit, and logging.
- Confirm who reviews generated clinical content.
- Confirm whether output is educational only and not clinical decision support.

AI content safety model:

- AI can draft but must not publish.
- Human review is required before public release.
- Published content requires an approved review state.
- No generated case should bypass hygiene, source, route, or preflight checks.
- No patient-identifiable data should be entered.
- No clinical advice should be generated for real patients.
- Educational disclaimers should remain clear.

Recommended post-demo path:

1. Document Copilot governance questions.
2. Use Copilot manually, if permitted, to help draft one reviewed case script from non-sensitive teaching content.
3. Build the local case-script template and review checklist.
4. Explore Copilot Studio only if the Trust allows custom agents and source grounding.
5. Consider external RAG/vector databases only if Copilot cannot meet the requirement and governance approval exists.

AI integration decision matrix:

| Pathway | Data risk | Implementation complexity | Governance burden | Demo value | Scalability | Recommended timing |
| --- | --- | --- | --- | --- | --- | --- |
| Static reviewed content | Low | Low | Low | High | Medium | Now |
| Local-only `ai-manager` | Low to medium | Medium | Medium | Medium | Medium | Post-demo prototype |
| Microsoft Copilot / Copilot Studio | Medium | Medium | Medium to high | High for Trust setting | High if approved | Preferred institutional exploration |
| External OpenAI/LangChain/RAG | Medium to high | High | High | Medium | High | Later, only if approved |
| Institution-hosted private RAG | Medium | High | High | Medium | High | Later institutional phase |

## Friday Demo Boundary

Vector search is not needed for the Friday demo. The demo already depends on reviewed public pages, published guided cases, draft route exclusion, the source registry, the metadata-driven migration tracker, and validation scripts. Adding embeddings, LangChain, Chroma, or database state before the demo would increase deployment risk without improving the public learner walkthrough.

The right post-demo sequence is:

- Keep the public learner site static and demo-safe.
- Keep AI/vector work local and back-office only.
- Explore Trust-approved Microsoft Copilot or Copilot Studio before external AI providers.
- Start with documentation and schema alignment.
- Add keyword and metadata search before embeddings.
- Add source-grounded drafting only after traceable retrieval works.

Vector search becomes useful after the demo because the source library will grow across legacy stations, PowerPoint imports, paper/PDF extracts, evidence notes, guideline summaries, and case MDX. At that point, reviewers will need better ways to find source support, compare drafts against evidence, and trace generated teaching material back to source records.

## Scope

The first implementation should live entirely under `ai-manager` or scripts used by the local Case Manager. Public Next.js routes should not import vector-search code, read private source indexes, or expose local search endpoints.

Initial uses:

- Find source passages related to a draft case.
- Compare a case against its linked source material.
- Search legacy stations, extracted slides, papers, evidence notes, and reviewed cases from one local tool.
- Support human review by showing traceable source snippets.
- Suggest candidate sources for a new draft without publishing anything.

Out of scope for the first version:

- Automatic publishing.
- AI-generated clinical claims without review.
- Public learner search over unreviewed source material.
- OCR.
- External embedding APIs.
- Database-backed multi-user access.
- Authentication or shared admin workflows.

## Local-Only Boundary

Vector search should be treated as back-office infrastructure.

Allowed:

- Local scripts under `scripts/`.
- Local Case Manager endpoints under `ai-manager/case-manager`.
- Local generated indexes under `ai-manager` or `content/imports` if they contain only approved metadata and non-sensitive extracted text.

Not allowed:

- Public routes under `src/app`.
- Public build-time imports from `ai-manager`.
- Client-side bundles containing source notes, draft cases, or vector data.
- Netlify-exposed endpoints for local admin search.

The public learner site should continue to use published MDX content and existing route safety checks only.

## Source Types To Ingest Later

The ingestion layer should be source-type aware but use a shared metadata model.

Legacy HTML case bank:

- Current extracted station markdown under `content/imports/html-case-bank/extracted/stations/*.md`.
- Existing `sourceType`, `sourceId`, `sourcePath`, and `reviewStatus` metadata.
- Useful for finding source passages behind generated legacy-derived cases.

PowerPoints:

- Future raw files under `content/imports/powerpoints/raw/`.
- Future extracted text under `content/imports/powerpoints/extracted/`.
- Chunk by deck, slide number, title, speaker notes, and section heading where available.
- Treat all extracted slide text as draft/unreviewed until checked.

PDFs and papers:

- Future raw files under `content/imports/papers/raw/`.
- Future extracted metadata or notes under `content/imports/papers/extracted/`.
- Chunk by abstract, key findings, clinical implications, methods, limitations, and reviewer notes when available.
- Do not implement OCR or full PDF parsing in this sprint.

Evidence notes:

- Reviewed summaries under `content/evidence/`.
- Chunk by clinical question, population, finding, limitation, and linked condition tags.
- Prefer reviewed evidence notes over raw extracted paper text for retrieval when both exist.

Guided case MDX:

- Published, draft, and archived cases under `content/cases/**/*.mdx`.
- Preserve status and review status in metadata.
- Do not expose draft or archived case chunks to the public site.
- Use case chunks for local review, similarity checks, and source traceability.

Guideline summaries:

- Future reviewed summaries of clinical guidelines or local pathways.
- Chunk by recommendation, population, contraindication, evidence level, and review note.
- Treat raw guideline notes as draft until reviewed.

Source registry metadata:

- `content/imports/source-registry.json` should provide source status, linked case paths, review status, and unlinked case information.
- Registry metadata should help filter and rank retrieval results.

## Chunk Metadata

Every indexed chunk should carry enough metadata to trace it back to a real file and review state.

Suggested chunk fields:

```json
{
  "chunkId": "legacy-html-case-bank:s28:chunk-004",
  "sourceType": "legacy-html-case-bank",
  "sourceId": "s28",
  "sourcePath": "content/imports/html-case-bank/extracted/stations/s28-mark-49-sudden-elbow-pain.md",
  "sourceTitle": "Distal Biceps Rupture - Referral Decision",
  "bodyRegionTags": ["elbow"],
  "conditionTags": ["distal-biceps-rupture"],
  "physiotherapyDomainTags": ["urgent-referral", "clinical-reasoning"],
  "chunkKind": "case-reasoning",
  "chunkIndex": 4,
  "reviewStatus": "reviewed",
  "sourceStatus": "converted",
  "targetOutputs": ["guided-case"],
  "linkedCases": ["content/cases/elbow/distal-biceps-rupture-case-01.mdx"]
}
```

Important traceability fields:

- `sourceType`
- `sourceId`
- `sourcePath`
- `chunkId`
- `chunkType`
- `chunkIndex`
- `sourceHash`
- `extractedTextPath`
- `embeddingModel`
- `indexedAt`
- `retrievalTags`
- `citationLabel`
- `evidenceLevel`
- `reviewStatus`
- `sourceStatus`
- `linkedCases`
- `linkedEvidence`
- `linkedCaseIds`
- `linkedDeckIds`
- `createdBy`
- `reviewedBy`
- `lastReviewed`

The chunk text should never be separated from its source metadata. Retrieval results should display source file, source ID, review status, and linked case status.

## Vector Store Options

### Option 1: Local JSON / In-Memory Prototype

Best first step.

Shape:

- A local script builds a deterministic JSON index.
- Case Manager loads it into memory.
- Search can begin with keyword or simple lexical scoring before embeddings are added.
- Later embedding vectors can be added as arrays if needed.

Pros:

- No new service.
- Easy to inspect in Git.
- Good for validating metadata, chunking, and review workflow.
- Lowest deployment risk.

Cons:

- Not scalable for large libraries.
- No efficient vector similarity at scale.
- Multi-user/shared workflows would outgrow it.

Recommended use:

- First local prototype for source discovery and traceability.
- Do not add to public preflight unless the generated output is deterministic and stable.

### Option 2: Chroma

Good local vector-store candidate after the JSON prototype.

Shape:

- Run Chroma locally for Case Manager experiments.
- Store embeddings and metadata locally.
- Query from `ai-manager` only.

Pros:

- Purpose-built vector search.
- Good local developer experience.
- Can store rich metadata alongside vectors.

Cons:

- Adds dependency and local service/state.
- Requires clear backup and reset rules.
- Not suitable for public Netlify deployment.

Recommended use:

- Local admin prototype once chunk metadata and review workflow are proven.

### Option 3: SQLite Vector Option Later

Possible local bridge between JSON and a full vector database.

Shape:

- Store source records, chunks, lexical fields, and optional vectors in a local SQLite database.
- Use a suitable vector extension only if it is stable for the local environment.
- Query from `ai-manager` only.

Pros:

- Local file-based workflow.
- Easier to inspect and reset than a service.
- Could support metadata filtering, keyword search, and vector search in one place.

Cons:

- Extension support varies by platform.
- Adds implementation and migration complexity.
- Still requires decisions about generated indexes and Git visibility.

Recommended use:

- Consider only after the JSON text index proves the data model and retrieval workflow.

### Option 4: pgvector / Supabase Later

Potential shared/admin option when the project moves beyond local-only tooling.

Shape:

- Store source records, chunks, embeddings, review state, and user actions in Postgres.
- Use pgvector for similarity search.
- Supabase could provide hosted Postgres, auth, row-level security, and admin APIs.

Pros:

- Better fit for shared review workflows.
- Can support permissions, audit tables, and multi-user admin.
- Easier to integrate with future GitHub pull-request publishing workflows.

Cons:

- Requires auth, database migrations, backups, and security design.
- Introduces operational complexity.
- Should not be added until the local workflow is stable.

Recommended use:

- Later shared/admin phase, not the current local demo sprint.

## Possible LangChain Role

LangChain may be useful later, but should not be added before the local data model is proven and the Trust-approved Copilot pathway has been assessed.

Potential roles:

- Loaders for case MDX, extracted markdown, evidence notes, and future source files.
- Text splitting and chunking with stable chunk identifiers.
- Retrievers that combine metadata filters with lexical or vector search.
- Source-grounded prompt assembly for draft cases and teaching decks.
- Evaluation helpers for retrieval coverage and citation coverage.

LangChain should not own the publication workflow. The project should still enforce review status, source metadata, route safety, and Git review outside any AI framework.

## Retrieval Workflow

Future local workflow:

1. Scan known source folders and case MDX.
2. Parse frontmatter and source registry metadata.
3. Split each source into stable chunks.
4. Attach source metadata to each chunk.
5. Build or update a local index.
6. Query from the Case Manager.
7. Show retrieved chunks with citations, source paths, review status, and linked outputs.
8. Allow a reviewer to use retrieved material when drafting or checking a case.
9. Keep generated outputs as drafts until human review.

Retrieval results should prioritize:

- Reviewed evidence notes.
- Reviewed/published cases.
- Converted legacy stations linked to reviewed cases.
- Draft or unreviewed material only when clearly labelled.

## Safety Rules

RAG should support review, not bypass it.

Rules:

- No generated clinical content should be published without human review.
- Draft and archived cases remain excluded from public route generation.
- Raw extracted PowerPoint/PDF content is unreviewed until explicitly reviewed.
- Retrieval snippets must show source path and review status.
- AI-generated summaries must include source references and be saved as draft or needs-review.
- Public pages must not read local vector indexes.
- Netlify builds must not require local vector services.
- Git remains the audit trail for generated files and reviewed content.

## Future Implementation Stages

Phase 0: Documentation and schema only

- Keep this sprint docs/scaffold only.
- Define future source and chunk metadata.
- Do not add embeddings, vector databases, dependencies, API calls, or runtime code.

Phase 1: Text index with no embeddings

- Add a deterministic local index over source metadata and text.
- Support keyword and metadata search in `ai-manager`.
- Do not add embeddings yet.

Phase 2: Local vector store

- Evaluate local JSON vectors, Chroma, or a SQLite vector option.
- Keep vector state local/back-office only.
- Do not make Netlify builds depend on a vector service.

Phase 3: Source-grounded case drafting

- Use retrieved source chunks to draft cases.
- Save outputs as draft with `reviewStatus: "needs-review"`.
- Require human review before publication.

Phase 4: Shared/admin workflow

- Consider auth, database storage, reviewer roles, Supabase/pgvector, and GitHub PR publishing.
- Design migrations and audit logs before implementation.

## Open Questions

- Should raw extracted source text be committed, or should some sources stay local-only?
- Which source types are safe to index in Git-visible JSON?
- Should generated vector indexes be ignored or committed as deterministic artifacts?
- What local embedding model is acceptable if external API calls are avoided?
- How should reviewer decisions be represented in frontmatter vs a future admin database?

For now, the safest next step is a metadata-only local chunking plan with no embeddings and no public runtime changes.
