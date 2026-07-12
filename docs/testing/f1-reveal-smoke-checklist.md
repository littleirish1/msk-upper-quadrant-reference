# F1 Reveal Smoke Checklist

Use this quick manual pass after `npm run preflight` when reviewing guided case reveal behaviour in a browser.

## Automated gate

- Run `npm run check:reveal`.
- Confirm it reports published case pages checked, `RevealAnswer` blocks checked, private routes excluded, and native closed `details/summary` rendering.
- Run `npm run preflight` and confirm `check:reveal` runs after `check:no-leak` and before `check:routes`.

## Manual browser pass

1. Open `/cases`.
2. Open each published guided case from the neutral case list.
3. Confirm the initial page does not expose the likely diagnosis or linked condition.
4. Confirm the staged controls are visible:
   - `Reveal likely diagnosis / linked condition`
   - `Reveal suggested reasoning`
5. Use keyboard navigation to tab to the reveal controls.
6. Activate `Reveal likely diagnosis / linked condition` and confirm the diagnosis/linked condition appears only after activation.
7. Activate `Reveal suggested reasoning`.
8. Confirm the comparison panels appear after the suggested reasoning reveal.
9. For several comparison panels, tab to the native `<summary>` row and press Enter or Space.
10. Confirm each panel opens and closes using the keyboard, starts closed, and contains non-empty answer content.

## Pass criteria

- Published guided cases are reachable from `/cases`.
- Draft/private cases are not reachable.
- Diagnosis or linked condition text is not visible before the reveal step.
- Comparison panels use native summary/details disclosure behaviour.
- No comparison panel is empty.

## Known limitation

The automated smoke check validates source and static-build invariants. It does not replace the browser pass for interactive state changes after clicking the staged reveal buttons.
