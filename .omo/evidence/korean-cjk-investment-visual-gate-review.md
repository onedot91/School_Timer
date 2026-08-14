# Korean/CJK Investment Visual Gate Review

- recommendation: **APPROVE (PASS)**
- blockers: **None**

## originalIntent

Independently verify the teacher and student investment UI for Korean/CJK precision and elementary-student usability at 1280×800, including copy, type size, return-band semantics, non-color cues, and removal of percentage wording from the student surface.

## desiredOutcome

The teacher can understand the five return bands, while students see simple Korean stage language with symbols, readable controls, and no percentage terminology.

## userOutcomeReview

- **C1 Korean copy:** PASS. Student-facing labels (`투자하기`, `투자할 고마`, `투자금 찾기`, `휴장`) and stage copy (`많이 올랐어요`, `올랐어요`, `그대로예요`, `내렸어요`, `많이 내렸어요`) are concise and age-appropriate.
- **C2 range semantics:** PASS. Teacher UI displays `+10% ~ +20%` for `올랐어요`, `+30% ~ +50%` for `많이 올랐어요`, `-20% ~ -10%` for `내렸어요`, and `-50% ~ -30%` for `많이 내렸어요`. The negative ranges are numerically ascending on screen but denote exactly the matching magnitude bands. `getInvestmentStageFromPercent` uses boundaries `>=30`, `>0`, `<=-30`, `<0`; selectable values are 10-point increments, so the displayed bands and available choices agree.
- **C3 color+symbol redundancy:** PASS. Results use `▲▲`, `▲`, `─`, `▼`, and `▼▼` plus Korean labels; meaning does not depend on red/blue color alone.
- **C4 1280×800 readability:** PASS. Both supplied captures are 1280×800 with no clipping, overlap, broken CJK glyphs, or truncated controls. Student card titles/result/status labels and 48px-class controls are readily legible. Teacher helper text is denser but remains legible and intact at the reviewed resolution.
- **C5 no percent wording on student UI:** PASS. The student capture contains no `%`, `퍼센트`, or `수익률`; the two student TSX surfaces render only `studentLabel` and symbols. Percent formatting is confined to the teacher settings surface.
- **C6 slop/maintenance confidence:** PASS. Direct diff pass found no deletion-only/requested-removal tests, tautological or implementation-mirroring tests, needless extraction/normalization, or unrelated production abstraction tied to this visual requirement. Existing code review also explicitly records `omo:programming` and `omo:remove-ai-slops` coverage.

## checkedArtifacts

- `/private/tmp/school-timer-investment-teacher-1280x800.png`
- `/private/tmp/school-timer-investment-student-1280x800.png`
- `src/pages/TimerPage.tsx`
- `src/components/student/StudentStockMarketPage.tsx`
- `src/components/student/StudentSecuritiesPage.tsx`
- `src/lib/studentEconomy.ts`
- `src/lib/studentEconomy.test.ts`
- `src/index.css`
- `.omo/evidence/grade-3-investment-system-code-review.md`
- Current working-tree diff from `git diff`

## exactEvidenceGaps

- None for the requested visual criteria. The supplied student capture is a weekend/closed state, so live positive/negative colors are established from production classes and symbol/label rendering rather than visibly exercised in that screenshot; this does not defeat the required color-independent redundancy.

## notes

- `omo ulw-loop status --json` could not run because `omo` is unavailable, so the mandated fallback evidence path was used.
