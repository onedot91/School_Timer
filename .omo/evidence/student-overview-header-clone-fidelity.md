# Student overview top-header clone-fidelity review

- Date: 2026-08-13 (Asia/Seoul)
- Scope: read-only review of the student overview balance-header relocation at `http://localhost:3000/#student-overview`.
- Required viewport: `1280×800` CSS px.
- Interaction safety: no student control was clicked; no balance, bid, award, emotion, pet, or navigation data was mutated. The temporary browser viewport was reset and the review tab was closed after capture.
- Recommendation: **REQUEST_CHANGES**

## Goal and success criteria reviewed

Move the balance summary containing student number, available 고마, and reserved 고마 into a full-width top header on the student overview. At `1280×800`, confirm that it occupies the top content width, emotion and pet remain in the right content column, and scene/bottom cards do not overlap or overflow. Korean copy must not be clipped.

## Reference and evidence inspected

1. User/reference capture: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-e0559489-4942-4686-91f5-672fde9c6ac7.png` (`2940×1846` PNG). The requested placement change supersedes its prior right-column balance placement.
2. Fresh live render: `http://localhost:3000/#student-overview` at an explicit `1280×800` viewport, visually inspected in this review. The page had a `1280×800` document box with `scrollWidth=1280` and `scrollHeight=800`.
3. Read-only live geometry from that render:
   - balance header: `(12, 12)`, `1256×64`; it spans the full page content width inside the documented 12px shell inset;
   - scene/status region: `(12, 88)`, `1256×576`, with the scene at `829.33×466.49` and the right status column at `414.66×576`;
   - bottom destinations: `(12, 676)`, `1256×112`;
   - 12px gaps separate header→content and content→destinations; all tested pairwise intersections were `false`;
   - no visible leaf text had `scrollWidth > clientWidth` or `scrollHeight > clientHeight`; no visible text box crossed the viewport boundary.
4. Live DOM inspection: the top balance is one `<section>` containing live `<strong>`, `<div>`, `<span>`, and inline SVG elements. The overview contains exactly one top balance summary, one right-column emotion summary, one right-column pet card, and two bottom destinations.
5. Code and diff evidence: `git status --short`; scoped `git diff` for `DESIGN.md`, `src/components/student/StudentOverviewPage.tsx`, `src/components/student/StudentHeader.tsx`, and `src/index.css`; full changed-file list/stat; `git diff --check`; `src/components/student/StudentBalanceSummary.tsx`; `src/index.css`; and `DESIGN.md`.
6. Existing/untrusted evidence inspected but not relied upon: `.omo/evidence/student-overview-1280x800-clone-fidelity.md` and `.omo/ulw-loop/notepad.md`. The former describes the older right-column balance arrangement, so it is stale for this relocation.

## What passes

- **Real component tree:** `StudentOverviewPage` renders the existing `StudentBalanceSummary` primitive before the hero and renders emotion/pet in `.student-overview-status` afterwards (`src/components/student/StudentOverviewPage.tsx:101-144`). The inspected top header is live DOM, not a pasted screenshot or a page-sized background image. The scene's artwork is a bounded stage asset only, not a replacement for the UI.
- **Layer/layout fidelity at the requested viewport:** the balance header is first, full content-width, and visually above the hero; emotion and pet stay in the right content column. The scene, status column, and bottom cards are all visible without document scrolling and do not collide.
- **Korean text:** no clipping or overflow was observed in `1번`, `사용 가능 고마`, `예약 고마`, `오늘의 감정`, `아직 선택하지 않았어요`, or the two destination cards.

## Findings

### CRITICAL

None.

### HIGH

1. **The new overview-header composition is not fully token-driven.** The implementation adds student Chromebook tokens in `DESIGN.md`, but the new header/overview rules bypass them with unregistered one-off layout and spacing values: `4rem`, `7rem`, `.4rem`, `21rem`, `.4fr`, `.75rem`, `1rem`, `.7rem`, `.85rem`, and `1.45rem` in [src/index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16559). The most direct header cases are `grid-template-rows: 4rem … 7rem` and `min-height: 4rem; padding-block: .4rem` at lines 16560-16566, while the documented tokens cover shell gap/radius/control height but not semantic overview balance/destination slot sizes. This violates the required token-driven design-system criterion and makes future viewport changes fragile.

   Required fix before approval: declare semantic overview tokens for the balance-header height/padding, hero/destination slot sizing, and any new compact-card spacing/type values in `DESIGN.md` and the CSS token layer; replace the direct values in the new overview rules with those tokens.

### MEDIUM

None.

### LOW

1. The older `student-overview-1280x800-clone-fidelity.md` reports a balance row inside the right status column. It includes an artifact path, but its geometry conflicts with the current top-header implementation. It must not be used as evidence for this relocation.

## Blockers

- Replace the new one-off overview layout/spacing/type values in `src/index.css:16559-16616` with documented semantic design tokens. Until that is done, the result is visually correct at one viewport but does not meet the requested rigorous design-system fidelity standard.

## Verification limits

This review establishes the requested static 1280×800 state only. It intentionally does not exercise any live button or write path, and it does not certify data-changing interactions.
