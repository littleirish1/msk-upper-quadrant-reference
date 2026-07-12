# Agent Delegation Model

This document proposes future specialised agents that can draft, inspect, and suggest improvements. Humans remain responsible for approving clinical/public content. Agents must not auto-publish, weaken checks, expose local admin tooling, or bypass review.

## Shared Agent Rules

All agents should follow these boundaries:

- Public site remains protected by hygiene, source, route, and preflight checks.
- Draft and archived content must not be published automatically.
- Clinical content requires human review before public release.
- Source metadata must be preserved.
- Local admin tooling must not be exposed as public routes.
- Agents can propose changes, but humans decide.

## 1. UI/UX Interaction Agent

Purpose:

- Improve learner interaction patterns, staged reveal, navigation, and page clarity.

Allowed inputs:

- Public UI code.
- Screenshots.
- Demo feedback.
- Non-sensitive learner journey notes.

Forbidden actions:

- Changing clinical claims without review.
- Adding external services.
- Exposing admin tooling.

Outputs:

- UI recommendations.
- Small component patches.
- Interaction flow diagrams.

Review requirement:

- Design review and functional validation.

Safety checks:

- Run route and preflight checks.
- Confirm draft routes remain excluded.

Example task prompt:

> Review the guided case page for learner flow and propose a low-risk staged reveal improvement without changing clinical content.

## 2. Accessibility Agent

Purpose:

- Improve semantic structure, keyboard navigation, focus states, contrast, and screen-reader clarity.

Allowed inputs:

- Public components.
- Generated HTML.
- Accessibility feedback.

Forbidden actions:

- Removing content.
- Adding inaccessible custom controls.
- Weakening route checks.

Outputs:

- Accessibility findings.
- Component patches.
- Manual test checklist.

Review requirement:

- Human review plus automated build validation.

Safety checks:

- Confirm links and buttons have accessible names.
- Confirm interactive elements work by keyboard.

Example task prompt:

> Audit the case reveal controls for keyboard and screen-reader usability and patch only low-risk accessibility issues.

## 3. Clinical Content Reviewer Agent

Purpose:

- Flag clinical ambiguity, missing safety screening, and unsupported claims for human review.

Allowed inputs:

- Case MDX.
- Condition MDX.
- Source notes.
- Review checklist.

Forbidden actions:

- Publishing drafts.
- Making final clinical decisions.
- Removing source metadata.

Outputs:

- Review notes.
- Risk flags.
- Suggested edits for clinician approval.

Review requirement:

- Qualified human clinical review before publication.

Safety checks:

- Check for TODOs in published legacy-derived cases.
- Confirm source metadata.

Example task prompt:

> Review this draft case for red flag omissions and differential diagnosis gaps. Do not edit the file; produce review notes.

## 4. Evidence/Source Extraction Agent

Purpose:

- Help extract structured notes from papers, PowerPoints, and legacy sources for review.

Allowed inputs:

- User-provided source files.
- Extracted text.
- Source registry metadata.

Forbidden actions:

- OCR without approval.
- Creating public claims from unreviewed sources.
- Ignoring copyright status.

Outputs:

- Draft evidence notes.
- Source metadata suggestions.
- Extraction quality warnings.

Review requirement:

- Human source and copyright review.

Safety checks:

- Mark outputs unreviewed.
- Preserve source path and source ID.

Example task prompt:

> Extract draft metadata and key teaching points from this PowerPoint text, mark everything unreviewed, and preserve slide references.

## 5. Case Script-Maker Agent

Purpose:

- Turn reviewed source material into draft guided case scripts.

Allowed inputs:

- Reviewed source notes.
- Case templates.
- Taxonomy.
- Educator brief.

Forbidden actions:

- Publishing generated cases.
- Inventing unsupported clinical facts.
- Removing review status.

Outputs:

- Draft case outline.
- Suggested prompts.
- Reveal sequence.

Review requirement:

- Clinician/educator review before public status.

Safety checks:

- `status: draft` for new cases.
- `reviewStatus: needs-review` until approved.

Example task prompt:

> Draft a guided case outline from this reviewed source note. Keep it draft, diagnosis-hidden, and source-tracked.

## 6. Conversation Red-Herring Agent

Purpose:

- Design conversation cases with plausible but safe red herrings and escalating safety cues.

Allowed inputs:

- Reviewed case content.
- Safety screening checklist.
- Educator intent.

Forbidden actions:

- Creating misleading unsafe advice.
- Hiding urgent referral cues after reveal only.
- Publishing without review.

Outputs:

- Conversation question sets.
- Red-herring map.
- Safety cue map.

Review requirement:

- Clinical safety review.

Safety checks:

- Confirm safety cues are present.
- Confirm reveal text avoids overclaiming diagnosis.

Example task prompt:

> Create a draft red-herring question sequence for a thoracic pain case that teaches safety screening without confirming a diagnosis prematurely.

## 7. Paediatrics Taxonomy Agent

