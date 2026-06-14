# MSK Clinical Reasoning Lab — Master Build & Review Brief

> A single agent-executable runbook. Hand it to a coding agent (Codex / Claude Code) and work through it in order. Every task has acceptance criteria — a task is not "done" until its criteria pass on a **Linux** runner.

---

## 0. How to use this brief

**Roles (generator / reviewer split):**
- **Generator** (e.g. Codex, async): does the bulk edits and drafting from this brief.
- **Reviewer** (e.g. Claude, deliberate): audits diffs against the contracts + rubric in Phases 4–5. Reviews the *delta*, not the whole repo.
- **Human clinician:** the only party that can mark clinical content as publishable. The agents may draft and audit; they never sign off clinical claims.

**The publish gate is fixed:**
`Generator drafts → Reviewer audits structure/reasoning → Clinician approves clinical content → ship.`

**Minimal-API discipline:** decide expensive things once and write them down (Phase 4 contracts), then make execution deterministic (scripts, codegen, schema validation). Never generate clinical content in a live loop — one drafting pass per case, then review.

---

## 1. Operating rules (apply to every task)

- **Do not auto-commit.** Produce diffs and a report; a human commits.
- **Do not publish draft cases.** `status: draft|archived` must never reach `out/`.
- **Do not expose `ai-manager/`** in the build output. `out/ai-manager` must not exist.
- **Do not weaken** hygiene / source-integrity / route / preflight checks. Only strengthen them.
- **Public site stays static and dumb:** no runtime AI, API calls, database, or vector store in the deployed site. Case interactions are client-side only, with no answer storage.
- **Diagnosis stays hidden** until the learner reveals it (see Phase 1 for the precise, testable definition).
- **AI-drafted clinical content is `draft` until a clinician reviews it.**
- **Run validation before reporting any phase done:**
  `npm run registry:sources && npm run check:hygiene && npm run check:sources && npm run check:routes && npm run build`
  (Add any of these scripts that are missing — see Phase 2/3.)

---

## 2. Load context first (cheap orientation)

Before editing, read these and treat them as the source of truth, in this order:
1. `AGENTS.md` (create in Phase 4 if absent) — conventions, guardrails, frozen file/route model.
2. `src/data/taxonomy.ts` — the canonical region/condition list.
3. `src/lib/mdx.ts` — how content is actually loaded (**flat single file per condition**, sections split on `##`).
4. The four design contracts from Phase 4, once they exist.

Do **not** re-crawl the whole tree each session. If you need a fact about structure, it belongs in `AGENTS.md`; if it's not there, add it.

---

## 3. Work phases

### Phase 0 — Release blockers (do first, in order)

**T0.1 — Rotate the leaked credential (human action, out of band).**
A live Google API key (prefix `AIzaSyBq-…`) is committed in `content/imports/html-case-bank/raw/index.html`. It has also left the building inside shared exports. **Revoke/rotate it in the Google console before touching code.** No code change makes an exposed key safe.
- *Acceptance:* key revoked/rotated upstream.

**T0.2 — Remove the secret from the repo and prevent regression.**
Redact or delete the key from `raw/index.html`; add a secret scan (`AIza…`, `sk-…`, `API_KEY`, `PRIVATE_KEY`) into `preflight`.
- *Acceptance:* `grep -rE 'AIza[0-9A-Za-z_-]{20,}' content` returns nothing; preflight fails if any secret pattern is present.

**T0.3 — Make `clean:build` cross-platform.**
`package.json` still uses Windows-only `cmd /c …`. Replace with `scripts/clean-build.mjs` using `fs.rm('.next', {recursive:true, force:true})` and `out` likewise; point the script at it.
- *Acceptance:* `npm run clean:build` succeeds on Linux; `npm run preflight` runs end-to-end on a Linux runner.

