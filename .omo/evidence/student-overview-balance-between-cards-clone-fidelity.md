# Student overview balance-between-cards clone fidelity review

## Recommendation: APPROVE

## Scope and success criteria

Reviewed the corrected intent: the action row must read, left to right, **고마 벌기 | 학생 잔액 | 고마 쓰기**; the balance must remain outside the illustrated home canvas. This review is read-only and does not exercise or mutate student data.

## Evidence inspected

- Fresh rendered artifact: `.omo/evidence/student-overview-balance-between-cards.jpg` (JPEG, 1280 × 720, modified 2026-08-13T19:25:42+0900).
- Layout tree: `src/components/student/StudentOverviewPage.tsx:102-147`.
- Reused live primitives: `src/components/student/StudentSectionCard.tsx:11-30`, `src/components/student/StudentPurchaseCard.tsx:8-19`, and `src/components/student/StudentBalanceSummary.tsx:19-43`.
- Responsive layout rules: `src/index.css:16598-16674`.
- Token contract: `DESIGN.md:75-101`.

## Findings

### CRITICAL

None. The row is live React DOM assembled from reusable components; no screenshot, raster overlay, or `background-image` substitutes for its cards or balance content.

### HIGH

None. `StudentOverviewPage` renders the required three children in the required order, and the desktop/Chromebook rule uses a three-column grid with the tokenized center width (`src/components/student/StudentOverviewPage.tsx:127-146`; `src/index.css:16647-16651`).

### MEDIUM

None. The fresh capture shows all three cards sharing the same top and bottom edges. The balance card is visually centered between the action cards and separated from the canvas by the row gap; it neither overlaps nor obscures the illustration.

### LOW

None within the supplied 1280 × 720 evidence. The labels, numerals, and action copy are fully visible: no CJK clipping, orphaned syllables, glyph substitution, baseline clipping, or button-label collision is visible. The canvas remains visually clean, with the balance moved entirely to the dedicated bottom row.

## Positive verification

- The hierarchy is clear: large illustrated home canvas first; compact, equal-height action row second; center balance is informational rather than competing with either primary action.
- The center panel uses the same card radius/elevation system and a tokenized width/height (`--student-overview-balance-width`, `--student-overview-action-height`, `--student-card-radius`) rather than a pasted visual.
- `StudentPurchaseCard` reuses `StudentSectionCard`, so the two action cards remain a shared primitive rather than duplicated markup.

## Blockers

None.

## Limitation

This verdict covers the provided fresh 1280 × 720 render and the current source. It does not assert separate visual inspection at 1024, 1280 × 800, or 1366 CSS pixels because fresh captures for those exact viewports were not supplied for this narrowly scoped review.
