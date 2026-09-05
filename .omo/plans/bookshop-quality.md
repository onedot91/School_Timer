# Bookshop quality goal

Authoritative scope: all agreed character, movement, carry/receive/place, room layout,
pastel pixel art, scoped UI, sound, life details and verification improvements.
Identity: orange dot-eyed bear, green scarf, garlic bag. Preserve100 slots/IDs,
API/storage/rewards, keyboard controls,624x376 integer-scale canvas. No new dependency.

## Work
- completed: character pose/atlas and renderer, room/UI, audio/game feedback.
- completed: integrate actual play loop and development art-review surface.
- completed: focused regressions/full tests/typecheck/build and browser QA (final 708 tests, lint/build/diff checks passed).
- completed: independent visual/code review; rear book depth and transfer-to-spine continuity findings resolved; final 28 frames, atlas, 30.70-second actual gameplay video, full-room/reading screenshots and QA.md audited.

## Gates
|Gate|Pass evidence|
|---|---|
|Character|4 directions idle/walk/carry/contact sheet; no disconnected arms, bag swaps or floating soles|
|Book interactions|receive/carry/place/seat actual UI; shared hand anchor; success only after save|
|Room|reachable fixtures/all100 slots,40px main aisle, stable slot mapping|
|Visual|consistent light/material/depth; quiet floor, warm shelf interiors, contextual affordances|
|Accessibility|1280x800 before/after no overflow; modal focus/Escape; long text/reduced motion/mute|
|Runtime|mock-only empty/full/save failure; lint/tests/build; console and frame timing observation|
|Delivery|before/after images, runtime recording, updated DESIGN.md; independent verification|

Baseline: CUA observed1280x800 with scroll1280x800 before layout edits;
`.omo/evidence/bookshop-quality/baseline.json` and `before.png`.
Physical Chromebook unavailable on macOS host; report hardware-specific performance as unverified.
