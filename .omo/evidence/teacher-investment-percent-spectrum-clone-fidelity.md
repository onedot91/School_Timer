# Teacher investment percent spectrum — clone fidelity review

- **Review type:** Visual fidelity and CJK precision (read-only)
- **Goal:** Rework the teacher investment settings around percentages, make the `-50%` to `+50%` spectrum intuitive and legible, and keep percentages out of student UI.
- **Target state:** one teacher settings dialog at `1280×800`; expected dialog bounds `1152×720`.
- **Recommendation:** REQUEST_CHANGES

## Artifacts inspected

1. `/private/tmp/teacher-investment-percent-spectrum-1280x800.png` opened directly at original resolution.
2. `src/pages/TimerPage.tsx` (spectrum structure and percentage rendering, lines 8680–8766).
3. `src/index.css` (teacher spectrum styling, lines 15168–15266; tokens, lines 11600–11618).
4. `src/components/student/StudentSecuritiesPage.tsx` (lines 39–67) and `src/components/student/StudentStockMarketPage.tsx` (lines 71–113), to verify students do not receive percentage text.
5. `src/lib/studentEconomy.ts` (lines 110–133), to verify the percentage-to-multiplier boundary.
6. Current worktree diff and `DESIGN.md` student-investment contract (line 176).

## Evidence observations

- The capture is `1280×800`; the visible dialog measures approximately `1152×720` from its `x=64…1216`, `y=40…760` bounds.
- The visible toolbar, tab row, title/date row, operation-rules card, all five spectrum cards, the full `-50% / 0% / +50%` axis, and the weekend notice are rendered without apparent horizontal clipping. Korean labels remain on one line in this state.
- The visible values are `+20%`, `+10%`, `0%`, `-10%`, and `-20%`; their slider thumbs agree with the individual `-50…+50` controls.
- The positive/negative colours are reinforced by sign and triangle labels; this is useful redundant encoding, not a defect. The implementation is live DOM (`section`, `label`, `output`, and `input[type=range]`), not a screenshot/background-image substitute.
- Student screens render stage symbols/labels and Goma amounts, but not percentage values. The conversion boundary is teacher-only.

## Findings

### CRITICAL

None found. The teacher settings surface is rendered by live React/HTML controls, not by a raster substitute.

### HIGH

1. **[product] The spectrum contradicts its own direction.** The card row is ordered `big_rise → rise → flat → fall → big_fall` (`TimerPage.tsx:8704`), so the visible left-to-right values are `+20%, +10%, 0%, -10%, -20%`. The enclosing spectrum background and axis state the opposite direction: blue/negative at left and red/positive at right (`index.css:15247`, `TimerPage.tsx:8744`). In the capture this makes the first card red `+20%` while it sits on the negative end, and the last blue `-20%` while it sits on the positive end. This directly defeats an intuitive `-50%…+50%` spectrum.

2. **[evidence] The required PNG capture is not a PNG.** `/private/tmp/teacher-investment-percent-spectrum-1280x800.png` has a JPEG/JFIF signature (`file` and `sips` both report `JPEG`, 1280×800). Consequently the capture does not meet the declared `.png` artifact contract and cannot provide the required alpha/integrity validation. It is fresh relative to the two source files, but it must be regenerated as an actual PNG before approval.

3. **[product] Stage semantics can become visually self-contradictory during normal range use.** Each stage slider accepts the whole `-50…+50` range and the update path stores it without a stage-polarity or ordering constraint (`TimerPage.tsx:8694–8699`, `8731–8738`). A teacher can therefore set `▲ 올랐어요` to `-20%` or `▼ 내렸어요` to `+20%`; colour follows the percentage but the Korean stage label and triangle do not. This is particularly misleading in an operational setting and undermines the stated “intuitive” spectrum requirement.

### MEDIUM

1. **[design-system] The new teacher surface is only partly token-driven.** New colour and radius references use shared tokens, but the feature introduces many repeated raw spacing, type, height, and width values (`index.css:15237–15263`: `.7rem`, `.9rem`, `.65rem`, `2.7rem`, `.75rem`, `1.15rem`, `3.5rem`, etc.) beyond the five newly declared tokens (`index.css:11614–11618`). The sections are also one-off `teacher-*` styles rather than reuse of documented control/card primitives. This is not yet a rigorous reusable design-system implementation.

2. **[coverage] This one capture cannot verify the below-fold configuration state.** The right-side scrollbar shows that the four stock editors and student investment-status list in `TimerPage.tsx:8747–8765` are below the captured scroll position. They are in scope for the settings page but have no visual evidence here. The visible state itself has no Korean wrapping or clipping defect; the missing state must be captured separately rather than assumed correct.

### LOW

None found in the visible frame. The compact teacher-only labels are small but remain readable and unwrapped at this viewport; visual hierarchy is clear: page title → operating rules → rate spectrum.

## Required blockers before approval

1. Make the rate-card order, background gradient, and `-50% / 0% / +50%` axis agree in the same left-to-right direction.
2. Prevent invalid polarity/order combinations, or revise the labels so every reachable slider value remains truthful.
3. Replace the mislabeled JPEG with a freshly captured, correctly encoded PNG at `1280×800`, and provide the below-fold capture/state for the complete settings page.
4. Consolidate the new teacher investment measurements into declared tokens/reused primitives before claiming design-system fidelity.
