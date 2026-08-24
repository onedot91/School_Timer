# Modal visual gate B — clone / accessibility fidelity review

**Verdict:** PASS  
**Scope:** Student pet feed parent modal, nested confirmation modal, and focus return only.  
**Reviewer mode:** Read-only; no product source, stock asset, or test-state mutation performed.

## Evidence inspected

- Fresh captures, opened directly:
  - `/private/tmp/modal-qa-parent.png` (1076×605)
  - `/private/tmp/modal-qa-confirm.png` (1076×605)
  - `/private/tmp/modal-qa-returned.png` (1076×605)
- Source:
  - `src/components/student/StudentOverviewPage.tsx:99-106,240-290,366-388`
  - `src/components/student/StudentConfirmDialog.tsx:32-71`
  - `src/lib/useModalFocus.ts:33-150`
  - `src/index.css:12241-12262,18132-18142,19280-19294,19405-19430,21619-21675`
- Supplied runtime evidence (treated as corroboration, then traced to source): exactly one `aria-modal`; inactive parent has `aria-hidden="true"`; duplicate IDs `[]`; child close initially receives focus; Escape returns focus to `5 고마 먹이기`; closing parent returns to the overview trigger; confirmation was not activated and balances stayed unchanged.
- Supplied parent→returned pixel comparison: same dimensions; 650,980 pixels; 25,915 differing pixels; `diffRatio 0.0398`; similarity 96; alpha intact. Stated hotspots are the close/button/background regions.

## Evidence trace

| State / region | Inspection result |
| --- | --- |
| Parent modal | The egg, heading, progress, and `5 고마 먹이기` action are live controls/content, centered and unclipped. Korean copy is natural and stays on complete lines. |
| Nested confirmation | The parent remains visible but is visually subdued; the confirmation has a clear kicker, question, explanatory sentence, two equal actions, and a close control. No CJK orphan, clipping, tofu, or metric collision is visible. |
| Nested modal semantics | `StudentOverviewPage.tsx:246-247` removes the parent modal marker and applies `aria-hidden` while the child is open. `StudentConfirmDialog.tsx:53-57` is the one active `aria-modal` dialog and uses instance-local title/description IDs. |
| Focus isolation / return | `useModalFocus.ts:39-57` inert-isolates branches outside the active dialog; `StudentOverviewPage.tsx:373-374` provides the feed button as the child return target; `useModalFocus.ts:136-149` suppresses return while another modal is topmost and otherwise restores the requested target. The returned capture visibly shows the global 3px blue focus ring (`src/index.css:12380-12383`) on `5 고마 먹이기`. |
| Diff hotspots | The changed close/action/background pixels match the visible focus-ring change and the supplied animated egg-frame explanation. No product-level layout drift is visible in the captures. Alpha-intact evidence agrees with the rendered modal materials. |

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- [evidence] The three captures are 1076×605, not the project-required authoritative 1280×800 at 100% scale. This limits only primary-layout certification; it is not a modal product defect for this scoped review.

## What must not regress

- Keep the parent `aria-hidden` and without `aria-modal` while the confirmation is active.
- Keep only the child confirmation as the active modal and preserve unique `useId`-derived labels.
- Keep child dismissal returning visible keyboard focus to the feed action, while parent dismissal returns to its overview opener.
- Keep the confirmation copy, action labels, and two-button arrangement as captured; no visual redesign is warranted.

## Blocking list

None.
