# Guided Cases And Evidence Hub

Guided-case relationships are private, revision-aware governance data. They do
not create public Evidence Hub routes, search entries or browser bundle imports.

The current Evidence Hub catalogue contains no approved records or
relationships. Guided Cases v2 therefore records zero verified links and keeps
condition/evidence associations as explicit unresolved gaps. No placeholder
Evidence Hub entity was invented for this migration.

A future relationship may be accepted only when:

- the target entity exists at the pinned revision;
- the governed relationship exists with the expected role;
- source and target lifecycle/review states permit the intended private use;
- the relationship and review decision apply to the exact current case
  revision and canonical hash;
- any evidence summary used publicly is separately approved and explicitly
  publication-safe.

A condition reference, source record or older approval cannot make a case
eligible by itself. Missing, stale, private, restricted, unverified or
unapproved dependencies fail closed. Changing the case revision or hash
invalidates the publication pin and requires a new human decision.

`reports/guided-cases/evidence-relationship-catalogue.json` is the deterministic
private review catalogue. Its verified relationship count remains zero until
real governed Evidence Hub records are available.
