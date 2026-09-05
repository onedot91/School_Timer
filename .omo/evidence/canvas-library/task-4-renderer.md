# Task 4 full-room renderer evidence

## Owned scope and exact files

- Product change: `src/components/student/library/CanvasLibraryRenderer.ts`
- Isolated actual-game fixture: `full-room.html`, `full-room.tsx`, `full-room-qa.mjs`
- Captures and receipts listed below.
- World/types/DESIGN, Game/CSS, routes, backend, persistence, dependencies, assets, and generated/imported images were not edited in this renderer lane.

Renderer product SHA-256 changed from the Task 3 approved `b21940d721ed9c9062f78c21939b65299e8113f7a555f599629326895de73ca7` to `9979f2100bb0ce0d9f4f5eb2f87be952fc83340af2f3c5ad3a379a2c8dafebce`. Exact final source/fixture/capture hashes are recorded in `task-4-renderer-sha256.txt`.

## PIN and RED

- PIN scenario: approved 18-slot game at `1280x800`, including cue behavior and 16 actual-play states.
- PIN artifact: `root-play-qa.json` with `passed:true`, renderer SHA `b21940...`, zero overflow/errors/blocked requests; visual approval is `task-3-final-visual.md`.
- RED scenario: before Task 4 product edits, check for a full-room fixture, `createFullLibraryRoom`, and `compact`/`endcap` renderer branches.
- RED invocation: bounded shell audit captured in `task-4-renderer-red.log`.
- RED binary observable: fixture absent and full-room API/variant renderer unavailable while the pinned renderer hash remained `b21940...`.

## Renderer implementation

- The existing `624x376` intrinsic Canvas, static architecture/floor cache, named palette, upper-left lighting, contact shadows, player, contextual cue, and single stable `(floorY,id)` dynamic sort remain unchanged.
- The existing carried-draft cue correction is preserved: an occupied book shows `Enter 책 보기` only while empty-handed; while carrying it shows `E 책장 열기`.
- `wide-low` keeps its broad shallow two-level frame and `narrow-tall` its raised-cap silhouette.
- `compact` uses a shallower front lip, close dense row framing, and lower rail. `endcap` uses the raised cap plus a lit finished side panel and side joinery. All four variants consume world-owned `visualRect`, `footCollider`, and direct `slot.rect` geometry rather than duplicating layout.
- Full shelves remain individual books rather than flat fill blocks: each placed record gets one bounded spine with stable `slotId`-derived 0–2 logical-pixel top/side variation, one of the three named accent pairs, paper edge, highlight band, and local dark contact pixel.

## Actual CanvasLibraryGame QA

Server invocation: `npm run dev:stable -- --host 127.0.0.1 --port 3026 --strictPort`. HMR was disabled so evidence writes could not reset movement state.

Browser invocation: `node .omo/evidence/canvas-library/full-room-qa.mjs`. CUA was attempted first at the exact local empty URL but returned `Browser is not available: chrome`; installed Chrome driven by the bundled Playwright module was the capability fallback. The script allowed local fixture/module requests only and blocked `/api` plus all non-local requests.

Fixture URLs:

- Empty actual game: `http://127.0.0.1:3026/.omo/evidence/canvas-library/full-room.html?mode=empty`
- Controlled read-only synthetic 100-book actual game: `http://127.0.0.1:3026/.omo/evidence/canvas-library/full-room.html?mode=full`

The fixture adds no visible debug HUD and calls the real `CanvasLibraryGame` with `createFullLibraryRoom()`. Empty mode uses the game's isolated local book state. Full mode supplies 100 synthetic books plus a non-writing `onPlace` for inspection only.

### Exact scenarios and observables

| Scenario | Invocation/action | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Empty full room | Load `?mode=empty` at viewport `1280x800` | Canvas intrinsic `624x376`, CSS `1248x752`, player `[312,340]`, document overflow `[0,0]` | `full-room-empty.png`, `full-room-qa.json` |
| Empty first shelf | Real held keyboard path `A 1200ms`, `W 2180ms`, `A 860ms`, then `E` | Player `[105.33,121.68]`, target `full-wide-left`, exactly 20 empty slot buttons | `full-room-empty-picker.png`, `full-room-qa.json` |
| Full 100 books | Load `?mode=full` with slots `0..99` occupied | Canvas intrinsic/CSS sizes unchanged, overflow `[0,0]`; all five shelf silhouettes and 100 individual spines visible | `full-room-100.png`, `full-room-qa.json` |
| First book inspection | Same real keyboard path to `full-wide-left`, press `E`, focus/click first named slot | Target `full-wide-left`; focused caption exactly `첫 번째 별빛 도서관 탐험기`; details heading visible `true` | `full-room-first-picker.png`, `full-room-qa.json` |
| Last shelf approach | From first shelf use real held keys `D 3440ms`, `S 1480ms`, `A 640ms`, press `E` | Player `[388.69,269.99]`, target `full-endcap-island` | `full-room-last-picker.png`, `full-room-qa.json` |
| Last long-CJK book | Focus/click accessible slot named `백 번째 책장의 아주 긴 한글 제목 확인본` | Focused caption matches full title; details heading visible `true`; title and long author remain readable | `full-room-last-picker.png`, `full-room-last-details.png`, `full-room-qa.json` |
| Network/storage isolation | Route every browser request | `errors:[]`, `blockedRequests:[]`; no `/api`, non-local, backend, or storage action | `full-room-qa.json` |

I directly opened the final empty, 100-book, empty-picker, first-picker, last-picker, and last-details PNGs. The wall-mounted three back units, two distinct island units, desk, entry, and reading alcove remain visually separated and walkable. No furniture/player overlap, missing/black region, clipped shelf, flat full-shelf slab, or unreadable first/last CJK caption was observed. This is renderer-lane evidence; root's independent 22-capture dual visual gate remains the Task 4 stage authority.

## Automated verification

- Scenario: full world geometry/capacity/approach suite.
- Invocation: `node --import tsx --test src/lib/canvasLibraryWorld.test.ts`.
- Binary observable: exit `0`, `19/19` pass. Includes exactly 100 unique in-bounds slots, connected non-overlapping furniture graph, five fully occupied shelf pickers reachable by movement, and 101st placement rejection preserving the existing 100 books and carried draft.
- Artifact: `task-4-renderer-world-test.log`.

- Scenario: repository TypeScript check against the final full-room world/Game/renderer contract.
- Invocation: `npm run lint`.
- Binary observable: exit `0`.
- Artifact: `task-4-renderer-lint.log`.

- Scenario: shared dirty-worktree whitespace/conflict check.
- Invocation: `git diff --check`.
- Binary observable: exit `0`, empty output.
- Artifact: `task-4-renderer-diff-check.log`.

## Known boundaries

- This lane does not claim backend persistence, production route integration, or Task 4 completion by itself.
- Full mode is explicitly controlled synthetic read-only inspection data; it is not production/student data and is not evidence of a persistence write.
- Root independently generated and opened the current-hash 22-image suite in `root-full-room-qa.json`; stage approval belongs to the root dual visual gate.

## Cleanup

- QA script closes its isolated Chrome browser in `finally`.
- Owned Vite 3026 session was stopped with Ctrl-C after the final capture.
- `lsof -nP -iTCP:3026 -sTCP:LISTEN` returned no listener; empty receipt is `task-4-renderer-cleanup.log`.
- No dependency, asset, network, storage, server state, or real student record was created.

