# Student emotion sun position — clone fidelity review

- Review type: Visual fidelity and CJK precision (read-only)
- Goal: Move the selected emotion away from clouds on `#student-overview`, using the supplied sun reference for the upper-right placement.
- Verdict: **REVISE**
- Recommendation: **REQUEST_CHANGES**
- Scope: current uncommitted implementation in `DESIGN.md`, `src/index.css`, `src/components/student/StudentPetStage.tsx`, and `src/components/student/StudentOverviewPage.tsx`.
- Notepad inspected: `.omo/ulw-loop/notepad.md`; it concerns older unrelated work and supplies no evidence for this review.

## Findings

### CRITICAL

None in the scoped implementation.

### HIGH

1. **[evidence] The claimed fresh selected-state capture is absent, and the available substitute is the wrong page.**
   - Required artifact: `.omo/evidence/student-overview-emotion-position-current.png`. It does not exist at review time.
   - Available substitute: `.omo/evidence/student-overview-emotion-sun-1280/live-1280x800.png` is a valid `1280×800` PNG, but direct inspection shows the `번호 선택` entry selector, not `#student-overview`, the canvas, clouds, or a selected emotion.
   - The supplied gate report claims a fresh selected-state rectangle (`128×128`, top/right gaps), but its visual artifact cannot be independently inspected. The older clone-fidelity report already records that this same `live-1280x800.png` is not selected-state evidence.
   - Impact: no current rendered target exists to compare against either cloud/sun reference, so upper-right placement, cloud separation, clipping, overflow, and target-surface CJK precision are unverified. This blocks approval.
   - Required correction: provide one fresh, non-mutating `1280×800` capture of the current selected-emotion `#student-overview` state, plus its DOM-rect/overflow data, with both clouds and the emotion visible.

### MEDIUM

None. The source supplies a plausible implementation but does not replace the missing visual proof.

### LOW

None.

## Confirmed implementation qualities

- The selected emotion is not a pasted screenshot or CSS background substitute. `StudentPetStage` renders a native button, with live click and Korean accessible-name wiring, and nests `StudentEmotionOrbVisual` ([`src/components/student/StudentPetStage.tsx:138`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:138), [`src/components/student/StudentEmotionOrb.tsx:18`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionOrb.tsx:18)). The image is the emotion asset within that DOM component.
- The placement and size are token-driven: `top`, `right`, `width`, and `height` consume the stage-scoped `--student-home-emotion-sun-*` tokens ([`src/index.css:12039`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12039), [`src/index.css:12065`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12065)). The same tokens are documented in [`DESIGN.md:79`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:79).
- The layer model is coherent in source: the emotion button is absolutely positioned at `z-index: 2` within a `position: relative; overflow: hidden` 16:9 stage ([`src/index.css:12065`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12065), [`src/index.css:14384`](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:14384)).
- `git diff --check` passed. No source or user data was modified by this review.

## Evidence inspected

1. Cloud/problem reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-129de834-6072-4f9d-b041-1f9ca134045d.png` (`662×486`), directly viewed.
2. Sun placement reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-a202fdc6-da65-4322-9ba8-a9f480ba4b50.png` (`852×582`), directly viewed.
3. Claimed fresh capture path: `.omo/evidence/student-overview-emotion-position-current.png` (missing).
4. Available alleged fresh capture: `.omo/evidence/student-overview-emotion-sun-1280/live-1280x800.png` (`1280×800`), directly viewed; wrong route/state.
5. Prior claims treated as untrusted and checked: `.omo/evidence/student-emotion-sun-position-gate-review.md` and `.omo/evidence/student-overview-emotion-sun-1280-clone-fidelity.md`.
6. Source and current diff: `DESIGN.md`, `src/index.css`, `src/components/student/StudentPetStage.tsx`, `src/components/student/StudentEmotionOrb.tsx`, and `src/components/student/StudentOverviewPage.tsx`.

## Blockers before approval

- A fresh, valid selected-state screenshot at the exact 1280×800 viewport is required at the supplied path (or an explicitly updated path), and it must visibly contain the overview canvas, both clouds, and the selected emotion.
- Its accompanying read-only DOM metrics must identify the stage and emotion-button rectangles and confirm document overflow. The metrics must correspond to that screenshot and postdate the edited CSS.
