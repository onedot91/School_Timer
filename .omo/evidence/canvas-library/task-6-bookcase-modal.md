# Canvas library bookcase modal — QA receipt

Final source binding:

- `src/components/student/library/CanvasLibraryGame.tsx`: `85e95e2ff896e2c8d58fca152c08cf6e5d8c95aeace00ba2a3cf71ff2a54e110`
- `src/index.css`: `df69c2f6fcc244348e1e0513a4eb6557e958409e414e4c6cbc4652d0af8c32a6`

The prior card-grid baseline is pinned as visual RED:

- PNG: `task-6-bookcase-modal-before-picker.png`
- SHA-256: `0add3539808cf76b47764147975a9fdaa92842a01aa0a268f42f7aa9c8fc1786`
- Functional receipt: `task-6-bookcase-modal-baseline-route-qa.json` (`165d989a4c958767c8837aefb15ab3d5dfa2d98cfddb65277badfde41e522d55`)

## Real-browser manual QA

Invocation after restarting a no-HMR mock server on port 3038:

`DISABLE_HMR=true npm run dev:stable -- --host 127.0.0.1 --port 3038`

`node .omo/evidence/canvas-library/task-6-bookcase-modal-qa.mjs`

The second command used isolated Google Chrome/Playwright at exactly 1280×800. It passed with no page errors; machine-readable details are in `task-6-bookcase-modal-qa.json`.

| Scenario | Binary observable | Captured artifact |
| --- | --- | --- |
| Wooden picker material | Computed dialog background is `rgb(105, 80, 68)` with a timber repeating gradient. Human review shows a timber frame, dark continuous recess, horizontal planks, and no card grid. | `task-6-bookcase-modal-route-picker.png` |
| All shelf forms, empty/mixed/full | Five 20-slot pickers opened for each state. Every dialog and grid stayed in the 1280×800 viewport and had 20 real buttons. | `task-6-bookcase-modal-bookcase-{empty,mixed,full}-full-{wide-left,wide-center,compact-back,tall-island,endcap-island}.png` |
| Spine palette and geometry | Mixed state computed opaque colors: tone 0 `rgb(129, 76, 73)`, tone 1 `rgb(61, 98, 112)`, tone 2 `rgb(79, 105, 87)`; all three differ. Pseudo-band geometry is above its slot-number rectangle. | `task-6-bookcase-modal-bookcase-mixed-full-wide-left.png`, `task-6-bookcase-modal-bookcase-mixed-full-endcap-island.png` |
| Keyboard and selection | WASD route travel and ArrowRight move work; no `이동 방향` group or four directional buttons exists. Slot ArrowRight/Enter yields the retained error, and Escape closes the picker. | `task-6-bookcase-modal-bookcase-keyboard-empty-error.png` |
| Failed-save recovery | Synthetic storage failure leaves focus inside the slot dialog, Tab stays trapped, Escape closes, and retry persists exactly one book. | `task-6-bookcase-modal-route-save-failed.png`, `task-6-bookcase-modal-route-save-retried.png` |
| 200% text | Dialog, scrollable grid, and close action have viewport-contained real bounding rectangles. The mode-badge rectangle still intersects the close rect, but its z-index is 79 and `elementFromPoint` at the close center resolves to the close button, proving no occlusion. | `task-6-bookcase-modal-bookcase-text-200-picker.png` |

The same Chrome run also passed placement/reload inspection, legacy no-duplicate reward behavior, blur pause, reduced motion, registration 200% actions, and 100-book capacity.

## Static validation

`npm run lint` passed.

`npm test` passed: 572 tests, 0 failures. The suite prints one intentional malformed mission-response diagnostic while its corresponding test passes.

`npm run build` passed.

`git diff --check -- src/components/student/library/CanvasLibraryGame.tsx src/index.css` passed.
