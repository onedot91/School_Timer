# Teacher Classword calendar state — clone/design-system fidelity review

**Recommendation:** REQUEST_CHANGES

## Scope and success criteria

Reviewed the teacher Classword calendar's topic, selected, today, and
outside-month state composition. The implementation must be live DOM (not a
raster substitute), token-led, match the supplied open-grid reference, retain
every state when classes combine, and render cleanly at the required
`1280×800` viewport.

## Evidence inspected

- `src/components/teacher/ClasswordCalendar.tsx:42-87` (current source and
  working-tree diff)
- `src/classword.css:579-602` (current source and working-tree diff)
- `src/index.css:12602-12622` (semantic palette and the two new calendar
  tokens)
- `DESIGN.md:171-182,374` (calendar state and token contract)
- User reference:
  `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-d9eda5ac-bf35-4156-be19-f78913d41f20.png`
  — inspected directly; valid `644×482` RGBA PNG.
- `tmp/visual-qa/teacher-classword-calendar-distinct-states-1280x800.jpg`
  and `tmp/visual-qa/teacher-classword-calendar-combined-state-1280x800.jpg`
  — inspected directly; valid `1280×800` JPEGs created after the current
  stylesheet modification.
- `tmp/visual-qa/teacher-classword-calendar-reference-1280x800.jpg` — valid
  JPEG, but predates the current `src/index.css` and `src/classword.css` and
  is therefore not final-pass evidence.

No direct pixel-diff was used: the supplied target and the full-page actual
captures have different dimensions and page context.

## Findings

### CRITICAL

None. `ClasswordCalendar.tsx:42-87` renders semantic section/header/footer
structure and forty-two live button elements. The scoped component and CSS
contain no image URL, raster/data URI, canvas, or screenshot/background-image
substitute for the calendar.

### HIGH

- **[product] Date columns visibly collide at the required viewport.** In
  `tmp/visual-qa/teacher-classword-calendar-distinct-states-1280x800.jpg`,
  middle-row labels such as `16` and `17` run together (`1617`). The seven
  equal tracks plus `.3rem` column gaps at `src/classword.css:590` do not
  provide sufficient usable width for the `1.1rem` date labels and the
  `aspect-ratio: 1` / minimum `var(--teacher-classword-calendar-cell-size)`
  control at `src/classword.css:591`. This violates the mandatory no-overlap
  requirement for `1280×800` and does not match the reference's open spacing.

- **[evidence] The named reference full-page capture is stale.**
  `teacher-classword-calendar-reference-1280x800.jpg` is timestamped
  `15:52:39`; `src/index.css` and `src/classword.css` changed at `16:38:53`
  and `16:39:39`. A final approval requires a fresh capture of every required
  state after the layout fix.

### MEDIUM

- **[product] Today loses an independently identifiable visual contribution
  when selected.** The component can emit both classes
  (`ClasswordCalendar.tsx:61`), but `.is-today` and the later `.is-selected`
  both only set the same accent text color (`src/classword.css:595-596`). A
  selected non-today date is visually indistinguishable from a selected today
  date. This does not meet the stated independently composable state contract.

- **[product] Outside-month muting is erased by later selected/today rules.**
  `.is-outside` supplies its only muted cue at `src/classword.css:593`, while
  the same-specificity `.is-today` / `.is-selected` rules at `595-596` win
  when states combine. The DOM classes remain correct, but the visual state is
  not composable.

- **[product] Selected rendering appears as a double green ring in the latest
  selected and combined captures, whereas the supplied target uses one ring.**
  Verify the selected control's focus/outline cascade alongside the intended
  inset ring at `src/classword.css:596`; retain one clear selection boundary.

- **[evidence] State coverage remains incomplete.** The combined capture
  correctly proves `has-topic.is-selected` preserves pale-lime fill, green
  dot, and selection outline (CSS `594`, `596-598`). It does not demonstrate
  that selected+today, outside+selected, or outside+today retain all their
  state cues.

### LOW

None. Semantic colors and the responsive cell/Today-action choices are driven
by documented tokens (`src/index.css:12602-12622`, `DESIGN.md:171-182`). The
calendar reuses one component tree, and Korean labels in the reviewed captures
have no clipping or unnatural wrapping.

## Blockers

1. Remove the 1280×800 date-label collision and recapture all required states.
2. Make today and outside-month signals survive combinations with selected,
   without sacrificing the required `has-topic.is-selected` fill, dot, and
   ring composition.
3. Resolve the apparent duplicate selected ring to the reference's single
   boundary, then recapture fresh evidence.
