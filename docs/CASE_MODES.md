# Guided, Conversation, and Hybrid Case Modes

All six public case routes now offer three modes without changing their neutral URLs or baseline clinical meaning.

- Guided preserves the existing structured reasoning and delayed reveal.
- Conversation lazy-loads an opaque, case-bound truth projection only after the learner selects the mode. Free-text questions use deterministic local intent mapping and unavailable/clarification fallbacks.
- Hybrid adds optional question domains, a disclosure summary, one process hint, a local reasoning notebook, and the same governed reasoning/reveal flow.

Conversation assets are matched against case ID and truth hash before use. Private pilots, diagnosis, condition links, reviewer data, provider keys, and hidden truth are absent. State is in-memory only, scoped to one case and browser tab, and cleared on restart. “New session seed” changes cosmetic session identity only; it cannot generate new clinical truth.

The tablist, chat roles, live patient announcements, focus states, loading/errors, touch targets, reduced-motion-compatible styling, and text alternatives are designed for keyboard, screen-reader, and mobile use.
