# Legacy HTML Case Bank Import

This directory contains reviewed extraction evidence from the original single-page
legacy case-bank source. The raw source is private, publicly ineligible, and
intentionally absent from the working tree.

## Approved source version

| Field | Value |
|---|---|
| Source ID | `legacy-html-case-bank-v1` |
| Source type | `private-external-legacy-html` |
| Station count | 47 |
| Git blob ID | `4b107b93aee91d7f012d97aa42e6b8b7d19a638b` |
| SHA-256 | `488282ca6ce682d5ee56f0c700b4392e1cf32d2b8625c0ed165f2db5b7483bb3` |
| Public eligibility | false |
| Repository raw copy removed | true |

The fingerprint describes the exact last committed repository blob. It records
identity and accounting only; it does not establish authorship, licensing, clinical
approval, or permission to publish.

The 47 entries in `extracted/station-index.json`, the 47 station markdown files,
the migration tracker, and the source registry account for the imported station set.

## Re-extraction

Keep source material in an approved private location. Supply it explicitly by command
argument or set `LEGACY_HTML_SOURCE`:

```text
npm run extract:legacy-index -- <private-source-file>
npm run extract:legacy-station -- <station-id> <private-source-file>
npm run extract:legacy-all -- <private-source-file>
```

The extractors read exact file bytes and reject any SHA-256 mismatch. A legitimate
new source requires a reviewed source-version update; extraction must not silently
accept it.

Do not copy private source material into the repository. Secret-scan and review every
future import before commit.

## Workflow

1. Verify the approved private source version.
2. Extract into the repository's reviewed evidence structure.
3. Review extracted clinical content.
4. Track source provenance and review status in metadata.
5. Convert reviewed items into MDX.
6. Publish only after clinical review and all repository checks pass.

## Safety

Extracted material is unreviewed by default. Extraction never grants permission to
publish and does not establish clinical approval or licensing.