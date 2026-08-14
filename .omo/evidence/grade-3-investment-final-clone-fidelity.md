# Grade-3 investment system — final clone/design-system fidelity review

## Recommendation

`APPROVE`

## Scope and success criteria

- Grade-3 amount-based Goma investment, with no student-facing percent jargon.
- Five icon-plus-text outcome stages; weekday-only settlement and visible weekend closure.
- Teacher date-by-stock settings at the 1280×800 target viewport.
- A genuine reusable React/component implementation, driven by existing Apple tokens plus the investment tokens; not a raster or background-image mock.

## Evidence independently inspected

- Current uncommitted diff: `DESIGN.md`, `src/components/student/StudentPlaza.tsx`, `src/components/student/StudentSecuritiesPage.tsx`, `src/components/student/StudentStockMarketPage.tsx`, `src/components/student/StudentStorePage.tsx`, `src/index.css`, `src/lib/studentEconomy.ts`, `src/lib/studentEconomy.test.ts`, `src/pages/AuctionPage.tsx`, and `src/pages/TimerPage.tsx`.
- Supplied current captures, verified by file signature and dimensions:
  - `/private/tmp/student-investment-weekend-1280x800-final.jpg` — JFIF/JPEG, 1280×800, created after the current investment CSS edit.
  - `/private/tmp/teacher-investment-settings-1280x800-final.jpg` — JFIF/JPEG, 1280×800, created after the current investment CSS edit.
- Render sources: `StudentStockMarketPage.tsx`, `StudentSecuritiesPage.tsx`, `StudentStockTrend.tsx`, `studentEconomy.ts`, `TimerPage.tsx`, `index.css`, and `DESIGN.md`.
- `git diff --check` completed with no whitespace errors.

## Findings

### CRITICAL

None. The investment UI is a live React tree: `StudentStockMarketPage` maps the four market records to native `<input>` and `<button>` controls ([StudentStockMarketPage.tsx:75](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:75)), and reuses `StudentStockIcon` ([StudentStockTrend.tsx:11](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockTrend.tsx:11)). The reviewed investment selectors contain no image or `background-image` substitute.

### HIGH

None. Investment typography/control tokens are declared and used alongside existing Apple color, radius, surface, and spacing tokens ([index.css:11614](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:11614), [index.css:15195](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15195)). The new investment-specific layout values use the documented 0.25rem base where introduced, and no new one-off color is introduced for this investment surface.

### MEDIUM

None. The student capture has no clipping or overlap at 1280×800: the header, weekend closure, and four equal market cards fit within the viewport. The teacher capture retains the date picker, five-stage settings, weekend message, and per-stock editors with correct surface hierarchy.

### LOW

None.

## Requirement trace

- Amount-based student flow: the student enters an integer `투자할 고마`; neither price nor share count is rendered ([StudentStockMarketPage.tsx:83](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:83)).
- Five non-percent, text-backed stages: `▲▲ 많이 올랐어요`, `▲ 올랐어요`, `─ 그대로예요`, `▼ 내렸어요`, `▼▼ 많이 내렸어요` ([studentEconomy.ts:117](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:117)).
- Weekend closed: the visible student banner and controls use the weekday predicate ([StudentStockMarketPage.tsx:69](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:69)); transaction boundaries reject weekend invest/withdraw attempts ([studentEconomy.ts:594](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:594)). Settlement enumerates weekdays only ([studentEconomy.ts:423](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:423)).
- Teacher date-by-stock controls: the date picker, per-stock stage/reason editor, and weekend registration disablement are live controls ([TimerPage.tsx:8704](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8704)).

## Review boundary

No app control was activated and no student, local, or Supabase data was changed. Earlier evidence reports were treated as untrusted context; this verdict is based on the current diff, current source, and the two supplied final JPEGs.
