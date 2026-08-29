# Row wire functional gate review

- recommendation: REJECT
- originalIntent: 실패 전시관의 위·아래 카드 행이 각각 동일한 행 기준 와이어 오프셋을 사용하고, 모든 와이어가 클립 몸체를 일관되게 가로지르게 한다.
- desiredOutcome: 두 행의 와이어/클립 접점이 동일하며 반응형 규칙이 이를 의도치 않게 바꾸지 않고, 최종 구현이 프로젝트 필수 1280×800·100% 뷰포트에서 확인된다.

## User outcome review

제품 구현 자체는 요청 동작을 충족한다. `.student-failure-feed-row`가 각 행의 동일한 positioning context가 되고, 유일한 와이어 규칙 `.student-failure-feed-row::before`가 공통 `--failure-wire-row-offset: .4rem`을 사용한다. 카드 클립 몸체도 두 행 공통 `.student-failure-relay-item::before` 규칙을 사용한다. 제공된 런타임 측정에서 행 0/1의 와이어는 클립 몸체 안쪽 각각 `1.92456px`, `1.92459px`에 위치해 모두 교차하며, 캡처에서도 두 행의 접점이 일관된다. 768–1100px 규칙은 행 gap만 변경하고 접점 selector를 덮어쓰지 않으며, 좁은 1열 규칙은 와이어를 명시적으로 숨긴다. forced-colors 규칙은 색만 바꾼다.

그러나 최신 런타임 증거는 실제 1075×672이며 프로젝트의 명시적 완료 조건인 정확한 1280×800, 100% 최종 검증이 아니다. 따라서 제품 결함은 없지만 필수 증거 부족으로 승인할 수 없다.

## Blockers

1. `[evidence]`
   - violatedCriterion: `AGENTS-primary-viewport-1280x800-100%-final`
   - observation: 최종 레이아웃 변경 뒤 정확한 `window.innerWidth === 1280`, `window.innerHeight === 800`, 미리보기 100%에서 두 행의 교차와 무클리핑·무겹침·무의도 스크롤을 확인한 증거가 없다.
   - evidencePointer: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-row-wire-consistency-1075x672.jpg` (실제 1075×672); task evidence explicitly states the preview could not prove 1280×800.

## Direct programming / remove-ai-slops pass

- Production CSS: PASS. 한 개의 행 상대 selector와 한 개의 토큰으로 두 행을 함께 해결하며, 행별 보정·중복 selector·불필요한 추출·정규화가 없다.
- Responsive selectors: PASS. 768–1100px에서는 gap만 바뀌고 와이어/클립 위치는 유지된다. 좁은 1열 모드의 wire `display: none`은 의도된 레이아웃 전환이며 접점 회귀가 아니다. forced-colors는 background만 바꾼다.
- Test quality: NOTE. `failureStoryOverflow.test.ts`의 새 테스트는 CSS 소스 문자열과 selector 구조를 고정하는 구현 결합형 테스트이며, 클립 몸체와의 실제 기하 교차를 계산하지 않는다. 삭제 전용/제거 확인/생산 로직 미러링은 아니지만 런타임 교차 증거를 대체하지 못한다. 이 약점 자체는 명시 성공 기준 위반이 아니므로 blocker가 아니다.
- Scope/slop: PASS. 이번 wire 변경에서 불필요한 production abstraction, parsing, normalization, dead code, obvious comments는 발견되지 않았다.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureStoryOverflow.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/failure-exhibition-row-wire-consistency-1075x672.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/wire-clip-functional-gate-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/wire_clip_visual_gate-clone-fidelity.md`

## Reproduced verification

- `node --test src/lib/failureStoryOverflow.test.ts`: PASS, 3/3.
- `npm run lint`: PASS (`tsc --noEmit`).
- Source selector audit: PASS; no responsive position override found.
- Runtime screenshot inspection at 1075×672: PASS for visible two-row alignment and clip intersection.

## Exact evidence gaps

- Missing final screenshot and viewport measurement at exact 1280×800, 100% after the row-relative wire change.
- The supplied test proves shared selector/token structure, not computed wire/clip intersection.
