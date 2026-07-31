# Private Source Intake Adapters

The existing source-intake engine is the authoritative private ingestion path.
Programme 4 adds only adapter contracts and synthetic fixtures; it does not read
the protected intake cache or copy source bodies into Git.

Supported adapter intents are PDF, PowerPoint, Word, spreadsheet, HTML, plain
text, image metadata, video metadata, and archive inventory. Each adapter must
preserve source checksum plus page, slide, sheet, section, note, table, or
archive-member provenance. Unsupported or encrypted input fails closed.

Tracked proposals may contain counts, IDs, hashes, classifications, and short
original summaries. They must not contain source bodies, private absolute paths,
identifiers, copyrighted figures, or sensitive matches. Every output remains
blocked pending privacy, copyright, source-clearance, evidence, and clinical
review.

No network adapter is enabled. Safe synthetic fixtures exercise schema and
boundary behaviour without touching a private inbox.
