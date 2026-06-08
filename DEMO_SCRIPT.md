# Demo Script

Use this as a concise trial-run path for the MSK Clinical Reasoning Lab demo.

## A. Public Learner Site

1. Open the home page and frame the project as a learner-facing MSK clinical reasoning reference.
2. Open `/demo` to show the trial status screen and safety cards.
3. Navigate by region to show the upper-quadrant structure.
4. Open a condition page and point out clinical organization, red flags, assessment cues, and management content where available.
5. Open a published guided case and show the case-based reasoning flow.
6. Use search or the red-flags page if available in the build.
7. Explain that draft and archived guided cases are intentionally hidden from public route generation.

## B. Local Case Manager

1. Start the Case Manager locally with:

```powershell
npm run case:manager
```

2. Show the active project root and confirm it is:

```powershell
C:\dev\msk-upper-quadrant-reference
```

3. Show project status and the Source Registry summary.
4. Explain the migration lifecycle:
   - Pending review = no draft yet.
   - Draft-created = draft exists but needs review.
   - Converted = published and reviewed.
   - Archived = intentionally hidden.
5. Show pending-review legacy stations and use the pending search/filter.
6. Show draft-created legacy stations as separate from pending stations.
7. Show converted stations as the reviewed/published set.
8. Open a station preview to show the legacy source material.
9. Demonstrate creating a draft case only if it is safe for the trial. Draft creation should not publish content.
10. Run preflight from the Case Manager or terminal and explain that publishing requires review.

## C. Safety Story

- Source metadata links generated cases back to legacy source IDs and paths.
- `check:hygiene` blocks draft notes, source notes, or TODO material from leaking into published content.
- `check:sources` validates legacy source metadata and duplicate source IDs.
- Static case route generation excludes draft and archived cases.
- Git remains the audit trail; do not auto-commit generated changes.

## D. Roadmap

- PowerPoint import for teaching decks and lecture material.
- Paper and evidence import for linked clinical reasoning notes.
- Shared admin access with authentication and review permissions.
- GitHub pull-request publishing workflow.
- AI-assisted case generation followed by human clinical review.
