# Student overview balance overlap — gate review

- recommendation: APPROVE
- verdict: PASS
- reviewType: design-system and functional integrity, read-only

## originalIntent

학생 overview 하단 3열에서 중앙 잔액 카드 내용이 폭을 초과해 오른쪽 `고마 쓰기` 카드와 겹치는 문제를 제거한다.

## desiredOutcome

중앙 잔액 카드의 세 그룹이 카드 내부에 모두 들어가고, 중앙 열과 양쪽 destination 카드가 서로 침범하지 않으며, 페이지 가로 overflow나 인접 카드의 잘림이 없어야 한다.

## successCriteria

- SC-1: 1075×605 재현 viewport에서 중앙 잔액 카드 내부 및 오른쪽 destination 카드와의 overlap이 없어야 한다.
- SC-2: 같은 화면에서 페이지 수평 overflow, 인접 카드 텍스트/버튼 잘림 또는 새로운 시각적 충돌이 없어야 한다.
- SC-3: 구현 token과 DESIGN.md 문서가 동일해야 한다.

## userOutcomeReview

PASS. `--student-overview-balance-width`의 최소값이 20rem에서 22rem으로 증가했고, 실제 compact Chromebook layout의 3열 grid 중앙 track에 이 token이 직접 사용된다. 제공된 실제 캡처에서 중앙 잔액 카드의 `1번`, `사용 가능 고마`, `예약 고마` 세 그룹은 카드 내부에 있으며 오른쪽 카드와 시각적으로 분리된다. 런타임 수치상 중앙 dock는 약 351.996px, 내부 summary는 scrollWidth 350/clientWidth 350으로 자체 overflow가 없다. 중앙 예약 영역 오른쪽 710.635px과 오른쪽 purchase 카드 왼쪽 725.807px 사이에는 약 15.172px 간격이 있어 overlap=false와 일치한다. 캡처상 좌우 카드의 제목과 액션도 잘리지 않고 horizontal page overflow=false다.

## directSlopAndProgrammingPass

- 변경은 기존 design token 한 값과 대응 문서 한 줄에 한정되어 새 추상화, 파서, 정규화, 방어 코드, dead code, 중복 또는 테스트를 추가하지 않는다.
- 삭제-only/제거 검증/동어반복/구현 미러링 테스트가 추가되지 않았다.
- 증상 위치의 임시 transform/margin 보정이 아니라 실제 3열 grid 중앙 track이 소비하는 shared token의 최소 폭을 조정하므로 이번 레이아웃 원인과 직접 연결된다.
- 현재 diff에는 다른 작업의 변경이 다수 섞여 있으나, 본 리뷰의 명시 범위는 DESIGN.md와 src/index.css의 해당 token 변경 및 지정 캡처다.

## blockers

없음.

## notes

- [evidence] 제공된 fresh actual capture는 1075×605 한 viewport/상태뿐이다. 프로젝트 기준의 1024, 1280, 1366px 전체 matrix는 이 리뷰 입력에 없지만, 이번 요청이 명시한 재현 viewport의 성공 기준 위반을 입증하지 않으므로 blocker가 아니다.
- [evidence] 이 수정 전 동일 상태의 before capture, 별도 code-review report, manual QA matrix, executor report, notepad path는 제공되지 않았다. 직접 artifact 및 런타임 수치로 SC-1~SC-3을 확인했으므로 blocker가 아니다.
- [product] 캡처에서 눈에 띄는 인접 회귀는 없다.

## checkedArtifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` (lines 15504, 16662-16825)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md` (line 85)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-balance-overlap-fixed.jpg` (actual 1076×605 image; reported browser viewport 1075×605)
- `git diff -- DESIGN.md src/index.css`

## exactEvidenceGaps

- 1024×605, 1280×800, 1366px 폭에서의 별도 실제 캡처/측정 없음.
- 수정 전 동일 fixture의 geometry 측정 없음.
- 별도 code review report/manual QA matrix/notepad artifact 없음.

