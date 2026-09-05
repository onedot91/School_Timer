# Canvas library art evidence

## Scope

- `src/components/student/library/CanvasLibraryRenderer.ts`
- `src/components/student/library/CanvasLibraryPalette.ts`

No dependency, collider, room geometry, persisted identifier, or live data changes were made in this art lane.

## Implemented art contract

- Rebalanced the room toward a quiet cream floor and deeper walnut furniture, with consistent dark lower/right faces and pale top/left highlights.
- Added pixel-stepped window and lamp light that remains behind fixtures and does not animate decoratively.
- Rebuilt the player as an original 24x30 Canvas2D bear sprite with an orange fur ramp, dark outline, fixed green scarf and tail, cream diagonal strap, and bulb-shaped satchel based on the supplied character's identity anchors.
- Preserved the feet anchor and collider while adding distinct up/down/left/right faces, alternating walking limbs, book-carrying arms, and a front-facing seated pose derived from the beanbag visual center.
- Added confirmed-state 500ms receive/place book continuity. The placed shelf copy is suppressed during place travel, and reduced-motion renders the final static state immediately.
- Replaced blurry canvas cue text with corner highlights only; the application owns the readable DOM cue.
- Made failure-board paper count depend on `scene.boardNoteCount`, using dimensions derived from the board frame in an 8x3 grid.
- Made a shelf and its placed books 68% opaque only while the player sprite is behind and intersecting it, keeping the actor locatable without changing world collision or depth order.

## Verification

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Baseline before production art | `node .omo/evidence/library-game-polish/baseline.mjs` at 1280x800, isolated mock entry 23 | Full library canvas captured before renderer edits | `.omo/evidence/library-game-polish/before.png` (SHA-256 `6081474d4f48b2a7ce969fea58bad568c5a98d1dbb8a9dff06940b3e5d4df7b7`) |
| Final production surface | `LIBRARY_CAPTURE=after-art.png node .omo/evidence/library-game-polish/baseline.mjs` at 1280x800 | Browser loaded the `application` role, viewport assertion was `[1280,800]`, screenshot completed, and isolated Chrome closed | `.omo/evidence/library-game-polish/after-art.png` (SHA-256 `2b63fcd70f518e083784b5f30c25aa56904410370e07bcb09ee146d36ef056bd`) |
| Type safety | `npm run lint` | Exit 0, `tsc --noEmit` reported no diagnostics | terminal output captured in executor turn |
| Production bundle | `npm run build` | Exit 0, 2240 modules transformed, `StudentLibraryPage` chunk emitted | terminal output captured in executor turn |
| Full repository suite after contract-test refresh | `npm test` | Exit 0; 580 tests passed, 0 failed | `.omo/evidence/library-game-polish/tests.log` |
| Real interaction QA | `node .omo/evidence/library-game-polish/qa.mjs` against isolated mock port 3044, Chromium 1280x800 | `qa.json` reports `passed: true`, no errors; directional walking, receive/place continuity, seated reading, readable DOM cue, reduced motion, room-first routes, 100-slot state, and modal ownership are all `true` | `.omo/evidence/library-game-polish/qa.json`; `walk-*-*.png`; `receive-*.png`; `place-*.png`; `reading-seated.png`; `behind-shelf.png`; `in-front-of-shelf.png`; `reduced-motion-placed.png` |

## Visual inspection

The final 1280x800 capture shows the full 624x376 logical room at 2x with no canvas clipping, overlap at the entry mat, unintended document scrolling, or first-screen overflow. The entry mat remains at logical `y=338`, `height=20`; the desk bottom remains logical `y=326`. The board correctly displays no fabricated notes when the real count is zero.
