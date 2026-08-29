# Row wire / clip visual gate

- Goal: `row_wire_visual_gate`
- Recommendation: **APPROVE (scoped product judgment)**
- Review date: 2026-08-29

## Evidence inspected

- Bug reference, opened directly: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-81f4db94-c0a0-4d83-813d-a08831b955ed.png` — valid RGBA PNG, `1968 x 1132`.
- Fresh runtime capture, opened directly: `tmp/failure-exhibition-row-wire-consistency-1075x672.jpg` — valid JPEG, `1075 x 672`, modified after the relevant source (`19:46:13` vs CSS `19:43:30`).
- Implementation: `src/components/student/StudentFailureRelay.tsx:204-240`, `src/index.css:12620-12648`, `src/index.css:13972-14056`, and `DESIGN.md:207-244`.

The files cannot be pixel-diffed: their dimensions differ, and the runtime capture is JPEG while the bundled diff command accepts matching PNG inputs. The reference is therefore used as an illustrative before-state, not as a same-size pixel target.

## Findings

### CRITICAL

None. The cards, wires, clips, and hooks are live DOM/CSS layers. `StudentFailureRelay` renders two explicit rows and maps each story into a `motion.div`; there is no raster or background-image substitution (`StudentFailureRelay.tsx:204-240`).

### HIGH

None. Each row owns its own wire (`.student-failure-feed-row::before`), and each card owns a centered clip body and hook via reusable pseudo-elements. All geometry and materials are named failure tokens (`index.css:12633-12641`), not row-specific inline values.

### MEDIUM

None. In the fresh capture, both rows have the same relationship: the wire passes through the upper portion of each sand-metal clip body, with the U-hook above and paper/card below. This corrects the reference's visible defect, where the lower-row clips hang noticeably below their wire. Source geometry supports that reading: row wire `top: .4rem`; every item clip body begins at `-.52rem` from the same padded grid-item origin; the hook begins at `-1.08rem` (`index.css:13985-14045`). Layering remains coherent: wire `z-index: 0`, card item `1`, hook `4`, clip body `5`.

### LOW

None. The metal clips are visually consistent across all six cards; their shadows and the paper edges do not obscure the row wires. The hierarchy reads cleanly as `wall -> wire -> hook/clip -> paper/card`.

## Scoped verdict and limitations

- [product] **PASS.** The top and bottom rows now attach clips to wires with the same visual relationship, and the wire/clip/paper hierarchy is coherent.
- [evidence] The only fresh runtime evidence is `1075 x 672`, not the project-required unscaled `1280 x 800` viewport. This prevents an approval of the broader final visual-QA gate, but does not identify a defect in the narrowly requested row-alignment fix. No same-size pixel comparison is possible against the `1968 x 1132` reference.

## Blockers

None for this scoped product visual gate. For release-level visual completion, supply a fresh exact `1280 x 800` / `100%` runtime capture and viewport proof after the final layout edit.
