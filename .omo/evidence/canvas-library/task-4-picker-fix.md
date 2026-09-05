# Task 4 — full-room slot picker readability

## Result

PASS. The 20-slot picker now uses each cell for a slot number plus a compact book/empty mark, while the focused slot's complete accessible name is rendered in the full-width caption above the grid. The existing `aria-label`, roving focus, click/Enter behavior, modal trap, and placement/detail flows were not changed.

The final bounded layout keeps the heading, close control, and selected-title caption fixed inside the dialog and gives only the slot grid internal overflow. A `0.375rem` grid inset protects the shared 3px focus outline plus 2px offset on every edge.

Final source SHA-256:

- `src/components/student/library/CanvasLibraryGame.tsx`: `762c1c0c9d082fa8b9c4829497c6156e7cc0de8f9d7d88bfb5f399d868dcc7d4`
- `src/index.css`: `ecc0dd6bf67c0fa39518610b9fee8b0184989ba87ca9e6dc3773e7239337cbb2`

## PIN / RED

- I directly inspected `task-4-picker-red.png` at 1280×800. Its ten-column occupied shelf renders complete Korean titles in narrow cells as stacked one- or two-character fragments; the first long title is particularly unreadable.
- The durable root observation is also recorded in `task-4-root-interim.md`.
- The first 200% implementation attempt used a sticky caption. Real reverse keyboard navigation showed that the caption covered focused slots 65 and 61. The preserved receipt `task-4-picker-200-red.json` records `separated: false` for those rows and an assertion failure. This rejected the incremental sticky approach.
- An early evidence-driver run also failed because its visible-text regex required whitespace between separate spans while `allTextContents()` correctly concatenated them as `1책`. Only the evidence oracle was corrected to accept optional whitespace; the product was unchanged for that harness-only failure.

## Implementation

- `CanvasLibraryGame.tsx`: derives the active slot/book label, exposes the complete title or `빈자리 N` in `.student-canvas-library-slot-caption`, and retains the exact full title/empty name on every button's `aria-label`. Grid cells contain only slot number, CSS book/empty mark, and state word.
- `src/index.css`: supplies the readable caption, 44px-plus cells, compact number/mark/state layout, a flex-column slot dialog, independently scrollable grid, and four-sided focus-ring inset. It does not change room or shelf geometry.

## Real browser GREEN

Invocation:

```bash
env VITE_DATA_MODE=mock DISABLE_HMR=true ./node_modules/.bin/vite --port 3028 --host 127.0.0.1
node .omo/evidence/canvas-library/task-4-picker-qa.mjs
```

Environment: local-only fixture `/.omo/evidence/canvas-library/full-room.html?mode=full`, Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, viewport 1280×800. The Playwright context aborted `/api/**` and every non-`127.0.0.1:3028` request. Player travel used held keyboard input from the real spawn; no position setter or teleport was used.

Binary observables in `task-4-picker-qa.json` (`generatedAt: 2026-09-05T06:58:23.390Z`, `passed: true`):

- `full-wide-left`: 10 columns × 2 rows, 20 non-empty accessible labels, exact first/last caption, Enter details, Escape Canvas focus return, movement frozen while modal is open.
- `full-compact-back`: 5 × 4, same 20-label and interaction checks.
- `full-tall-island`: 4 × 5, same 20-label and interaction checks.
- First and last focus-ring inset is at least 6px on the nearest grid edges for all three layouts (`outlineClear: true`).
- At 200% root text size: document overflow is exactly `{x:0,y:0}`; caption and close control are inside the 1280×800 viewport; last-to-first ArrowLeft/ArrowUp traversal records eight focused states, all in viewport and all separated from the caption.
- Source hashes were unchanged for the complete browser run; `blockedRequests` and `errors` are empty. The owned Chrome context closed in `finally`.

Captured artifacts:

- `task-4-picker-full-wide-left-first.png`
- `task-4-picker-full-wide-left-last.png`
- `task-4-picker-full-compact-back-first.png`
- `task-4-picker-full-compact-back-last.png`
- `task-4-picker-full-tall-island-first.png`
- `task-4-picker-full-tall-island-last.png`
- `task-4-picker-tall-200-last.png`
- `task-4-picker-tall-200-first.png`
- machine receipt: `task-4-picker-qa.json` (SHA-256 `3bd16758b8e2e3cb10f838c6d93483c6b6f775fbe89f582c4819cd83c41afd53`)

I directly inspected both final 200% PNGs: the complete selected title remains visible, first and last focus rings are fully drawn, and the grid scrolls without covering the caption.

## Repository verification

- `npm run lint` → exit 0 (`tsc --noEmit`).
- `npm test` → exit 0; 537 passed, 0 failed, 0 skipped.
- `git diff --check -- src/components/student/library/CanvasLibraryGame.tsx src/index.css .omo/evidence/canvas-library/task-4-picker-qa.mjs` → exit 0, no output.
- `lsof -nP -iTCP:3028 -sTCP:LISTEN` after sending Ctrl-C to the owned Vite session → exit 0 with no listener output. No root-owned server was stopped.

