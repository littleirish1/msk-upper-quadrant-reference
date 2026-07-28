# Guided Case Disclosure Boundary

## Purpose

Guided cases use pedagogical progressive disclosure. The diagnosis and answer-linked material must not be delivered with the initial case page, even when React state would keep it visually hidden.

This is not a confidentiality or access-control mechanism. A static export cannot provide security-grade secrecy for data that the public browser must eventually retrieve. Opaque reveal identifiers reduce accidental discovery; they do not make the reveal assets private.

## Initial Delivery

Before an explicit learner reveal action, diagnosis-bearing data must be absent from:

- HTML and metadata
- inline scripts, embedded JSON, React hydration data, and RSC payloads
- initially referenced JavaScript or JSON assets
- preload and prefetch references
- search, sitemap, breadcrumbs, route labels, cards, navigation, and accessibility labels
- server-to-client component props

The initial client component may receive neutral learner-facing labels, UI state, and an opaque reveal identifier. Reveal filenames and URLs must not contain diagnosis labels or condition slugs.

## Delayed Reveal

Each published case has a build-generated JSON reveal payload under `public/case-reveals/`. The filename is derived from the neutral public case route using a stable hash. The payload can contain:

- the internal case title
- the matching condition label and route
- suggested reasoning content compiled from the existing case MDX
- reveal-gated enhanced feedback

The browser requests this payload only after the learner activates a diagnosis, suggested-reasoning, or enhanced-feedback control. There is no eager import, prefetch, preload, search entry, sitemap entry, or navigation link to a reveal payload.

Loading failures leave the diagnosis and reasoning hidden and present a retryable error. A payload must carry the expected opaque identifier, which prevents a response for one case from being shown after navigation to another.

## Validation

`check:no-leak` derives restricted values from validated guided-case frontmatter and taxonomy data. It scans the complete initial HTML and public runtime bundles, reconciles the delayed payload inventory, verifies payload identity and condition links, and confirms cases remain absent from search.

`test:case-reveal` checks base-path URL resolution, payload validation, loading failure, and stale-case identity rejection. These checks must be updated in the same change as any reveal transport or component-boundary change.
