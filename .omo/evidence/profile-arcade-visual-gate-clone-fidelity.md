# Profile arcade visual gate — clone fidelity

## Recommendation

REQUEST_CHANGES

## Evidence inspected

- Target contract: `DESIGN.md:168-170,306`.
- Runtime implementation: `src/components/student/StudentProfileGachaDialog.tsx:36-49,203-216,307-355,365-456`; `src/index.css:23032-23476`.
- Fresh normal-motion artifacts (all validated as 1280×800): `tmp/visual-qa/profile-gacha/arcade-final-7/01-confirm.png`, `02-saving-250.png`, `03-reel-fast-900.png`, `04-reel-decelerating-1850.png`, `05-reveal-mid-2550.png`, `06-result-3100.png`, and `profile-gacha-arcade-demo.gif` (147 frames).
- Fresh reduced-motion artifact (1280×800): `tmp/visual-qa/profile-gacha/arcade-reduced-harness-final-3/02-reduced-result.png`.

The component and stylesheet modification times are `2026-08-30 19:12:34`; all reviewed final artifacts are newer. The tiny black pill at bottom centre in normal-motion captures was excluded as specified capture-tool contamination.

## Findings

### CRITICAL

None. The modal is a live React component tree: conditional stage DOM, controls, card images, a reel track, center gate, and flip faces are rendered in `StudentProfileGachaDialog.tsx`, not substituted with a screenshot or a CSS background image.

### HIGH

1. **Declared gacha motion tokens are not runtime design tokens.** `DESIGN.md:168-170` declares `--student-profile-gacha-shuffle`, `--student-profile-gacha-reveal`, and `--student-profile-gacha-reduced`, but no matching custom-property definition or consumption exists in `src`. Runtime instead hardcodes `1700`, `500`, and `220` in `StudentProfileGachaDialog.tsx:36-38`, with dependent transition durations at `:326`, `:394`, `:415`, `:437`, and `:445`. This is not token-driven motion styling and lets the documented design system drift from the rendered sequence.

### MEDIUM

None.

### LOW

None.

## Verified visual/motion behaviour

- The six normal captures and 147-frame GIF show saving, a reverse anticipation, a fast horizontal reel, staged slowdown, a centered selection gate, a 3D card reveal, and a stable result.
- All reviewed states retain the cream/mint thick-material styling; no clipping, overlap, unintended scroll, or Korean glyph/wrapping corruption was seen at 1280×800.
- `StudentProfileGachaDialog.tsx:379-418` uses a real `perspective`/`rotateY` reveal and `:430-456` preserves the selected result; the committed receipt controls the output.
- The reduced-motion capture is stable, while runtime omits reel travel and `rotateY` under `useReducedMotion` (`StudentProfileGachaDialog.tsx:192-201,380-415`).

## Blockers before approval

1. Define and consume the three declared gacha-duration tokens from runtime code (or remove the inaccurate design-token claims and establish one authoritative timing source), then re-run the gate on fresh final evidence.
