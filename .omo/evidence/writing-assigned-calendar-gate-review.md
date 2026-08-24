# Writing Assigned Calendar Gate Review

## recommendation

REJECT (user-facing verdict: REVISE)

## blockers

- `violatedCriterion`: `[evidence] V1 — layout-affecting UI must be observed at exact 1280×800 CSS viewport and 100% preview scale after the final edit.`
  - `evidencePointer`: `.omo/evidence/writing-assigned-calendar/teacher-writing-calendar-render.jpg` is 1254×784, and the supplied capture description confirms only a 1280×800 toolbar override rather than `window.innerWidth === 1280` and `window.innerHeight === 800` at 100%.
  - Observation: the required primary visual QA cannot be reproduced from the supplied artifact. The screenshot looks unclipped, but project instructions explicitly disallow treating a scaled or dimension-mismatched capture as primary QA evidence.

## originalIntent

교사 설정의 `글쓰기` 화면에서 달력을 열었을 때 이미 글쓰기 주제가 배정된 날짜를 시각적·접근성 상태로 표시하고, 다른 날짜를 선택해도 기존 배정 날짜 표시가 유지되게 한다.

## desiredOutcome

- 배정 날짜에는 선택 여부와 무관하게 주황 점과 `글쓰기 주제 할당됨` 접근성 이름이 유지된다.
- 선택, 오늘, 배정 상태가 서로 구별된다.
- 달력은 실제 DOM UI이며 Escape와 바깥 누르기로 닫힌다.
- 팝오버는 viewport 안에 배치되고 필수 1280×800·100% 및 1024/1366 보조 폭에서 잘림·겹침·의도치 않은 overflow가 없다.
- 배정 날짜는 저장된 글쓰기 편지와 현재 배정 상태에서 유도된다.

## userOutcomeReview

기능 구현 자체는 요구를 충족한다. `TimerPage.tsx`는 저장된 `studentLife.letters`에서 추출한 날짜와 현재 `dailyWriting.assignment.dateKey`를 합치고, `TeacherWritingCalendar.tsx`는 이를 선택 상태와 독립된 `Set`으로 렌더링한다. 2026-08-25의 주황 점, 선택된 주황 채움, 2026-08-24의 오늘 윤곽은 캡처에서 구별된다. 날짜 버튼의 접근성 이름에도 배정 문구가 붙는다. Escape는 팝오버를 닫고 트리거로 초점을 돌리며, 바깥 pointer down도 닫는다. 고정 위치 팝오버는 초기 열림 시 viewport gutter 안으로 clamp된다. 모션은 140ms 단일 진입뿐이고 reduced-motion에서 제거된다.

최종 승인을 막는 것은 제품 결함이 아니라 필수 primary viewport 증거다. 실제 캡처 크기 1254×784는 프로젝트가 요구하는 정확한 CSS viewport 1280×800 증명이 아니다. 또한 1024px 및 1366px 보조 폭의 최신 캘린더-open 증거도 제공되지 않았다. 보조 폭 누락은 NOTE이나, primary viewport 누락은 blocker다.

## direct remove-ai-slops / programming review

- 실제 diff, production code, tests를 직접 검토했다.
- 요청된 제거만 확인하는 deletion-only test, 자연어 문구 pin, snapshot, tautology, output-derived expected, 구현 미러링 테스트는 발견하지 못했다.
- `getDailyWritingAssignedDateKeys` 테스트는 두 번 발행한 실제 편지 결과에서 중복 없는 두 날짜를 검증하므로 요청 제거 확인용이나 tautological test가 아니다.
- 달력 컴포넌트 분리는 포털, 포커스 복귀, 외부 클릭, 날짜 그리드, viewport 배치를 함께 소유하는 실제 UI 경계다. 불필요한 pass-through extraction으로 보지 않았다.
- 저장 payload 정규화는 외부 저장 경계에서 수행되어 과잉 방어가 아니다.
- `dailyWriting.ts`는 285 pure LOC로 skill의 250 LOC 기준을 넘지만, 이 스타일/유지보수 이슈는 이번 명시 성공 기준 실패를 입증하지 않으므로 NOTE다.
- 기존 대형 `TimerPage.tsx`와 CSS도 이번 변경의 명시 기준에 연결되지 않아 blocker가 아니다.

## verification

- `npm test`: PASS, 192 passed / 0 failed.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS; 기존 성격의 Vite chunk-size warning만 있음.
- Static/security scan: N/A; 요청된 달력 UI 변경에 대응하는 별도 scanner가 제공되지 않음.
- Fresh capture direct inspection: completed.

## checkedArtifactPaths

- `.omo/evidence/writing-assigned-calendar/teacher-writing-calendar-render.jpg`
- `src/components/teacher/TeacherWritingCalendar.tsx`
- `src/components/teacher/TeacherWritingSettings.tsx`
- `src/index.css`
- `src/lib/dailyWriting.ts`
- `src/lib/dailyWriting.test.ts`
- `src/pages/TimerPage.tsx`
- `DESIGN.md`
- `.omo/evidence/daily-writing-gate-review.md`
- `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-9d03e581-c6bb-47d6-8575-107b0f62c492.png` (context only; not used as pixel target)

## exactEvidenceGaps

- Missing exact post-edit proof of browser scale 100%, `window.innerWidth === 1280`, and `window.innerHeight === 800` with the calendar open.
- Missing latest calendar-open secondary checks at 1024px and 1366px widths; NOTE, because primary evidence is the explicit completion gate.
- No dedicated code review report or manual QA matrix for this narrow calendar change was found. Direct source/diff/slop review and reproduced quality gates support functional completion, so this is not independently blocking.
- No executor notepad path was supplied or found for this goal.
- `omo ulw-loop status --json` could not run because `omo` is unavailable; the required fallback report path was used.
