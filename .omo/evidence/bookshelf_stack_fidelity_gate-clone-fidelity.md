# Bookshelf stack clone/design-system fidelity review

## Recommendation

**APPROVE**

The bookshelf is a live React/CSS implementation whose rendered book spines are data-driven DOM, not an image substitute. The final source now applies the documented bookstore and spine tokens, and its deterministic layout and unrounded page-count formula produce the requested reference-inspired stack at all supplied classroom widths.

## Scope and acceptance criteria inspected

- **Goal:** Verify the final reference-inspired bookshelf stack, including live DOM, token-driven styling, deterministic width/offset rhythm, raw page-proportional spine height, and responsive visual fidelity.
- **Concept reference:** `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png` (534 x 942 PNG). It is a conceptual stack reference rather than a same-viewport pixel target.
- **Capture set:** `tmp/bookshelf-layout-qa/bookshelf-stack-{1024,1280,1366}.png`. File signatures and dimensions are valid PNG/RGB at the named widths; all were created after the latest scoped source edits.
- **Source/diff:** `DESIGN.md`, `src/lib/studentLife.ts`, `src/lib/studentLife.test.ts`, `src/components/student/StudentLibraryPage.tsx`, and `src/index.css`, plus the current scoped diff.

## Findings

### CRITICAL

None.

The source maps each saved book to a live `<article>` containing title, author, and page count ([StudentLibraryPage.tsx:59](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:59)). The bookshelf component and its specific CSS contain no bitmap, canvas, `background-image`, data URI, or screenshot stand-in for book spines.

### HIGH

None.

The active shelf and six spine variants consume CSS custom properties ([index.css:12518](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12518)); these values are explicitly documented in the bookstore token contract ([DESIGN.md:142](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:142)). There are no remaining literal palette colors in the bookshelf-specific selector block.

### MEDIUM

None.

### LOW

None.

## Verified strengths

- **Reusable, live layer structure:** `StudentLibraryPage` composes the existing `StudentHeader` and `StudentConfirmDialog` primitives with a semantic form, a height marker, the mapped stack, and a separate shelf-base layer ([StudentLibraryPage.tsx:34](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:34), [StudentLibraryPage.tsx:40](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:40), [StudentLibraryPage.tsx:51](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:51)).
- **Token-driven materials:** The paper, wood, ink, and six spine foreground/background pairs are semantic `--bookstore-*` / `--book-spine-*` variables. The vertical paper surface, spine shadow, and shelf base consume those variables ([index.css:12487](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12487), [index.css:12518](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12518), [index.css:12533](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12533)).
- **Deterministic stack silhouette:** A centralized 12-entry layout cycle sets a bounded 70–92% width rhythm and -8%–7% offset rhythm ([studentLife.ts:46](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:46)); every spine receives the matching width and horizontal transform through the same mapping path ([StudentLibraryPage.tsx:60](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:60)). This gives the reference's irregular, hand-stacked silhouette without absolute-positioning or randomness.
- **Strict page proportionality:** Spine height uses the unrounded calculation `20 + pageCount * 0.005 * 32` ([studentLife.ts:163](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:163)), and the rendered inline height uses its raw result with no CSS `min-height` clamp ([StudentLibraryPage.tsx:65](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:65), [index.css:12518](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12518)). Direct evaluation confirmed distinct outputs for 1/2/3 pages (20.16/20.32/20.48px) and the visible 24/320-page span (23.84/71.2px).
- **Responsive fidelity:** Direct review of all three supplied captures shows the complete height marker, stack, and shelf base within the 1024x768, 1280x800, and 1366x768 frames. The spine-width/offset variation remains visible, Korean title/author/page text is not clipped, and no horizontal layout break is visible. The pastel spine palette and wood base reproduce the reference's essential layered book-stack grammar while remaining consistent with the project’s classroom system.

## Verification

- `git diff --check` — passed.
- `npm test` — passed, 133/133 tests. The output includes an expected malformed-weekly-mission error-path log; no test failed.
- `npm run lint` (`tsc --noEmit`) — passed.
- Focused logic probe — confirmed strictly increasing adjacent page heights and the documented layout ranges.

## Evidence inspected

1. Reference image: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png`.
2. Fresh captures:
   - `tmp/bookshelf-layout-qa/bookshelf-stack-1024.png`
   - `tmp/bookshelf-layout-qa/bookshelf-stack-1280.png`
   - `tmp/bookshelf-layout-qa/bookshelf-stack-1366.png`
3. Current scoped source and diff listed in the review scope.

## Blockers

None.
