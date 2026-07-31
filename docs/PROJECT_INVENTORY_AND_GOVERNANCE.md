# Project Inventory And Governance

## Authoritative Inventory

`reports/governance/project-inventory.json` is the generated cross-programme
inventory. It reconciles:

- legacy stations;
- governed guided cases;
- condition pages;
- anatomy, special-test, outcome-measure, and learning records;
- region plans;
- catalogued private evidence sources;
- Evidence Hub records;
- expected public routes;
- public Search entries;
- registered visual assets.

Every item has a stable ID, content type, region, source fingerprint or revision,
independent review and clearance states, publication state, route, blockers,
and next action.

The inventory deliberately uses neutral legacy station labels. It does not copy
personal names or private source paths into the generated report.

## Private Governance Dashboard

`reports/governance/governance-dashboard.json` is private machine-readable
status data. It has no public route and is prohibited from the static export.
It contains queue membership for:

- clinical review;
- evidence review;
- source clearance;
- stale approvals;
- publication blockers;
- unaccounted legacy stations;
- dependency and security work.

An absent review date is not interpreted as approval or silently assigned a due
date. The queue records the absence and leaves the human decision explicit.

## Generation And Currentness

```bash
npm run programmes:generate
npm run check:programmes
```

Generation uses stable ordering, tracked inputs, UTF-8, LF output, and no
authoritative timestamps. Currentness regenerates into a temporary directory
and compares canonical text without overwriting tracked output.

## Governance Meaning

Inventory presence is not evidence approval, source clearance, clinical
approval, or publication approval. Existing reviewed public content remains
public under its established baseline, while missing Evidence Hub relationships
are recorded as gaps. Draft and private records remain unavailable to public
routes, Search, sitemap, navigation, and static output.
