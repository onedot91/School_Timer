# Sudoku dialog visual final — clone/design-system fidelity review

## Final recommendation

**APPROVE**

The final evidence set replaces the earlier, invalid JPEG/state-mismatched captures.
Its three real PNGs have verified SHA-256 values, exact requested pixel dimensions,
and corresponding DOM measurements proving `visualViewport.scale === 1`, exact
window/client/scroll geometry, and `dialogOpen: true`. Both independent fresh
read-only reviewers returned `PASS` with no blockers.

## Final findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

The dialog still contains a few local `.15rem`/`2px` chip/detail rules; the core
border/frame/radius/shadow/font contracts are tokenized and documented. This is
accepted visual hierarchy rather than a fake or unmaintainable surface.

## Final evidence

- `.omo/evidence/sudoku-dialog-responsive-metadata.json` — captured at
  `2026-08-27T23:34:41+09:00`; for each viewport it records 100% visual scale,
  exact `window`, `documentElement.client`, and scroll dimensions, plus
  `dialogOpen: true`.
- `/private/tmp/sudoku-dialog-1280x800-evidence.png` — actual PNG magic, 1280×800,
  SHA-256 `3fc98ed3a550efe2c9ca47aa32a0f7172a1a82f764d315049c170e40d287f29b`.
- `/private/tmp/sudoku-dialog-1024x800-evidence-exact.png` — actual PNG magic,
  1024×800, SHA-256 `8b86e0be7794d73e908935d4b5073bc1b954dd124d2e30d07ab009536718c925`.
- `/private/tmp/sudoku-dialog-1366x800-evidence-exact.png` — actual PNG magic,
  1366×800, SHA-256 `908b4141adaf7854dea0d6ddcfbfebddc2fe7498bad04caf127b5483525e1579`.

Direct inspection of all three captures verifies the open modal, no clipping,
overlap, unintended scroll, or Korean wrapping defects; 6×6/2×3 and 9×9/3×3
previews, pixel grid, hard shadows, and CTAs remain legible at every target width.

## Prior review record

The remainder of this file preserves the superseded initial evidence review for
traceability only. Its former evidence blockers are resolved by the final evidence
above and must not be treated as current findings.

## Initial evidence inspected

## Evidence inspected

- `src/components/student/StudentMissionsPage.tsx` — source and current diff;
  live `StudentSudokuPreview` component and difficulty-modal component tree.
- `src/index.css` — Sudoku tokens and modal/card/preview styling.
- `DESIGN.md` — documented Sudoku design contract and token inventory.
- `/private/tmp/sudoku-dialog-1280x800-final.png` — modal is visible; file bytes
  identify it as JPEG, dimensions are 1280×800.
- `/private/tmp/sudoku-dialog-1024x800-exact.png` — file bytes identify it as JPEG,
  dimensions are 1025×800, and it shows the student home screen rather than the
  open difficulty modal.
- `/private/tmp/sudoku-dialog-1366x800-exact.png` — file bytes identify it as JPEG,
  dimensions are 1367×800, and it shows the student home screen rather than the
  open difficulty modal.
- Independent read-only integrity and visual/CJK review passes, both returning
  `REVISE` on the same evidence set.

All three captures postdate the latest relevant CSS/DESIGN edits, so freshness is
not the issue; state, dimensions, and image-format integrity are.

## Findings

### CRITICAL

None found in the product implementation. The previews are not raster substitutions:
`StudentSudokuPreview` renders one DOM cell per board position and derives block
boundaries from the active ruleset.

### HIGH

- **[evidence] Required responsive evidence is invalid.**
  `/private/tmp/sudoku-dialog-1024x800-exact.png` is a 1025×800 JPEG and
  `/private/tmp/sudoku-dialog-1366x800-exact.png` is a 1367×800 JPEG. Neither
  contains the open Sudoku difficulty dialog. Therefore neither can prove modal
  layout, Korean wrapping, clipping, scroll behavior, or accessibility-visible
  geometry at the required 1024px and 1366px widths.

### MEDIUM

- **[evidence] Extension/signature mismatch weakens all capture evidence.**
  The first bytes of every `*.png` artifact are the JPEG/JFIF signature
  `ff d8 ff e0 ... JFIF`, rather than a PNG signature. This includes the otherwise
  useful 1280×800 modal capture. Recreate evidence as actual PNGs before treating
  it as the final visual-QA record.

- **[product] Some local pixel rules remain literal instead of using the newly
  declared arcade geometry tokens.** The modal shell/options correctly use
  `--student-sudoku-arcade-radius` and shared border/shadow tokens, but the kicker,
  size chip, reward, and CTA still include direct `.15rem`, `2px`, or 2px-shadow
  geometry values. See `src/index.css:19263`, `src/index.css:19341`,
  `src/index.css:19344`, `src/index.css:19368`, `src/index.css:19371`, and
  `src/index.css:19433`. This is not an image fake and does not invalidate the
  broad system, but it is incomplete tokenization for a strict design-system gate.

### LOW

- **[product] The documented type section still calls the global display family a
  platform stack, while the local Sudoku exception is described in the color and
  feature contract instead.** `DESIGN.md:60` and `DESIGN.md:284` make the exception
  clear enough for this scope, so this is documentation organization rather than a
  functional or visual defect.

## Verified strengths

- `StudentMissionsPage.tsx:70-101` builds 6×6 and 9×9 previews as live spans. It
  calculates 2×3 and 3×3 boundaries from `getSudokuRules`; no screenshot,
  `<img>`, canvas, or `background-image` acts as a board substitute.
- `StudentMissionsPage.tsx:388-444` uses a live `role="dialog"` with
  `aria-modal`, labelled/described relationships, real option buttons, descriptive
  accessible names, close control, and the existing focus-management hook.
- `src/index.css:16669-16684` declares the Sudoku color ramp, display/number font
  stacks, arcade border, frame border, radius, and hard-shadow tokens; the principal
  modal/card/preview styles consume those tokens at `src/index.css:19229-19460`.
- The visible 1280×800 capture has centered hierarchy, legible Korean copy, clear
  6×6/9×9 distinction, hard pixel grid/shadow treatment, and no apparent overlap,
  crop, or unwanted scroll in that one state.

## Blockers before approval

1. Capture the **open difficulty modal** at true CSS viewport 1280×800, 1024×800,
   and 1366×800 with browser preview scale at 100%.
2. Save the captures as real PNG files whose signatures and pixel dimensions match
   their filenames. In particular, 1024 must be exactly 1024 pixels wide and 1366
   exactly 1366 pixels wide.
3. Re-run the visual review on the corrected three-state evidence. It must show no
   modal clipping, overlap, unintended scroll, or Korean text breakage at all
   three widths.
4. For a strict token-complete gate, replace the remaining local arcade-radius and
   2px hard-shadow literals with declared geometry/depth tokens.
