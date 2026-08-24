# Gate Review — writing-random-fill

## recommendation

REJECT

## originalIntent

교사 글쓰기 설정에 단일 `랜덤 채우기` 버튼을 제공해, 선별된 하나의 묶음에서 `글쓰기 주제`, `꼭 넣을 낱말`, `낱말 뜻`을 함께 채운다. 활동 날짜는 유지하고 현재 묶음의 즉시 반복은 피한다.

## desiredOutcome

교사가 실제 DOM 버튼을 한 번 누르면 서로 대응하는 세 값이 한 번의 React 이벤트 처리 안에서 함께 바뀌고, 선택 날짜는 그대로 유지된다. 연속 클릭 시 직전 topic과 같은 curated 묶음은 다시 선택되지 않는다. 화면은 기존 warm classroom/rice-paper 디자인과 조화를 이루며 필수 `1280×800`, 100% viewport에서 clipping, overlap, unintended overflow가 없어야 한다.

## userOutcomeReview

- 기능 구현은 의도와 일치한다. `TeacherWritingSettings.tsx`의 `fillRandomPrompt`는 `pickDailyWritingPrompt(topic)`이 반환한 동일 객체에서 세 필드를 연속 갱신하며 `dateKey`를 변경하지 않는다. React click event의 state updates는 batch 처리된다.
- `dailyWritingPrompts.ts`는 15개의 curated matching bundle을 상수로 보관하고, 현재 topic을 trim한 값과 같은 후보를 제외한다. 따라서 정상적인 `Math.random()` 범위에서 즉시 같은 topic이 반복되지 않는다.
- 버튼은 `type="button"`인 실제 DOM button이고, 아이콘은 `aria-hidden`이며 가시 텍스트 `랜덤 채우기`가 있다. focus-visible 스타일도 존재한다.
- 캡처에서는 버튼, 날짜, topic/word/meaning이 안정적으로 정렬되고 기존 cream/orange/brown 언어와 조화를 이룬다. 보이는 영역에서 가로 clipping이나 overlap은 없다.
- 그러나 fresh JPEG는 1095×821이다. 프로젝트의 필수 primary QA 기준인 정확한 CSS viewport `1280×800`, toolbar scale 100%, `window.innerWidth/innerHeight` 증명이 없다. 이 기준은 레이아웃 작업 완료 전에 반드시 확인하도록 명시되어 있어 visual/layout 승인은 불가하다.

## blockers

1. **violatedCriterion:** `PROJECT-QA-1280X800-100`
   - **observation:** 필수 primary viewport 및 100% scale에서 최종 구현의 clipping/overlap/scroll 상태를 확인한 증거가 없다.
   - **evidencePointer:** `.omo/evidence/writing-random-fill/teacher-writing-random-filled.jpg`는 실제 1095×821 JPEG (`file`/ImageMagick 확인); AGENTS.md의 정확한 `1280×800`·`100%` 최종 확인 요구.

## notes

- `[product]` curated data, atomic matching update, date preservation, immediate-repeat avoidance, DOM semantics에서 차단 이슈는 발견하지 못했다.
- `[evidence]` 제공 runtime 서술은 코드와 일치하지만 독립적인 DOM interaction recording/automated component test는 없다. 이는 위 필수 viewport blocker 외에는 별도 stated criterion 위반으로 보지 않았다.
- `[evidence]` 전용 code review report/manual QA matrix/notepad는 입력에서 제공되지 않았고 evidence 디렉터리에도 발견되지 않았다. 직접 코드·테스트·캡처 검토가 기능 완료를 지지하므로 독립 blocker로 삼지 않았다.
- 빌드는 기존 large-chunk warning을 출력했지만 성공했다. 요청 범위의 실패 기준이 아니므로 blocker가 아니다.

## remove-ai-slops / programming direct pass

- 불필요한 production extraction, parser/normalizer, wrapper, dead code, broad catch, type suppression은 이 기능 범위에서 발견하지 못했다.
- `pickDailyWritingPrompt` 추출은 UI에서 랜덤 선택 규칙을 분리하고 deterministic random source를 제공해 테스트 가능한 실제 seam이므로 needless abstraction이 아니다.
- 테스트는 현재 후보 제외와 같은 curated object 반환을 검증한다. 삭제만 확인하거나 구현을 그대로 재계산하는 tautology는 아니다. 다만 세 개의 non-empty assertion은 bundle 상수의 완전성을 얕게 확인하며, 유지보수 부담이나 false confidence가 success criterion을 깨는 수준은 아니다.
- production code는 readonly 타입과 `as const satisfies`를 사용하며 `any`, suppression, non-null assertion을 추가하지 않았다.

## reproducedChecks

- `npm test`: PASS — 196/196
- `npm run lint`: PASS — `tsc --noEmit`
- `npm run build`: PASS — Vite build, existing chunk-size warning only
- `git diff --check`: PASS
- JPEG inspection: 1095×821, visible layout reviewed

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/teacher/TeacherWritingSettings.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/dailyWritingPrompts.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/dailyWritingPrompts.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/writing-random-fill/teacher-writing-random-filled.jpg`

## exactEvidenceGaps

- 브라우저 toolbar scale 100% 증거 없음.
- 최종 구현에서 `window.innerWidth === 1280`, `window.innerHeight === 800` 증거 없음.
- 위 정확한 viewport에서 clipping, overlap, unintended scrolling, first-screen overflow가 없다는 최종 캡처/측정 없음.
