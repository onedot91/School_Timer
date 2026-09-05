# Library interior world/art implementation evidence

## Outcome

The authored full room now uses four materially different bookcases with stable slot IDs `0..99`: left tall `0..29`, north wide `30..49`, low double-sided island `50..69`, and right compact tall `70..99`. The registration desk remains within 28 logical pixels of the lower entrance while leaving a direct route on its right. The failure board is wall-mounted with its bottom aligned to the `y=104` wall/floor boundary, and its three papers scale from the frame width.

The full-room renderer now keeps the reading nook visible: a bounded rug groups the table, bench, attached lamp, window, decorative books, a code-drawn flower vase, and a lavender beanbag. The beanbag has an explicit non-overlapping foot collider. A restrained timber/paper circulation inlay connects the entrance, shelves, board, and nook. Shelf variants use different caps, end panels, trim rhythms, and bright palette ramps without changing the small-room fixture, movement model, input, camera, or persistence schema.

User addendum incorporated: the vase and soft beanbag are actual deterministic Canvas artwork, and the brighter/kitsch palette is consumed through the shared named palette owned by the root task.

## Evidence matrix

| Success criterion | Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- | --- |
| Baseline captured before production edit | Existing 1280×800 two-shelf/large-floor room | Root browser capture before this implementation | PNG exists, 21,154 bytes, SHA-256 `7dab320af927cf2e3fa6226675d922e4ef0066b44790ba6f3ecb66f0a545f91c` | `before.png` |
| Failing-first intent | New four-shelf, wall-board, reading-collider assertions against old world | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` | FAIL: 3 intent tests | `world-red-baseline.log` |
| IDs/capacity/variety/reachability | 4 shelves, ranges total 100, dense spines, all interactions reachable when full, collisions disjoint | `node --import tsx --test src/lib/canvasLibraryWorld.test.ts` | PASS: 25/25, fail 0 | `world-tests.log` |
| Renderer integration | Full-room nook plus beanbag/vase layers, scalable board papers, distinct shelf trim | Same focused test invocation | PASS: renderer contract tests included in 25/25 | `world-tests.log` |
| Type safety | Repository TypeScript no-emit check | `npm run lint` | PASS: exit 0 | `world-lint.log` |
| Assigned-file whitespace check | Three owned source/test files | `awk` trailing-whitespace scan | PASS | `world-diffcheck.log` |

## Frozen file receipt

- `src/lib/canvasLibraryWorld.ts`: `f98e954a418218c1c50da16c767abb278c70aecef14af066990eb47129150b3e`
- `src/lib/canvasLibraryWorld.test.ts`: `dba2d1ae0c50c95e815a7bd3acd74fc09f411ef5f5299ad17b2f2e6ce783bd57`
- `src/components/student/library/CanvasLibraryRenderer.ts`: `ebddca1e5032078d36710dea0e585c25d56b0bf972945c0e99dd3471327c0a91`

## QA boundary

No browser pass is claimed here. The root task owns the fresh real-browser 1280×800 manual QA after these product files freeze. This receipt provides the baseline failure intent, authored geometry, renderer integration, focused behavior tests, and type/diff checks for that surface run.
