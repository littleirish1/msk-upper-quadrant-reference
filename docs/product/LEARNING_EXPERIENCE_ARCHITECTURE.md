# Learning Experience Architecture

## Purpose

The learning layer adds active reasoning without turning the public site into a service. It remains a static export; all interaction is client-side and optional.

## Clinical Reasoning Engine

The schema supports ordered presentation, differential, justification, history reveal, safety, examination, findings reveal, investigation, management, patient explanation, expert comparison, and reflection steps. The public prototype demonstrates mechanics only. Existing guided cases are not converted in this pass because case-specific expert answers require source and clinician review.

## Learning Modes

- Study: normal reviewed reference browsing.
- OSCE: candidate instructions, domains, and a post-attempt discussion; no accreditation claim.
- Viva: sequential prompts and post-attempt expert notes.
- Flashcard: approved front/back records with local shuffle planned.
- Quiz: multiple-choice or short answer with explanations after submission; no competence claim.

Private schema examples validate each mode. They are not public clinical learning content.

## State And Privacy

- Learner text is held only in component memory.
- No localStorage is used in v1.
- No network calls, account, analytics, runtime AI, or backend exists.
- Reset clears the current component state.
- Print uses the browser print dialog and sends no data.

## Accessibility

Controls use native buttons, labels, visible focus styles, progress text, `aria-expanded`, `aria-live`, and keyboard-operable tabs. Components are responsive and respect reduced-motion settings. Print styles remove controls and preserve readable content.

## Adoption Path

Convert one reviewed guided case only after its authored step data and clinician approval are recorded. Diagnosis no-leak and reveal checks must be extended in the same change.
