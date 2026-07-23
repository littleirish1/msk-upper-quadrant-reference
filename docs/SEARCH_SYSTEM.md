# Search System

## Scope

The public search is a deterministic, client-side search over the generated
`public/search-index.json`. The index contains public condition records only.
Guided cases, draft/private content, imports, Evidence Hub records, and
`ai-manager/` content are excluded before indexing.

`src/lib/searchEngine.ts` is the single search implementation. React renders
its returned state and does not maintain a second, asynchronous results state.

## Query States

- **Empty:** no matching results are shown.
- **Too short:** fewer than two normalised characters returns no matches and
  asks the learner for at least two characters.
- **No results:** a valid query with no evidence returns an explicit
  no-results state.
- **Results:** every item has a positive score, matched tokens, field-level
  evidence, and a learner-facing snippet.

Search is synchronous once the static index has loaded, so a new query replaces
the previous result set in the same render. The `q` URL parameter is read on
load and browser history changes; input changes replace that parameter without
navigation. The static index is cached for the current module session only and
is fetched with browser HTTP caching disabled to avoid retaining a previous
deployment's index.

## Normalisation

Queries and fields use the same normalisation:

1. Unicode compatibility decomposition and diacritic removal.
2. Lowercasing.
3. Ampersand expansion to `and`.
4. Apostrophe removal.
5. Punctuation and hyphen conversion to spaces.
6. Whitespace collapse.

Token matching uses complete tokens. Prefix matching is allowed at governed
minimum lengths: two characters for titles, aliases, regions, categories, and
keywords; three for summaries and headings; four for body text. Arbitrary
single-character and inside-word substring matching is not used.

## Ranking

The central score tiers in `SEARCH_RANKING` establish this order:

1. Exact normalised title.
2. Exact governed alias.
3. Title phrase.
4. Title prefix.
5. Title token.
6. Alias phrase, prefix, or token.
7. Region or category.
8. Governed keyword.
9. Summary.
10. Section heading.
11. Body text.

Matching all significant query tokens receives a coverage bonus. One- and
two-token queries require every token. Longer queries require at least 60% of
their significant tokens, and partial matches remain below stronger title or
alias evidence. Supporting evidence is capped so repeated weak fields cannot
overtake a stronger ranking tier.

Ties are resolved by score, matched-token count, normalised title, stable ID,
and URL. The original JSON array position is never a tie-breaker. The public UI
renders the complete genuine match set rather than hiding weak matching behind
an arbitrary result truncation.

## Alias Governance

Aliases are metadata, not query-specific code. Current aliases live in the
canonical taxonomy and are copied into the generated index. The engine contains
no condition-specific boosts or exclusions.

## Index Contract

Every index record must include:

- a stable ID and unique public URL;
- title, aliases, region label, category, keywords, summary, headings, and
  learner-facing body text;
- `status: published`;
- `publicEligibility: true`.

The runtime parser rejects malformed, duplicate, or non-public index records.
The search engine also filters records defensively. Index generation starts
from `getPublicConditionRecords()`, so taxonomy/content mismatches fail before
the JSON is written.

## Validation

`npm run test:search` covers query states, ranking, normalisation, stale-result
transitions, malformed records, publication gating, duplicate handling, and
MDX extraction.

After the build, `npm run check:search` validates the complete generated index.
It retrieves every exact title and configured alias, compares rankings against
a deterministically shuffled index, rejects duplicate/inconsistent metadata,
requires positive match evidence, and verifies that an unmatched query cannot
fall back to default records.
