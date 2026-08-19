# Clone / Design-system Fidelity Review — personal-question-reward-10

## Verdict

- recommendation: **APPROVE**
- confidence: **HIGH**
- blockers: 없음

## 검토 범위와 증거

- 최신 렌더 캡처 5장(모두 JPEG 서명 확인, `2026-08-20 04:58 +0900`):
  - `.omo/evidence/personal-question-reward-10/current/missions-1024.jpg` (860×672)
  - `.omo/evidence/personal-question-reward-10/current/missions-1280.jpg` (1075×672)
  - `.omo/evidence/personal-question-reward-10/current/missions-1366.jpg` (1147×672)
  - `.omo/evidence/personal-question-reward-10/current/missions-effective-512.jpg` (430×672)
  - `.omo/evidence/personal-question-reward-10/current/missions-weekly-effective-512.jpg` (430×672)
- 소스와 변경 사항:
  - `src/lib/weeklyMission.ts:1-53`
  - `src/components/student/StudentMissionsPage.tsx:136-153`
  - `src/components/student/StudentMissionCard.tsx:25-74`
  - `src/index.css:14741-14882`, `src/index.css:16304-16337`, `src/index.css:18307-18332`
  - `api/weekly-missions.ts:173-177`
  - `src/lib/weeklyMission.test.ts:41-52`
  - `DESIGN.md:175`

## Findings

### CRITICAL

없음. 카드·버튼·보상 pill은 `StudentMissionCard`가 실제 DOM으로 렌더하며, 이미지나 `background-image`로 UI를 대체한 흔적이 없습니다.

### HIGH

없음. 개인 질문 보상은 단일 상수 `PERSONAL_QUESTION_WEEKLY_REWARD = 10`에서 정의되고, 정의 배열·로컬 보상 지급·API fallback 응답이 `getWeeklyMissionRewardAmount`를 통해 같은 값에 연결됩니다. Classword 두 유형은 공용 `CLASSWORD_WEEKLY_REWARD = 5`를 유지합니다.

### MEDIUM

없음. 1024/1280/1366 캡처에서 세 주간 카드가 정렬되어 있고, 개인 질문은 `+10 고마`, 나머지 두 카드는 각각 `+5 고마`로 명확히 분리됩니다. effective 512에서는 단일 열로 재배치되어, 한글 제목·상태 chip·보상 pill·행동 버튼이 잘리거나 겹치지 않습니다.

### LOW

없음.

## 적합성 확인

- `StudentMissionsPage`는 `WEEKLY_MISSION_DEFINITIONS.map(...)`으로 세 카드를 생성하고 `mission.rewardAmount`를 재사용 `StudentMissionCard`에 전달합니다.
- `StudentMissionCard`는 `formatCurrency` 결과를 실제 텍스트 노드로 표시합니다. 캡처상의 `+10 고마`/`+5 고마`는 해당 라이브 컴포넌트의 출력과 일치합니다.
- 스타일은 기존 CSS 변수(`--apple-*`, `--student-*`, `--font-*`)와 재사용 카드/상태/pill 클래스에 기반합니다. 이번 보상 변경을 위해 일회성 색·간격·레이아웃 스타일이 추가되지 않았습니다.
- 반응형 격자는 넓은 화면 3열, 중간 폭 2열, 좁은 폭 1열로 정의되어 있어 캡처와 일치하며 가로 오버플로 증거가 없습니다.

## 결론

요청한 `신문에 개인 질문하기 = 10 고마`, 두 Classword 주간 미션 = `5 고마`가 실제 컴포넌트와 보상 정의에 일관되게 반영되었습니다. 현재 증거에서 수정이 필요한 디자인시스템·시각 결함은 발견하지 못했습니다.
