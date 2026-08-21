# Bookshelf alternating-layout clone / design-system fidelity review

## Recommendation

**APPROVE**

## Scope and success criteria inspected

- Alternation starts with the rendered top book and remains strict left/right for every visible book.
- Layout is data-driven, repeatable, and bounded rather than a screenshot-specific placement.
- Width variation and relative page-thickness behavior remain bounded and responsive.
- The shelf uses live DOM and documented visual tokens, not raster or background-image substitution.

## Evidence inspected

- Scoped diff: `DESIGN.md`, `src/lib/studentLife.ts`, and `src/lib/studentLife.test.ts`.
- Live rendering consumer: `src/components/student/StudentLibraryPage.tsx:30-80`.
- Shelf CSS/materials: `src/index.css:12487-12535`.
- Actual captures: `tmp/bookshelf-alternating-layout-qa/1024x768.jpg`, `tmp/bookshelf-alternating-layout-qa/1280x800.jpg`, and `tmp/bookshelf-alternating-layout-qa/1366x768.jpg`.
- Direct runtime probe: `getBookSpineHeightPx` produced `15→27`, `30→36`, `37→40.2`, and `45→45`; all 18 renderable layout indices alternated left/right and repeated after the 12-entry even cycle.
- Commands run in this worktree: `node --import tsx --test src/lib/studentLife.test.ts` (8/8 passed), `npm run lint` (passed), and `git diff --check` (passed).

## Findings

### CRITICAL

None. The stack is a map over saved `StudentBook` records to real `<article>` spine elements (`src/components/student/StudentLibraryPage.tsx:60-78`). Captures are evidence only; no image, canvas, or CSS background substitutes for the book stack.

### HIGH

None. The reusable `getBookStackLayout` helper reads a declarative 12-entry layout table (`src/lib/studentLife.ts:46-59,173-175`), and the consumer applies each returned width and offset to the corresponding live book (`src/components/student/StudentLibraryPage.tsx:61-70`). This is a reusable rendering rule, not a four-book screenshot arrangement.

### MEDIUM

None. The pattern is bounded by documented `81%–92%` widths and `-1.25%–1.25%` offsets (`DESIGN.md:158-159`) and protected by regression assertions (`src/lib/studentLife.test.ts:42-51`). The 12-entry cycle has even length and every even index is negative while every odd index is positive, so alternation stays strict through the page's 18-book render cap.

### LOW

None. The range-normalized spine calculation keeps current visible page-count differences legible while capping visual height at 27–45px (`src/lib/studentLife.ts:163-171`), and its physical-height label remains separately derived from the page count (`src/lib/studentLife.ts:159-161,177-179`). All three supplied desktop captures show the expected left/right sequence, distinct thicknesses, stable center axis, and no clipping.

## Blockers

None.
