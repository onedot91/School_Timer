# Competition board integration

Scope: room target/collider, pixel trophy cabinet, Canvas interaction, season-change draft retention, StudentLibraryPage panel composition. No persistence, live data, or production DB writes.

## Verification

- RED: `node --import tsx --test --test-name-pattern='아래쪽 순위판' src/lib/canvasLibraryWorld.test.ts` failed because no reachable `competition-board` existed.
- GREEN: `node --import tsx --test src/lib/canvasLibraryWorld.test.ts`: 27 pass, 0 fail. BFS movement reaches competition board, all 100 slots, all four shelves, desk, failure board, and reading nook. Existing collider nonoverlap check passes.
- `npm run lint`: exit 0.
- `git diff --check`: exit 0.
- `node .omo/evidence/library-competition/game-qa.mjs`: actual isolated Chrome 1280×800 PASS. Walked from entry to ranking fixture using ArrowLeft; E, Enter, Korean KeyE keyboard event, and actual canvas click open the delegated dialog.
- Registration inputs survive season prop update and reopened registration. Carried draft survives the second season update while slot modal is open, then is successfully placed after reopening the shelf.
- `game-board-near.png` directly inspected: trophy/podium is in the lower-left, matches shared palette, readable E-only label, no overlap with desk, shelves, or player path.
- The fixture tests game integration; it deliberately substitutes a tiny panel and does not claim actual ranking data, archive, teacher panel, or RPC coverage. Those belong to root integration QA.

Harness corrections: an external month-switch button was properly inert under the existing focus trap, so server-driven season update is injected as a fixture event; Playwright has no `keyboard.press('ㄷ')` key name, so the test dispatches the actual Korean `keydown` fields; slot test selector corrected to the existing `.is-empty` button.

## Cleanup

All isolated Chrome instances close in `finally`, including failing harness attempts. Root-owned 3044 server was neither started nor stopped by this worker. Fixture and screenshots remain as durable evidence. No user browser, user 3000 server, or production state touched.

## Source fingerprints

- world `e57b8def7eb4e6d3c2d277bfe4057a5f484247da6edba70e73f0cddda58b9c62`
- Game `5a33bf38ac83ddcfe94d122e4b9579eb5be1a29d9b819d1e7310e4c557db0cdd`
- Renderer `b70fa465418af1f74700dad65c77cc83a816cc80e1007df4ab6395ea5a055a0c`
- new board helper `440e71db3f5d64c52881dca54c7112c5d198ae4c0009f665871a410da9b846bd`
- StudentLibraryPage `2c389aafd9d3d8adaeb3018b1b97dcf2151c359c6f0c68a44fa47e0d57978f78`

New renderer helper is 37 lines and owns only trophy cabinet artwork. Existing large Game/world/renderer modules were narrowly extended under the project rule against unrelated refactors. Typed optional props reuse existing controlled callback, palette, collision, and modal focus contracts; no dependencies or type escape hatches added.
