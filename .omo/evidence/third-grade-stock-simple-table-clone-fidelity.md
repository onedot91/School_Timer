# Clone-fidelity final review: third-grade-stock-simple-table

## Verdict

- **Recommendation:** APPROVE
- **Reviewed commit:** `48cc08ff70c19bbc34dbabce0d076b7901eb9bb5`
- **Scope:** The student stock-trading screen only. The review deliberately excludes the other 53 dirty worktree entries and the existing shared confirmation-dialog migration, as requested.

## Goal and acceptance criteria checked

The required hierarchy is `종목명 → ▲/▼ 실제 고마 → 이유 → 가격·사기/팔기`, not a pixel-for-pixel recreation of the supplied paper table. The 1280×720 basic state must show four 305×330 cards on one row, without document overflow, at least 14px student text, and no removed visible phrases. The buy-confirmation dialog must be 400×228 without internal overflow.

## Independent evidence inspected

- Reference hierarchy photo: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-11d86af7-2559-4019-adaf-a5b9fe1c8904.png` (1368×554), opened and visually inspected. It establishes a four-column `name → movement → reason` table hierarchy, rather than a pixel contract.
- Basic capture: `/private/tmp/student-stock-simple-table-1280.jpg` (1280×720), opened and visually inspected.
- Confirmation capture: `/private/tmp/student-stock-confirm-modal-1280.jpg` (1280×720), opened and visually inspected.
- Source and scoped diff: `src/components/student/StudentStockMarketPage.tsx`, `src/components/student/StudentStockTrend.tsx`, `src/index.css`, and `DESIGN.md`; route integration was also traced in `src/components/student/StudentStorePage.tsx:54-78`.
- Live local Vite page at `http://127.0.0.1:4174/#student-store-securities-trade`, driven at exactly 1280×720. Selected only entry `1` and opened the confirmation dialog; no buy, sell, or balance-changing confirmation was invoked.
- Validation run independently: `git diff --check`, `npm run lint`, `npm test -- --run`, and `npm run build`.

## Findings

### CRITICAL

None. The surface is live DOM, not a screenshot or raster substitute. `StudentStockMarketPage` maps live stock data to four `<article>` cards and real `<button>` controls (`src/components/student/StudentStockMarketPage.tsx:54-101`); the live DOM check found zero `img`, `canvas`, or computed `background-image` descendants in this surface.

### HIGH

None. The reused `StudentStockTrend` primitive owns the direction glyph and absolute 고마 value (`src/components/student/StudentStockTrend.tsx:16-25`) and is also rendered by the portfolio screen (`src/components/student/StudentSecuritiesPage.tsx:7,32,46`). Positive and negative states use documented `--student-stock-up/down` semantic color tokens (`src/index.css:11610-11613,15106-15108`; `DESIGN.md:50-51`), while surface, text, separator, radius, control, and elevation styles use the existing `--apple-*` system tokens (`src/index.css:15112-15125`). Existing direct `rem` spacing/type values were accepted under the stated review contract and showed no visual defect.

### MEDIUM

None. The implementation intentionally reinterprets the reference as four cards, preserving the required informational sequence rather than faking a paper-table clone. The visual source order is name, trend, reason, price/action (`src/components/student/StudentStockMarketPage.tsx:65-82`), and matches the documented third-grade stock contract (`DESIGN.md:151,171`). The default live state had no visible `%`, `오늘 소식`, `미보유`, or `보유 0개` text.

### LOW

None. The current stock-specific dialog duplicates the existing common-dialog visual rules, but the requested review explicitly excludes a shared-dialog conversion; it is not a fidelity blocker.

## Live rendering measurements

At the exact 1280×720 viewport:

| Check | Observed result | Result |
| --- | --- | --- |
| Card grid | Four cards at x=12/329/646/963; each 305×329.96px | PASS |
| Overflow | `documentElement` and `body` scroll sizes both 1280×720 | PASS |
| Student text | Smallest rendered stock text is 14px (`사는 값`); trend is 21.6px, reason/action 16px | PASS |
| Removed visible copy | `%`, `오늘 소식`, `미보유`, and `보유 0개`: 0 matches | PASS |
| Modal | One `role="dialog"`, `aria-modal="true"`; outer size 400×228px; `scrollWidth/clientWidth` 398/398 and `scrollHeight/clientHeight` 226/226 | PASS |
| Browser faults | No console warnings or errors during the inspected basic/modal flow | PASS |

The inspected basic and modal captures agree with these live measurements. The supplied default state is neutral (`－ 0 고마`); the code path independently confirms nonzero values become red `▲ n 고마` or blue `▼ n 고마` through the shared primitive and semantic classes.

## Validation

- `git diff --check`: pass.
- `npm run lint`: pass (`tsc --noEmit`).
- `npm test -- --run`: pass, 71/71. One test intentionally logs a malformed mission-response error while its assertion passes; this is unrelated to the reviewed stock surface.
- `npm run build`: pass. Vite emitted only its existing large-chunk advisory.

## Blockers

None.
