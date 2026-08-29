# Card text stability gate review

- recommendation: APPROVE
- blockers: []

## originalIntent

카드 본문을 눌렀을 때 실패 문장과 다짐의 줄바꿈 또는 표시량이 바뀌지 않고, 글자가 항상 같은 배치로 유지되어야 한다.

## desiredOutcome

- 카드 본문은 상호작용 컨트롤이 아니다.
- 본문 클릭으로 확장 상태나 CSS 변형이 생기지 않는다.
- 응원 메뉴, 포인터·포커스, 탐색 버튼에 따른 자동 릴레이 일시정지는 유지된다.

## userOutcomeReview

APPROVE. `StudentFailureMessage`의 본문은 `button`에서 이벤트 없는 `div`로 변경되었고 확장 상태/콜백/접근성 토글 문구가 제거됐다. 릴레이의 일시정지 계산은 응원 메뉴, 포인터, 포커스, 외부 모달, 탐색 누름 상태로 유지되며 제거된 확장 상태에 의존하지 않는다. 1280×800 증거에서 모든 카드가 같은 고정 2줄 규칙을 사용하며 잘림·겹침·레이아웃 점프는 보이지 않는다.

## checkedArtifacts

- `src/components/student/StudentFailureMessage.tsx:22-76`
- `src/components/student/StudentFailureRelay.tsx:42-76,137-143,220-235`
- `src/components/student/studentFailureRelayState.ts:1-15`
- `src/index.css:14209-14261`
- `src/lib/failureExhibition.test.ts:63-78`
- `src/lib/failureStoryOverflow.test.ts:25-45`
- `src/lib/failureRelayPause.test.ts:1-20`
- `tmp/failure-card-text-stability-1280x800.jpg` (1280×800 JPEG)
- targeted test run: 298 passed, 0 failed
- `git diff --check`: clean

## directRemoveAiSlopsAndProgrammingPass

- 프로덕션 변경은 기존 확장 상태와 클릭 핸들러를 삭제한 최소 경로로, 새 추상화나 호환 계층을 만들지 않았다.
- 테스트는 삭제 사실만 세는 테스트에 머물지 않고 실제 정적 마크업 계약(`div`, 토글 레이블 부재)과 CSS의 고정 줄바꿈 계약을 분리해 확인한다.
- `failureStoryOverflow.test.ts`의 CSS 문자열 검사는 구현 결합도가 있으나 이번 사용자 가시 계약을 직접 보호하며 차단 사유는 아니다.
- 타입 억제, `any`, 불필요한 정규화/파서, 테스트 전용 프로덕션 추출은 발견되지 않았다.

## evidenceGaps

- 정적 마크업 테스트는 실제 포인터 클릭 이벤트를 재생하지 않는다. 다만 본문 노드에 클릭 핸들러가 없고 버튼도 아니며 확장 상태/CSS 선택자가 코드베이스에서 완전히 제거된 것을 직접 확인해 기능 실패 근거는 없다.
- 응원 메뉴 일시정지는 순수 함수의 `isStampMenuOpen` 분기와 릴레이 호출부로 확인했지만, 해당 분기만을 독립적으로 고정하는 테스트는 없다. 현재 구현 실패를 나타내는 증거는 아니므로 NOTE로 기록한다.
