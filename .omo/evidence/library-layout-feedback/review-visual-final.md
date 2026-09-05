# Library layout feedback — final visual/CJK gate

Date: 2026-09-05

## Recommendation

- `verdict`: **PASS**
- `recommendation`: **APPROVE**
- `blockers`: **None**

## Original intent

Replace the prior over-furnished library with a coherent physical room: reuse the existing failure exhibition as a right-wall bulletin board, make book registration entrance-first, use exactly two compact 50-slot bookcases for 100 persistent IDs with tightly spaced spines, and remove the visible directional pad while retaining keyboard interaction.

## Desired outcome

At 1280×800, students can register a book at the entrance, carry it through the room, place or inspect it in either dense shelf, and open/create/stamp/close the embedded failure board. Korean text must remain readable and non-overlapping at normal scale and 200% text zoom; zoom overflow must remain inside the board with its header and close control fixed and operable.

## User outcome review

The current artifact satisfies the requested visual and CJK outcome.

- **Physical room composition:** `entered.png`, `placed.png`, and `full-100.png` show two visually balanced bookcases, the registration desk directly above the entrance/player spawn, and one framed right-wall failure board. The board reads as furniture in the room, not a detached replacement route.
- **Entrance-first registration:** `entrance-registration.png` presents `읽은 책 등록` immediately at the entrance. Labels, values, previous-book recovery, cancel, close, and submit controls are separated and legible.
- **Two shelves / 100 stable positions:** `full-100.png` shows 50 dense upright spines in each of two shelves. The four full/bottom picker captures visibly cover IDs 1–50 and 51–100; numbers and alternating spine heights/colors remain distinguishable without loose shelf spacing.
- **No visible directional pad:** none of the 21 current product captures contains directional buttons. Keyboard guidance (`WASD 또는 방향키로 이동`) is status/instruction text, not a directional-pad control.
- **Board states and flow:** `board-stories.png`, `board-stamp-menu.png`, `board-stamped.png`, `board-compose.png`, `board-compose-cancelled.png`, `board-created.png`, and `board-closed-carry-retained.png` provide distinct receipts for reading, stamping, composing, cancelling, creating, closing, focus/ownership flow, and retaining the carried book. `legacy-route-board.png` opens the same embedded board.
- **Normal-scale CJK quality:** Korean glyphs render cleanly. Word-level wrapping is natural, including `다음에는 천천히 다시 도전해 / 볼래요.`; no card, dialog, button, or shelf-caption text overlaps or produces isolated punctuation/orphaned syllables.
- **200% text zoom:** `board-text-200.png`, `board-text-200-card.png`, and `board-text-200-lower-card.png` show the intended single-column cards without collisions. The latter shows a lower card while `실패 자랑소` and the close control remain simultaneously visible.
- **Zoom containment reproduced from artifacts:** `qa.json.zoomScroll` records `windowY: 0`, `rootY: 0`, `bodyY: 0`, and `innerY: 1805`; `headerBefore` and `headerAfter` are identical at `{x:100,y:136,width:1080,height:128}`, and `closeRect` remains within the viewport at `{x:1120,y:144,width:44,height:88}`. `qa.mjs:171-181` asserts these values and clicks the close control directly, with no restorative `scrollIntoView` on the close button.
- **1280×800 safety:** all 21 QA screenshots are 1280×800. Visual inspection found no product clipping, overlap, unintended document scrolling, or obscured required control. Picker bottom captures intentionally show a scrolled internal grid; their clipped preceding row is scroll-boundary context, not document or modal clipping.

## Baseline and diff adjudication

`diff.json` was read in full. It reports matching 1280×800 dimensions, intact alpha, 1,024,000 pixels, 365,076 changed pixels, ratio 0.3565, similarity 64/100, and 46 hotspots. The hotspots coherently map to removal of the prior heterogeneous shelves/mid-room decor and addition or relocation of the two bookcases, entrance desk, and failure board. Because `before.png` is the intentionally replaced design, this structural delta supports the brief and is not a pixel-fidelity failure.

## Direct remove-ai-slops / programming pass

No stated visual criterion is defeated by slop, overfit, or maintenance structure in the reviewed scope. The new room units are necessary product behavior and reuse existing Canvas/DOM, failure-story components, callbacks, storage identity, and styles. The visual/world tests and full-route QA assert observable geometry, capacity, IDs, interaction results, modal ownership, overflow, and persisted outcomes; they do not merely assert deletion of old furniture.

The prior code review explicitly covers both `omo:remove-ai-slops` and `omo:programming`, including implementation-mirroring test and oversized-module concerns. I independently repeated the relevant pass. The large Canvas modules and brittle supplementary source-text route test remain maintenance notes, not blockers: neither creates a failure of a named visual/CJK/user outcome, and browser/state evidence independently covers the requested flow.

## Checked artifact paths

- `.omo/evidence/library-layout-feedback/qa.json`
- all 21 PNG paths enumerated by `qa.json`
- `.omo/evidence/library-layout-feedback/before.png`
- `.omo/evidence/library-layout-feedback/diff.json` (all fields and 46 hotspots)
- `.omo/evidence/library-layout-feedback/qa.mjs`
- `.omo/evidence/library-layout-feedback/board-states.md`
- `.omo/evidence/library-layout-feedback/verification.md`
- `.omo/evidence/library-layout-feedback/tests.log`
- `.omo/evidence/library-layout-feedback/lint.log`
- `.omo/evidence/library-layout-feedback/build.log`
- `.omo/evidence/library-layout-feedback/review-integrity.md`
- `.omo/evidence/library-layout-feedback/review-visual.md`
- `.omo/evidence/canvas-library/final-code-review.md`
- `src/index.css`
- `src/components/student/library/CanvasLibraryGame.tsx`
- `src/components/student/library/CanvasLibraryRenderer.ts`
- `src/components/student/StudentLibraryPage.tsx`
- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/components/student/StudentFailureMessage.tsx`
- `src/components/student/StudentFailureRelay.tsx`
- `src/lib/canvasLibraryWorld.ts`

All 12 source SHA-256 values in `qa.json` were independently recomputed and match the current files.

## Evidence gaps

None tied to a stated success criterion.

## Notes

- `[evidence]` The supplied logs show 576 tests passed, `tsc --noEmit` exited successfully, and the Vite build completed. This visual-only final pass inspected those logs rather than rerunning the full gates.
- `[product]` Oversized Canvas modules and the supplementary implementation-mirroring route test are maintenance debt already recorded by code review; they do not falsify any requested visual or CJK result.

## Cleanup

This review created no runtime, browser, server, temporary fixture, dependency, or network resource. No cleanup was required. Product source was not modified.
