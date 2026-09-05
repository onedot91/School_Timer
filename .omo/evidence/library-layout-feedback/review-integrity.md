# Library layout feedback — integrity gate review

Date: 2026-09-05

## Recommendation

- `verdict`: **PASS**
- `recommendation`: **APPROVE**
- `blockers`: **None**

## Original intent

Replace the over-furnished library layout with one coherent, usable room: reuse the existing failure exhibition as a physical wall bulletin board, put book registration at the entrance, represent all 100 persistent positions in exactly two compact shelves with dense readable spines, and preserve the existing data/backend behavior. Keep keyboard movement and contextual interaction without a visible directional pad.

## Desired outcome

At 1280×800, a student can enter the real library route, immediately register/carry a book, reach either shelf or the wall board by keyboard, place/read books without changing stable slot IDs, and use the existing create/stamp failure-story flow. Dialogs must retain one modal owner and preserve drafts across cancel/failure/pending states. The page must not clip, overlap, create document overflow, introduce runtime errors, or require new assets, engines, dependencies, or backend contracts.

## User outcome review

The shipped artifact satisfies the requested outcome.

- The room now visibly contains two compact 5×10 bookcases, one registration desk directly in front of the entrance, and one framed wall bulletin board. The old baseline is appropriately treated as the design being replaced, not a pixel target (`before.png`, `entered.png`, `full-100.png`).
- Both shelves collectively expose 100 stable IDs `0..99`; current tests verify `[50, 50]`, uniqueness/order, dense 6px-or-wider slots, 1–3px gaps, collision separation, and reachability (`src/lib/canvasLibraryWorld.ts:147-190`, `src/lib/canvasLibraryWorld.test.ts:282-409`). Full and scrolled picker captures show IDs 1–100 and readable dense spines (`full-picker-*.png`).
- The failure exhibition is not a detached replacement screen: the Canvas2D room draws a physical board, proximity resolves a `failure-board` target, and the game renders the existing `StudentFailureExhibitionPage` callbacks inside that board modal (`src/components/student/library/CanvasLibraryGame.tsx:216-332,503-545`; `src/components/student/StudentLibraryPage.tsx:60-84`; `board-stories.png`, `legacy-route-board.png`).
- Registration and existing-book carry reuse the live placement callback and persisted book identity. The full-route capture sequence demonstrates registration, carried state surviving board open/close, placement, and reload/readback (`entrance-registration.png`, `board-closed-carry-retained.png`, `placed.png`, `reloaded-book.png`).
- Modal ownership is explicit: the embedded board relinquishes `aria-modal` and becomes `aria-hidden`/`inert` while composer or cheer dialogs own the modal layer; Escape on the stamp menu is captured locally. Rejected/pending create fixtures preserve draft and block close/duplicate submission, then return to one board owner on success (`src/components/student/StudentFailureExhibitionPage.tsx:91-122,190-222,251-290`; `src/components/student/StudentFailureMessage.tsx:108-124`; `board-states.md`).
- No directional pad is present. Movement remains WASD/arrow-key Canvas input with E/Enter interaction and live DOM dialog controls (`src/components/student/library/CanvasLibraryGame.tsx:337-371,503-540`). Canvas2D is genuine (`src/components/student/library/CanvasLibraryRenderer.ts:789-825`).
- All 20 current QA screenshots are 1280×800. Visual inspection found no clipping, overlap, or unintended document scrolling. The normal board is a 3×2 presentation; at 200% text zoom it becomes an internally scrollable single column while the close header stays visible (`board-stories.png`, `board-text-200.png`, `board-text-200-card.png`).
- The intentional image diff is coherent with the brief: dimensions and alpha match, similarity is 64/100, 365,076/1,024,000 pixels differ, and all 46 hotspot records correspond to the removed shelf/decor regions and added desk/board/two-shelf layout (`diff.json`). This is evidence of the intended structural redesign, not a fidelity regression.

## Evidence integrity

- `.omo/evidence/library-layout-feedback/qa.json` reports all nine behavioral checks true, `errors: []`, `passed: true`, cleanup of the isolated browser, and 20 screenshot paths.
- Every one of those 20 screenshots plus `before.png` was opened and visually inspected for this review.
- The QA source hashes for all reviewed production files match the current working tree exactly. The QA harness hash is `9a715fcad2521d6bf2526f6602f57ff993f20e22be05dfd79b140e70a4ecffe1`.
- `.omo/evidence/library-layout-feedback/tests.log`: 576 passed, 0 failed. The printed weekly-mission error is the expected negative-path test log; suite status is green.
- `.omo/evidence/library-layout-feedback/lint.log`: `tsc --noEmit`, exit 0.
- `.omo/evidence/library-layout-feedback/build.log`: Vite build exit 0.
- `qa.json` lists blocked `/css2`, `/api/version`, and `/api/question-submission-status` requests from the isolated harness; they produced no page errors and are not library writes. No production data or server was used by this review.

## Direct remove-ai-slops / programming pass

