# Sudoku clone / design-system fidelity review

## Recommendation

**REQUEST_CHANGES** — the implementation itself is visually credible and structurally sound, but the supplied completion-state evidence does not prove the required exact `1280×800` / `100%` viewport.

## Scope and evidence inspected

- Goal/contract: `DESIGN.md` (especially lines 4–6, 54–59, 142–144, and 281).
- Implementation: `src/components/student/StudentSudokuPage.tsx`, `src/components/student/StudentSudokuBoard.tsx`, `src/index.css`.
- Diff: current working-tree diff for the four changed tracked files, plus the untracked `src/lib/studentSudokuFeedback.test.ts`.
- Visual artifacts opened directly:
  - `/private/tmp/school-timer-sudoku-arcade-qa/basic-1280x800.png` — actual raster: `1280×800`.
  - `/private/tmp/school-timer-sudoku-arcade-qa/challenge-1280x800.png` — actual raster: `1280×800`.
  - `/private/tmp/school-timer-sudoku-arcade-qa/challenge-1024x800.png` — actual raster: `1025×800`.
  - `/private/tmp/school-timer-sudoku-arcade-qa/challenge-1366x800.png` — actual raster: `1367×800`.
  - `/private/tmp/school-timer-sudoku-arcade-qa/challenge-complete-1280x800.png` — actual raster: `1280×749`.
- Verification run: `npm run lint` passed; `npm test -- --test-name-pattern='스도쿠|숫자 입력'` passed (`266` tests).

## Findings

### CRITICAL

None. The rendering is live React DOM, not an image/screenshot surrogate: `StudentSudokuBoard` maps every puzzle cell to a real button/gridcell at `src/components/student/StudentSudokuBoard.tsx:38–78`; `StudentSudokuPage` renders the live keypad and feedback at `src/components/student/StudentSudokuPage.tsx:226–258`. The CSS background is procedural grid decoration, not a raster substitution.

### HIGH

None. New arcade colors are declared as scoped design tokens in `DESIGN.md:54–59` and `src/index.css:16669–16676`, then consumed by the Sudoku-only selectors at `src/index.css:17954–18227`. The page-specific selectors remain under `.student-sudoku-*`, so this treatment does not restyle other student screens.

### MEDIUM

1. **[evidence] The claimed exact completion-state viewport is not evidenced.** `challenge-complete-1280x800.png` is physically `1280×749`, despite its name. The two secondary artifacts are also one pixel wider than named (`1025×800`, `1367×800`). The completed visual itself looks coherent, but the project rule requires fresh, exact `1280×800` at `100%` after layout-affecting changes; the supplied artifact cannot prove that requirement. Re-capture the completed challenge at verified `window.innerWidth === 1280`, `window.innerHeight === 800`, toolbar scale `100%`, and record the scroll measurements alongside it.

### LOW

1. **[product] Some local arcade geometry is still literal rather than named geometry tokens.** Examples include the `3px`/`4px` borders and `4px`/`5px` hard-shadow values in `src/index.css:17970–17975`, `18057–18060`, `18164–18180`, and `18197–18227`. This does not undermine the visual result, and all palette values are token-driven; however, promoting the reusable pixel-border/shadow recipe to declared Sudoku geometry/depth tokens would make the local system stricter and easier to maintain.

## Confirmed goal coverage

- Bright cobalt/sky 8-bit arcade treatment: confirmed visually in all five artifacts and in token-driven CSS.
- Scope isolation: confirmed by `.student-sudoku-*`-scoped overrides and no global palette restyle.
- Board and keypad in one screen: confirmed for basic and challenge `1280×800`, and visually for the supplied secondary widths; no clipping is visible.
- Neutral wrong-answer behavior: confirmed by removal of conflict classes, `aria-invalid`, conflict feedback, and correctness copy in `StudentSudokuBoard.tsx:3–78` and `StudentSudokuPage.tsx:1–258`.
- Idle automatic-save copy removed: confirmed in `StudentSudokuPage.tsx:189–199`; status renders only for saving/saved/error/completed states.
- Keyboard focus/high contrast/reduced motion: focus styles at `src/index.css:18197–18200`, forced-colors alternatives at `src/index.css:20109–20132`, and reduced-motion alternatives at `src/index.css:20055–20080` are present. The completion burst is a DOM span-based effect, not imagery.

## Required blocker resolution

1. Replace the three dimension-mismatched screenshots with fresh artifacts whose actual pixel dimensions and browser-reported CSS viewport exactly match their stated names, especially the completed challenge at `1280×800` / `100%`.
