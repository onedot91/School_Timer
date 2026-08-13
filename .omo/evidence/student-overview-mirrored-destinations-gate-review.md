# Gate review: student overview mirrored destinations

- recommendation: APPROVE
- blockers: []
- originalIntent: 화살표 아이콘만 바꾸는 것이 아니라, 중앙 잔액 카드를 축으로 왼쪽 미션 카드와 오른쪽 소비 카드를 실제 레이아웃 수준에서 서로 마주 보도록 구성한다.
- desiredOutcome: 왼쪽 카드는 바깥 왼쪽에 `미션 시작` 버튼, 중앙 쪽 오른쪽에 `고마 벌기` 제목/아이콘을 둔다. 오른쪽 카드는 중앙 쪽 왼쪽에 `고마 쓰기` 제목/아이콘, 바깥 오른쪽에 진입 버튼을 유지한다. 기존 클릭 동작과 접근 가능한 이름을 보존한다.

## User outcome review

PASS. 1280×800 캡처에서 왼쪽 카드의 action은 x=29, heading은 x=185에 있고, 오른쪽 카드의 heading은 x=854.6, action은 x=1107에 있다. 두 카드는 각각 430.4px이며 양쪽 내부 heading이 중앙 잔액에서 각각 29px 떨어져 있어, 중앙을 기준으로 한 목적지 배치가 실제로 대칭이다.

소스도 단순 아이콘 교체가 아닌 구조적 미러링을 구현한다. 왼쪽 인스턴스는 `direction="left"`를 전달하고, 해당 modifier는 grid 영역을 `"action heading"`으로 바꾸며 heading flex 방향도 `row-reverse`로 바꾼다. 오른쪽 구매 카드는 기본 `heading action` 배치를 유지한다.

기능과 접근성은 보존된다. `StudentSectionCard`는 실제 `button type="button"`과 가시 텍스트 레이블을 유지하고, 방향/기능 아이콘은 `aria-hidden="true"`이다. `onClick` 전달 경로도 변경되지 않았다. heading이 DOM에서 button보다 먼저인 것은 비포커스 제목을 먼저 읽고 유일한 상호작용 버튼으로 이동하는 논리적 순서이며 키보드 동작을 손상하지 않는다.

## Responsive review

- 1024px: Chromebook media query의 하한 `min-width: 64rem`에 포함된다. 24px shell inset, 24px 총 gap, 320px balance를 제외하면 각 카드가 약 328px이고, action 최소 열 144px과 heading 열이 수평 배치 안에 들어간다.
- 1280px: 제공 캡처로 직접 확인했다.
- 1366px: 동일 media query와 capped balance width가 적용되어 카드 폭이 더 넓어지므로 1280px보다 수평 여유가 증가한다.
- NOTE: 1024px 미만이면서 768px를 초과하는 CSS viewport에서는 Chromebook 미러링 media query가 해제되고 base two-column 규칙이 적용된다. 고배율 page zoom 등에서 세 destination 자식이 2열로 흐를 수 있다. 이번 명시 기준의 1024/1280/1366 대상 실패를 입증하지 않으므로 비차단이지만 후속 시각 QA 후보이다.

## Slop and programming pass

- 직접 overfit/slop 점검: 새 테스트 없음; 삭제만 확인하는 테스트, tautological test, 구현 미러링 테스트, 불필요한 helper/extraction/normalization 없음.
- production 변경은 32 pure LOC의 기존 컴포넌트에 `direction` discriminant와 modifier class를 추가한 좁은 변경이다. dead code, broad catch, type suppression, one-off helper, parameter mutation, 새 의존성 없음.
- 유지보수 부담: modifier class와 CSS grid-area가 목적을 직접 표현하며 범위 이탈 없음.
- 별도 최신 code-review report에서 동일 skill-perspective coverage를 명시한 자료는 제공되지 않았다. 지시대로 본 gate의 직접 pass와 artifact 검증으로 보완했으며, 이는 성공 기준 실패 증거가 아니다.

## Verification

- `npm run lint`: PASS, exit 0 (`tsc --noEmit`).
- `npm run build -- --outDir /tmp/school-timer-gate-build.bKt0EE`: PASS, exit 0; 2151 modules transformed. 기존 chunk-size warning만 있음.
- capture dimensions: 1280×800.

## Checked artifact paths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-mirrored-destinations.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentSectionCard.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-between-cards-gate-review.md`

## Exact evidence gaps

- `omo ulw-loop status --json`를 실행할 수 없었다 (`omo: command not found`), 따라서 currentAttemptDir 대신 fallback evidence 경로를 사용했다.
- 이 변경 상태의 별도 1024px/1366px fresh capture는 제공되지 않았다. 해당 폭은 CSS constraint 검토로만 확인했다.
- 현재 변경 상태를 대상으로 `remove-ai-slops`/`programming` 관점을 명시한 별도 code-review report 또는 manual-QA matrix는 제공되지 않았다. 본 gate에서 diff/source를 직접 점검했다.
