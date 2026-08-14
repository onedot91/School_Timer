# Teacher investment status-grid fix — clone-fidelity re-review

## Scope and inputs

- **Goal:** Issue PASS or REVISE for the complete teacher securities settings UI at `1280×800` after the status-grid fix.
- **Success criteria checked:** status columns at about `525px`/`525px`; no list or first-row horizontal overflow; `-50%` → `+50%` order and signs; CJK readability; visual hierarchy; lower-fold stock cards and visible student rows; collision risk with realistic values.
- **Source and full diff inspected:** `src/pages/TimerPage.tsx`, `src/index.css`, and the complete current working-tree diff (`git diff`, HEAD `44142e928685650095d21fb0f4f1318ec28a6e6b`).
- **Reference/target evidence inspected:** `/private/tmp/teacher-investment-spectrum-top.png`, `/private/tmp/teacher-investment-spectrum-bottom.png`, and `/private/tmp/teacher-investment-status-final.png` (each a real `1280×800` PNG).
- **Fresh runtime evidence:** current worktree rendered in the in-app browser at `1280×800` on `http://127.0.0.1:3004/`; top spectrum and lower-fold status views were directly inspected. The local Vite process was started only for this read-only visual review.
- **Notepad:** none was supplied.

## Recommendation

**REQUEST_CHANGES**

The status-grid fix itself works at the supplied zero-value state, but the complete result does not meet the required rigorous design-system or realistic-value robustness bars.

## Confirmed evidence

- The rendered spectrum is consistently ordered `▼▼ -20%`, `▼ -10%`, `─ 0%`, `▲ +10%`, `▲▲ +20%`; it agrees with the blue-loss → neutral → red-gain gradient and the `-50% / 0% / +50%` axis. `src/pages/TimerPage.tsx:8712-8713, 8731-8754`; `src/index.css:15247-15259`.
- CJK labels are readable and unbroken in the direct top and lower-fold renders. Hierarchy remains title/date → operating rules → return spectrum → four stock cards → student status.
- The status container renders two computed columns of `525.398px` and `525.406px`; the first row has `scrollWidth == clientWidth == 525`, and the document and panel have no horizontal overflow at the supplied state. The lower-fold screenshot visibly shows stock cards and student rows.
- The surface is live React/DOM (`section`, `label`, `input`, `select`, `textarea`, `button`, and mapped `article` rows), not a raster or CSS background-image substitute. `src/pages/TimerPage.tsx:8715-8776`.

## Findings

### CRITICAL

None found. The UI is not faked with a screenshot or raster substitute.

### HIGH

1. **Status rows are not collision-safe for values the application permits.** The fixed first-row data only proves the zero state. Each of the three monetary columns is about `121.5px` wide at `1280px`, but rows force unbroken text with `white-space: nowrap` and supply no truncation, wrapping, or compact-number rule. `src/index.css:15263-15265`.

   This is reachable without corrupt data: settings permit `999,999` per stock (`src/lib/studentEconomy.ts:231-242`), four positions can be held, and weekday settlement compounds `currentAmount` by a configured multiplier with no display cap (`src/lib/studentEconomy.ts:449-465, 602-621`). With four maximum positions and `+50%` for 20 weekdays, the row can render `투자 3999996`, `+13297013624 고마`, and `현재 13301013620`. That is materially wider than the current monetary cells, so the no-overflow criterion is not robust for realistic configured classroom use.

2. **The new teacher investment surface is not rigorously token-driven or componentized.** It relies on many one-off raw gap, padding, height, radius, and font literals (`.7rem`, `.9rem`, `.65rem`, `2.7rem`, `.75rem`, `1.15rem`, `3.5rem`, etc.) in `src/index.css:15237-15265`, rather than declared spacing/type/control tokens. The entire feature tree is also embedded as one page-local JSX composition in `src/pages/TimerPage.tsx:8715-8776`; no reused teacher-settings/card/field/status-row primitives implement these repeated patterns. Colors and a few radii use tokens, but that partial use does not satisfy the requested design-system fidelity.

### MEDIUM

1. **Stage slider affordance still disagrees with its actual allowed domain.** Every non-flat slider visibly advertises `-50…+50`, while `updateInvestmentReturnPercent` silently clamps each named stage into narrower semantic bounds. `src/pages/TimerPage.tsx:8694-8707, 8740-8748`. The current signs/order are correct, but moving `▲ 올랐어요` into a negative portion gives misleading control feedback before it snaps back.

### LOW

1. The compact teacher-only CJK metadata (`0.75rem` stage names and `0.7rem` axis labels) is readable at the verified `1280×800` target, though it has little reserve for lower-density displays. `src/index.css:15251, 15259`.

## Blocking issues before approval

1. Make monetary status values collision-safe for the permitted range: define a compact-number/overflow strategy or a row structure that accommodates compounded totals, then demonstrate it at `1280×800` with representative non-zero high values.
2. Move teacher investment spacing, typography, sizing, and repeated card/field/status-row anatomy to declared reusable design tokens and primitives.

## Verification record

- `npm run lint`: passed (`tsc --noEmit`).
- `git diff --check`: passed.
- No application data, investment, bid, or balance mutation was performed during review.
