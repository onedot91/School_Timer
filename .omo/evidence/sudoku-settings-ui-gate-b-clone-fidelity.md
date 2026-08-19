# Sudoku settings UI — visual fidelity and CJK review

## Verdict

- **VERDICT:** REVISE
- **CONFIDENCE:** HIGH

The current settings dialog has a clear, child-readable decision sequence and stays within the established Apple/classroom system. The supplied problem screenshot is defect context rather than an exact pixel target, so this review judged the stated hierarchy and responsive behavior instead of requiring a pixel diff. The visual/CJK surface passes; the overall result remains REVISE only because the required successful, isolated runtime click proof was not supplied as a durable artifact and could not be independently replayed from the provided captures.

## Evidence trace — 4/4

| Capture | Physical pixels | Effective CSS viewport at 84% | Result |
| --- | ---: | ---: | --- |
| `.omo/evidence/sudoku-settings-ui/current/modal-1024.jpg` | 860×672 | 1024×800 | Two equal option cards; no horizontal clipping. |
| `.omo/evidence/sudoku-settings-ui/current/modal-1280.jpg` | 1075×672 | 1280×800 | Two equal option cards; modal is optically centered. |
| `.omo/evidence/sudoku-settings-ui/current/modal-1366.jpg` | 1147×672 | 1366×800 | Two equal option cards; no horizontal clipping. |
| `.omo/evidence/sudoku-settings-ui/current/modal-effective-512.jpg` | 430×672 | 512×800 | Cards stack in the same reading order; no horizontal clipping. |

All four files were directly opened. They are genuine JFIF JPEGs (`FF D8 FF E0 … JFIF`), fully composited, and were created 59–69 seconds after the reviewed sources (`2026-08-20 03:35:07 +0900` sources; `03:36:06`–`03:36:16` captures). The dimensions consistently encode 84% in-app-browser scaling.

## Findings

### CRITICAL

- None. The dialog is live React DOM: a `motion.section` with native controls, not a raster or `background-image` substitute ([StudentMissionsPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:157)).

### HIGH

- None. The option cards use existing Apple/classroom tokens and a shared class-driven grid, rather than a screenshot-like one-off composition ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15769)).

### MEDIUM

- None. Reading order is preserved: `오늘의 스도쿠` → title → irreversible-choice warning → each card’s size, difficulty, rule, reward, filled action row ([StudentMissionsPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:188)). Korean copy remains as complete phrases at every inspected width; no orphan particles, clipped glyphs, or awkward CJK breaks are visible.

### LOW

- None. The visible blue close-control ring is the intentional keyboard-focus signal (`--apple-focus`), not a competing action accent; selectable and primary action surfaces remain the single classroom green accent ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:11604), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:11695)).

### Evidence blocker

- **[evidence] Functional success is not independently evidenced.** The four supplied artifacts stop at the open dialog; none records the Challenge click, the subsequent `#student-sudoku` hash, the closed dialog, or the named 81-cell 9×9 grid. A local browser replay was deliberately isolated from classroom data, but its placeholder Supabase endpoint did not reproduce the project’s full settings-read contract, so it did not produce a trustworthy normal-flow receipt. Add one fresh isolated action-log/DOM receipt (or post-click capture) with those four facts. This is an evidence gap, not a demonstrated visual or product defect.

## Functional and accessibility trace

- On opening, the shared modal-focus hook focuses the first native control—the close button—so the shown focus ring is real, and it traps Tab/Escape appropriately ([useModalFocus.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/useModalFocus.ts:73)).
- Challenge closes the dialog before delegating to `onOpenSudoku('challenge')` ([StudentMissionsPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx:197)). The host persists/starts that difficulty then routes to `#student-sudoku` ([AuctionPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:1509)). The resulting board is a named live `role="grid"` with 81 native `role="gridcell"` buttons: `도전 9×9 스도쿠 문제` ([StudentSudokuBoard.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentSudokuBoard.tsx:31)).
- The attempted isolated Playwright replay used an empty browser context and blocked classroom data writes. It confirmed entry selection and therefore did not touch a real balance, bid, award, or shared setting, but its incomplete settings-service stub prevents treating it as a normal-flow click receipt.

## Blocking

1. **[evidence]** Provide a fresh, isolated Challenge-click artifact proving: dialog count becomes zero, `location.hash === '#student-sudoku'`, grid accessible name is `도전 9×9 스도쿠 문제`, and gridcell count is `81`.
