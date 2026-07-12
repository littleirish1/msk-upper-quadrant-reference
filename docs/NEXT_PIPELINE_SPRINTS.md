# Next Pipeline Sprints

These are staged architecture tasks for the MSK Clinical Reasoning Lab. They are intentionally separated from tomorrow's trial demo so the public build remains safe.

## Sprint 1: Whole-Body Taxonomy and Routing Review

- Review body-region slugs and labels.
- Decide which modules are active, planned, or hidden.
- Keep planned modules out of public navigation until reviewed content exists.
- Confirm route generation still excludes draft and archived cases.

## Sprint 2: PowerPoint Text Extraction

- Add a script for extracting slide text and basic metadata.
- Write extracted outputs under `content/imports/powerpoints/extracted/`.
- Register imported decks as `sourceType: "powerpoint"`.
- Keep imported slide material unreviewed until checked.

## Sprint 3: Paper and PDF Metadata Extraction

- Add a script for citation and metadata extraction.
- Do not implement OCR until the review model is ready.
- Store extracted metadata under `content/imports/papers/extracted/`.
- Link papers to evidence summaries and guided cases through source IDs.

## Sprint 4: Evidence Summary MDX Format

- Define a reviewed evidence summary format.
- Add frontmatter for source IDs, body-region tags, condition tags, evidence type, and review status.
- Link evidence notes to cases, conditions, and presentations.

## Sprint 5: Presentation Draft Template

- Create a draft teaching-session template.
- Link presentations to source records and evidence notes.
- Keep generated presentations out of public learner routes until reviewed.

## Sprint 6: Case Template Library

- Add case templates by presentation type, such as red flags, referral decision, differential diagnosis, rehabilitation planning, persistent pain, and return-to-sport.
- Require source metadata and review status for generated cases.

## Sprint 7: AI Prompt Templates for Paper-to-Teaching-Deck

- Store prompts as local templates, not runtime API calls.
- Require source IDs, review status, limitations, and human review notes in generated drafts.

## Sprint 8: AI Prompt Templates for Source-to-Guided-Case

- Add prompt templates for converting source records into draft guided cases.
- Keep generated outputs as draft by default.
- Preserve source traceability in frontmatter.

## Sprint 9: Review Checklist

- Add a clinical review checklist for draft cases, evidence notes, and teaching sessions.
- Include source traceability, red-flag safety, differential diagnosis, management scope, and learner clarity.

## Sprint 10: Shared Admin and Auth Roadmap

- Define reviewer roles and publishing permissions.
- Decide what state stays in Git, what can move to a database, and how synchronization works.
- Keep Git as the durable audit trail.

## Sprint 11: GitHub PR Publishing Workflow

- Generate branches or pull requests from reviewed admin changes.
- Run preflight before publish.
- Use PR review as the publication checkpoint.

## Sprint 12: Netlify Production Checklist

- Confirm build command and publish directory.
- Revisit base-path strategy for the target Netlify URL.
- Confirm no local/admin routes are exported.
- Confirm draft and archived content stays hidden.
- Confirm source and hygiene checks run in CI.
