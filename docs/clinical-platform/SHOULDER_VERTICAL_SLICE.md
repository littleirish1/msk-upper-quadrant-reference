# Governed Shoulder Vertical Slice

## Status

This implementation is a technical and governance vertical slice. It does not grant clinical, evidence, source-clearance, licensing or publication approval.

The public shoulder region continues to use only the previously published condition pages and the two previously published neutral guided cases. New shoulder Evidence Hub records, modules, compatibility rules, movement records, MCQ slots, 3D requirements and authoring data remain private and fail closed.

## Architecture

The slice connects these layers without allowing an upstream record to confer approval on a downstream record:

1. A governed source inventory records stable IDs, hashes, clearance state and withheld-locator status.
2. Private Evidence Hub condition and guided-case records hold revision-pinned structural relationships and explicit evidence gaps.
3. Clinical modules define empty, classified authoring slots for anatomy, presentation, assessment, management and prognosis.
4. Patient Truth Records retain atomic known, unavailable and intentionally withheld states for Guided, Conversation and Hybrid case modes.
5. Compatibility rules remain disabled until exact evidence and clinical review exists.
6. Movement, 3D and MCQ records define authoring requirements without adding clinical assertions, assets, answers or public routes.
7. The private authoring workspace aggregates exact review tasks.
8. The learner-facing shoulder page consumes only existing public condition selectors and public case summaries.

## Source Boundary

The inventory contains seven previously public repository artefacts and three metadata-only intake records. None of the selected sources is cleared for new private evidence processing in this task. Accordingly:

- no new clinical claim is created;
- no private source locator, filename, path or body is copied;
- no external reference is verified;
- no evidence summary or diagnostic-accuracy value is created;
- every new clinical authoring slot retains an evidence and human-review blocker.

Existing public repository material can preserve its reviewed baseline meaning. It does not approve a new module, claim, relationship or recommendation.

## Publication Boundaries

All new Evidence Hub records use `publicEligibility: false`. New module records use the private publication state, compatibility rules are disabled, movement records are private, 3D has no asset or route, and MCQ records contain no authored question or answer.

The public shoulder dashboard receives only:

- the count returned by the canonical public-condition selector;
- summaries returned by the governed public-case projection.

It does not import the AI manager, Evidence Hub repositories, source inventory or review data. Generated-output checks reject private shoulder IDs in the static export.

Static diagnosis disclosure remains pedagogical progressive disclosure, not secure storage. Delayed reveal assets may be retrieved if their opaque URL is discovered. Internal-only data must never enter the public export.

## Human Gates

The private shoulder workspace records tasks for source clearance, evidence appraisal, clinical review, anatomy and movement review, rights, accessibility, technical review and publication. Automated validation cannot complete these gates.

The current governed state is:

- sources inventoried: 10;
- sources cleared for new evidence processing: 0;
- new claims: 0;
- private module slots: 36;
- shoulder truth records: 3, including one existing private pilot;
- disabled compatibility-rule slots: 12;
- private movement slots: 20;
- planned 3D structures: 16, with zero assets;
- source-insufficient MCQ slots: 10, with zero authored questions;
- human review tasks: 100;
- public shoulder cases: 2;
- new public clinical routes: 0.

## Deterministic Commands

```powershell
npm.cmd run shoulder:generate
npm.cmd run test:shoulder
npm.cmd run check:shoulder-currentness
npm.cmd run build
npm.cmd run check:shoulder-output
npm.cmd run preflight
```

The same commands can be run as `npm run ...` on Linux. Generation uses stable ordering, UTF-8 JSON and no authoritative timestamp. The currentness check hashes governed artefacts before and after regeneration.

## Review Priorities

Independent review should verify:

- no intake locator or source body entered tracked output;
- Evidence Hub structural relationships do not imply evidence approval;
- every new module remains claim-free and private;
- Truth Record aliases do not invent absent findings;
- compatibility rules cannot be enabled without evidence and exact-revision review;
- movement records contain no unsupported range, ratio or muscle-role claim;
- the 3D registry contains requirements only and no unlicensed asset;
- MCQ slots contain no stem, options or answers;
- the private workspace is absent from routes, Search, sitemap and `out/`;
- the learner page uses only approved public projections and retains diagnosis boundaries.

## Next Controlled Work

The next content-development pass requires human source-clearance decisions followed by locator verification, evidence appraisal and clinician review. Only then may original paraphrased claims, movement explanations, questions or asset proposals be authored against an exact revision. Publication remains a separate exact-revision decision.
