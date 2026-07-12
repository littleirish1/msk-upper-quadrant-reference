# User Knowledge Store Architecture

This document lays groundwork for a future personal learning layer. It does not propose adding login, databases, APIs, or external services before the current demo phase.

## Purpose

The future product may allow each learner to build a personal knowledge database alongside the reviewed public clinical reasoning content.

The public site should remain distinct from private user data:

- Public content: reviewed cases, condition pages, red flags, search, demo pages.
- Private user data: notes, reflections, bookmarks, saved cases, uploaded personal sources.

## Trust-approved AI pathway: Microsoft Copilot-first option

The Trust currently has an agreed Microsoft Copilot licence. If personal knowledge features later include AI assistance, Microsoft Copilot, Copilot Studio, and the Trust-approved Microsoft 365 environment should be considered before direct external AI providers.

This is planning guidance only. It does not approve storing user notes in Microsoft 365, connecting Copilot to user data, or creating custom agents. Local information governance, IT/security, clinical safety, and procurement approval would be required.

Key implications for personal knowledge storage:

- Public static content can remain AI-free and low risk.
- Personal notes and reflection answers should not be sent to any AI service until data-flow, retention, audit, and consent questions are answered.
- If Copilot is used, approved data locations such as SharePoint, Teams, or other Trust-governed stores may be safer than external AI services, subject to local policy.
- Any AI-generated personal study output should remain educational, private to the user unless explicitly shared, and clearly separated from reviewed global content.

Governance questions:

- Does the Trust licence include Copilot Chat, Microsoft 365 Copilot, or Copilot Studio?
- Are custom agents allowed?
- Can learner notes or teaching materials be processed?
- Where are prompts, outputs, and logs retained?
- Can users delete or export AI-assisted notes?
- Are patient-like scenarios synthetic/anonymised?
- Who approves generated content before it becomes public or institutional teaching material?

Recommended position:

- Do not add AI to personal knowledge storage before the Friday demo.
- Prototype non-sensitive local notes/bookmarks first.
- Assess the Trust Copilot pathway before external RAG over personal notes.
- Treat external AI/RAG over personal data as a later, higher-governance option.

## Use Cases

Potential personal features:

- Saved cases.
- Personal notes.
- Reflection answers.
- Progress tracking.
- Bookmarks.
- Personal evidence snippets.
- Uploaded learning materials later.
- Revision dashboard.
- Spaced repetition later.
- Personal weak areas.
- Private collections for exam, placement, or CPD preparation.

## Data Model Concept

Possible entities:

- `user`: account identity.
- `profile`: display preferences, role, learning goals.
- `savedCase`: user-saved public case reference.
- `caseAttempt`: a run through a guided case.
- `reflectionAnswer`: text entered into reasoning prompts.
- `bookmark`: saved condition, case, section, or evidence note.
- `note`: private user-authored note.
- `personalSource`: user-uploaded or user-created source material.
- `personalCollection`: grouped notes, cases, and sources.
- `progressEvent`: lightweight event for completion, reveal, revisit, or self-rating.

Illustrative shape:

```json
{
  "userId": "user_123",
  "savedCases": [
    {
      "casePath": "content/cases/cervical/cervical-radiculopathy-case-01.mdx",
      "savedAt": "2026-06-12",
      "tags": ["exam", "neuro-screening"]
    }
  ],
  "caseAttempts": [
    {
      "caseSlug": "cervical-radiculopathy-case-01",
      "startedAt": "2026-06-12",
      "completedAt": null,
      "selfRating": "needs-review"
    }
  ]
}
```

This is a concept, not a committed schema.

## Privacy And Governance

Principles:

- Data minimisation.
- Data protection by design.
- No patient-identifiable data.
- Clear export and delete account pathway.
- Encryption considerations for sensitive private learning notes.
- Role-based access later for learner, educator, reviewer, and admin roles.
- Strict separation between reviewed public content and private user data.
- Clear warnings against entering real patient identifiers into notes or reflections.

If institution pilots are pursued, data protection impact assessment and legal review should happen before collecting personal data.

## Storage Options

### Local-Only Prototype

Use for early design exploration only.

Benefits:

- Low risk.
- No hosting complexity.
- Good for testing note and bookmark UX.

Limits:

- Not portable across devices.
- Not suitable for real personal data workflows.

### Browser LocalStorage

Use only for demo-only, non-sensitive notes.

Benefits:

- Fast to prototype.
- No backend.

Limits:

- Not secure for sensitive data.
- Easy to lose.
- Not appropriate for real account features.

### SQLite Or Postgres

Potential direction for a real app.

Benefits:

- Structured data.
- Better auditability.
- Works with server-side app patterns.

Limits:

- Requires hosting, backups, security, and migrations.

### Supabase, Firebase, Auth.js, Clerk

Possible later options:

- Supabase for Postgres plus auth/storage.
- Firebase for managed app data and auth.
- Auth.js for flexible authentication in a custom stack.
- Clerk for managed user authentication.

Selection should depend on cost, data residency, institution requirements, developer workflow, and privacy review.

### Institution-Hosted Storage

Potential later option for universities, NHS education teams, or clinic groups.

Benefits:

- Local control.
- Easier alignment with institution policies.

Limits:

- More deployment and support complexity.

## RAG And Personal Knowledge Future

Future personal retrieval could include:

- Personal source index.
- User-owned source library.
- Retrieval over private notes.
- Retrieval over saved reflections.
- Links between public reviewed content and private study notes.

Boundaries:

- Global reviewed content and private user notes must remain clearly separate.
- Private notes should not train or alter global content unless the user explicitly contributes and review accepts it.
- Public pages should not expose private indexes or source material.

## Recommended First Implementation

Do not add a user system before the Friday demo.

Suggested sequence after the demo:

1. Prototype local-only note and bookmark model for one browser.
2. Add export/import for local notes.
3. Test whether learners actually use notes and saved cases.
4. Design authenticated personal dashboard.
5. Choose storage/auth provider after privacy and deployment review.
6. Add account features behind feature flags or a private beta.

## Open Questions

- Are users individuals, institutions, or both?
- Does the product need educator dashboards before personal accounts?
- What learner data is genuinely useful and proportionate to store?
- What data must never be stored?
- Will institution pilots require UK-hosted data?
- How will users export, delete, or transfer their learning history?
