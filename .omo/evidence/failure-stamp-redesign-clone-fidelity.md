# Failure stamp redesign — clone/design fidelity review

**Recommendation:** APPROVE  
**Scope:** Visual fidelity and CJK precision of the open cheer-stamp state at 375×800, 768×800, 1024×800, 1280×800, and 1366×800.

## Evidence inspected

- `DESIGN.md:177-188, 213-215, 252-254` — warm paper/green palette, 44px cheer control, pale-green tray, three equal choices, and responsive contract.
- `src/components/student/StudentFailureMessage.tsx:43-107` — live DOM component tree, conditional tray, three button options, pressed state, and no public stamp count.
- `src/lib/failureExhibition.ts:1-5` — exact Korean option labels.
- `src/index.css:12260-12285, 13279-13439, 13615-13648` — named tokens, 2.75rem (44px) minimum controls, responsive grid, selected state, and reduced-motion rule.
- Fresh valid PNG captures, all newer than the reviewed source:
  - `.omo/evidence/failure-stamp-redesign/final-open-375x800.png`
  - `.omo/evidence/failure-stamp-redesign/final-open-768x800.png`
  - `.omo/evidence/failure-stamp-redesign/final-open-1024x800.png`
  - `.omo/evidence/failure-stamp-redesign/final-open-1280x800.png`
  - `.omo/evidence/failure-stamp-redesign/final-open-1366x800.png`

All five are valid RGB PNG files at their claimed dimensions. The supplied automation result reports `overflowX=false` and `overflowY=false` for every viewport.

## Findings

### CRITICAL

None. The surface is live DOM (`article`, `button`, `span`, and SVG icon components), not a raster/screenshot substitute. The only raster use is the small profile-image content asset, not a UI replacement.

### HIGH

None. The implementation uses the documented failure-exhibition tokens and shared control/radius/motion tokens; no one-off color system or non-reusable static mock is present.

### MEDIUM

None. The tray maintains its intended hierarchy: direct trigger, prompt, then equal choices. At 768px and above it is a 3-column row; at 375px it deliberately becomes one equal-width column to preserve the 44px targets and readable Korean labels.

### LOW

None. The Korean prompt and all three labels render without clipping, overlap, or orphaned final characters in every capture. The blue focus outline visible on the open trigger is intentional shared keyboard-focus treatment (`--apple-focus`) and remains clearly separated from the selected/green action state.

## Visual assessment

The tray is visually cohesive with the gallery: pale-green container, warm-paper options, green text/icon accents, and a subtle selected inset/check state. It remains subordinate to the story while making the next action unambiguous. At 375px, the stacked tray is balanced within the scroll owner and retains comfortable whitespace; at 768–1366px, the three choices form a stable, evenly weighted row with no excess horizontal tension. The selected-state implementation exposes no count in source or capture.

## Blockers

None.
