# Gate review: student securities simplification

- recommendation: REJECT
- originalIntent: Minimize complexity and unnecessary information, while making current holdings, profit, and the trade path immediately understandable to Korean grade-3 students at 1024, 1280, and 1366 CSS-pixel Chromebook widths.
- desiredOutcome: Both the holdings overview and stock-selection route present a clean, non-overlapping hierarchy at every required viewport; a student can see available money before choosing a purchase and can move between holdings and trading without ambiguity.

## Blockers

1. violatedCriterion: `SC-CHROMEBOOK-HIERARCHY` — The simplified securities UI must remain immediately understandable at all named Chromebook widths.
   - observation: At 1366×800 on the trade route, the `종목 고르기` heading overlaps the available-balance block; `100 고마` is drawn through the heading region. This is a direct hierarchy/readability failure at a required viewport.
   - evidencePointer: `/private/tmp/student-store-securities-trade-1366.png`; header sizing rules at `src/index.css:16741-16766`; title/action composition at `src/components/student/StudentStorePage.tsx:57-70`.

2. violatedCriterion: `SC-TRADE-PATH-IMMEDIATE` — The trade path and information needed to act must be immediately understandable for grade-3 students.
   - observation: At 1024×800 on the trade route, the entire available/reserved balance block is absent while every stock exposes a `사기` action. A child cannot compare a 15/20/25/35 고마 price against their available 100 고마 on the decision screen.
   - evidencePointer: `/private/tmp/student-store-securities-trade-1024.png`; the same balance component is intentionally supplied to this route at `src/components/student/StudentStorePage.tsx:63-69`, so its disappearance is a rendered responsive defect rather than omitted source data.

## User outcome review

The empty-holdings overview is materially simpler than the baseline and its single `종목 고르기` action is clear. The trade cards also remove the repeated default market-news sentence and present name, trend, price, and action compactly. However, the required cross-viewport outcome fails because the transaction header loses essential balance context at 1024 and visibly collides at 1366.

## Checked artifacts

- `/private/tmp/student-securities-before.png`
- `/private/tmp/student-store-securities-1024.png`
- `/private/tmp/student-store-securities-trade-1024.png`
- `/private/tmp/student-store-securities-1280.png`
- `/private/tmp/student-store-securities-trade-1280.png`
- `/private/tmp/student-store-securities-1366.png`
- `/private/tmp/student-store-securities-trade-1366.png`
- `src/components/student/StudentSecuritiesPage.tsx`
- `src/components/student/StudentStockMarketPage.tsx`
- `src/components/student/StudentStorePage.tsx`
- `src/index.css`
- Current `git diff` for the three user-listed source files

## Direct slop/programming pass

- No added tests, deletion-only tests, tautological tests, implementation-mirroring tests, or unnecessary parsing/normalization were found in the reviewed diff.
- The production changes are narrowly scoped and reuse existing components/tokens. No slop/programming finding independently blocks the stated criteria.
- The code-review report and manual QA matrix named by the gate protocol were not supplied or found in the provided evidence. Direct artifact inspection supports the two blockers above; this missing report coverage is an evidence NOTE, not an additional blocker.

## Exact evidence gaps and notes

- All seven files use JPEG encoding despite a `.png` extension (`file` inspection). They remain viewable and dimensionally correct, so this is a capture-hygiene NOTE rather than a product blocker.
- Captures cover only the empty-holdings overview and all-unowned stock-list state. No populated holdings/profit capture, owned-stock sell state, confirmation dialog, focus state, or text-zoom state was supplied. These gaps prevent affirmative verification of those aspects but are not separate blockers because the supplied concrete viewport failures already require revision.
- `omo ulw-loop status --json` was unavailable (`omo: command not found`), so the required fallback report path was used.