No success-criterion-blocking slop or overfit was found in the production behavior added for this feedback pass. The two-shelf layout and physical board are necessary product units, reuse existing callbacks/components, and do not add an engine, asset, dependency, or duplicate backend path. The focused world tests assert observable geometry, identity, collision/reachability, capacity, and state preservation rather than merely checking that old furniture was deleted.

The existing `.omo/evidence/canvas-library/final-code-review.md` explicitly records both `omo:remove-ai-slops` and `omo:programming` perspectives, including overfit-test and oversized-module coverage, then re-adjudicates them against the actual acceptance criteria and independent behavioral evidence. I independently repeated the relevant pass over the current diff/tests rather than relying on that report.

### Non-blocking notes

- [evidence] `omo ulw-loop status --json` could not be executed because the `omo` executable is unavailable in this environment. The task supplied the exact attempt evidence directory, so this report uses the requested fallback path. This does not leave a named product criterion unverified.
- [product] `CanvasLibraryGame.tsx`, `CanvasLibraryRenderer.ts`, and `canvasLibraryWorld.ts` exceed the programming skill's general 250-pure-LOC guidance. The approved scope does not name module size as a success criterion, and AGENTS.md requires approval before the structural refactor needed to split them, so this is maintenance debt rather than a delivery blocker.
- [evidence] The source-text route test previously noted in `final-code-review.md` is brittle supplementary coverage. Current behavioral local/client tests and the source-bound full-route QA independently verify the state contract, so it does not create false approval for any requested outcome.

## Checked artifact paths

- Plan: `.omo/plans/library-layout-feedback.md`
- QA: `.omo/evidence/library-layout-feedback/qa.mjs`, `qa.json`, all 20 screenshots, `before.png`
- Visual delta: `.omo/evidence/library-layout-feedback/diff.json`, `diff-check.log`
- State evidence: `.omo/evidence/library-layout-feedback/board-states.md`, `board.md`, `world.md`
- Gates: `.omo/evidence/library-layout-feedback/tests.log`, `lint.log`, `build.log`, `world-test.log`, `world-lint.log`
- Prior code review: `.omo/evidence/canvas-library/final-code-review.md`
- Production/tests: `src/lib/canvasLibraryWorld.ts`, `src/lib/canvasLibraryWorld.test.ts`, `src/components/student/library/CanvasLibraryGame.tsx`, `src/components/student/library/CanvasLibraryRenderer.ts`, `src/components/student/StudentLibraryPage.tsx`, `src/components/student/StudentFailureExhibitionPage.tsx`, `src/components/student/StudentFailureMessage.tsx`, `src/pages/AuctionPage.tsx`, `src/index.css`

## Exact evidence gaps

None tied to a stated success criterion.

## Cleanup

This review spawned no browser, server, temporary fixture, or sub-agent resource. No cleanup was required.

## Addendum — refreshed 21-capture evidence adjudication

Recorded: 2026-09-05 18:04 KST (`qa.json.generatedAt`: `2026-09-05T09:04:08.643Z`)

- `verdict`: **PASS**
- `recommendation`: **APPROVE**
- `blockers`: **None**

I reopened and inspected every screenshot in the refreshed 21-item `qa.json` list. The original 20 scenarios remain visually consistent, and the new `board-text-200-lower-card.png` shows the fourth card after a deep internal scroll while the board title and close control remain at the top of the same fixed board frame.

The strengthened binary measurements resolve the earlier screenshot-only ambiguity:

- `windowY: 0`, `rootY: 0`, and `bodyY: 0` prove that neither the document nor its root/body scrolled.
- `innerY: 1805` proves the scroll occurred in `.student-canvas-library-failure-board-content`, the intended internal scroll owner.
- `headerBefore` and `headerAfter` are identical at `{ x: 100, y: 136, width: 1080, height: 128 }`, proving the header did not move during the internal scroll.
- `closeRect` remains `{ x: 1120, y: 144, width: 44, height: 88 }`; the harness then directly activated the close control without `scrollIntoView`, demonstrating that it remained operable in place.
- The CSS supports the measured behavior: the fixed board uses `grid-template-rows: auto minmax(0, 1fr)` with `overflow: hidden`, while only its content row uses `min-height: 0; overflow: auto` (`src/index.css`, library failure-board scoped section).

All reviewed production SHA-256 values still match `qa.json.sourceSha256` exactly. The product source is unchanged from the original approval; only the QA harness/evidence was strengthened (`qa.mjs` current SHA-256: `0511d3b94c25b54e4b5b57c27ee2116f39b10f2cce4fd9ba7a6e41b2b37b0ee7`). `qa.json.passed` remains true with all nine checks true and `errors: []`. The recorded 576-test, lint, and build gates remain applicable because their product inputs did not change.

This is an evidence adjudication, not a product fix. It introduces no new functional, visual, accessibility, data-integrity, or cleanup gap and therefore does not change the original **PASS / APPROVE** recommendation.
