# Post-Friday AI Source Architecture

This document sketches the next architecture layer for the MSK Clinical Reasoning Lab after the Friday demo. It is documentation only. It does not add embeddings, API calls, databases, OCR, public routes, or runtime behavior.

The current upper-quadrant work remains Phase 1 of a broader whole-body physiotherapy clinical reasoning platform. The public learner site should stay static, review-first, and demo-safe while local source-management tools evolve under `ai-manager`.

## Operating Principles

- Public learner site: static, published, reviewed learner content only.
- Local Case Manager: back-office tool for source review, draft generation, registry inspection, and future retrieval.
- RAG/vector search: post-demo local capability, not required for the Friday trial.
- Generated content: always draft or `needs-review` until a human reviewer promotes it.
- Git: source of truth and audit trail for reviewed content, metadata, and generated artifacts.
- Source metadata: every output must trace back to `sourceType`, `sourceId`, `sourcePath`, and review state.

## Local-Only AI Source Manager

The AI/source manager should live under `ai-manager` and local scripts. It should never be imported by public Next.js routes or exposed through Netlify.

Future local-only responsibilities:

- Search across source registry records, case MDX, extracted legacy stations, evidence notes, and imported teaching material.
- Show source excerpts with citations and review state.
- Help reviewers compare draft cases with source material.
- Draft candidate cases or teaching decks from selected sources.
- Save generated outputs as drafts only.
- Support reviewer actions that can later become GitHub pull requests.

## Source Ingestion Pipeline

The ingestion pipeline should remain source-type aware but metadata-consistent.

Current source type:

- `legacy-html-case-bank`: extracted station markdown under `content/imports/html-case-bank/extracted/stations`.

Future source types:

- `powerpoint`: teaching slides and speaker notes.
- `paper`: peer-reviewed papers or PDF extracts.
- `evidence-note`: reviewed clinical evidence notes.
- `manual-case`: manually authored guided cases.
- `teaching-session`: curated teaching sessions.
- `assessment-template`: assessment or reasoning templates.
- `clinical-guideline`: guideline summaries or local protocols.

Each source should eventually support stable traceability fields such as:

- `chunkId`
- `chunkType`
- `sourceHash`
- `extractedTextPath`
- `embeddingModel`
- `indexedAt`
- `retrievalTags`
- `citationLabel`
- `evidenceLevel`
- `reviewStatus`
- `linkedCaseIds`
- `linkedDeckIds`

These fields do not need to be added to the current registry output until implementation begins.

## PowerPoint Pathway

Future PowerPoint handling should start with text extraction only.

Suggested flow:

1. Raw files are placed under `content/imports/powerpoints/raw`.
2. A local script extracts slide text, slide titles, speaker notes, and slide numbers.
3. Extracted text is saved under `content/imports/powerpoints/extracted`.
4. Source records are registered with source metadata and draft review state.
5. Reviewers decide whether excerpts can support cases, evidence notes, or teaching decks.

Do not publish extracted slide content directly. Treat it as unreviewed source material until checked.

## PDF and Paper Pathway

Future paper handling should begin with metadata and reviewer notes, not OCR.

Suggested flow:

1. Raw papers or PDFs are placed under `content/imports/papers/raw` only when licensing permits.
2. Extracted metadata, abstracts, notes, and reviewer summaries are placed under `content/imports/papers/extracted`.
3. Reviewed summaries can become evidence notes under `content/evidence`.
4. Retrieval should prefer reviewed evidence notes over raw extracted paper text.

The first paper pipeline should avoid OCR and avoid attempting to extract full copyrighted papers into public content.

## Evidence Notes

Evidence notes should be reviewable source-linked records. They can summarize:

- Clinical question.
- Population and presentation.
- Intervention or assessment.
- Key findings.
- Limitations.
- Practical clinical implications.
- Linked cases, modules, and body-region tags.

Evidence notes should be clearly marked as draft or reviewed and should cite source metadata.

## AI-Assisted Case Drafting

AI-assisted case drafting should use retrieved source excerpts as support, but should never publish directly.

Safe flow:

1. Reviewer selects source records or search results.
2. Local tool prepares a source-grounded draft prompt.
3. AI output is saved as a draft case with `reviewStatus: "needs-review"`.
4. Human reviewer checks clinical accuracy, source fit, pedagogy, and safety.
5. Only reviewed/published cases become public routes.

Draft and archived cases must remain excluded from public route generation.

## AI-Assisted Teaching Decks

Teaching deck generation can follow the same source-grounded model:

1. Select reviewed cases, evidence notes, and source excerpts.
2. Draft a teaching outline locally.
3. Generate slide content as draft material only.
4. Review for clinical accuracy, copyright, teaching tone, and learner level.
5. Commit reviewed deck content or templates through Git.

No generated deck should be treated as final without human review.

## Future RAG and Vector Layer

RAG/vector search is a post-demo enhancement for local source discovery and source-grounded drafting.

Possible progression:

- Phase 0: docs and schema only.
- Phase 1: local text index with keyword and metadata search, no embeddings.
- Phase 2: local vector store prototype inside `ai-manager`.
- Phase 3: source-grounded case and deck drafting.
- Phase 4: shared/admin workflow with auth, database, and GitHub PR publishing.

Every retrieved answer or draft should cite `sourceId`, `sourcePath`, and `chunkId`.

## Review-First Publication Model

The platform should continue to separate creation from publication:

- Source imports are unreviewed by default.
- AI-generated outputs are draft by default.
- Human review is required before publish.
- `check:hygiene`, `check:sources`, `check:routes`, and `preflight` must continue to block unsafe public output.
- Git remains the audit trail.

## Public Site and Admin Separation

The public learner site should expose only:

- Reviewed learner pages.
- Published guided cases.
- Public-safe demo/status information.
- Static build artifacts.

It should not expose:

- `ai-manager`.
- Local indexes.
- Draft case content.
- Archived cases.
- Raw source notes.
- Local file paths.
- API keys or environment variables.

Future shared/admin tooling can introduce authentication, roles, a database, audit tables, and GitHub PR publishing, but that should be designed separately from the public static site.
