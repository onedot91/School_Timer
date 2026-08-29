# Wire/Clip Functional Gate Review

- recommendation: REJECT
- originalIntent: 실패 전시관의 각 카드가 실제로 와이어에 클립으로 매달린 형태로 보이고, 화면에 보이는 여섯 카드가 모두 서로 다른 배경 톤을 갖게 한다.
- desiredOutcome: DOM/CSS 기반의 `wire → hook/body → paper` 재료 계층이 모든 보이는 카드에 적용되고, 순환 릴레이의 어느 여섯 장 창에서도 톤이 중복되지 않으며, 프로젝트의 필수 `1280×800`/`100%` 뷰포트에서 최종 화면이 검증된다.

## User outcome review

제품 구현은 요청한 두 동작을 충족한다. `StudentFailureRelay`가 현재 여섯 장 창에 `createFailureStoryWindowToneIndex`를 적용하고, 충돌한 선호 톤만 사용하지 않은 톤으로 치환한다. 실제 캡처의 여섯 톤은 `[0,5,4,3,2,1]`로 모두 다르며, 세 번 이동한 뒤에도 매 창 여섯 톤이 고유하다는 런타임 증거와 순환 단위 테스트가 있다. 클립은 래스터를 붙인 것이 아니라 `.student-failure-relay-item::{before,after}`와 디자인 토큰으로 만든 몸체/고리이며, 와이어가 몸체를 가로지르고 고리가 몸체 위에서 이어져 종이 상단 중앙에 놓인다.

다만 프로젝트의 명시적 완료 조건인 정확한 `1280×800`, 미리보기 `100%` 최종 시각 검증이 없다. 제공된 최신 캡처와 DOM 측정은 `1280×720`이며, 입력 설명도 이것이 인앱 미리보기 스케일 때문에 생긴 값이고 필수 primary QA로 인정할 수 없다고 명시한다. 따라서 제품 결함이 아니라 필수 증거 결함으로 승인할 수 없다.

## Blockers

1. violatedCriterion: `AGENTS-primary-viewport-1280x800-100%-final`
   - observation: 최종 레이아웃 변경 뒤 정확한 `window.innerWidth === 1280`, `window.innerHeight === 800`, 미리보기 `100%`에서 클리핑/겹침/스크롤/first-screen overflow가 없다는 증거가 없다.
   - evidencePointer: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-wire-clip-six-tones-1280x720-valid.png` (실제 1280×720); task runtime evidence states 1280×720 is not accepted as required primary QA.

## Direct slop / programming pass

- Token-driven design: PASS. clip/wire dimensions and colors are CSS custom properties; anatomy is CSS pseudo-elements, not a raster/screenshot.
- Functional integration: PASS. visible-window tone resolver is memoized at the component seam and passed into `StudentFailureMessage` via `data-story-tone` styling.
- Collision behavior: PASS. canonical ID preference is retained unless it collides in the current window; colliders deterministically consume unused tones. Six or fewer visible sources therefore receive unique tones.
- Accessibility/regression: PASS for the changed behavior. Decorative clip pseudo-elements ignore pointer events; tone is decorative and content does not depend on color. Existing keyboard labels/navigation remain present.
- Overfit/slop: PASS. `failureStoryTone.test.ts` asserts observable uniqueness, identity stability, input immutability, and every offset of a seven-story cycle. It does not assert source text, deleted code, CSS literals, or mirror the production collision implementation. The small pure resolver is a justified testable seam, not needless extraction.
- Notes (non-blocking): the broader `StudentFailureRelay.tsx` diff contains unrelated relay-motion work, but this review was scoped to the requested wire/clip and six-tone outcome and no stated criterion is violated by that presence.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureStoryTone.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureStoryTone.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-wire-clip-six-tones-1280x720-valid.png`
- illustrative references supplied in the task under `/var/folders/.../codex-clipboard-*.png`

## Reproduced verification

- `npm test`: PASS, 288/288.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS; existing chunk-size warning only.

## Exact evidence gaps

- Missing final screenshot and viewport measurement at exact `1280×800`, `100%` after the latest clip/tone edit.
- Until that primary viewport passes, secondary 1024px/1366px checks cannot substitute for completion.
