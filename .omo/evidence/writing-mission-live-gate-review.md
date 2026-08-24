# Writing Mission Live Gate Review

- recommendation: REJECT
- user-facing verdict: REVISE
- review type: DESIGN-SYSTEM AND FUNCTIONAL INTEGRITY
- review mode: read-only; only this required gate artifact was written

## Original Intent

오늘 날짜의 글밥 편지가 실제 학생에게 존재할 때, 현재 `dailyWriting.assignment`가 없어도 학생 미션 페이지의 일일 미션에 글밥짓기 미션이 표시되어야 한다.

## Desired Outcome

- 오늘 글밥 편지가 있으면 일일 미션 수가 4개로 증가한다.
- 네 번째 실제 DOM 카드가 기존 `StudentMissionCard` 패턴으로 렌더링된다.
- 미완료 상태는 `진행 중`, 보상은 `+25 고마`, 제목은 `글밥짓기`, 동작은 `글밥 편지 확인`이다.
- 최종 레이아웃은 프로젝트 필수 기준인 CSS viewport `1280×800`, preview scale `100%`에서 관찰되어야 한다.

## User Outcome Review

기능 결과는 충족한다. 기준 캡처에는 일일 미션 3개만 보이지만 현재 빌드 캡처에는 네 번째 글밥짓기 카드가 보인다. 이 카드는 이미지 합성이 아니라 `StudentMissionsPage`가 `StudentMissionCard`를 조건부 렌더링하는 실제 DOM 구현이다. `AuctionPage`는 오늘 assignment가 있거나 현재 학생의 오늘 날짜 글밥 편지가 있으면 `hasCurrentDailyWritingMission`을 true로 만든다. 편지 ID 정규식은 날짜와 학생 번호 전체 형식을 요구하므로 다른 날짜 및 일반 편지를 오인하지 않는다.

현재 캡처에서 카드 수 4, 상태 `진행 중`, 보상 `+25 고마`, 제목 `글밥짓기`, 버튼 `글밥 편지 확인`이 모두 확인되며 기존 미션 카드와 동일한 디자인 시스템을 사용한다. 눈에 보이는 겹침, 잘림, 비정상 스크롤은 없다.

그러나 현재 빌드 증빙은 JPEG `1095×821`이고 런타임에서 확인된 CSS viewport도 `1095×820`뿐이다. 프로젝트의 명시적 완료 조건인 `1280×800` 및 `100%` 최종 QA를 증명하지 못하므로 제품 결함이 아닌 evidence blocker로 REVISE한다.

## Blockers

1. violatedCriterion: `PRIMARY-VIEWPORT-1280x800-100`
   - tag: `[evidence]`
   - observation: 최종 구현이 필수 CSS viewport `1280×800`, preview scale `100%`에서 잘림·겹침·의도치 않은 스크롤 없이 동작한다는 증빙이 없다.
   - evidencePointer: `.omo/evidence/writing-mission-live/student-missions-current-preview.jpg` (`1095×821` JPEG); supplied DOM evidence states CSS viewport `1095×820` only; project `AGENTS.md` primary viewport completion rule.

## Direct Functional Checks

- `src/lib/dailyWriting.ts`: `hasDailyWritingLetterForDate`는 완전한 글밥 편지 ID 패턴에서 날짜를 추출해 정확히 비교한다.
- `src/pages/AuctionPage.tsx`: 오늘 assignment 또는 현재 학생에게 보이는 오늘 날짜 글밥 편지 중 하나가 있으면 미션을 활성화한다. 완료 여부도 같은 현재 날짜의 보상 기록으로 계산한다.
- `src/components/student/StudentMissionsPage.tsx`: 조건부 실제 DOM `StudentMissionCard`를 렌더링하고 카드 수 및 entrance index도 함께 조정한다.
- `src/components/student/StudentMissionCard.tsx`: 기존 상태, 보상, 버튼 및 article 구조를 그대로 재사용한다.
- `src/lib/dailyWriting.test.ts`: 오늘/다른 날짜를 구분하는 좁은 회귀 테스트가 추가됐다. 삭제-only, 제거 확인, tautology, 구현 결과 재계산, 과도한 mock, production extraction은 아니다. 다만 helper 단위 테스트만으로 React 연결을 증명하지는 않으며 실제 화면 캡처와 DOM 관찰이 그 간극을 보완한다.

## Remove-AI-Slops / Programming Pass

- 불필요한 추상화, 중복 파서, 과도한 정규화, dead code, debug residue, type suppression, `any`, 비어 있는 catch, 범위 밖 리팩터링 없음.
- 새 helper는 UI가 편지 존재 여부만 필요로 하므로 전체 assignment 객체를 합성하지 않고 최소 boolean seam을 제공한다.
- 테스트는 요청된 제거 자체를 확인하지 않고 날짜별 존재 동작을 구분한다. 과잉 테스트나 허위 신뢰를 만드는 assertion은 발견하지 못했다.
- 변경은 4개 파일, `+37/-14`; 기능 범위 밖 유지보수 부담이나 새 의존성 없음.
- 별도 code review report가 이 작업 evidence 경로에 없어 동일 skill-perspective coverage를 문서에서 확인할 수 없었다. 본 gate의 직접 pass가 코드 및 테스트를 독립적으로 확인했으므로 이것만으로는 blocker가 아니다.

## Reproduced Verification

- `npm test`: PASS, 197/197
- `npm run lint`: PASS (`tsc --noEmit`)
- `npm run build`: PASS; 기존 chunk-size warning만 있음
- `git diff --check`: PASS

## Checked Artifact Paths

- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-10aada99-86ac-429d-85eb-877159edc979.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/writing-mission-live/student-missions-current-preview.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/dailyWriting.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/dailyWriting.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionsPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentMissionCard.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentLife.ts`

## Exact Evidence Gaps

- `1280×800` CSS viewport 및 `100%` preview scale을 동시에 입증하는 최종 캡처/DOM measurement가 없다.
- 이 작업 전용 code review report, manual QA matrix, notepad는 발견되지 않았다. 직접 검토와 제공된 fresh DOM/capture가 기능 기준을 충분히 뒷받침하므로, 명시적으로 필요한 primary viewport 증빙 외에는 blocker로 분류하지 않는다.
- reference와 current의 viewport/composition이 달라 image-diff JSON은 없으며, 요청대로 두 이미지를 직접 검사했다.

## Good Aspects

- stale assignment와 학생에게 이미 전달된 편지 사이의 실제 불일치를 루트 조건에서 복구한다.
- 일반 편지나 과거/미래 날짜 글밥 편지를 오늘 미션으로 오인하지 않는다.
- 기존 카드 컴포넌트와 보상 상수를 재사용해 상태·보상·action 패턴이 일관된다.
- 현재 증빙 픽셀에서는 네 번째 카드 및 전체 섹션에 겹침이나 잘림이 보이지 않는다.
