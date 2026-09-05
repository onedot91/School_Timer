# Library layout feedback — visual/CJK gate review

## Verdict

**REVISE**

The normal 1280×800 library and its core flows visually satisfy the requested direction, but the 200% text-zoom evidence exposes document-level scrolling that moves the supposedly fixed bulletin-board header and close control out of view. This conflicts with the repository's explicit text-zoom/overflow-safety contract and the claimed fixed-header behavior.

## Blocker

### [product] Text zoom does not keep the board header/close control fixed

- **Violated criterion:** preserve keyboard access, text zoom, and overflow safety; the long-card board must use inner scrolling while the close header remains visible.
- **Observation:** `board-text-200.png` initially shows the board title and close button. After bringing the first card into view, `board-text-200-card.png` shows neither; the viewport has moved to the card body. The only way QA restores the close control is a second `close.scrollIntoViewIfNeeded()` call.
- **Evidence pointers:** `.omo/evidence/library-layout-feedback/board-text-200.png`, `.omo/evidence/library-layout-feedback/board-text-200-card.png`, `.omo/evidence/library-layout-feedback/qa.mjs:164-171`.
- **Source locations:** `src/index.css:1489` declares the board fixed and `src/index.css:1541` declares the intended inner scroller. The captured result shows that intent is not preserved when `scrollIntoViewIfNeeded()` targets a card at 200% text size.
- **Required correction/evidence:** prevent the root/document from scrolling at 200% and prove that scrolling the board content leaves `실패 자랑소 닫기` visible without scrolling the close button back into view. Record `scrollY === 0` (or equivalent root-scroll assertion) after reaching a lower card, plus a screenshot with a lower card visible and the header/close control simultaneously visible.

## User-outcome review

- **PASS — physical integration:** the failure exhibition is visually a real right-wall bulletin board inside the library, not a separate destination. `entered.png`, `board-stories.png`, and `legacy-route-board.png` show the same room behind the board overlay; the legacy route lands in the embedded board and contains no `책장으로 가기` escape UI.
- **PASS — entrance-first registration:** the desk sits directly above the entrance rug/player spawn. `entrance-registration.png` presents `읽은 책 등록`, keeps all Korean labels readable, and includes previous-book recovery.
- **PASS — fewer shelves / 100 books:** the room contains exactly two large shelves. `full-100.png` shows 50 dense upright spines per shelf, with a coherent coral/blue/sage library palette. The four picker screenshots prove both 1–50 and 51–100 ranges and their lower rows.
- **PASS — no product directional pad:** no directional-pad UI appears in any screenshot. The small black bottom-center pointer pill appears identically in the old baseline and all captures, so it is capture/browser chrome rather than the redesigned product surface.
- **PASS — normal 1280×800 composition:** `entered.png`, `placed.png`, `reloaded-book.png`, and `full-100.png` show no product clipping, overlap, or unintended first-screen overflow. Interaction labels remain separated from furniture and character sprites.
- **PASS — board functionality:** create, cancel, created-owner state, stamp menu, stamped state, close-with-carried-book, and legacy-board entry have distinct visual receipts. `board-states.md` additionally records rejected/pending callback states, duplicate-submit prevention, focus restoration, and one-modal ownership.
- **PASS — CJK precision at normal scale:** Korean labels use meaningful word-level wrapping (`다음에는 천천히 다시 도전해 / 볼래요.`), no broken glyphs, and no text collisions in cards, registration, book details, or shelf captions.
- **REVISE — CJK/text zoom:** the single-column 200% card layout itself does not overlap, but its navigation/containment behavior fails the fixed-header evidence requirement described above.

## Baseline/diff interpretation

`diff.json` was read in full. Its fields report: command `image-diff`; matching 1280×800 dimensions; 1,024,000 total pixels; 365,076 changed pixels; ratio 0.3565; similarity 64; intact alpha; 46 hotspots; summary consistent with those values.

The low similarity is expected from intentional furniture re-layout, not evidence of a fidelity regression:

- Upper-left/center hotspots map to replacing three heterogeneous upper shelves with two large 50-slot shelves (`CanvasLibraryRenderer.ts:442`, plus the new room model).
- Center/lower hotspots map to removing the two old mid-room shelving units and relocating the registration desk to the entrance (`CanvasLibraryRenderer.ts:195`, room/depth drawing around `:737-781`).
- Right-side hotspots map to replacing the old rug/table area with the physical failure bulletin board (`CanvasLibraryRenderer.ts:287`).
- Broad floor hotspots arise because newly exposed floor receives the deterministic plank/brick treatment from `CanvasLibraryRenderer.ts:100`.

The unchanged outer room frame, green upper wall, brown floor family, window, pixel-art treatment, exit/book controls, and entrance threshold show coherent continuity with `before.png`. The old design is a baseline for intentional comparison, not a pixel-clone target.

## Directly checked visual artifacts

All 20 paths enumerated by `qa.json` were opened individually at original detail, plus the baseline:

1. `before.png`
2. `entered.png`
3. `entrance-registration.png`
4. `board-stories.png`
5. `board-stamp-menu.png`
6. `board-stamped.png`
7. `board-compose.png`
8. `board-compose-cancelled.png`
9. `board-created.png`
10. `board-closed-carry-retained.png`
11. `dense-empty-picker.png`
12. `placed.png`
13. `reloaded-book.png`
14. `full-100.png`
15. `full-picker-full-left-bookcase.png`
16. `full-picker-bottom-full-left-bookcase.png`
17. `full-picker-full-center-bookcase.png`
18. `full-picker-bottom-full-center-bookcase.png`
19. `legacy-route-board.png`
20. `board-text-200.png`
21. `board-text-200-card.png`

Also checked: `qa.json`, every field/hotspot in `diff.json`, `qa.mjs`, `board-states.md`, `tests.log`, `lint.log`, `build.log`, and the scoped production sources named in the task.

## Evidence integrity and slop/programming pass

- All 12 `sourceSha256` entries in `qa.json` were recomputed and match current files.
- The evidence logs report 576 tests, lint success, and build exit 0; these were inspected as supplied evidence, not rerun for this visual-only gate.
- Direct `remove-ai-slops`/`programming` review found no criterion-blocking tautological deletion tests, prompt/prose pins, screenshot-only fake implementation, or unnecessary production parsing/normalization in the scoped visual work. The canvas renderer is large, but size/architecture taste is not a blocker unless tied to the requested visual criterion.
- `qa.mjs` is broad and scenario-oriented, but its `text200` boolean is currently a false-positive because it never asserts root scroll remains zero after the card is reached and explicitly scrolls the close button back into view. This is the exact evidence gap behind the REVISE verdict.

## Cleanup

No browser, server, process, dependency, or temporary fixture was created by this review. Only this review artifact was added; no product source was edited.
