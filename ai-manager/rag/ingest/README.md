# Ingestion Scaffolding

Future ingestion scripts can live here for local source indexing experiments.

Possible scripts:

- `ingest-mdx-sources.mjs`
- `ingest-powerpoint-text.mjs`
- `ingest-paper-extracts.mjs`
- `build-local-index.mjs`

Ingestion should preserve `sourceType`, `sourceId`, `sourcePath`, review state, and stable chunk identifiers. Imported content is unreviewed until checked.

Do not implement OCR, live API calls, embeddings, or vector database writes in this scaffold.
