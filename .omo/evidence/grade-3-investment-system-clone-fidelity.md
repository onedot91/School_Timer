# Grade-3 investment system — clone/design-system fidelity review

## Recommendation

`REQUEST_CHANGES`

## Scope and success criteria reviewed

- Grade-3 amount-based investment with no student-facing percent terminology; weekday-only results; weekend closure; teacher date-by-stock result settings; 1280×800 layouts.
- A real component tree, reusable primitives, and token-driven colors, spacing, and typography.

## Evidence inspected

- Current uncommitted diff: `DESIGN.md`, student investment components, economy logic/tests, `TimerPage.tsx`, and `src/index.css` (522 additions / 232 deletions). `git diff --check` passed.
- `/private/tmp/student-investment-weekend-1280x800-latest.png`: physically a readable 1280×800 JPEG/JFIF capture despite the `.png` extension; timestamp `2026-08-15 02:44:41 +0900`.
- `/private/tmp/teacher-investment-settings-1280x800-final.jpg`: 1280×800 JPEG; timestamp `2026-08-15 02:51:09 +0900`.
- `src/index.css` timestamp `2026-08-15 02:50:37 +0900`; the student capture therefore predates the current CSS by about six minutes. Previous evidence reports were read only as untrusted context and not relied upon.
- Current render and model sources: `src/components/student/StudentStockMarketPage.tsx`, `src/components/student/StudentSecuritiesPage.tsx`, `src/components/student/StudentStockTrend.tsx`, `src/lib/studentEconomy.ts`, `src/pages/TimerPage.tsx`, `src/index.css`, and `DESIGN.md`.

## Findings

### CRITICAL

None. The implementation is live React DOM, not a pasted capture: four cards are generated from `getDailyStockQuotes(...).map(...)`, inputs and buttons are native controls, and `StudentStockIcon` is reused. The inspected investment route has no raster or `background-image` substitute.

### HIGH

1. **[evidence] The student 1280×800 visual proof is stale against the current implementation.** `/private/tmp/student-investment-weekend-1280x800-latest.png` was created at 02:44:41, but the reviewed investment CSS was last modified at 02:50:37. The final CSS includes the student investment selectors at [src/index.css:15190](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15190) through [src/index.css:15230); therefore this capture cannot validate the current student render. Its JPEG payload is accepted per the user instruction and is not itself a blocker.

2. **[product] New investment styling is not token-driven for spacing or typography.** The design contract requires new spacing to use 0.25rem multiples at [DESIGN.md:108](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:108), yet the added rules introduce one-off values such as `gap: .65rem`, `padding: .8rem`, `gap: .6rem`, `font-size: 1.15rem`, `border-radius: .65rem`, and `min-height: 4.6rem` at [src/index.css:15190](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15190) through [src/index.css:15207](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15207). The teacher rules repeat the issue at [src/index.css:15232](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15232) through [src/index.css:15239](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15239). The color/surface/container conversion to `--apple-*` is genuine, but it does not satisfy the full color, spacing, and typography token requirement.

### MEDIUM

None found in the inspected teacher capture. It visibly uses the Apple surface/separator/accent family, preserves the 4×1 rule grid and date control, and exposes weekend closure without overlap. The student weekend capture visually has four live cards, a clear closure banner, and disabled input/actions, but its staleness prevents final approval.

### LOW

None.

## Requirement trace

- Student-facing `투자하기` is an amount-entry flow; no percent, price, or share-count copy is rendered in [StudentStockMarketPage.tsx:72](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:72) through [StudentStockMarketPage.tsx:96](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:96).
- Weekend closure is both visual/disabled and enforced in the model at [StudentStockMarketPage.tsx:69](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:69) through [StudentStockMarketPage.tsx:95](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx:95) and [studentEconomy.ts:594](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:594) through [studentEconomy.ts:624](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:624).
- Weekday settlement is date-keyed and skips Saturday/Sunday at [studentEconomy.ts:423](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:423) through [studentEconomy.ts:457](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:457).
- Teacher date-by-stock result entry and weekend disablement are live controls at [TimerPage.tsx:8706](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8706) through [TimerPage.tsx:8730](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8730).

## Blockers before approval

1. Capture the current student weekend page at 1280×800 after the final `src/index.css` edit, then compare that fresh capture with the current source.
2. Replace the new one-off investment spacing/type geometry with named design tokens or documented base-unit values, consistently for student and teacher investment rules.

## Review boundary

No app controls were activated and no student/local/Supabase data was mutated. No source files were edited; this report replaces an earlier untrusted evidence claim with the current review result.