Purpose:

- Expand paediatric MSK taxonomy and case ideas with appropriate safeguards.

Allowed inputs:

- Paediatric taxonomy docs.
- Reviewed educational sources.
- Specialist educator notes.

Forbidden actions:

- Giving specific treatment advice without review.
- Minimising safeguarding concerns.
- Publishing paediatric cases without specialist review.

Outputs:

- Taxonomy expansions.
- Case idea lists.
- Red flag prompts.

Review requirement:

- Paediatric specialist review.

Safety checks:

- Include safeguarding and serious pathology prompts.
- Mark all new content future/draft.

Example task prompt:

> Expand paediatric ankle and foot case ideas with red flag and safeguarding considerations. Keep it taxonomy-only.

## 8. Route/Build QA Agent

Purpose:

- Protect public static export and Netlify compatibility.

Allowed inputs:

- Build scripts.
- Route checks.
- Build output.
- Package scripts.

Forbidden actions:

- Weakening checks.
- Publishing draft cases.
- Ignoring build failures.

Outputs:

- Build reports.
- Route safety patches.
- Netlify compatibility notes.

Review requirement:

- Developer review.

Safety checks:

- `npm run preflight`.
- `npm run check:routes`.
- Confirm `/ai-manager` absent.

Example task prompt:

> Audit the static export for draft case routes, `/ai-manager`, and missing demo routes. Patch only deterministic smoke checks.

## 9. Data Privacy/Security Agent

Purpose:

- Review privacy, data minimisation, secrets, and public/private boundaries.

Allowed inputs:

- Architecture docs.
- Config.
- Environment templates.
- Route lists.

Forbidden actions:

- Adding auth or storage without explicit implementation task.
- Storing real personal data.
- Exposing local paths publicly.

Outputs:

- Privacy risk notes.
- Secret scan findings.
- Boundary recommendations.

Review requirement:

- Human security/privacy review.

Safety checks:

- Search for credentials.
- Confirm no private admin routes in export.

Example task prompt:

> Review the proposed user knowledge store architecture for privacy risks and suggest safer sequencing.

## 10. RAG Retrieval Evaluation Agent

Purpose:

- Evaluate future retrieval quality, source traceability, and hallucination risk.

Allowed inputs:

- Local indexes.
- Source registry.
- Reviewed evidence notes.
- Retrieval test questions.

Forbidden actions:

- Calling external APIs without approval.
- Publishing generated clinical answers.
- Mixing private user notes into global content.

Outputs:

- Retrieval evaluation reports.
- Grounding failure examples.
- Test query sets.

Review requirement:

- Human review of retrieval assumptions and clinical safety.

Safety checks:

- Source IDs present.
- Review status visible.
- Unreviewed sources labelled.

Example task prompt:

> Evaluate whether retrieved chunks for this draft case support each clinical claim. Produce a traceability report only.

## 11. Demo/Storytelling Agent

Purpose:

- Improve demo script, stakeholder narrative, and product explanation.

Allowed inputs:

- Demo pages.
- Product docs.
- Feedback notes.

Forbidden actions:

- Overclaiming readiness.
- Giving legal, financial, or clinical claims as definitive advice.
- Exposing local-only paths on public pages.

Outputs:

- Demo scripts.
- Slide outlines.
- Stakeholder talking points.

Review requirement:

- Product owner review.

Safety checks:

- Use "pilot", "prototype", and "review-first" language.
- Keep claims modest.

Example task prompt:

> Rewrite the demo walkthrough for an educator audience while clearly stating this is a pilot build.

## 12. Mobile Polish Agent

Purpose:

- Improve mobile readability, spacing, and interaction ergonomics.

Allowed inputs:

- Public pages.
- Screenshots.
- CSS/components.

Forbidden actions:

- Redesigning the whole site without scope.
- Changing content facts.
- Adding heavy dependencies.

Outputs:

- Small layout patches.
- Mobile QA checklist.

Review requirement:

- Visual review on small and desktop viewports.

Safety checks:

- No text overflow.
- Buttons remain usable.
- Preflight passes.

Example task prompt:

> Check `/cases`, one guided case, `/demo`, and `/future` for mobile layout issues and patch only low-risk spacing problems.

## 13. Investor/Stakeholder Deck Agent

Purpose:

- Draft non-final stakeholder and investor presentation material.

Allowed inputs:

- Strategy docs.
- Demo script.
- Product roadmap.
- User feedback.

Forbidden actions:

- Making financial projections as fact.
- Claiming IP protection is complete.
- Claiming clinical or regulatory approval.

Outputs:

- Deck outline.
- Problem/solution narrative.
- Risk-aware roadmap.

Review requirement:

- Professional legal/financial review before external fundraising use.

Safety checks:

- Include planning disclaimer.
- Avoid overpromising.

Example task prompt:

> Draft a cautious stakeholder deck outline for an educator pilot, including risks and professional-advice caveats.
