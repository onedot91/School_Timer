# Bank / Donation Hover Gate Review

- recommendation: REJECT
- originalIntent: 은행 기본 동작 버튼과 기부 버튼의 hover 표현만 정리하고, 예금 깨기·상환 의미 색상과 증권 아이콘은 변경하지 않는다.
- desiredOutcome: 새 문구 없이 지정 버튼만 새 hover 스타일을 사용하며, 1280×800·100%에서 잘림·겹침·첫 화면 overflow가 없다.
- userOutcomeReview: CSS 범위와 제공된 축소 캡처의 화면 상태는 의도에 부합하지만, 필수 기본 뷰포트 검증 자료가 없어 완료 승인은 불가하다.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` (final-theme hover rule at lines 21739-21753)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBankPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentDonationPage.tsx`
- `/private/tmp/school_timer_bank_hover.png` (1075×672)
- `/private/tmp/school_timer_donation_hover.png` (1075×672)
- `git diff -- src/index.css`
- `git diff -- src/components/student/StudentBankPage.tsx src/components/student/StudentDonationPage.tsx`

## Direct findings

- No text addition is introduced by the new CSS hover rule. The component diff adds accessibility attributes and `type="button"`; visible button copy remains unchanged. Donation adds a non-visible progressbar aria-label only.
- Selector scope is `.student-bank-grid` buttons excluding `.student-bank-break-button` and `.student-bank-repay-button`, plus buttons under `.student-donation-page`, gated by `@media (hover: hover)`, enabled state, and `:hover`.
- Break/repay semantic classes remain separately styled and are explicitly excluded from the new final-theme rule.
- The supplied 1075×672 captures show the intended hover treatment with no visible clipping, overlap, or unintended scroll in the captured frame.
- Securities/stock icon changes were excluded from this review as instructed.
- Direct remove-ai-slops/programming pass: the CSS rule is minimal, has no needless abstraction, parsing/normalization, tests, dead code, tautological coverage, or production extraction. No maintenance-burden finding tied to this scoped change.

## Blockers

1. violatedCriterion: `PRIMARY-VIEWPORT-1280x800-100`
   - observation: The mandatory latest-layout verification at exact CSS viewport 1280×800 and preview scale 100% is absent. Both supplied images are 1075×672 from an 84% preview and cannot substitute for primary QA evidence.
   - evidencePointer: `/private/tmp/school_timer_bank_hover.png`; `/private/tmp/school_timer_donation_hover.png`; project `AGENTS.md` primary viewport rule.

## Exact evidence gaps

- A post-final-edit bank hover capture or equivalent browser evidence proving `window.innerWidth === 1280`, `window.innerHeight === 800`, and preview scale 100%.
- The same post-final-edit exact-viewport evidence for donation hover, demonstrating no clipping, overlap, unintended scrolling, or first-screen overflow.

## Notes

- `omo ulw-loop status --json` was unavailable because the `omo` executable is not installed on PATH, so the documented fallback report path was used.
- No code-review report or manual QA matrix specific to this micro-change was provided; direct artifact inspection supports all scoped criteria except the mandatory exact viewport criterion.
