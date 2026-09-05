# Task 2 world DoneClaim

Scope: fresh pure small-room world model only. This is not a claim that the complete Canvas-library feature or Task 2 browser surface is finished.

## PIN and RED

- PIN: existing isolated bookshelf baseline remains at `.omo/evidence/canvas-library/baseline.json` (non-empty, 1,948 bytes at verification time). This lane did not change the existing route.
- RED invocation: `node --import tsx --test src/lib/canvasLibraryWorld.test.ts`
- RED observable: exit 1, `ERR_MODULE_NOT_FOUND` for the intentionally absent product module.
- RED artifact: `.omo/evidence/canvas-library/task-2-world-red.log`.
- Review RED invocation: same targeted test after adding idle and huge elapsed-time cases.
- Review RED observable: exit 1, 11 pass / 2 fail for stale walking state and unbounded finite elapsed time.
- Review RED artifact: `.omo/evidence/canvas-library/task-2-world-red-review.log`.

## Public type contract

Path: `src/lib/canvasLibraryWorld.ts`.

- Geometry: `LibraryPoint`, `LibraryRect`, `LibrarySlot`, `LibraryShelf`, `LibraryRoom`.
- State: `LibraryPlayer`, `LibraryBookDraft`, `LibraryPlacedBook`, `LibraryTarget`, exact plan-shaped `LibraryScene`, and `LibraryPlacementResult`.
- `LibraryPlayer.position` is feet-center. Rectangle coordinates are top-left plus positive width/height. Furniture collision uses `footCollider`, while rendering uses `visualRect`.
- Player includes deterministic `studentNumber`; `createLibraryPlayer(room, studentNumber = 1)` accepts only 1..23 and safely defaults invalid values to 1.
- Operations: `createSmallLibraryRoom`, `createLibraryPlayer`, `stepLibraryPlayer`, `getNearbyLibraryTarget`, `placeLibraryDraft`.
- Placement rejection returns the original placed-books reference and retains the draft; successful placement appends immutably and clears it. No relocation operation exists.

## GREEN matrix

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Two distinct small-room shelves, 18 unique slots | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Walls and furniture collision | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Normalized diagonal speed | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Partition-stable ordinary elapsed time | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Substep anti-tunneling and 250ms finite frame cap | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| NaN/Infinity/negative time and malformed draft safety | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Idle clears stale walking state | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Nearby/far target selection | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Valid placement plus occupied/invalid/no-draft rejection | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Immutable player/book inputs | targeted Node test | pass | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Full targeted suite | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` | exit 0; 13 pass, 0 fail | `.omo/evidence/canvas-library/task-2-world-green.log` |
| Type check | `npm run lint` | exit 0 | `.omo/evidence/canvas-library/task-2-world-lint.log` |
| Whitespace/error check | `git diff --check` through an exit-reporting Node wrapper | exit 0 | `.omo/evidence/canvas-library/task-2-world-diff-check.log` |

## Manual pure-world driver

- Invocation: `node --import tsx .omo/evidence/canvas-library/world-driver.ts`.
- Exact scenario: repeated `stepLibraryPlayer` calls walk student 7 from lower-center spawn to the registration desk; `getNearbyLibraryTarget` returns `registration-desk`; the player walks to the wide shelf; a synthetic `달빛 우체국` draft is placed in slot 0; the player walks to that slot and reads the returned placed-book title.
- Additional observables: every initial slot interaction point is reachable from spawn; a path into the reading table stops at x=496.30769230769215 before its footprint; a second placement into slot 0 is rejected while retaining the first array reference and carried draft; room and original player snapshots remain unchanged.
- Binary observable: driver exit 0 with all assertions reached.
- Driver source: `.omo/evidence/canvas-library/world-driver.ts`.
- Receipt: `.omo/evidence/canvas-library/task-2-world-driver.log`.

## Adversarial and scope receipt

- Covered: malformed/NaN input, negative/NaN/huge elapsed time, timestep partitioning, collision tunneling, occupied/conflicting/invalid slot, missing/invalid/repeated draft, repeated placement, immutable inputs, all initial slot reachability.
- Dirty worktree: pre-existing unrelated edits/deletion were observed and not reverted or modified by this lane.
- Stale current types: interface was published before consumers started; `studentNumber` addition was immediately sent to renderer/UI/root.
- External prompt injection and process interruption: N/A for a local pure TypeScript module with no external text/process surface.
- Browser, storage, network, backend, migration, image generation, dependencies, 100-slot expansion, and production data: intentionally absent from this lane. Browser integration is the parent/UI gate.

## Architectural coherence revision

Fresh screenshot review found that the old `walkableBounds.y=34` allowed player feet to enter the visual rear-wall/window plane. The world and renderer owners agreed on this exact shared boundary before editing:

- Opaque rear wall: logical y 0..93.
- Baseboard/wall-to-floor transition: logical y 94..103.
- Floor and `room.walkableBounds.y`: logical y 104 onward.
- With the 6px feet collider, the minimum legal feet-center is y 107. The existing lower boundary remains y 358.
- Window y 38..76 is wholly wall-mounted. The wide shelf visual ends exactly at y 104; both shelf front interaction aisles remain on the floor plane.
- The renderer derives the division from `room.walkableBounds.y`; no public world type or function signature changed.

### Revision PIN / RED / GREEN

| Phase/scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| PIN existing world suite | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` before revision test | exit 0; 13 pass | `.omo/evidence/canvas-library/task-2-world-revision-pin-tests.log` |
| PIN existing walk/place/read driver | `node --import tsx .omo/evidence/canvas-library/world-driver.ts` before revision | exit 0 | `.omo/evidence/canvas-library/task-2-world-revision-pin-driver.log` |
| RED rear-wall penetration | targeted world test with the new derived-boundary assertion before geometry edit | exit 1; new rear-wall test fails | `.omo/evidence/canvas-library/task-2-world-revision-red.log` |
| GREEN rear-wall boundary plus existing adversarial suite | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` | exit 0; 14 pass, 0 fail | `.omo/evidence/canvas-library/task-2-world-revision-green.log` |
| Manual pure-world path | `node --import tsx .omo/evidence/canvas-library/world-driver.ts` | exit 0; all slots reachable; rear feet top 104.8512 >= floor start 104; window/wall interiors unreachable | `.omo/evidence/canvas-library/task-2-world-revision-driver.log` |
| Whole-repository type check | `npm run lint` | exit 0 | `.omo/evidence/canvas-library/task-2-world-revision-lint.log` |
| Final whitespace/error check | `git diff --check` through exit-reporting Node wrapper | exit 0 | `.omo/evidence/canvas-library/task-2-world-revision-diff-check.log` |

Revision adversarial receipt: wall minimum bound, window plane, all 18 front positions, collision/tunneling, normalized and partitioned movement, NaN/negative/huge timing, duplicate/invalid placement and immutable inputs are covered by the fresh suite and driver. Pre-existing dirty files remain untouched. No server/browser process was owned by this lane, so cleanup is empty by construction.