**T0.4 — Fix the hygiene checker's Linux self-scan.**
`scripts/check-content-hygiene.mjs` `IGNORE_FILES` uses backslash paths, so on Linux it scans its own config/rules (which contain the flagged names) and fails. POSIX-normalize `relativePath` (reuse the `toPosix` helper from `check-case-source-integrity.mjs`) **and** move the denylist out of the scanned tree (see T3.6).
- *Acceptance:* `npm run check:hygiene` passes on Linux; ignore matches the config + rules files.

### Phase 1 — Make the "diagnosis hidden" invariant real and testable

> Definition to adopt: *"diagnosis hidden" = not spoiled anywhere the learner sees before reveal — UI labels, chips, sidebar, breadcrumbs, page title, **or the URL**.* `RevealAnswer` is a native `<details>`, so the answer text ships in the HTML; this is acceptable for an educational tool, but document it honestly as "not spoiled," not "cryptographically hidden."

**T1.1 — Neutralize case slugs/filenames.**
Files like `cervical/cervical-radiculopathy-case-01.mdx` leak the diagnosis in the URL. Rename to neutral slugs (e.g. `cervical/case-01.mdx`) or map a neutral public slug while keeping an internal id. Keep the real diagnosis only in non-rendered frontmatter.
- *Acceptance:* no case URL contains a condition slug.

**T1.2 — Gate diagnosis labels behind the reveal everywhere.**
Remove pre-reveal diagnosis tells: the "Condition link: …" chip on the case page, "Linked condition: …" and diagnosis-bearing `learningFocus` chips on `/cases`, and the `currentCondition` sidebar highlight.
- *Acceptance:* rendered pre-`<details>` HTML for any case contains neither the condition label nor its slug.

**T1.3 — Add a "no-leak" test to CI.**
Build the site, then for each case grep the HTML *before* its first `<details>` for the case's condition label and slug; fail the build on a hit.
- *Acceptance:* test runs in `preflight`; passes on current published cases.

**T1.4 — Fix the `wrist - hand` slug.**
`content/cases/wrist - hand/` (spaces) doesn't match taxonomy slug `wrist-hand`, so `getRegion` returns undefined and URLs contain spaces. Rename to `wrist-hand`.
- *Acceptance:* case resolves its region label; no spaces in any generated path.

### Phase 2 — Reconcile architecture, docs, and deployment

**T2.1 — Make the docs match reality.**
`README.md` / `ARCHITECTURE.md` describe an `[region]/[condition]/[section].mdx` (8-files-per-condition) model that no longer exists. Rewrite to the flat single-file model; mark `SECTIONS` as in-page nav only (or delete if unused).
- *Acceptance:* docs describe what `getConditionContent` actually does.

**T2.2 — One deploy target, one gate.**
Both `netlify.toml` and `.github/workflows/deploy.yml` (GitHub Pages) are configured with opposite `basePath` handling, and the Pages path runs only `npm run build` — skipping hygiene/source/secret checks. Pick one host; delete the other; ensure the surviving CI runs the **same `preflight` gate** and builds the search index.
- *Acceptance:* a single deploy path; CI runs the full gate; asset paths resolve on the chosen host.

**T2.3 — Add the missing route check.**
`npm run check:routes` is referenced (File 1) but no `check-routes.mjs` exists. Add a route smoke check (every taxonomy route + every published case renders, no 500s, no draft leakage).
- *Acceptance:* `check:routes` exists and is part of `preflight`.

### Phase 3 — Determinism and tooling (this is where API spend drops)

**T3.1 — Search index always current.**
Fold `build-search-index.mjs` into a `prebuild` step; fix the builder to not treat `cases/` and `imports/` as pseudo-regions (index cases intentionally or skip them).
- *Acceptance:* `/search` is correct immediately after any build with no manual step.

**T3.2 — One validated frontmatter schema.**
Introduce a single zod schema for condition + case frontmatter, shared by the app and scripts; retire the two hand-rolled YAML parsers in the check scripts.
- *Acceptance:* invalid frontmatter fails locally with a clear message; all existing content passes.

