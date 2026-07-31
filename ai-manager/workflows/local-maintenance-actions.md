# Local Maintenance Action Policy

The local manager may inspect tracked repository state, draft governed
proposals, run deterministic validation, prepare explicit staging lists, and
generate review packets. It may not push, merge, deploy, approve clinical or
evidence content, approve source clearance, or approve publication.

Action logs contain command category, affected tracked paths, exit status, and
artifact hashes. They do not store secrets, private source text, or protected
cache paths. Provider mode is disabled and preflight requires no network.

The private authoring workspace is a local service/data layer. It has no public
route, static export, Search entry, sitemap entry, or browser bundle import.
Remaining interface work is explicitly listed in
`ai-manager/case-manager/workspace.json`.
