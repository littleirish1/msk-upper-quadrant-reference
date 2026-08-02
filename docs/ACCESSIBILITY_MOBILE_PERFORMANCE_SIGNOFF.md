# Accessibility, mobile, and performance sign-off

## Automated gate

Run a production build, then `npm run quality:generate-v1` and `npm run test:quality-v1`. The report records route output, JavaScript budgets, keyboard tab semantics, focus visibility, skip navigation, and touch-target tokens.

## Manual accessibility checklist

- Traverse every public template with keyboard only; confirm logical order, visible focus, no traps, and reliable skip navigation.
- Exercise Guided, Conversation, and Hybrid tabs with Arrow keys, Home, End, Enter, and Space.
- Confirm patient replies and load/error states are announced without disruptive repetition.
- Inspect headings, landmarks, labels, link purpose, error recovery, and non-colour status cues with a screen reader.
- Verify content remains usable at 200% browser zoom and with text spacing overrides.

## Responsive visual matrix

Review home, regional dashboard, case library, every case mode, anatomy, search, red flags, and learning at 320x568, 375x667, 768x1024, 1024x768, and 1440x900 in light and dark themes. Check horizontal overflow, fixed navigation overlap, readable line length, touch target spacing, and focus visibility.

## Performance checklist

- Exported JavaScript total must remain at or below 2 MiB.
- Every JavaScript chunk must remain at or below 256 KiB.
- Diagnosis reveal payloads must not be preloaded or prefetched.
- Conversation data must remain lazy and case-scoped.
- Record any device/network field measurement separately; synthetic build size is not a claim about real-user performance.

## Sign-off boundary

Generated evidence never substitutes for human assistive-technology and visual review. Until that sign-off is recorded against the exact release revision, the quality gate remains release-blocking.
