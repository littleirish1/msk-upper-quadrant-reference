# Private Clinical Authoring and Review Workspace

The authoring workspace lives only under `ai-manager/clinical-platform/workspace/` and is served on `127.0.0.1`. It has no Next route, public import, navigation entry, Search/sitemap record, static export, query-string bypass, provider call, or write API.

The deterministic snapshot derives exact IDs, revisions, hashes, lifecycle/publication states, inventories, and queue totals for modules, truth records, rules, recipes, seeded/provider-free previews, cases/transcripts, regional content, MCQs, Evidence Hub/ingestion, movement, 3D, and legacy reconciliation. Queues cover clinical, evidence, source, licensing, accessibility, anatomy, movement, stale approvals, beta issues, dependency risks, and publication decisions.

Reviewers can inspect/filter records, draft an ephemeral note, and download a JSON review packet. Notes never change authoritative truth and are not persisted. Start locally with `npm run authoring:v1` after `npm run authoring:generate-v1`.
