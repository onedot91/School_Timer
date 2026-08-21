# Bookshelf stack clone/design-system fidelity review

## Recommendation

`REQUEST_CHANGES`

The rendered bookshelf is genuine React/CSS, the deterministic width/offset rule matches the requested reference-inspired silhouette, and the current thickness calculation is page-count proportional. Approval is blocked only by the stack's visual palette still being implemented with literal colors rather than documented design tokens.

## Scope and success criteria inspected

- Goal: create a reference-inspired bookshelf with varied widths and left/right offsets while retaining page-count-proportional spine thickness.
- Reference: `/private/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png`.
- Current source: `DESIGN.md`, `src/lib/studentLife.ts`, `src/lib/studentLife.test.ts`, `src/components/student/StudentLibraryPage.tsx`, and `src/index.css`.

## Findings

### CRITICAL

None. The bookshelf is not a pasted screenshot or raster substitute. `StudentLibraryPage` maps live book data to DOM `<article>` elements containing title, author, and page-count text ([StudentLibraryPage.tsx:59](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:59)); neither that component nor its bookshelf selectors use an image/background-image as the books.

### HIGH

1. The actual book stack's colors are not token-driven. The documented bookstore tokens cover paper/wood/ink ([DESIGN.md:146](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:146)), but the visible shelf gradient, each of the six book color variants, and shelf base use literal hex/RGBA values ([index.css:12475](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12475), [index.css:12506](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12506), [index.css:12521](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12521)). This fails the required token-driven styling criterion and prevents this from qualifying as a rigorous design-system implementation.

### MEDIUM

None.

### LOW

None.

## Verified strengths

- Live component structure: each spine is a data-driven DOM article, styled by the shared stack selector; the existing `StudentHeader` and `StudentConfirmDialog` primitives are reused.
- Deterministic layout: the 12-entry `BookStackLayout` cycle produces 70–92% widths and -8–8% offsets ([studentLife.ts:46](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:46), [studentLife.ts:167](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:167)); it is applied directly to every spine ([StudentLibraryPage.tsx:62](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:62)). This reproduces the reference's irregular horizontal silhouette without random or fixed-position markup.
- Thickness: the current implementation follows the documented `20px + 32px/cm` visual-scale contract ([DESIGN.md:154](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:154), [studentLife.ts:163](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts:163)). The rendered height is that value directly, with no CSS minimum-height flattening ([StudentLibraryPage.tsx:66](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx:66), [index.css:12506](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12506)).
- Responsive visual evidence: the 1024, 1280, and 1366 CSS-pixel screenshots show a readable stack and the intended width/offset rhythm without clipping or horizontal overflow.
- Independent read-only visual check also passed the DOM, proportionality, and three-width visual review. Its pass does not resolve the token finding above.

## Evidence inspected

- Reference image: `/private/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-b6a42e7d-fac0-4d98-b916-b8c8d81a2bd3.png`
- Render captures:
  - `tmp/bookshelf-layout-qa/bookshelf-stack-1024.png`
  - `tmp/bookshelf-layout-qa/bookshelf-stack-1280.png`
  - `tmp/bookshelf-layout-qa/bookshelf-stack-1366.png`
- Full current diff for the scoped files; `git diff --check`.
- `npm test` — 133/133 passed on the final inspected state.
- `npm run lint` — passed on the final inspected state.

## Blockers

- Replace the literal bookshelf palette/shelf surface values with documented, reusable design tokens before approval. The visible spine palette must be part of the design-system contract, not anonymous hex values embedded in component CSS.