**T3.3 — Codegen from taxonomy.**
Generate region/nav scaffolding from `taxonomy.ts` so adding a condition is a data edit only.
- *Acceptance:* adding a condition requires no hand-written page/nav code.

**T3.4 — Minimal test layer.**
Unit tests for `mdx.ts` parsing + sanitization, a link checker, and the Phase 1 no-leak assertion.
- *Acceptance:* tests run in CI and pass.

**T3.5 — Replace regex MDX sanitization.**
Swap the brittle `<`/`>` string-replacement for a remark/rehype approach or a documented authoring rule (`&lt;`, backticks). 
- *Acceptance:* `<45`, `>90%`, `p<0.05` render correctly without per-string hacks.

**T3.6 — Information-governance cleanup.**
Move the real-name denylist out of the scanned content tree (env/external file the scanner reads but never walks). Purge `raw/index.html` from the repo once extraction is complete; keep only redacted/extracted derivatives.
- *Acceptance:* no real staff names in committed scanned content; raw legacy HTML removed from the tree.

### Phase 4 — Design-phase delegation (freeze the contracts)

**Freeze the taxonomy/route contract first** — the other three depend on it. Then run four briefs (parallel if independent, sequential if one agent), each producing a markdown spec **with acceptance criteria**:

| Brief | Output | Owns |
|------|--------|------|
| Content & clinical schema | `CONTENT_SCHEMA.md` | case schema, frontmatter, evidence/provenance, reveal pedagogy |
| Information architecture | `IA_AND_ROUTES.md` | flat-file model, taxonomy as truth, routing, nav |
| Interaction & UX | `UX_INVARIANTS.md` | the no-leak invariant (Phase 1), mobile, accessibility |
| Governance & build | `GOVERNANCE_AND_CI.md` | SaMD/IG boundary, review-gate fields, secrets/PII, single-target CI |

An orchestrator merges the four into one spec and writes/updates **`AGENTS.md`** (conventions + guardrails from §1 + frozen file/route model). These contracts are what Phase 5 reviews against.
- *Acceptance:* four specs exist with acceptance criteria; `AGENTS.md` committed; no open contradictions between them.

### Phase 5 — Stand up the periodic review loop

- **Trigger:** per milestone (a PR, a new region, a batch of cases, a build-system change) — not the calendar.
- **Inputs to the reviewer each cycle:** the **diff/changed files + the contracts + the previous review log** (not the whole repo).
- **Output:** a dated entry in `docs/reviews/` that, for each open item, records *closed / regressed / new*, references the prior baseline, and lists residual risks.
- **Baseline:** seed `docs/reviews/0001-baseline.md` with the Phase 0–3 findings above so cycle two has something to measure against.
- *Acceptance:* `docs/reviews/` exists with a baseline; the rubric in the appendix is followed each cycle.

---

## 4. Reporting format (after every phase)

Hand back, in this shape:
- **Changed files:** list.
- **Acceptance status:** one line per task — `pass / regressed / blocked` with a one-line reason.
- **Residual risks:** anything not fully closed.
- **Validation output:** the result of the §1 validation command.

No prose essays; the report is a status surface, not a narrative.

---

## Appendix — Fixed review rubric (the reviewer's lens)

Score each cycle on these axes only, so reviews stay comparable:

1. **Build health** — does `preflight` pass cross-platform, with search index current and one deploy path?
2. **Invariant compliance** — no diagnosis leak (UI + URL); drafts gated; no secrets/PII in committed content.
3. **Architecture drift** — does the change match the frozen contracts, or did it diverge silently?
4. **Content/clinical structure** — red-flag screening present, differentials reasoned, `reviewedBy` + `lastReviewed` set on published content. (Structure only — clinical correctness is the clinician's gate.)
5. **Open-risk movement** — did this cycle close, hold, or regress items from the last review log?
