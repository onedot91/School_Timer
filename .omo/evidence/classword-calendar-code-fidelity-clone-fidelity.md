# Teacher Classword calendar — clone/design-system fidelity review

**Recommendation:** APPROVE

## Scope and success criteria

Reviewed the teacher Classword calendar redesign against the supplied open-grid
calendar reference. The required result is live semantic DOM with existing Lucide
icons, token-led styling, accessible topic/current/selected states, and narrowly
scoped overrides that defeat the legacy settings-dialog button theme without
affecting other controls.

## Evidence inspected

- `src/components/teacher/ClasswordCalendar.tsx` (current source and working-tree diff)
- `src/classword.css` (current source and working-tree diff)
- `src/index.css` (tokens plus legacy settings-dialog cascade)
- `src/main.tsx:4-5` (stylesheet order: `index.css`, then `classword.css`)
- `DESIGN.md:176-182, 365-366` (teacher Classword token and layout contract)
- `tmp/visual-qa/teacher-classword-calendar-reference-1280x800.jpg` — valid JPEG, `1280×800`, captured at `2026-08-30 15:52:39`, after the reviewed component (`15:43:22`) and stylesheet (`15:51:22`)
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-758d16d1-92b9-40d8-9eae-6858365df182.png` — valid RGBA PNG, `788×928`, supplied target
- Two independent read-only reviews: design-system integrity PASS (0.94 confidence) and visual-fidelity PASS (0.84 confidence)
- `npm run lint` — passed (`tsc --noEmit`)

The target and actual have different dimensions, month data, and selected state;
an image-diff percentage would be invalid. Both images were directly inspected
for the corresponding calendar treatment instead.

## Findings

### CRITICAL

None. `ClasswordCalendar.tsx:42-87` renders a labelled `<section>`, semantic
header/footer, and forty-two live `<button>` date controls. It contains no image,
canvas, SVG screenshot, `background-image`, or raster substitution for the
calendar UI.

### HIGH

None. The component uses `ChevronLeft` and `ChevronRight` from `lucide-react`
(`ClasswordCalendar.tsx:1, 46-49`) in separately labelled navigation buttons;
the visual layer is not hand-drawn or duplicated from the target.

The calendar consumes documented design tokens for its responsive cell size and
Today action color (`src/index.css:12619-12622`, `src/classword.css:580, 590`).
It also reuses the existing Classword palette, control size, radius, and semantic
color tokens throughout (`src/classword.css:573, 581-590`).

The old global selected-button rules at `src/index.css:1043-1050`, the legacy
`aria-pressed` styling at `src/index.css:9264-9299`, and the global dialog button
radius at `src/index.css:9590-9593` are overridden only inside
`.teacher-settings-theme .settings-dialog .teacher-classword-*`
(`src/classword.css:581-590`). The necessary `!important` declarations therefore
win the known legacy cascade but cannot leak outside this teacher calendar or its
Today action.

### MEDIUM

- **[evidence] State-capture coverage is incomplete.** The fresh `1280×800`
  capture visibly confirms the open grid, header/nav, footer, and combined date
  state, but does not separately demonstrate topic-only, current-only, and
  selected-only date variants. Source proves the variants: `has-topic`,
  `is-selected`, and `is-today` are independently derived and exposed through
  `aria-pressed` / `aria-current` at `ClasswordCalendar.tsx:55-69`; their visual
  rules are separately defined at `src/classword.css:581-586`. This is not a
  product blocker, but a future visual regression gate should capture all three
  states individually.

### LOW

None. The fresh render visually preserves the reference hierarchy in its
1280×800 settings-panel context: month label at upper left, bare chevrons at
upper right, borderless default dates, pale-lime topic treatment with green dot,
left legend, and blue text-only `오늘` action. Korean labels are legible, with no
calendar clipping, overlap, or internal scroll.

## Accessibility and state integrity

- Previous and next month controls have explicit Korean names; their Lucide SVGs
  are hidden from assistive technology (`ClasswordCalendar.tsx:46-49`).
- Each date has a full month/day label plus `주제 있음` where applicable
  (`ClasswordCalendar.tsx:58-69`).
- Selection is expressed with `aria-pressed`; today is exposed as
  `aria-current="date"` (`ClasswordCalendar.tsx:63-64`). The visible state does
  not rely on color alone: selected uses an inset outline, topic adds a dot, and
  today changes the date treatment.

## Blockers

None.
