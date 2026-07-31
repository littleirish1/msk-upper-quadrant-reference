# Learner Product And Visual Governance

## Learning Journeys

Region and condition pages use one shared, public-safe journey navigation to
the existing Anatomy, Guided Cases, Learning Lab, Red Flags, and Search routes.
It does not infer clinical relationships or expose draft content. Search and
QuickFind continue to share the existing deterministic search engine.

No account or cloud progress store is introduced. Local continuation remains a
future opt-in feature pending privacy and usability review.

## Accessibility

Journey controls retain native links, visible focus styles inherited from the
site, descriptive navigation labels, and 44px minimum touch targets. Automated
checks cover structural requirements; they do not constitute human
screen-reader, zoom, contrast, or mobile usability approval.

## Performance

`npm run check:performance` runs after static export. It caps total exported
JavaScript at 5 MiB and individual chunks at 1 MiB, and rejects eager preload or
prefetch hints for reveal payloads. These are regression budgets, not a claim of
field performance on every device.

## Visual Assets

The private visual registry records ownership/licence, permitted use, alt text,
clinical review, accessibility review, publication state, and blockers. The
internal body-model prototype remains blocked and absent from public routes and
assets. Unknown rights always fail closed.
