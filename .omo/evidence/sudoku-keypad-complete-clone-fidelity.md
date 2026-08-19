# Sudoku keypad complete — clone/design-system fidelity review

## Recommendation

**APPROVE**

## Scope and reference

- Goal: after all nine instances of a Sudoku digit are placed, hide that keypad digit without moving the other keys; restore it when one instance is erased.
- Reference: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-0593b196-5142-484d-92b2-dcd1c78c97b1.png` is a structural/example reference only, not an exact pixel target. **Image diff: N/A.**
- Review mode: read-only visual/CJK/design-system pass. The five authoritative JPEGs were directly opened; identically named `.png` files were intentionally excluded.

## Evidence inspected

- Design contract: `DESIGN.md` (especially lines 155–176 and 215–245).
- Live implementation: `src/lib/sudoku.ts:223`, `src/components/student/StudentSudokuPage.tsx:149-153,235-259`, `src/components/student/StudentSudokuBoard.tsx:20-69`, `src/index.css:14278-14295,14943-15075,15215-15236,16401-16414`.
- Test coverage: `src/lib/sudoku.test.ts:95-106`.
- Fresh JPEGs (all valid JFIF JPEGs, generated after the changed source):
  - `.omo/evidence/sudoku-keypad-complete/current/seven-count-8.jpg`
  - `.omo/evidence/sudoku-keypad-complete/current/seven-count-9-hidden.jpg`
  - `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1024.jpg`
  - `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1280.jpg`
  - `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1366.jpg`
- Independent local verification: `npm test` (112/112), `npm run lint`, and `npm run build` all passed. Build emitted only the pre-existing Vite chunk-size warning.

## Visual and CJK evidence trace (5/5)

1. `seven-count-8.jpg` — digit 7 is visibly rendered and enabled in the third row, first keypad slot; selected-state green provides an unambiguous live-control state.
2. `seven-count-9-hidden.jpg` — the exact third-row/first-column slot is blank while digits 8 and 9, the row geometry, keypad card, and erase control remain aligned. The blank is a deliberate position-memory cue, not a collapsed grid gap.
3. `seven-hidden-1024.jpg` — board and keypad preserve their side-by-side hierarchy; Korean title, save state, guidance, and `지우기` are legible with no clipping, overlap, or horizontal crowding.
4. `seven-hidden-1280.jpg` — the authoritative Chromebook composition is balanced: the fixed blank slot does not leave an awkward or misleading visual break, and card/board spacing remains natural.
5. `seven-hidden-1366.jpg` — added width produces breathing room without overexpanding keypad controls; Korean labels remain intact and the 3×3 keypad alignment remains stable.

## Design-system and implementation assessment

- **Real DOM, not an image substitute — PASS.** `StudentSudokuPage` maps all nine live `<button>` elements, while `StudentSudokuBoard` independently renders the 81 live grid-cell buttons. No raster/background-image mechanism participates in the keypad state.
- **State integrity — PASS.** `getSudokuCompletedDigits` derives the completed set from current cells (`src/lib/sudoku.ts:223-225`). The same set controls `disabled`, `aria-hidden`, `tabIndex`, CSS state, mouse/touch input, and physical keyboard input (`StudentSudokuPage.tsx:149-153,235-259`). Thus the invisible key is also noninteractive, rather than color-only hidden.
- **Position stability — PASS.** CSS uses `visibility: hidden` and `pointer-events: none` for `.is-complete` (`src/index.css:15072-15075`), retaining the grid item; the screenshots confirm no reflow of 8, 9, or erase.
- **Token and layer fidelity — PASS.** The board, panel, controls, radii, colors, shadows, responsive sizing, and motion consume named Apple/student tokens from `DESIGN.md`; the new Sudoku tokens are declared in both the contract and scoped student surface. The visual hierarchy matches the provided structural reference: task header → board/control workspace → keypad inside its own control card.
- **CJK/responsive fidelity — PASS.** The full Korean strings visible in all required captures have no orphaning, glyph loss, clipping, baseline loss, or overlap. Required 1024/1280/1366 layouts remain visually coherent.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Blocking

None.
