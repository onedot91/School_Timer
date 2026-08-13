# Student overview emotion sun — visual fidelity and CJK precision review

- Review date: 2026-08-13 (Asia/Seoul)
- Goal: At `1280px` width, place the selected emotion farther right and up than the problem image, like the reference sun, while keeping it inside the canvas and clear of the large and smaller clouds.
- Scope: read-only review of the `top: 3%`, `right: 2.5%` token change. No classroom or user data was changed.
- Verdict: **REVISE**

## Evidence inspected

1. Problem image: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-129de834-6072-4f9d-b041-1f9ca134045d.png` (`662x486`, RGBA).
2. Sun-position reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-a202fdc6-da65-4322-9ba8-a9f480ba4b50.png` (`852x582`, RGBA).
3. Fresh isolated-browser capture: `.omo/evidence/student-overview-emotion-sun-1280/live-1280x800.png` (`1280x800`, RGB). It renders the entry selector because the browser has no existing selected-student state; it is not evidence of the selected-emotion canvas.
4. Previous selected-state runtime artifact: `.omo/evidence/student-emotion-start-qa/s1-metrics.json` and `s1-student-start-1280x800-valid.png`. The captured stage was `1024x576`, and the previous sun was `128x128` at `(951.46, 117.70)`, with `top: 5%` and `right: 7%`.
5. Current source and focused diff: `src/components/student/StudentPetStage.tsx`, `src/index.css`, and `DESIGN.md`.

## What source proves

- The selected emotion is a live native `<button>` with a reused `StudentEmotionOrbVisual`, not a pasted screenshot or background substitute: `src/components/student/StudentPetStage.tsx:138-150`.
- Current tokens are declared and consumed by the same component: `src/index.css:12034-12041` and `src/index.css:12065-12082`; they are documented in `DESIGN.md:79-80`.
- With the last verified `1024x576` canvas and unchanged `128px` 1280px-wide size clamp, the token change calculates to `(998.4, 105.28)` relative to the old document geometry—about **46.9px right** and **11.4px up** from the prior measured control. It retains a **25.6px right** and **17.3px top** canvas inset, so the control box cannot touch the canvas edge. Its horizontal interval is `[870.4, 998.4]` in canvas coordinates, clear of the large left cloud and the smaller lower cloud.
- No visible Korean copy is added or moved in this surface. The Korean accessible labels remain whole strings in `src/components/student/StudentPetStage.tsx:142-143`; therefore no CJK line-break, clipping, or glyph-metric issue is indicated by the moving control itself.

## Findings

### CRITICAL

None. The source uses a live component tree and tokenized positioning; no raster screenshot is standing in for the selectable emotion control.

### HIGH

1. **[evidence] The requested post-change live selected-emotion comparison is unverified.** The only inspected selected-state screenshot and DOM measurement predate the current token edit (`src/index.css` modification time is newer than both `s1-metrics.json` and its PNG). The fresh `1280x800` capture cannot reach `#student-overview` without changing the isolated browser's entry selection, which was not permitted by the request. Consequently, the calculation is strong code evidence but not a fresh visual confirmation of the rendered selected orb, its real asset bounds, or its relationship to both clouds.
   - Blocking verification artifact: `.omo/evidence/student-emotion-start-qa/s1-metrics.json` (stale for this CSS edit).
   - Needed before approval: a fresh, non-mutating `1280x800` capture and DOM rect of an already-selected emotion from the current build, showing the canvas and both clouds.

### MEDIUM

1. **[evidence] The supplied problem and reference images cannot be used for a pixel comparison.** Their dimensions differ (`662x486` versus `852x582`), and the bundled image diff correctly reports `dimensionsMatch: false` and a non-actionable `0` similarity score. The images establish the intended relative placement, but not exact pixel geometry.
   - Needed before exact clone approval: same viewport/crop captures for the reference and current selected state, or an explicit statement that this is a directional placement comparison only.

### LOW

None.

## Blockers

1. Fresh current-build selected-state visual evidence at `1280x800` is required for a PASS; previous success claims are not sufficient because their artifacts are stale relative to the token edit.
2. A same-size/crop comparison pair is required if pixel-level reference fidelity is the acceptance bar.

## Recommendation

`REQUEST_CHANGES` — not because the implementation is structurally wrong (it is token-driven and mathematically meets the requested move), but because the required fresh live selected-state visual proof is missing under the no-data-mutation constraint.
