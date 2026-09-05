# Task 4 world DoneClaim

Scope: full 100-slot pure-world geometry and interaction model. This is not a claim that renderer/browser Task 4 QA is complete.

## Stable contract

- Existing `createSmallLibraryRoom()` and all pre-Task-4 fields/signatures remain available.
- `LibraryShelf.variant` is now `'wide-low' | 'narrow-tall' | 'compact' | 'endcap'`.
- New export: `createFullLibraryRoom(): LibraryRoom`.
- Full room remains 624×376 logical pixels, floor begins at y=104, spawn remains lower-centre at (312,340), and the existing registration desk/reading alcove/window are preserved.
- Palette, material ramps, logical pixel density, camera, renderer ownership, persistence boundary, and placement API are unchanged.

## Exact layout

| Shelf | Variant | Slot IDs | Grid | Visual rect x,y,w,h | Foot collider x,y,w,h | Picker point |
| --- | --- | --- | --- | --- | --- | --- |
| `full-wide-left` | wide-low | 0..19 | 2×10 | 28,42,156,62 | 28,86,156,18 | 106,122 |
| `full-wide-center` | wide-low | 20..39 | 2×10 | 198,42,164,62 | 198,86,164,18 | 280,122 |
| `full-compact-back` | compact | 40..59 | 4×5 | 378,38,100,66 | 378,86,100,18 | 429,122 |
| `full-tall-island` | narrow-tall | 60..79 | 5×4 | 210,142,84,104 | 210,228,84,18 | 252,264 |
| `full-endcap-island` | endcap | 80..99 | 5×4 | 350,158,72,94 | 350,234,72,18 | 386,270 |

Every slot rectangle is calculated inside its shelf visual rectangle. The compact 4×5 grid keeps approximately 14×7-logical-pixel recesses rather than compressing five rows into a shallow wall unit. No shelf holds more than 20 positions.

When a 20-slot shelf is fully occupied, its shelf target has priority within 10 logical pixels of the picker point. This creates a practical keyboard approach band, not an exact-coordinate exception. Outside that band, placed books remain directly inspectable. Small-room shelves have fewer than 20 slots and retain their prior direct-book target behavior.

## PIN / RED / GREEN

| Phase/scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| PIN original world suite | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` before Task 4 edits | exit 0; existing 14 pass | `.omo/evidence/canvas-library/task-4-world-pin-tests.log` |
| PIN original walk/place/read driver | `node --import tsx .omo/evidence/canvas-library/world-driver.ts` before Task 4 edits | exit 0 | `.omo/evidence/canvas-library/task-4-world-pin-driver.log` |
| RED full-room export | targeted suite after adding full-room tests, before product implementation | exit 1; missing `createFullLibraryRoom` export | `.omo/evidence/canvas-library/task-4-world-red.log` |
| RED fully occupied picker | targeted suite after geometry landed | exit 1; 18 pass / 1 fail because compact returned `placed-book` instead of `shelf` | `.omo/evidence/canvas-library/task-4-world-red-picker.log` |
| GREEN complete world suite | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` | exit 0; 20 pass / 0 fail | `.omo/evidence/canvas-library/task-4-world-green.log` |
| Full pure-world driver | `node --import tsx .omo/evidence/canvas-library/world-driver.ts` | exit 0 with all assertions | `.omo/evidence/canvas-library/task-4-world-driver.log` |
| Type check | `npm run lint` | exit 0 | `.omo/evidence/canvas-library/task-4-world-lint.log` |
| Diff check | `git diff --check` through exit-reporting Node wrapper | exit 0 | `.omo/evidence/canvas-library/task-4-world-diff-check.log` |

## Behavioral proof matrix

| Success criterion | Scenario and real invocation | Binary observable |
| --- | --- | --- |
| Exactly 100 stable positions | Full-room unit test enumerates returned slots rather than a duplicate fixture | IDs exactly 0..99; length 100; max 20 per shelf |
| Slot/furniture coherence | Unit test checks each returned slot against its returned shelf rect and every returned obstacle pair | all slots contained; no foot-collider overlap |
| Connected movement | Unit test and driver build a bounded graph exclusively by repeated cardinal `stepLibraryPlayer(..., 40)` calls | 32,790 reachable player states; all 100 interaction points within the 28px interaction range |
| Full capacity | Driver performs 100 sequential `placeLibraryDraft` transitions | 100 placed books, slots 0..99 |
| Capacity conflict | Driver attempts a distinct 101st draft in occupied slot 0 | rejected; same 100-book array reference and draft retained |
| Fully occupied picker access | Actual movement graph approaches each shelf; unit test additionally samples a ±4px two-dimensional band | all five return their `shelf` target with all 20 books present |
| Direct inspection preserved | Full-room first-slot target outside the 10px picker centre and a small-room placed slot are queried | both return `placed-book` |
| Immutability | Full-room snapshot and placed-book identity checked after graph/placement/conflict transitions | room unchanged; rejected placement retains prior array |

## Adversarial and scope receipt

- Existing malformed/NaN/negative/huge timing, normalized diagonal, timestep partition, collision/tunneling, invalid slot/draft, repeated placement, cancellation/no-draft, rear-wall minimum, and immutable-input tests remain green.
- Graph traversal is bounded at 50,000 states and completed at 32,790, so the proof cannot hang indefinitely.
- Stable source hashes at final world verification:
  - `canvasLibraryWorld.ts`: `5110911b862ca4ae5b729398089d68c3945a105fb1559c7c144913b82dace1e1`
  - `canvasLibraryWorld.test.ts`: `eaa440dbb2e9486c83b6237f6190423411b85e04ceedad15f56c34e7cb3e7e06`
  - `world-driver.ts`: `81442a690de8ec2a30ef8ce68975a2c5b3bbe96e0c4f1409ecee4a5a2f65983b`
- Pre-existing dirty worktree paths and other agents' renderer/UI changes were preserved. No backend, route, migration, dependency, asset, storage, network, or production-data work occurred.
- No server, browser, port, or other long-running resource was created by this lane; cleanup is none.
