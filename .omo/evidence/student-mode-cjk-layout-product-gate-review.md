# Student Mode CJK/Layout/Product Gate Review

- recommendation: REJECT
- originalIntent: 현재 학생 모드 리디자인을 375/768/1280의 최신 캡처로 독립 검수해, 인계 전 정보 중복·모바일 오버플로·한국어 조판·시각 위계 결함을 찾는다.
- desiredOutcome: 개요와 스토어에 불필요한 반복이 없고, 모바일 요일 탭이 의도적인 탭으로 보이며, 375px에서도 모든 한국어와 액션이 잘림 없이 읽히고, 밝고 차분한 Apple 계열 위계와 기존의 따뜻한 녹색/크림/캐릭터 정체성이 유지된다.

## User outcome review

개요와 스토어의 정보 구조는 간결해졌고, 스토어의 중복 eyebrow는 보이지 않는다. 요일 탭은 375px에서도 개별 테두리·라벨·선택 상태가 명확해 진행 막대로 보이지 않으며, 스크롤바도 노출되지 않는다. 768px와 1280px의 한국어 텍스트에는 관찰 가능한 clipping, orphan, baseline collision이 없다. 전 화면은 light-only 표면, 낮은 그림자, 크림 배경과 녹색 강조, 캐릭터 이미지로 요청한 정체성을 유지한다.

그러나 375px 미션 캡처에서 페이지가 수평으로 밀려 상단 뒤로가기 버튼이 왼쪽 화면 밖으로 잘린다. 동일한 `StudentHeader`의 스토어 375px 캡처에서는 버튼이 정상적으로 보이므로 의도적인 모바일 축약이 아니다. 이 결함은 375px에서 카드와 액션을 포함한 모바일 레이아웃이 오버플로 없이 온전히 보여야 한다는 기준을 직접 위반한다.

## Blockers

- violatedCriterion: CHECK-3 / mobile overflow and 375px legibility
  - observation: 375px 미션 화면의 상단 뒤로가기 컨트롤 대부분이 왼쪽 viewport 밖으로 잘리고 초록색 둥근 가장자리만 보인다.
  - evidencePointer: `/private/tmp/school-timer-qa/final2-student-missions-375.png` 상단 좌측; 비교 `/private/tmp/school-timer-qa/final2-student-store-375.png` 상단 좌측

## Notes

- CHECK-1: PASS — 개요는 `미션`/`고마 사용` 목적과 액션만 제시하고, 스토어는 페이지 제목 `고마 사용`, 잔액, 섹션 제목 `경매장`이 서로 다른 정보 계층이다. 중복 eyebrow는 없다.
- CHECK-2: PASS — 375px 스토어의 월~목 탭은 pill형 개별 컨트롤과 선택 테두리/색으로 탭임이 분명하며 진행 막대처럼 보이지 않는다. scrollbar는 보이지 않는다.
- CHECK-3: REJECT — 위 blocker 외에는 캡처에서 한국어 clipping/orphan/baseline collision을 발견하지 못했다.
- CHECK-4: PASS — 차분한 light-only 카드 표면과 충분한 여백, 녹색/크림 팔레트, 캐릭터가 함께 유지된다.
- remove-ai-slops direct pass: diff에 삭제만 검증하는 테스트, tautological/implementation-mirroring test, 불필요한 parser/normalizer/extraction은 없다. 스토어 제목 추가는 페이지 내 경매 영역의 실제 정보 계층이며 중복 eyebrow가 아니다.
- programming direct pass: 이번 검수는 read-only이고 테스트 추가는 없다. 변경 diff에서 이번 시각 기준을 직접 위반하는 유지보수성/범위 이탈은 확인하지 못했다. 단, 모바일 수평 오버플로는 실제 사용자 결과 결함이다.

## Checked artifacts

- `/private/tmp/school-timer-qa/final2-student-overview-375.png`
- `/private/tmp/school-timer-qa/final2-student-overview-768.png`
- `/private/tmp/school-timer-qa/final2-student-overview-1280.png`
- `/private/tmp/school-timer-qa/final2-student-store-375.png`
- `/private/tmp/school-timer-qa/final2-student-store-768.png`
- `/private/tmp/school-timer-qa/final2-student-store-1280.png`
- `/private/tmp/school-timer-qa/final2-student-missions-375.png`
- `/private/tmp/school-timer-qa/final2-student-missions-768.png`
- `/private/tmp/school-timer-qa/final2-student-missions-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentHeader.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStorePage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- current `git diff -- src`

## Exact evidence gaps

- `omo ulw-loop status --json` could not run because `omo` is unavailable in this environment, so the required fallback report path was used.
- No interaction/motion capture was supplied; this gate is limited to the user-requested fresh static screenshots.
- No separate current code-review report or manual QA matrix for this final2 capture set was supplied. Direct screenshot, source, diff, remove-ai-slops, and programming passes support the findings above.
