# Student overview balance between cards — final gate review

- recommendation: APPROVE
- blockers: []
- originalIntent: 학생 개요 잔액 바를 캔버스 위 오버레이가 아니라 하단 `고마 벌기`와 `고마 쓰기` 카드 사이에 배치한다.
- desiredOutcome: 캔버스와 분리된 하단 행에서 왼쪽 목적지 카드, 가운데 잔액 요약, 오른쪽 목적지 카드가 나란히 보이고, 의미 구조·기존 이동 액션·Chromebook 반응형 안전성이 유지된다.

## User outcome review

PASS. 신선한 1280×720 캡처에서 캔버스는 `(132,12) 1016×572`, 하단 행은 `y=596`, `h=112`이며, 왼쪽 카드는 `x=12, w=430.4`, 잔액은 `x=454.4, w=371.2`, 오른쪽 카드는 `x=837.6, w=430.4`이다. 세 항목은 겹치지 않고 같은 행을 공유하며 캔버스에는 잔액 오버레이가 없다. 화면 가장자리 잘림이나 수평 오버플로도 보이지 않는다.

React 구조도 시각 결과와 일치한다. `StudentOverviewPage`의 `.student-overview-destinations` 직계 자식 순서는 미션용 `StudentSectionCard`, `.student-overview-balance-dock` 안의 기존 `StudentBalanceSummary`, `StudentPurchaseCard`이다. 잔액은 `section[aria-label="고마 잔액"]`으로 학생 번호, 사용 가능 고마, 예약 고마를 구조화하며, 좌우 목적지는 각각 제목이 있는 `section`과 실제 `button[type="button"]`을 유지한다.

액션은 보존되어 있다. 왼쪽 버튼은 기존 `onOpenMissions`, 오른쪽 버튼은 `StudentPurchaseCard`를 통해 기존 `onOpenStore`를 호출한다. 잔액 재배치는 새로운 상태 변경, 저장, 데이터 쓰기 또는 이벤트 가로채기를 추가하지 않았다. 이 리뷰에서도 사용자 컨트롤을 누르거나 데이터를 변경하지 않았다.

반응형 소스 검증 결과, 1024px 이상이고 높이 850px 이하인 Chromebook 범위에서는 하단 행이 `minmax(0, 1fr) var(--student-overview-balance-width) minmax(0, 1fr)` 3열이며 모든 자식에 `min-width: 0` 계열 제약이 적용된다. 1280px에서는 토큰의 29vw가 371.2px로 캡처와 정확히 일치한다. 1024px과 1366px에서도 가운데 열은 `clamp(20rem, 29vw, 24rem)` 범위에 머물고 좌우 열이 남은 폭을 유연하게 나눈다. 64rem 미만 또는 200% 텍스트 확대에 따른 좁은 유효 폭에서는 기본 2열 및 52rem 이하 단일 열 규칙으로 재배치되며, DOM 순서상 잔액은 계속 두 목적지 카드 사이에 남고 수평 스크롤을 강제하는 고정 전체 폭은 없다.

## Direct remove-ai-slops / programming pass

- 삭제 여부만 검증하는 테스트, 요청된 제거 문구를 고정하는 테스트, tautological 테스트, 구현 미러링 테스트가 추가되지 않았다.
- 잔액 UI를 복제하거나 새 파서·정규화·추상화·의존성을 만들지 않고 기존 `StudentBalanceSummary`, `StudentSectionCard`, `StudentPurchaseCard`를 재사용한다.
- 현재 변경은 목적지 행의 자식 이동과 범위가 좁은 레이아웃 규칙으로 구현되어 있으며, 의미 없는 래퍼나 이벤트 프록시를 추가하지 않았다.
- NOTE: `StudentOverviewPage.tsx`는 270 pure LOC이고 `src/index.css`는 레거시 대형 파일이다. 이는 programming/remove-ai-slops 기준의 유지보수 경고지만, 이번 명시적 배치·의미·반응형·액션 보존 기준을 위반한다는 증거는 아니므로 blocker가 아니다. `DESIGN.md`도 `src/index.css`를 accepted debt로 명시한다.
- NOTE: `StudentBalanceSummary`의 `balance` prop은 기존과 동일하게 전달되지만 컴포넌트 내부에서 사용되지 않는다. 이번 재배치가 도입한 문제가 아니며 사용자 요구 결과를 깨뜨리지 않는다.

## Checked artifact paths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-between-cards.jpg` — 직접 원본 확인, JPEG 1280×720
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentSectionCard.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPurchaseCard.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-bottom-balance-gate-review.md` — 이전 요구를 다룬 비신뢰 참고 자료로 확인
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-bottom-balance-clone-fidelity.md` — 이전 요구를 다룬 비신뢰 참고 자료로 확인
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/ulw-loop/notepad.md` — 현재 작업과 무관한 과거 debug notepad임을 확인
- scoped working-tree diff and `git diff --check` — 통과
- `npm run lint` (`tsc --noEmit`) — exit 0

## Report coverage check

현재의 정확한 “두 카드 사이” 요구를 대상으로 한 별도 executor code-review report 또는 manual QA matrix는 제공되지 않았다. 기존 bottom-balance 보고서는 과거의 캔버스 오버레이 요구를 검토하므로 현재 성공 근거로 신뢰하지 않았다. 본 gate에서 소스, diff, 캡처, 반응형 규칙, 액션 경로와 remove-ai-slops/programming 기준을 직접 확인했으며, 명시된 성공 기준을 충족하므로 이 보고서 공백 자체는 blocker가 아니다.

## Exact evidence gaps

- 이번 정확한 배치의 신선한 렌더 캡처는 1280×720 한 장뿐이며, 1024px·1280×800·1366px·200% 확대의 별도 최신 캡처나 DOM 측정표는 없다. 해당 범위는 활성 CSS와 DOM 순서로 검증했으며, 사용자가 제공한 명시적 캡처/치수 및 성공 기준을 반박하는 증거가 없어 NOTE로 남긴다.
- 클릭 기반 내비게이션 실행 증거는 없다. 데이터 무변경 제약에 따라 클릭하지 않았고, 버튼 의미와 기존 콜백 연결을 소스에서 확인했다.
- `omo ulw-loop status --json`은 현재 환경에서 `omo: command not found`로 실행되지 않았다. 따라서 활성 ULW attempt 디렉터리를 확인할 수 없어 지침의 fallback 경로인 `.omo/evidence/student-overview-balance-between-cards-gate-review.md`를 사용했다.
- 정적/security scanner는 프로젝트에 구성된 도구가 확인되지 않아 N/A이다.
