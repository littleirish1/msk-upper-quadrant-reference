# UX Invariants

This contract defines learner-facing UX rules for guided cases, condition pages, and future UI work.

## Diagnosis Hiding

Diagnosis must not be spoiled before reveal anywhere the learner can see it, including:

- URL
- page title
- breadcrumb
- case card
- chips or tags
- search result
- related links
- metadata rendered into the page
- pre-reveal HTML

The final diagnosis or linked condition may appear only in the final reveal step or in an area that is safely gated after reveal.

Condition/reference links that identify the answer may appear only after reveal. Condition pages may exist as reference pages, but they must not link directly to a matching unrevealed guided case.

## Guided Case Flow

Case pages must show a clear neutral case presentation before asking reasoning questions.

The pre-question presentation should use existing safe case content. Do not invent clinical facts in UI-only diffs.

Guided case prompts should support active reasoning before answer reveal:

- leading hypothesis
- supporting features
- caution or safety features
- next assessment priorities

Per-question feedback must not expose the final diagnosis early. Feedback should focus on reasoning process, safety thinking, assessment planning, and how to use the presented information.

## Reveal Behaviour

Reveal controls should be closed by default and keyboard accessible.

Native `details` and `summary` are acceptable for comparison panels because they provide built-in keyboard operation. If the reveal mechanism changes, `check:reveal` and `check:no-leak` must be updated in the same diff.

The diagnosis reveal must remain separate from reasoning-process feedback. Per-question feedback can be toggled open and closed without confirming the final answer.

## Mobile And Navigation

Mobile readability is required:

- presentation text must be readable on narrow screens
- text boxes must remain usable
- feedback toggles must not clutter the page
- bottom navigation must remain usable
- controls must wrap cleanly without horizontal overflow

## Runtime Boundaries

The public site must remain static and dumb:

- no runtime AI
- no APIs
- no databases
- no vector stores
- no answer storage
- no learner analytics

## Current Status

- F2 is closed: route smoke confirms 6 published cases are discoverable from `/cases` and 3 private cases are excluded.
- F1 automated checking is added and passing through `check:reveal`.
- Manual F1 browser smoke testing was passable, but raised UX issues around case presentation prominence and per-question feedback toggles.

## Review Rule

No clinical content changes should be included inside UI-only diffs. If clinical wording or case facts need to change, use a separate clinically reviewed content task.

