# Demo Script

Use this as a concise trial-run path for the MSK Clinical Reasoning Lab demo.

## A. Public Learner Site

1. Open the home page and frame the project as a learner-facing MSK clinical reasoning reference.
2. Open `/demo` to show the trial status screen and safety cards.
3. Open `/future` from the demo page to frame the post-demo roadmap.
4. Explain that upper quadrant is Phase 1 of a future whole-body physiotherapy clinical reasoning platform.
5. Navigate by region to show the upper-quadrant structure.
6. Open a condition page and point out clinical organization, red flags, assessment cues, and management content where available.
7. Use the related guided cases panel on a condition page, or open `/cases`, to show published case studies without diagnosis-revealing card titles.
8. Open a published guided case, type a leading hypothesis, supporting features, features against, and next assessment priorities.
9. Reveal the likely diagnosis / linked condition, then reveal the suggested reasoning and continue through the case.
10. Return to the module, then open a condition page.
11. Click section buttons such as Overview, Pathophysiology, and Outcome Measures and confirm the active "On this page" item follows the selected section.
12. Mention that only reviewed/published cases are public; draft and archived guided cases are intentionally hidden by route checks and source checks.

## Friday Demo Path

1. Open `/demo`.
2. Explain public learner site vs local Case Manager.
3. Open `/future` from the demo page to show the roadmap.
4. Open `/cases`.
5. Show neutral case titles.
6. Open a guided case.
7. Type a hypothesis plus supporting and against features.
8. Reveal likely diagnosis / linked condition.
9. Reveal suggested reasoning.
10. Return to the module.
11. Open a condition page and test Overview, Pathophysiology, and Outcome Measures links.
12. Mention draft route protection and source checks.

## Conversation Case Preview

1. Open `/cases`.
2. Select `Case 06 · Thoracic pain with broader screening cues`.
3. Point out the `Conversation reasoning preview` badge.
4. Ask a few MSK/red-herring questions first, such as posture, desk work, and local movement reproduction.
5. Ask targeted safety questions about exertion, chest pressure, nausea, breathlessness, and cardiovascular risk factors.
6. Show that important safety information appears only after selecting the relevant questions.
7. Complete the reflection prompts and reveal the likely concern.
8. Explain that this is a deterministic scripted preview of future conversational reasoning, not a live AI chatbot.

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
- The source registry and migration tracker show current pipeline state from metadata.
- `check:hygiene` blocks draft notes, source notes, or TODO material from leaking into published content.
- `check:sources` validates legacy source metadata and duplicate source IDs.
- Static case route generation excludes draft and archived cases.
- The public Netlify build and the local Case Manager are intentionally separate.
- Git remains the audit trail; do not auto-commit generated changes.

## D. Roadmap

- PowerPoint import for teaching decks and lecture material.
- Paper and evidence import for linked clinical reasoning notes.
- Shared admin access with authentication and review permissions.
- GitHub pull-request publishing workflow.
- AI-assisted case generation followed by human clinical review.
- Whole-body physiotherapy expansion beyond the current upper-quadrant Phase 1.
