# Sudoku difficulty dialog — clone/design-system fidelity review

## Scope and verdict

- Goal reviewed: whether the Sudoku difficulty dialog carries the existing blue 8-bit Sudoku system and whether its 6×6 and 9×9 previews communicate their respective scale and block structure at a glance.
- Recommendation: **REQUEST_CHANGES** (`REVISE`).
- Rationale: the rendered dialog is visually strong and the mini boards are real DOM/CSS, but the newly added visual geometry and type are not token-driven. This is a HIGH design-system fidelity failure under the review criteria.

## Evidence inspected

- `DESIGN.md:11-12,54-59,142-153,156` — Sudoku arcade exception, its named palette/motion tokens, grid-size contract, and 0.25rem spacing rule.
- `src/components/student/StudentMissionsPage.tsx:70-101` — `StudentSudokuPreview` renders a span grid from `getSudokuRules`; it creates 36 or 81 child cells with actual box-boundary classes.
- `src/components/student/StudentMissionsPage.tsx:377-445` — dialog tree, two reused difficulty-card instances, DOM preview insertion, semantic button/action markup, and labelled modal.
- `src/index.css:16669-16690` — available Sudoku color and motion custom properties.
- `src/index.css:19221-19464` — dialog, cards, previews, hard-shadow/CTA/focus styles, and narrow-width layout.
- `/private/tmp/sudoku-dialog-1280x800.png` — inspected at its real `1280×800` dimensions.
- `/private/tmp/sudoku-dialog-1024x800.png` — inspected; file metadata reports `1029×800`, not the name's stated `1024×800`.
- `/private/tmp/sudoku-dialog-1366x800.png` — inspected; file metadata reports `1365×800`, not the name's stated `1366×800`.

## Findings

### CRITICAL

None. The board previews are not raster or pasted screenshots: `StudentSudokuPreview` creates live DOM cells and CSS Grid controls their column count. The modal's blueprint-like background uses CSS gradients only as a surface treatment, not as a replacement for the live preview boards.

### HIGH

1. **The visual system is only color/motion-token-driven; geometry and typography are hard-coded throughout the new dialog.** `DESIGN.md:54-59,142-153,156` names the Sudoku palette, difficulty-aware game-cell sizes, motion, and a 0.25rem spacing base, but not dialog-specific borders, hard-shadow offsets, preview dimensions, or retro type stacks. The implementation then introduces repeated literals such as `3px`/`4px` borders and `3px`/`5px` hard shadows (`src/index.css:19225,19244,19248,19254,19258,19271,19299,19303,19332,19336,19360,19363,19385,19387,19410,19414,19424,19428,19450`) plus duplicated raw font families (`src/index.css:19259,19266,19277,19337,19348,19367,19388,19429`).

   This passes the visual snapshot but fails the stated token-driven design-system criterion and even uses 3px increments that do not follow the documented 0.25rem base. Extract named Sudoku dialog tokens for the hard border, hard-shadow step, grid cadence, preview size, compact type, and title/display type; then consume those tokens in the dialog. Do not approve until that token contract exists in `DESIGN.md` and CSS uses it.

### MEDIUM

1. **Two responsive-evidence filenames do not match their actual pixels.** `/private/tmp/sudoku-dialog-1024x800.png` is `1029×800`; `/private/tmp/sudoku-dialog-1366x800.png` is `1365×800`. The visible layouts look sound at those near-target widths—no clipping, overlap, or collapsed card—but they cannot prove the exact requested 1024px and 1366px secondary checkpoints. Re-capture at exact widths if these screenshots are used as formal pass evidence.

### LOW

None.

## Visual assessment

- **Layer/layout:** PASS. The modal has a clear layered hierarchy: scrim → square blue-grid dialog → title/kicker/close control → two parallel option cards → preview → CTA. The spatial rhythm is stable at the 1280×800 primary evidence.
- **8-bit fidelity:** PASS visually. Navy keylines, square corners, hard down-right shadows, blue/ice/yellow palette, mono digits, and pixel-grid background form a coherent extension of the Sudoku page rather than generic Apple-card styling.
- **Mini-board legibility:** PASS visually. The `6×6` preview visibly separates its `2×3` regions; the `9×9` preview visibly separates its `3×3` regions. The size badges and the different grid densities reinforce the distinction, and the same preview component generates both.
- **CTA consistency:** PASS. Both cards have the same full-width blue "이 난이도로 시작" action treatment, hard shadow, arrow, and press/focus affordances; rewards remain a secondary yellow chip.
- **No fake visual substitute:** PASS. The DOM mapping and CSS-grid variable are implementation evidence for reusable, data-derived boards rather than screenshot matching.

## Required blockers before approval

1. Tokenize the new Sudoku dialog's structural geometry and type (border widths, shadow offsets, preview size/grid cadence, relevant font stacks) in `DESIGN.md` and CSS; replace the repeated magic values.
2. If exact responsive proof is required, recapture the two secondary artifacts at actual `1024×800` and `1366×800` (the 1280×800 primary capture is correctly sized).
