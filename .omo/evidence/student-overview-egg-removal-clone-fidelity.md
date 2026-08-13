# Student overview egg removal — clone-fidelity review

- Date: 2026-08-13 (Asia/Seoul)
- Mode: read-only review; the only write is this required review artifact.
- Recommendation: **REQUEST_CHANGES**
- Scope: `http://localhost:3000/#student-overview` at `1280×800`, the canvas egg hotspot and its non-mutating modal-open path, plus the emotion-card/picker layout.

## Success-criteria result

| Criterion | Result | Evidence |
| --- | --- | --- |
| Remove the standalone pet-egg card | PASS | `StudentOverviewPage` no longer imports/renders `StudentPetCard` (`src/components/student/StudentOverviewPage.tsx:12-15,100-148`). Fresh overview DOM has one egg button inside the scene and one emotion region; the old third status-card is absent. |
| Make the nest egg in the canvas selectable | PASS | The scene contains a live `<button>` at `src/components/student/StudentPetStage.tsx:125-130`, not an image click-map. In the fresh 1280×800 capture, its rect was `x=58.5, y=208.77, 140.64×83.60`, visually covering the illustrated nest/egg. |
| Show the egg modal on click | PASS | Clicking only the non-mutating egg opener created a live `role="dialog"` with `aria-modal="true"`, title `알 성장`, progress text, close control, and feed button. Its fresh rect was `480×440.52` at `x=400, y=179.73`; body scroll locked. No feed action was invoked. |
| Emotion-card and picker layout | PASS | The overview emotion card is a live reusable `StudentEmotionSummary` (`src/components/student/StudentEmotionSummary.tsx:15-37`). Navigating to `#student-emotions` (navigation only) produced the nine live radio controls in a 3×3 grid; the viewport/document remained `1280×800`, with no detected clipped overflow. |
| CJK clipping/bad breaks | PASS for inspected states | Korean labels (`아직 선택하지 않았어요`, the nine yellow-zone emotions, and modal labels) rendered without clipping, tofu, or orphaned CJK syllables in the fresh 1280×800 captures. |
| Real component tree rather than a screenshot substitute | PASS | The canvas illustration is a bounded raster asset, but interactive UI is live DOM: separate semantic buttons for egg/mailbox/library and live modal/summary/picker components. No page screenshot or raster overlay substitutes for the UI. |

## Findings

### CRITICAL

None. The visual scene uses a raster illustration as artwork, but the reviewed interface and interactions are live DOM/components; this is not a pasted-page/screenshot implementation.

### HIGH

1. **New egg hotspot geometry bypasses the design-token contract.** `src/index.css:12052` hardcodes `top: 14%`, `left: 5.5%`, `width: 17%`, and `height: 18%` directly on the one-off egg hotspot. `DESIGN.md` defines named stage/house geometry tokens but does not define an egg hotspot anchor/size token. The rendered position is visually right today, but the geometry cannot be shared, audited, or adjusted as part of the design system. This fails the requested token-driven layout requirement.

### MEDIUM

None.

### LOW

None.

## Required blockers before approval

1. Define named egg-hotspot position and size tokens in `DESIGN.md` and the CSS token layer, then consume them from `.student-home-hotspot-egg` instead of the four literal percentages at `src/index.css:12052`.

## Evidence inspected

- User reference identifying the removed card: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-92a38d91-3e7e-4069-88db-7025fb5881f6.png` (`384×1014`, RGBA).
- User reference identifying the target canvas egg: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d9954e04-2712-4d47-b5dd-34efb7570e53.png` (`166×132`, RGBA).
- Fresh in-app-browser captures/DOM inspection of `http://localhost:3000/#student-overview` and `#student-emotions`, viewport override `1280×800`, captured in this review session. The egg click was limited to opening/closing the dialog; no mutation control was clicked.
- Current source: `DESIGN.md`, `src/components/student/StudentOverviewPage.tsx`, `src/components/student/StudentPetStage.tsx`, `src/components/student/StudentEmotionSummary.tsx`, `src/components/student/StudentEmotionPage.tsx`, and `src/index.css`.
- Current worktree diff and `git diff --check`; 17 modified tracked files plus untracked evidence/assets were enumerated. Binary home-scene assets were inspected as asset changes only.
- Existing claims were treated as untrusted: `.omo/evidence/student-overview-1280x800-clone-fidelity.md` and `.omo/evidence/student-overview-emotion-pet-gate-review.md`. They describe a prior composition with the pet card still present, so they cannot establish the current result.
- Notepad consulted: `.omo/ulw-loop/notepad.md`. It is an unrelated July storage-debug notepad and supplies no evidence for this task.

## Notes on evidence limits

The supplied references are a card crop and a canvas crop rather than a matching full-screen 1280×800 target, so no honest whole-page pixel-diff score is possible. The explicit visual acceptance criteria above were checked directly against the fresh live render.
