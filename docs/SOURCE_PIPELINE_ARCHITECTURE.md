# Source Pipeline Architecture

The current MSK Upper Quadrant Reference is Phase 1 of a broader MSK Clinical Reasoning Lab. The long-term product direction is a whole-body physiotherapy clinical reasoning platform for presentations that physiotherapists may assess, triage, treat, refer, educate around, or use for teaching and review.

The source pipeline should stay metadata-driven. Source files and case frontmatter hold the truth; scripts read those files; the Case Manager displays the current state; Git remains the audit trail.

## Phase 1: Current Legacy Station Pipeline

Current legacy station sources live at:

```text
content/imports/html-case-bank/extracted/stations/*.md
```

Guided cases live at:

```text
content/cases/**/*.mdx
```

Legacy-derived cases can include:

```yaml
sourceType: "legacy-html-case-bank"
sourceId: "s42"
sourcePath: "content/imports/html-case-bank/extracted/stations/..."
reviewStatus: "needs-review"
```

The current pipeline:

1. `npm run registry:sources` generates `content/imports/source-registry.json`.
2. `npm run tracker:legacy` regenerates the legacy migration tracker from source metadata.
3. `npm run check:sources` validates legacy source metadata and duplicate source IDs.
4. `npm run preflight` runs build safety checks before public export.

Published legacy-derived cases must be reviewed. Draft and archived cases must stay out of public route generation.

## Whole-Body Scope

Future source and content architecture should avoid naming that limits the platform to upper quadrant only. Preferred language includes:

- MSK Clinical Reasoning Lab
- Physiotherapy Clinical Reasoning Lab
- whole-body MSK clinical reasoning platform

Planned domains include cervical, thoracic, shoulder, elbow, wrist/hand, lumbar, pelvis/SIJ, hip/groin, knee, ankle/foot, neuro/MSK overlap, rheumatology and systemic screening, persistent pain, post-operative rehabilitation, return-to-sport reasoning, occupational/work-related presentations, and multi-region reasoning.

## Future PowerPoint Import Pipeline

PowerPoint imports should be treated as source material, not published content.

Expected stages:

1. Store raw files in `content/imports/powerpoints/raw/`.
2. Extract text and slide metadata into `content/imports/powerpoints/extracted/`.
3. Create source registry entries with `sourceType: "powerpoint"`.
4. Link extracted slides to draft teaching sessions, evidence notes, or guided cases.
5. Mark all generated outputs as draft or needs-review until human review is complete.

This scaffold does not implement PowerPoint extraction yet.

## Future Papers and Evidence Pipeline

Paper and evidence imports should also be source-tracked.

Expected stages:

1. Store raw papers or citation packages in `content/imports/papers/raw/`.
2. Extract metadata and reviewer notes into `content/imports/papers/extracted/`.
3. Create source registry entries with `sourceType: "paper"` or `sourceType: "evidence-note"`.
4. Store reviewed summaries under `content/evidence/papers/`.
5. Link evidence back to cases, condition pages, presentations, and teaching sessions.

This scaffold does not implement PDF extraction, OCR, or API calls.

## AI-Assisted Case Generation

AI-assisted generation should create drafts only. Generated case frontmatter should include source metadata, body-region tags, condition tags, review status, and target output type. Human review is required before public publication.

Generated draft cases must not be made public by status changes alone. The route-generation and source-integrity checks remain the safety boundary.

## AI-Assisted Teaching Deck Generation

Future teaching deck generation should link outputs to source records for papers, PowerPoint slides, guideline notes, and manual teaching-session plans. Draft decks should live in a reviewable folder and should not be treated as reviewed teaching material until signed off.

## Review-First Publication Model

The publication model should remain conservative:

- Source material is imported as unreviewed.
- Draft outputs are created from sources.
- Human reviewers check clinical accuracy, learning design, and source traceability.
- Published learner content must pass hygiene, source-integrity, and build checks.
- Git commits and pull requests record the review trail.

## Public Site vs Local/Admin Tooling

The public learner site should expose only reviewed learner-facing material.

The local Case Manager is an admin prototype for source preview, draft creation, registry summaries, migration tracking, and preflight validation. It should not be exposed as a public route in the static learner build.

## Git as Audit Trail

Git should record:

- Source extraction changes.
- Generated registry and tracker changes.
- Draft creation and review edits.
- Publication status changes.
- Build-safety script changes.

Do not hide source pipeline changes behind runtime-only state. If a source or case status changes, it should be visible in the repository.

## Future Shared/Admin Platform

The local admin prototype can later evolve into shared/admin infrastructure with:

- Authenticated reviewer access.
- Role-based publishing permissions.
- Database-backed workflow state.
- GitHub pull-request publishing.
- Netlify deployment checks.
- Audit logs linked to source IDs and review status.

Even with a database, metadata should remain synchronized with source-controlled files so Git remains a durable audit trail.
