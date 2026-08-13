# Student overview egg hotspot clone-fidelity re-review

- Date: 2026-08-13 (Asia/Seoul)
- Mode: read-only review; this report is the required evidence artifact.
- Goal: Remove the right pet-egg section and use the canvas nest egg to open the existing feed modal.
- Recommendation: **APPROVE**
- Blockers: none.

## Scope and acceptance checks

Reviewed the live app at `http://localhost:3000/#student-overview` with a temporary `1280×800` viewport, current working-tree diff, `DESIGN.md`, `src/components/student/StudentOverviewPage.tsx`, `src/components/student/StudentPetStage.tsx`, and `src/index.css`.

The initial live state contained no `.student-pet-card`. The nest-egg control is a live native `BUTTON` with the accessible name `알 성장 0 / 100 고마. 알 성장 창 열기`; it rendered at `x=58.5, y=208.77, 140.64×83.60px`, covering the illustrated tree-nest egg. Its computed geometry resolves from the documented CSS custom properties (`14%`, `5.5%`, `17%`, `18%`). The closed and open page both measured `1280×800` with no document overflow.

Only this control was clicked. It opened one live `role=dialog` with `aria-modal=true`, heading `알 성장`, and the existing `5 고마 먹이기` control. No feed control was clicked. Escape closed the dialog, returned focus to the egg control, and left the displayed available balance unchanged at `145 고마`.

## Findings

### CRITICAL

None. The interactive surface is live DOM, not a pasted screenshot: `StudentPetStage` renders a native button and `StudentOverviewPage` reuses the existing modal state.

### HIGH

None. The hotspot geometry uses documented design tokens rather than four one-off literal declarations: `DESIGN.md:77-78`; `src/index.css:12035-12038,12056-12061`.

### MEDIUM

None. The right standalone pet section is absent from the current live DOM, and the canvas hotspot's layer and visible target align with the nest egg in the scene.

### LOW

None.

## Evidence inspected

- Current working-tree diff and `git diff --check`.
- `DESIGN.md:77-78`.
- `src/components/student/StudentOverviewPage.tsx:100-148`.
- `src/components/student/StudentPetStage.tsx:125-132`.
- `src/index.css:12034-12067`.
- Fresh live browser inspection at `http://localhost:3000/#student-overview`, `1280×800`, including closed state, egg-open modal state, and Escape-close state.
- Prior reports were read only as untrusted context; the verdict above is based on the current source and fresh runtime observation.

## Non-mutating interaction record

1. Loaded `#student-overview` (student 1 was already selected; no selection was changed).
2. Clicked only the canvas egg hotspot.
3. Verified modal semantics and visible feed control without activating it.
4. Sent Escape, verified the dialog closed and focus returned to the hotspot.

