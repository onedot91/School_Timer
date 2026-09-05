# Task 2 Canvas renderer evidence

## Scope and files

- Product source: `src/components/student/library/CanvasLibraryRenderer.ts`
- Named palette: `src/components/student/library/CanvasLibraryPalette.ts`
- Renderer-only evidence fixture: `render-preview.html`, `render-preview.tsx`, `render-preview-qa.mjs`
- No world, game/UI, CSS, route, persistence, network, storage, generated/imported image, dependency, or asset file was authored in this lane.
- Stable product hashes are recorded in `task-2-renderer-sha256.txt`.

## Draw API and implementation observables

- Exact export: `createLibraryRenderer(canvas: HTMLCanvasElement, room: LibraryRoom): { draw: (scene: LibraryScene) => void; dispose: () => void }` at `CanvasLibraryRenderer.ts:700`.
- The renderer fixes the intrinsic buffer to `624x376`, disables smoothing, owns no RAF/input/listener/modal/storage/network behavior, and returns a synchronous `draw` plus cleanup-only `dispose`.
- Static room/floor/window/rug/lamp pixels are rendered once into `staticCanvas` at construction (`CanvasLibraryRenderer.ts:710-716`) and copied during draws (`:724`); tile grain is coordinate-seeded (`:61`, `:119`), not random per frame.
- Every dynamic object produces one depth record and furniture, shelf spines, tabletop props, and player share the stable `(floorY, id)` sort (`:629-697`). All contact shadows run before the shared body pass (`:726-727`).
- Bear animation is conditional on `player.isWalking` and disabled by `scene.reducedMotion` (`:484-563`). Non-finite `timeMs` becomes zero, preventing runaway frame arithmetic. Carrying changes the drawn arms/book silhouette; the game DOM owns the single compact carry-status symbol so Canvas and DOM badges cannot overlap. Student number selects one of the named scarf accent pairs.
- Palette source contains only the DESIGN token ramps; pixel geometry uses integer-rounded fills/stepped lines and no image loading or gradient/blur APIs.

## PIN / RED

- Scenario: actual pre-game isolated library at `1280x800` with synthetic metadata.
- Invocation: `node .omo/evidence/canvas-library/baseline-qa.mjs` (task 1 independent capture).
- Binary observable: `.omo/evidence/canvas-library/baseline.json` records `canvasCount: 0`.
- Captured artifacts: `baseline.json`, `baseline.png`, and independent receipt `task-1-independent.md`.
- This established the missing-game failure before renderer source existed; it was not recreated from old code or a reference image.

## Actual renderer browser scenarios

Invocation: `node .omo/evidence/canvas-library/render-preview-qa.mjs`, using installed Google Chrome against the isolated local fixture at port 3022. The script blocked `/api` and every non-local request. Initial CUA use was attempted first but an in-app visible tab is unavailable from a subagent; root's CUA navigation was also blocked by the browser client policy. The bundled Playwright driver with installed Chrome was the capability fallback, without weakening browser policy.

All scenarios used viewport `1280x800` and the real renderer/world imports. Binary receipt: `render-preview.json`.

| Scenario | Scene input | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Empty room | idle upward-facing student 8, no books | intrinsic `624x376`, CSS `1248x752`, `234624` opaque pixels, `0` black pixels, document overflow `[0,0]` | `render-empty.png` |
| Carry | walking right, carried synthetic draft | same size/opacity/overflow; `24` named rendered colors; visible held book with no duplicate Canvas HUD | `render-carry.png` |
| Placed | synthetic spines in wide and tall shelves, selected slot and nearby placed-book target | same size/opacity/overflow; `117` rendered colors; shelf spines, corners, and contextual cue visible | `render-placed.png` |
| Reduced/non-finite time | `isWalking: true`, carry pose, `timeMs: NaN`, `reducedMotion: true` | `stableAfter250Ms: true`, same complete opaque frame, no hang or autonomous animation | `render-reduced.png` |

The first failed visual surface is preserved as `render-before-empty.png`, `render-before-carry.png`, and `render-before-placed.png`. Root rejected that pass as flat. The recaptured renderer materially changes the observable scene: opaque teal rear wall through logical y=93, timber baseboard y=94..103, warm staggered floor from y=104, window sky/foliage silhouette on the wall plane, shared upper-left lighting, wainscot/pilasters, framed wood faces/grain/joinery/feet, desk ledger/quill/lamp/drawers, woven rugs, visible bear/scarf, and shelf spines. Root inspected `render-empty.png` and accepted this revision for combined play and independent review.

The first combined carry screenshot then exposed a concrete overlap between the Canvas `운반 중` badge and the game-owned DOM carry status. The redundant Canvas badge was removed while the on-character held-book pose remained. `render-carry.png` is the post-fix recapture; the new renderer SHA is bound in `task-2-renderer-sha256.txt`.

## Automated verification

- Scenario: full repository type check after the stable world interface and renderer formatting.
- Invocation: `npm run lint`.
- Binary observable: exit `0`; captured in `task-2-renderer-lint.log`.
- Scenario: whitespace/conflict-marker integrity of the shared dirty tree.
- Invocation: `git diff --check`.
- Binary observable: exit `0` with empty output; captured in `task-2-renderer-diff-check.log`.
- Exact product and image hashes: `task-2-renderer-sha256.txt`.

## Verification boundary

Verified here: renderer compile, exact API, real Canvas output in empty/carry/placed/reduced states, complete opaque frame, no missing-black region, fixed intrinsic/CSS size in the fixture, zero document overflow, non-local/API request count zero, non-finite-time stability, and visual before/after evidence.

Not yet claimed here: complete playable task 2 or task 3 visual/functional approval. The game controller owns real movement, registration/modal flow, focus/blur, and placement timing. Root's combined actual-play capture and mandatory independent task 3 reviewers remain the acceptance authority.

## Cleanup

- Renderer creates one private static Canvas; `dispose()` marks it inert and releases its backing dimensions.
- Renderer-only browser contexts closed inside the QA script.
- Renderer-owned Vite port 3022 was stopped after capture; no network/storage state or test student data was created.
