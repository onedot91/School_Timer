# Bookshelf natural-stack clone / design-system fidelity review

## Recommendation

**REQUEST_CHANGES**

The correction is a real React/CSS implementation, uses the documented bookshelf palette tokens, and visibly fixes the supplied 15/30/37/45-page fixture at 1024, 1280, and 1366 CSS pixels. It cannot be approved as a rigorous, reference-faithful design system because its raw height formula produces very large spines for ordinary supported books and makes the bookshelf internally scroll rather than retain the reference's compact stack composition.

## Scope and evidence inspected

- Target reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-16ba5156-3f8f-43ce-a368-8ce1332f7f16.png`.
- Previous rejected capture: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-eb0761b0-59eb-46fa-b68b-75def4f8acb3.png`.
- Fresh actual captures: `tmp/bookshelf-layout-fix-qa/bookshelf-fix-1024.png`, `bookshelf-fix-1280.png`, and `bookshelf-fix-1366.png`.
- Current full scoped diff and source: `DESIGN.md`, `src/lib/studentLife.ts`, `src/lib/studentLife.test.ts`, `src/components/student/StudentLibraryPage.tsx`, and `src/index.css`.
- Regression commands run in the inspected worktree: `git diff --check`, `npm test -- --test-concurrency=1` (133/133), and `npm run lint` (passed).

## Findings

### CRITICAL

None. The bookshelf is not a pasted screenshot, canvas, or raster/background-image substitute. `StudentLibraryPage` maps saved books to live `<article>` elements and applies data-driven dimensions directly ([StudentLibraryPage.tsx:59](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:59)).

### HIGH

1. **The stated raw formula breaks the compact reference composition for supported data.** `getBookSpineHeightPx` returns `18 + pageCount * 0.6` with no ceiling or visual compression ([studentLife.ts:163](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:163)). A normal 200-page book becomes 138px; the accepted 5,000-page maximum becomes 3,018px. The renderer applies that raw number as the DOM element height ([StudentLibraryPage.tsx:65](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:65)) inside a `35rem` scrollable shelf ([index.css:12487](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12487)). Thus a real saved set shifts from the reference-like, fully visible stack to a giant internally scrolling spine/stack. The supplied captures exercise only 15/30/37/45 pages, so they do not cover this actual supported-state failure.

### MEDIUM

1. **The claimed `9.38px` runtime center range is not reproducibly evidenced.** The captures demonstrate visual containment but do not provide DOM/computed-style measurements or a generation log that establishes `9.38px` or the claimed `59.25px` baseline. The source does establish the `81–92%` / `-1–1%` layout rhythm ([studentLife.ts:46](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:46)), but the numerical before/after statement must remain unverified until a reproducible runtime artifact exists.

2. **The documented scope says the bookshelf's existing form and data are unchanged, but the scoped diff changes both.** `DESIGN.md` says the bookshelf view reuses the existing form and data unchanged ([DESIGN.md:183](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:183)); the implementation introduces a required author input and expands `StudentBook`/the callback contract ([StudentLibraryPage.tsx:21](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:21), [StudentLibraryPage.tsx:46](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:46), [studentLife.ts:13](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:13)). This is not needed for the thickness/placement correction and leaves the design contract inaccurate.

### LOW

1. The user-visible formula is documented in `DESIGN.md`, centralized in a reused TypeScript helper, and unit-tested, so it is not a one-off rendering hack. Its numeric values are nevertheless duplicated as raw literals in the helper rather than represented by an executable design token; consolidate the visual-scale source of truth when addressing the high-severity range behavior.

## Verified strengths

- Live/reused structure: shared `StudentHeader` and `StudentConfirmDialog` remain composed around semantic form, stack, and shelf-base layers ([StudentLibraryPage.tsx:34](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:34), [StudentLibraryPage.tsx:84](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:84)).
- Tokens: the visible shelf paper, wood, and six spine colors use documented `--bookstore-*` / `--book-spine-*` custom properties ([DESIGN.md:146](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:146), [index.css:12518](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12518)).
- The precise requested fixture is real and covered: 15/30/37/45 pages compute to 27/36/40.2/45px, and the deterministic layouts stay within 81–92% width and -1–1% offset ([studentLife.test.ts:19](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.test.ts:19), [studentLife.test.ts:38](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.test.ts:38)).
- In all three fresh desktop captures, that four-book fixture has no observed clipping, horizontal overflow, or CJK text collision, and its central axis is materially calmer than the rejected capture.

## Blockers

1. Define and verify a bounded or perceptually compressed page-to-spine mapping that preserves the intended compact reference stack across the documented `1..5000` page input range, while retaining visibly distinct 15/30/37/45-page cases.
2. Supply reproducible runtime measurement evidence before treating `9.38px vs 59.25px` as verified.

