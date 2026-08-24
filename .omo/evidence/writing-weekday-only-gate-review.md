# Gate Review — writing-weekday-only

- recommendation: **APPROVE**
- reviewType: DESIGN-SYSTEM AND FUNCTIONAL INTEGRITY (read-only)
- confidence: **HIGH**

## originalIntent

교사용 `글쓰기` 주제는 월요일부터 금요일까지만 할당한다. 토·일은 달력에 보이되 포인터와 키보드로 활성화할 수 없어야 한다. UI를 우회한 주말 발행도 persistence 전에 실패로 반환하고 성공으로 보고하지 않아야 하며, 금요일 다음 기본 날짜는 월요일이어야 한다.

## desiredOutcome

- 주말은 보이는 네이티브 disabled 컨트롤이다.
- UI handler와 domain boundary가 주말 입력을 모두 차단한다.
- 우회 입력은 `false`와 평일 전용 상태를 남기고 Supabase/localStorage persistence를 호출하지 않는다.
- 금요일 뒤 기본 활동 날짜는 월요일이다.
- selected/today/assigned/weekend 상태와 CJK 라벨이 명확하고 clipping/overlap이 없다.

## successCriteria

- C1: 월요일~금요일만 선택 가능하다.
- C2: 토요일·일요일은 보이되 포인터 및 키보드 선택이 비활성화된다.
- C3: UI를 우회한 주말 발행도 persistence 전에 거부되고 실패로 보고된다.
- C4: 금요일 다음 기본 글쓰기 날짜는 월요일이다.
- C5: 주말/평일, selected/today 상태, CJK 가독성, clipping/overlap에 제품 차단 결함이 없다.

## userOutcomeReview

요청한 결과를 충족한다. `TeacherWritingCalendar`는 모든 날짜를 렌더링하고 주말 버튼에 실제 `disabled`를 설정한다. `aria-label`도 `주말 선택 불가`를 알리며, `TeacherWritingSettings`의 발행 버튼도 주말에 비활성화된다.

이전 blocker는 수정되었다. `TimerPage.publishDailyWriting`은 주말이면 평일 전용 상태를 설정하고 `false`를 반환한다. 이 guard는 draft 생성, `setIsWritingPublishing`, domain publish, `updateSharedSettings`, localStorage 저장보다 앞에 있어 주말 persistence 경로에 진입할 수 없다. Domain `publishDailyWritingAssignment`도 독립적으로 주말 draft를 기존 state/studentLife 그대로 반환한다.

최종 JPEG에서 일·토 열은 낮은 대비, 선택일 8월 25일은 주황 채움, 오늘 8월 24일은 별도 초록 윤곽으로 구분된다. 팝오버와 주요 한글 라벨은 잘리거나 겹치지 않는다.

## findings

- PASS C1/C2: `src/components/teacher/TeacherWritingCalendar.tsx:165-184`의 `disabled={isWeekend}`가 pointer/keyboard activation을 차단한다. `TeacherWritingSettings.tsx:54-57`도 주말 publish를 막는다.
- PASS C3: `src/pages/TimerPage.tsx:8684-8688`의 early return이 persistence 전 실패를 보장한다. 첫 persistence 가능 지점은 `updateSharedSettings` 8701행 또는 local writes 8714-8715행이다. `src/lib/dailyWriting.ts:170-180`도 주말을 독립 거부한다.
- PASS C4: `src/lib/dailyWriting.ts:125-130`이 다음 평일까지 전진하고 `src/lib/dailyWriting.test.ts:230-241`이 금요일 2026-08-28 → 월요일 2026-08-31을 검증한다.
- PASS C5: fresh capture를 원본으로 직접 확인했다. 주말 muted state, selected/today 분리, 한글 가독성, clipping/overlap 모두 허용 가능하다.
- PASS [remove-ai-slops direct pass]: 토·일 테스트는 각각 domain 결과의 state/studentLife 불변이라는 관찰 가능한 계약을 검증한다. deletion-only, 제거만 검증, tautology, 구현 미러링, prose/snapshot pin, 출력으로 기대값 재계산은 없다. 금→월 테스트는 독립 literal 기대값을 쓴다. UI·handler·domain guard는 서로 다른 boundary를 보호하므로 불필요한 중복이 아니다.
- PASS [programming direct pass]: 새 의존성, type suppression, 불필요한 parsing/normalization/extraction, dead helper, 범위 밖 추상화가 없다. 공유 `isDailyWritingWeekday`가 날짜 규칙을 한 곳에 둔다.
- NOTE [evidence]: 별도 code review report가 없어 그 보고서의 skill-perspective/overfit coverage는 확인할 수 없다. 본 게이트의 직접 pass와 재현 증거가 completion을 지지하므로 blocker가 아니다.
- NOTE [evidence]: fresh capture는 1095×821이며 exact 1280×800·100% 증거는 아니다. 이번 명시 기준과 제공 캡처에서 요구 상태 및 layout 결함이 없어 blocker로 연결하지 않는다.

## whatIsGood

- UI, application handler, domain의 세 boundary가 각 우회 경로를 보호한다.
- 이전 false-success가 persistence 전 명확한 early return으로 제거됐다.
- 토요일과 일요일을 별도 테스트로 고정해 회귀 신뢰가 정확해졌다.
- native `disabled`, muted state, accessible label이 동일 판정에서 파생된다.

## blockers

없음.

## blocking

**NO.**

## checkedArtifactPaths

- `.omo/evidence/writing-weekday-only/teacher-writing-weekends-disabled-final.jpg` — 직접 확인, JPEG 1095×821, SHA-256 `cde572810c1c1970bd2a6b61a38f81167abec8726b32edf588d74dd69f708b98`
- `.omo/evidence/writing-weekday-only-gate-review.md` — 이전 REJECT/C3 blocker 확인 후 갱신
- `src/components/teacher/TeacherWritingCalendar.tsx`
- `src/components/teacher/TeacherWritingSettings.tsx`
- `src/lib/dailyWriting.ts`
- `src/lib/dailyWriting.test.ts`
- `src/pages/TimerPage.tsx`
- `src/index.css`
- `DESIGN.md`
- `package.json`

## reproducedValidation

- `npm test`: PASS, 195/195
- `npm run lint`: PASS (`tsc --noEmit`)
- `npx vite build --outDir /private/tmp/school-timer-gate-build --emptyOutDir`: PASS; 기존 chunk-size warning만 있음
- `git diff --check`: PASS
- source-order audit: PASS; weekend early return precedes all publishing persistence calls

## exactEvidenceGaps

- executor evidence report, code review report, manual QA matrix, notepad path가 입력에 없다.
- evidence 디렉터리에는 JPEG 두 장만 있고 browser DOM assertion 로그는 없다. 사용자 제공 browser evidence는 현재 native `disabled` 소스와 일치한다.
- `omo ulw-loop status --json`은 `command not found`라 currentAttemptDir를 확인할 수 없었다. fallback `.omo/evidence/writing-weekday-only-gate-review.md`를 사용했다.
- exact 1280×800·100% primary viewport 캡처는 없다.

## recommendation

**APPROVE**
