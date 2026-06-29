# Review 0002 - Diagnosis-by-association leakage fix

## Verdict

Safe to commit.

The diagnosis-hidden invariant is enforced across the current live regions. Preflight passed against 6 published cases and 33 live condition pages.

## Scope reviewed

- Condition page to matching guided case leakage
- Unrevealed case to matching condition page leakage
- Reveal-gated condition link behaviour
- Neutral `/cases` discovery
- Search index exposure
- Strengthened no-leak checks

## Follow-up items

### F1 - Browser smoke test reveal behaviour

Manually confirm in a browser that the condition link is not visible on case page load and only appears after the diagnosis reveal step.

### F2 - `/cases` discovery coverage check

Strengthen checks so every published case is confirmed to appear on `/cases`. Current leakage check may pass silently if a published case is missing from the discovery page.

### F3 - Derive live regions from taxonomy

Avoid hardcoded `LIVE_REGION_SLUGS`. Live regions should be derived from `src/data/taxonomy.ts` so new regions are not silently skipped.

### F4 - Make taxonomy parsing less brittle

The no-leak check currently depends on taxonomy field ordering. Phase 3C/T3.2 shared schema work should replace this with validated data loading.

### F5 - Remove redundant per-case condition-page check

There may be duplicated checking between the main case loop and the broader condition-page scan. Clean up after schema/data loading is centralised.

## Next action

Proceed to Phase 3C shared frontmatter schema implementation, using these follow-ups as acceptance criteria where relevant.
