# Legacy Source Provenance

## Approved identity

| Field | Value |
|---|---|
| `sourceId` | `legacy-html-case-bank-v1` |
| `sourceType` | `private-external-legacy-html` |
| `stationCount` | 47 |
| `gitBlobId` | `4b107b93aee91d7f012d97aa42e6b8b7d19a638b` |
| `sha256` | `488282ca6ce682d5ee56f0c700b4392e1cf32d2b8625c0ed165f2db5b7483bb3` |
| `publicEligibility` | false |
| `repositoryRawCopyRemoved` | true |

The Git blob identifier and SHA-256 were calculated from the exact last committed
blob bytes. No text conversion was used. The prior blob contained 789,580 bytes and
6,527 newline-delimited lines.

These values identify the reviewed repository extraction snapshot. They do not prove
authorship, licence, ownership, clinical approval, or external credential safety.

## Accounting

The approved source contains 47 indexed stations. Repository accounting requires:

- 47 station IDs in the station index,
- 47 extracted station markdown files,
- the same 47 source IDs in the source registry,
- the same 47 source IDs in the migration tracker.

A mismatch blocks review until it is explained.

## Private-source handling

- The raw repository copy is removed from the working tree.
- Future operators supply a private source file by argument or `LEGACY_HTML_SOURCE`.
- Extractors hash exact bytes before parsing.
- A fingerprint mismatch fails without copying the source into the repository.
- A legitimate replacement requires a new reviewed source ID and fingerprint.
- Private absolute source paths must not be logged or committed.

## History boundary

The deleted blob remains reachable from Git history and remote refs. Repository-side
removal does not purge history and does not rotate any external credential. Those
actions require the human-controlled process in `docs/HUMAN_ACTIONS_REQUIRED.md`.
