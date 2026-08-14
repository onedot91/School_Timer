# Teacher Investment Settings Clone-Fidelity Review

## Scope inspected

- Goal: final visual-fidelity review of the revised teacher investment settings UI.
- Criteria: CJK readability; card, axis, and gradient direction; visual hierarchy; 1280×800 fit; lower-fold stock/status presentation; stage-sign semantics.
- Evidence inspected directly: `/private/tmp/teacher-investment-spectrum-top.png` (1280×800), `/private/tmp/teacher-investment-spectrum-bottom.png` (1280×800), `src/pages/TimerPage.tsx`, and `src/index.css`.
- Reference/target design: the supplied 1280×800 renders. No separate target reference was supplied.
- Notepad: none supplied.

## Recommendation

REQUEST_CHANGES

## Findings

### CRITICAL

None.

### HIGH

1. The lower-fold requirement is not verifiable or robust at the supplied target viewport. The bottom image ends as the `학생별 투자 현황` heading begins, without a single status row. In code, each status row places five no-wrap fields into a three-column grid, with no responsive rule or overflow containment for this component. At wider real values (for example `+999999 고마`), fields can visually collide or escape their cell. This prevents approval of the requested lower-fold stock/status presentation.
   - `src/index.css:15263-15265`
   - Evidence: `/private/tmp/teacher-investment-spectrum-bottom.png`

### MEDIUM

1. The overall `-50%` to `+50%` axis is visually correct, but every stage slider exposes the entire `-50` through `+50` range while the stage-specific range is silently clamped in its change handler. That makes the displayed control affordance broader than the stage semantics, even though the persisted output is corrected.
   - `src/pages/TimerPage.tsx:8694-8707`, `src/pages/TimerPage.tsx:8740-8748`

### LOW

1. The spectrum’s 0.75rem CJK stage labels and 0.7rem axis labels are legible in the supplied 1280×800 capture but are visually secondary to the large percentages; this is acceptable for teacher metadata, though it leaves little headroom for lower-resolution displays.
   - `src/index.css:15251`, `src/index.css:15259`

## Confirmed

- The gradient runs from loss-blue at left through neutral to gain-red at right, and the five cards follow the same semantic order: `▼▼`, `▼`, `─`, `▲`, `▲▲`.
  - `src/pages/TimerPage.tsx:8712-8713`, `src/index.css:15247`
- The axis labels agree with that direction, and the stage labels/signs are generated from the shared presentation mapping rather than independently hand-written.
  - `src/pages/TimerPage.tsx:8732-8754`; `src/lib/studentEconomy.ts:117-125`
- The top viewport’s hierarchy is clear: title/date, operating rules, then the return spectrum. The live DOM source uses sections, labels, inputs, selects, outputs, and range controls; there is no image-based UI substitution in the inspected scope.

## Blockers

- Provide a 1280×800 lower-fold render showing the complete `학생별 투자 현황` rows, or revise the status layout so five fields cannot overflow/collide at real maximum values. Until then the required lower-fold presentation is not proven.
