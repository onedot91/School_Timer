# Bookshelf stack — clone/design-system fidelity review

## Review scope

- **Goal:** Re-verify the reference-inspired live bookshelf after the thickness-flattening change. The requested acceptance criteria include a deterministic token-driven layout, live DOM rather than an image stand-in, proportional `20px + 32px/cm` spine scale, visible per-page differences, and safe rendering at 1024, 1280, and 1366 CSS-pixel classroom widths.
- **Reference:** `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png` (534 × 942 RGBA PNG).
- **Rendered evidence:** `tmp/bookshelf-layout-qa/bookshelf-stack-1024.png` (1024 × 768), `tmp/bookshelf-layout-qa/bookshelf-stack-1280.png` (1280 × 800), and `tmp/bookshelf-layout-qa/bookshelf-stack-1366.png` (1366 × 768). All three were created at `2026-08-22 00:35:37`, after the current `StudentLibraryPage.tsx` and `studentLife.ts` modifications at `00:34:56`.
- **Source and diff inspected:** `DESIGN.md`, `src/lib/studentLife.ts`, `src/lib/studentLife.test.ts`, `src/components/student/StudentLibraryPage.tsx`, `src/index.css`, and the current worktree diff.

## Recommendation

**REQUEST_CHANGES**

The implementation is a real, reusable component tree and the supplied desktop captures preserve the intended stacked-book silhouette. However, the actual spine-height calculation still maps distinct page counts to identical heights, violating the stated per-page proportional-difference criterion. The active bookshelf palette also remains raw, per-selector values rather than the documented feature-token system.

## Findings

### CRITICAL

None. The bookshelf is not a screenshot, canvas, raster replacement, or `background-image` substitute.

### HIGH

1. **Distinct page counts are still flattened into identical spine heights.** `getBookSpineHeightPx` calculates from `getBookHeightCm`, but that helper rounds the physical height to two decimal places before the `32px/cm` term is applied ([src/lib/studentLife.ts:159](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:159)-[165](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:165)). The direct current-code evaluation produced `1 → 20.32px`, `2 → 20.32px`, and `3 → 20.32px`; therefore the requested “every page difference visible” behavior is not true. The existing test only compares 100-page intervals ([src/lib/studentLife.test.ts:22](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.test.ts:22)-[27](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.test.ts:27)) and does not catch this counterexample. This contradicts the documented `20px + 32px/cm` proportional visual-scale contract ([DESIGN.md:154](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:154)).

2. **The active bookshelf spine surface is not token-driven.** Its rendered colors and elevation are hard-coded as page-local values: raw paper-gradient colors on [src/index.css:12475](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12475), six direct text/background color pairs plus a raw shadow on [src/index.css:12506](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12506)-[12511](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12511), and raw shelf colors on [src/index.css:12521](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12521). `DESIGN.md` records bookstore tokens ([DESIGN.md:146](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:146)-[154](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:154)), but those tokens do not govern the stack’s palette or shelf. This fails the requested rigorous token-driven styling criterion.

### MEDIUM

None.

### LOW

None.

## Verified strengths (do not regress)

- **Live DOM and reusable layout logic:** Every book is rendered as a mapped `article` with text children, ARIA text, CSS height, width, and transform ([src/components/student/StudentLibraryPage.tsx:59](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:59)-[76](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:76)); no target screenshot or bookshelf bitmap is used. The deterministic width/offset table is centralized in [src/lib/studentLife.ts:46](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:46)-[59](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:59)) and exercised by tests.
- **Layer hierarchy matches the reference’s essential structure:** a centered height label, descending live book-spine stack, and separate shelf base render as three DOM layers ([src/components/student/StudentLibraryPage.tsx:51](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:51)-[80](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:80)).
- **Visual and responsive evidence:** I directly inspected all three fresh captures. They retain varied widths, gentle alternating offsets, a fully visible stack/shelf, unclipped Korean labels, and no desktop-width overflow at 1024, 1280, or 1366px. The 20px base makes the specific 24–320 page evidence books legible; it just does not satisfy the universal per-page criterion above.
- **Verification:** `npm test` passed (133/133) and `npm run lint` (`tsc --noEmit`) passed. The test output includes one expected exercised error-path log for malformed weekly-mission evidence, but no test failure.

## Blockers before approval

1. Make the rendered spine-height path strictly page-proportional before display rounding so adjacent valid page counts do not share a height; add a regression assertion that demonstrates this property.
2. Move the active stack’s paper, spine variants, shelf colors, and stack elevation into the documented design-token system; the live selectors must consume those tokens rather than raw one-off values.

## Evidence inspected

1. Reference image: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png`.
2. Fresh captures: `tmp/bookshelf-layout-qa/bookshelf-stack-1024.png`, `tmp/bookshelf-layout-qa/bookshelf-stack-1280.png`, `tmp/bookshelf-layout-qa/bookshelf-stack-1366.png`.
3. Current source/diff: `DESIGN.md`, `src/lib/studentLife.ts`, `src/lib/studentLife.test.ts`, `src/components/student/StudentLibraryPage.tsx`, and `src/index.css`.
4. Direct logic probe: `node --import tsx --input-type=module -e "import { getBookHeightCm, getBookSpineHeightPx } from './src/lib/studentLife.ts'; …"`, which returned the 1/2/3-page height collision described above.
5. Verification commands: `npm test` and `npm run lint`.
