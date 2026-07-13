# Todo 7 DoneClaim

## Result

- Standalone RandomDraw now shares the Apple canvas, solid stage, translucent control hierarchy, segmented cases, cards, controls, focus, and preference behavior used by the embedded draw.
- Primary draw, reset, settings, and case controls provide immediate pointer-down scale/opacity feedback.
- Settings uses the shared modal focus lifecycle with a unique name, inert background, contained Tab/Shift+Tab, Escape close, and exact settings-trigger return.
- Reduced motion removes flight, flash, particle, and transform-heavy effects while retaining short opacity/color feedback. Reduced transparency and increased contrast have solid/defined alternatives.
- Existing visible strings, probability/history/queue logic, audio semantics, `randomDraw.ts`, and `school-random-draw-v1` shape are unchanged.

## Verification

- `runtime.json`: `success: true`
- Current states: default, settings, after-settings, case-switch, winner, reset, repeat, exhausted, invalid-range, reduced-motion, reduced-transparency, more-contrast
- Each of the 12 states has a state-specific semantic assertion in all seven viewport records. Reload clearing is gated to the first navigation, so synthetic repeat/exhausted/invalid fixtures persist.
- Reset and exhausted flows are independently reconstructed and retriggered for every viewport; all seven records show `섞는 중`.
- Preference runs open the settings material and trigger reset, winner, and repeat effects before asserting computed reduced-motion, reduced-transparency, and increased-contrast behavior.
- Viewports: 320×568, 390×844, 768×1024, 1024×768, 1280×720, 1440×900, and 390×844 at 200%
- Pristine `f5a90d8` visible text: 28/28 exact UTF-8 matches
- Pointer-down: `scale: 0.96`, `opacity: 0.84`
- Settings lifecycle: initial focus, background inert, Tab, Shift+Tab, Escape, exact return all PASS
- Page horizontal overflow: 0; targets below 44px: 0
- Storage: only `school-random-draw-v1`; top-level keys remain `activeCaseId`, `cases`, `repeatPickEnabled`
- Empty pool is unreachable after inclusive 1..999 range normalization; exhausted behavior is captured explicitly
- External requests are fulfilled as categorical blocked fixtures; console errors 0; no live data access
- Fresh screenshots: 24
- Independent design-system/functional review: PASS, high confidence
- Independent CJK/visual review: PASS, high confidence after the desktop reset label was bounded and the entire harness/capture set reran
- `npm run lint`, `npm run build`, `git diff --check`: PASS; existing chunk-size warning only

Plan checkbox remains unchanged pending independent verification.
