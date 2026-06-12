# Product Storyboard And Timeline

This document describes a planning storyboard and phased roadmap. It does not claim production readiness.

## Friday Demo Storyboard

1. Open `/demo`.
2. Explain that this is a pilot build, not final production software.
3. Explain the separation between public learner site and local admin tooling.
4. Open `/cases`.
5. Point out neutral case titles and hidden diagnoses.
6. Open one guided case.
7. Ask the learner to type a leading hypothesis and supporting/caution features.
8. Reveal likely diagnosis or linked condition.
9. Reveal suggested reasoning and continue into the case content.
10. Open `/future`.
11. Explain the roadmap: whole-body scope, source registry, local admin tooling, future PowerPoint/paper imports, and review-first AI assistance.

Optional demo branch:

- Open a condition page.
- Click Overview, Pathophysiology, Outcome Measures, and Management section links.
- Mention draft route protection and source checks.

## Mature Product Storyboard

1. Learner logs in.
2. Learner chooses a body region, condition cluster, or self-identified weak area.
3. Learner starts a conversation case.
4. Learner asks targeted questions.
5. The case presents plausible red herrings and safety cues.
6. Learner receives contextual feedback on reasoning process.
7. Learner reveals the likely diagnosis or concern.
8. Learner saves a reflection.
9. Learner reads an evidence-linked explanation.
10. Learner receives suggested follow-up cases or revision topics.
11. Educator reviews aggregate cohort gaps.
12. Admin creates new cases from reviewed sources.
13. Human reviewer approves public release.

## Timeline

### Immediate: Demo Hardening

Goals:

- Keep public build stable.
- Keep draft and archived cases hidden.
- Keep Case Manager local-only.
- Validate `/demo`, `/future`, `/cases`, condition pages, and published guided cases.

Definition of done:

- `npm run preflight` passes.
- Route smoke checks pass.
- Public demo path is clear.
- No unreviewed draft routes appear.

### Week 1-2 Post-Demo: Feedback And Bug Fixes

Goals:

- Collect feedback from learners, educators, and stakeholders.
- Fix navigation, mobile, copy, and clarity issues.
- Decide which demo interactions are worth deepening.

Definition of done:

- Feedback themes documented.
- Priority bugs fixed.
- Next content priorities chosen.

### Month 1: Staged Cases And Taxonomy Expansion

Goals:

- Improve staged case flow.
- Expand whole-body taxonomy planning.
- Add more cases where reviewed content is available.
- Improve neutral labels and reveal patterns.

Definition of done:

- Case template is reusable.
- New case creation checklist exists.
- Public cases remain reviewed and route-safe.

### Month 2: Local Source Manager And Import Prototypes

Goals:

- Strengthen local Case Manager.
- Prototype PowerPoint text extraction.
- Prototype paper/PDF metadata extraction without risky automation.
- Improve source registry support for multiple source types.

Definition of done:

- Local-only import scripts do not affect public build by default.
- Imported material is marked unreviewed.
- Source provenance is preserved.

### Month 3: Evidence Notes And Review Queue

Goals:

- Add evidence note format.
- Build review queue concepts.
- Link cases to evidence summaries.
- Define reviewer roles and approval states.

Definition of done:

- Evidence notes have metadata.
- Review status is visible in local tooling.
- Published content remains human-approved.

### Month 4-6: Single-User Knowledge Store

Goals:

- Prototype notes, bookmarks, and saved cases.
- Test personal reflection storage.
- Explore authentication and storage options.

Definition of done:

- Privacy model drafted.
- Prototype avoids patient-identifiable data.
- Export/delete user data path is designed.

### Month 6-12: Institutional Pilot And Educator Tooling

Goals:

- Support educator-created case pathways.
- Add cohort-level reporting concepts.
- Improve admin review workflows.
- Prepare institution pilot materials.

Definition of done:

- Pilot scope defined.
- Clinical safety governance documented.
- Data protection review started before storing user data.

### Long-Term: Shared Admin, RAG, Analytics, Paid Product Options

Goals:

- Shared admin with roles and permissions.
- Local or hosted source retrieval.
- Analytics for learning gaps.
- Paid content packs or institutional licensing.

Definition of done:

- Business model validated with real users.
- Legal/compliance review complete for chosen deployment model.
- Clinical content review workflow is reliable.

## Dependencies And Risks

Key dependencies:

- Content creation capacity.
- Clinical review availability.
- Source permissions.
- Regulatory boundary clarity.
- Data privacy design.
- UX simplicity.
- Hosting/auth costs.
- Educator adoption.

Key risks:

- Overbuilding before feedback.
- Letting AI-generated content bypass review.
- Imported content copyright issues.
- User data collection before privacy design.
- Public learner site becoming cluttered with admin concepts.

## Phase Governance

Each phase should answer:

- What user problem does this solve?
- What content becomes public?
- What remains local/private?
- What checks protect the build?
- Who reviews clinical material?
- What data is stored?
- What would make this phase unsafe to ship?
