# Platform V2 Overview

## Purpose

Platform V2 extends the MSK Clinical Reasoning Lab from its upper-quadrant foundation toward a whole-body, anatomy-linked, interactive learning platform. The public product remains a static reviewed learner site. Source ingestion, proposals, and future AI assistance remain private and human-controlled.

This document distinguishes implemented product behaviour from representative scaffolding and roadmap work. A schema or route framework does not make unfinished clinical content public.

## Fully Implemented

### Foundation and public safety

- Netlify remains the sole public deployment target and runs `npm run preflight` before publishing `out`.
- GitHub Actions is validation-only.
- Draft, private, and archived guided cases are excluded from routes, discovery, and search.
- Neutral guided-case routes and diagnosis reveal gates remain enforced.
- Public `/3d-model`, public GLB assets, and public `ai-manager` output are prohibited by deterministic checks.
- Legacy station provenance and 47-of-47 source accounting are recorded and checked.
- Generated source registry and migration tracker currentness is mandatory in preflight.

### Current learner product

- Five live upper-quadrant regions: cervical, thoracic, shoulder, elbow, and wrist/hand.
- Thirty-three condition pages using the flat MDX model.
- Six published neutral guided cases; three private guided cases remain excluded.
- A generated upper-quadrant completion matrix reports structural and review gaps without inventing missing content.
- `/anatomy` and thirteen anatomy category pages provide useful category navigation.
- `/learning` demonstrates static clinical-reasoning mechanics, differential ranking, a non-diagnostic decision tree, and representative Study, OSCE, Viva, Flashcard, and Quiz modes.

### Private maintenance foundation

- `ai-manager` has tracked schemas, templates, prompts, workflows, and offline validation.
- Provider mode is disabled by default and no provider dependency or network call is required.
- Ingestion and content proposals require provenance and human review metadata.
- Private inbox, archive, reports, source documents, and local configuration are ignored.

## Representative Or Scaffolded

The following validate structure and checks but are not complete clinical libraries:

- one private special-test cluster brief;
- one private outcome-measure brief;
- five private lower-quadrant region briefs;
- nine private anatomy records across muscle, peripheral nerve, nerve root, dermatome, myotome, and cranial-nerve categories;
- six private learning-content schema examples;
- static public learning components using non-clinical or process-level examples;
- neurology, cranial-nerve, lower-quadrant, and evidence-ingestion architecture documents.

## Draft And Private

Items under `content/anatomy/private`, `content/special-tests/private`, `content/outcome-measures/private`, `content/learning/private`, and `content/plans/regions` are not public learner content. They are review briefs or schema fixtures with `publicEligibility: false` and an explicit draft, private, or planned lifecycle.

No new lower-quadrant condition page, anatomy detail page, or additional guided case was published in this phase.

## Requires Clinician Approval

- New or changed clinical claims and case-specific model answers.
- Special-test technique, interpretation, accuracy, caution, and evidence fields.
- Outcome-measure scoring, interpretation, measurement properties, and licence details.
- Anatomy descriptions, lesion patterns, examination content, and clinical relevance.
- Neuro assessment pathways, red flags, outcome measures, and guided cases.
- Any future conversion of private briefs into public content.

The implementation does not claim clinician approval where none is recorded.

## Roadmap Only

- Public lower-quadrant condition libraries and guided cases.
- Public anatomy detail records.
- A complete neurology or cranial-nerve curriculum.
- Paediatrics and broader whole-body modules.
- Interactive body-region mapping or public 3D anatomy.
- Persistent learner profiles, formal assessment scoring, or accreditation claims.
- Runtime AI, vector search, provider integrations, shared admin, authentication, or databases.

## Public And Private Boundary

Public:

- reviewed condition pages;
- published neutral guided cases;
- region, anatomy-category, and learning-framework pages;
- static learner interactions that do not transmit or persist free text.

Private:

- all `ai-manager` tooling and intake;
- source imports and evidence proposals;
- private anatomy, special-test, outcome-measure, learning, and region briefs;
- unapproved 3D assets and experiments;
- drafts awaiting clinical or governance review.

## Release Rule

Nothing becomes public solely because a schema exists. Public eligibility requires validated metadata, an approved lifecycle state, required provenance and review fields, deterministic route/search inclusion, and a passing `npm run preflight`.
