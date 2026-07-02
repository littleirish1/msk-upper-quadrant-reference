# Review 0004 - App reader schema unification

## Verdict

Safe to commit after blocker fixed.

The Phase 3C-4 runtime content reader now validates condition and guided case frontmatter against the shared frontmatter schema. Preflight passed after the guided case status blocker was fixed.

## Scope reviewed

- `src/lib/mdx.ts` runtime app reader
- `src/lib/contentSchemas.ts` shared schemas
- `src/components/ui/QuickFacts.tsx` typing change
- Phase 3C-4 goal: runtime content loading now validates against shared frontmatter schema

## Blockers

### B1 - Guided case status default weakened publish gate

The first review found that guided case status had been changed to `default('published')`, which weakened the publish gate.

Risk:
A guided case missing explicit status could silently become published.

Fix:
Guided case status was reverted to required in `src/lib/contentSchemas.ts`. All 9 guided cases have explicit status. `check:frontmatter` and preflight passed after the fix.

## Validation

- `check:frontmatter` passed with 33 condition files and 9 guided case files
- Build passed
- Search check passed
- Diagnosis no-leak passed with 6 published case routes, 3 private routes excluded, and 33 condition pages checked
- Route smoke check passed
- `npm run preflight` passed after the blocker fix

## Closed

R2 from review 0003 is closed.

The runtime app reader now uses the shared frontmatter schema.

## Remaining follow-ups

### R5 - Shared reader consolidation

App and scripts now share schema but still use separate readers. A single shared reader remains future work.

### R1 - Script-side TypeScript loading fragility

Data-URL TypeScript transpile fragility remains in script-side loading, especially if `contentSchemas.ts` or `taxonomy.ts` gain relative imports.

### F1 - Browser smoke test reveal behaviour

Manual browser reveal smoke test remains open.

### F2 - `/cases` discovery coverage check

Add coverage proving every published case appears on `/cases`.

### F5 - Tidy repeated scans

Repeated case re-read/revalidation and redundant scans can be cleaned later.

### R3/R4 - Prior review carry-forward

R3/R4 carry forward unchanged from the prior review if still applicable.
