# 실패 이야기 6색 릴레이 안전 리팩터링 계획

## TL;DR
> Summary:      실패 이야기 색상을 저장 데이터가 아닌 `createdAt + id` 기반의 정규 시간순 파생값으로 분리해 0~5의 여섯 톤을 배정하고, 릴레이가 같은 이야기의 톤을 계속 전달하도록 한다. 이전/다음 버튼은 아이콘만 보이되 현재의 명확한 접근성 이름과 네이티브 버튼 동작을 유지한다.
> Deliverables: 새 `failureStoryTone` 순수 모듈과 전용 테스트; 릴레이→메시지의 필수 tone prop; 여섯 파스텔 CSS 토큰/selector; 아이콘 전용 탐색 버튼; 1280×800 실화면 증거
> Effort:       Short
> Risk:         Medium - 순환 목록 길이가 6의 배수가 아닐 때 경계에 걸친 임의의 6개 창까지 모두 서로 다른 색으로 만드는 것은 6색만으로 불가능하므로, 기본/비경계 6개 창과 안정적 이야기 색상을 우선한다.

## Scope
### Must have
- `FailureStoryTone`을 `0 | 1 | 2 | 3 | 4 | 5`로 확장하고 색상 계산 책임을 `src/lib/failureStoryTone.ts`로 분리한다.
- 입력 배열 순서가 아니라 `createdAt` 오름차순, 동률이면 `id` 오름차순인 정규 시간순을 사용해 `index % 6`으로 톤을 배정한다. 이에 따라 최초 여섯 이야기와 기본 newest-first 릴레이의 최신 연속 여섯 이야기는 모두 다른 톤을 가진다.
- 전체 story collection에서 한 번 계산한 `story.id -> tone`을 `StudentFailureRelay`가 각 `StudentFailureMessage`에 필수 prop으로 전달한다. `relayOffset`, 애니메이션, 휠/스와이프/키보드 이동으로 카드 위치가 바뀌어도 tone은 바뀌지 않는다.
- 같은 저장 데이터를 재로딩하거나 입력 배열을 재정렬하거나 failure/lesson/updatedAt을 수정해도 각 story의 tone은 유지된다. 정상적인 최신 story 추가는 기존 시간순 인덱스를 바꾸지 않으므로 기존 tone도 유지된다.
- `data-story-tone="0"`부터 `"5"`까지 여섯 selector와 서로 구분되는 저채도 파스텔 토큰을 제공한다.
- 이전/다음 버튼의 보이는 `이전`, `다음` span을 제거하고 `ChevronLeft`, `ChevronRight`만 남긴다. `<button type="button">`, `aria-label="이전 이야기 보기"`/`"다음 이야기 보기"`, 장식 SVG의 `aria-hidden="true"`, Tab/Enter/Space 동작은 유지한다.
- 현재 작업 트리의 사용자 작성 변경을 기준선으로 보존한다. 특히 가로/세로 swipe, wheel, 방향키, 자동 릴레이, pending story, 3×2 카드 배치, 우측 rail을 되돌리지 않는다.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- `FailureStory`, `StudentLifeState`, Supabase payload, localStorage JSON에 `tone`/`colorIndex` 필드를 추가하지 않는다. migration, SQL, storage key, normalizer 변경도 금지한다.
- ID 해시 `% 6`만 적용하지 않는다. 안정성은 얻지만 임의의 첫 여섯 ID가 여섯 톤을 모두 쓴다는 계약을 보장하지 못한다.
- 현재 circular `getFailureRelayWindow` 동작을 비순환으로 바꾸거나 총 story 수에 맞춰 tone phase를 조정하지 않는다. 7~11개 story의 wrap 경계에서 모든 6-card window가 distinct여야 한다는 범위는 포함하지 않는다.
- 오래된 story 삭제/삽입까지 색상 불변을 약속하지 않는다. 저장 필드 없이 이 변경까지 보장하면 재배정 충돌 또는 persistence 변경이 필요하다. 이번 계약은 reorder/body edit/reload와 시간순 뒤에 추가되는 정상 작성 흐름이다.
- `AuctionPage.tsx`, `StudentFailureExhibitionPage.tsx`, `studentLife.ts`, Supabase 파일은 수정하지 않는다.
- 새 dependency, router, CSS-in-JS, 전역 design-system 리팩터링을 추가하지 않는다.
- 1024/1366 보조 화면을 1280×800·100% 기본 검증보다 먼저 튜닝하거나, 실제 학생 고마/응원/글 데이터를 QA에 사용하지 않는다.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node built-in test runner (`npm test`) 및 React SSR markup assertions
- QA policy: every task has agent-executed scenarios
- Evidence: `<attemptDir>/task-<N>-<slug>.<ext>` — under ulw-loop, `<attemptDir>` is the `currentAttemptDir` from `omo ulw-loop status --json` (`.omo/evidence/ulw/<session>/<goalId>/a<attempt>`); outside ulw-loop use `.omo/evidence/`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.
> 이 범위는 동일한 prop/selector를 연속 변경하는 좁은 기능이므로 충돌을 피하기 위해 3개의 원자 작업으로 유지한다.

Wave 1 (no dependencies):
- Task 1: 순수 6톤 배정 모듈과 전용 TDD 계약

Wave 2 (after Wave 1):
- Task 2: 릴레이 tone 전달 및 아이콘 전용 접근성 탐색 버튼; depends [1]

Wave 3 (after Wave 2):
- Task 3: 여섯 파스텔 selector와 정확한 viewport 시각 검증; depends [2]

Critical path: Task 1 -> Task 2 -> Task 3

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 2      | none                 |
| 2    | 1          | 3      | none                 |
| 3    | 2          | F1-F4  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. 시간순 6톤 파생 모듈을 TDD로 추출한다

  What to do: 먼저 현재 `src/lib/failureExhibition.test.ts`의 tone 영역에 `tone-1`~`tone-6`과 증가하는 `createdAt` fixture를 넣고 Set size 6을 요구하는 assertion을 추가해 기존 3톤 구현에서 실제 assertion failure red를 만든다(존재하지 않는 import/parse error red는 금지). red 출력을 저장한 다음 이 테스트와 기존 `src/lib/failureExhibition.test.ts:159-200`의 tone 전용 테스트를 새 `src/lib/failureStoryTone.test.ts`로 이동·확장한다. 새 API는 `FailureStoryTone = 0 | 1 | 2 | 3 | 4 | 5`, readonly `{ id, createdAt }` source, 그리고 `get(storyId): FailureStoryTone`을 반환하는 readonly `FailureStoryToneIndex`를 만드는 `createFailureStoryToneIndex(sources)`로 고정한다. 구현은 입력을 복사한 뒤 `createdAt` 오름차순과 `id` 오름차순 tie-break로 정렬하고, 아직 배정하지 않은 unique id에만 정규 unique 인덱스 `% 6`을 배정한다. 이 index는 생성 입력의 모든 id를 포함하므로 `get` 반환 타입은 undefined가 아니며, malformed duplicate id도 정규 시간순의 최초 배정을 공유한다. 기존 `src/lib/failureExhibition.ts:215-230`의 3톤 타입/ID 해시는 제거한다. 최종 전용 테스트 fixture는 최소 12개를 사용해 (a) 최초 여섯과 최신 연속 여섯이 각각 `[0..5]` 집합, (b) reorder 후 id별 동일, (c) failure/lesson/updatedAt 변경에 무관, (d) JSON 직렬화/재파싱과 동등한 reload 후 동일, (e) 원본 array/object 불변, (f) 같은 `createdAt`은 id tie-break로 결정됨, (g) duplicate id는 같은 tone을 공유함을 독립 assertion으로 고정한 뒤 최소 구현으로 green을 만든다.
  Must NOT do: `FailureStory`에 tone을 추가하거나 `studentLife.ts`/저장 경계를 건드리지 않는다. `failureExhibition.ts`의 profile/story CRUD 등 관련 없는 329 pure LOC를 이번에 재분해하지 않는다. missing lookup을 `?? 0`으로 숨기거나 non-null assertion/type assertion을 쓰지 않는다.

  Parallelization: Can parallel: NO | Wave 1 | Blocks: [2] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/lib/failureExhibition.ts:205-230` - story의 안정 identity/time 필드와 현재 3톤 구현; 이 블록만 tone 모듈로 이동한다.
  - Pattern:  `src/lib/failureExhibition.ts:278-291` - persistence normalizer/create가 명시 필드만 복원하며 duplicate id를 거부하는 경계.
  - Pattern:  `src/lib/failureExhibition.ts:335-352` - newest-first order와 6개 circular visible window; tone 함수는 이 window가 아닌 전체 stories를 입력으로 받는다.
  - Test:     `src/lib/failureExhibition.test.ts:159-200` - 같은 story의 안정 tone/reorder/body edit에 대한 기존 테스트 의도.
  - Test:     `src/lib/failureExhibition.test.ts:93-157` - 6개 window와 wrap 동작을 그대로 보존해야 하는 회귀 계약.
  - Test:     `src/lib/studentLife.test.ts:233-257` - failure story persistence shape/normalization 회귀 계약; tone 필드를 추가하지 않는 근거.
  - External: `https://nodejs.org/api/test.html` - 현재 `node:test` 기반 테스트 runner의 공식 계약.

  Acceptance criteria (agent-executable only):
  - [ ] red: `npm test -- --test-name-pattern='실패 이야기 6톤'`이 기존 3-tone 결과의 Set size가 6이 아니라는 assertion 때문에 non-zero로 실패하며 import typo/parse error로 실패하지 않는다; 출력을 `<attemptDir>/task-1-six-tone-red.txt`에 저장한다.
  - [ ] green: 같은 명령이 zero로 끝나고 12-story fixture의 각 id가 reorder/body edit/reload 전후 동일 tone이다.
  - [ ] 최초 여섯 및 canonical 최신 연속 여섯 tone을 `new Set(...).size === 6`으로 각각 검증한다.
  - [ ] 새 module이 `FailureStory` 전체가 아니라 readonly `{ id, createdAt }` 입력만 요구하고, 함수 실행 전후 `structuredClone(fixtures)` deep equality가 유지된다.
  - [ ] `rg -n "FailureStoryTone|createFailureStoryToneIndex" src/lib/failureExhibition.ts src/lib/failureStoryTone.ts src/lib/failureStoryTone.test.ts` 결과에서 tone 정의/계산은 새 module에만 존재하고 persistence type에는 필드가 없다.
  - [ ] `npm run lint`가 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 시간순 첫 여섯과 최신 연속 여섯은 각자 여섯 톤을 모두 쓴다
    Tool:     bash
    Steps:    `npm test -- --test-name-pattern='실패 이야기 6톤.*여섯'`
    Expected: 명령 exit 0; 두 fixture 모두 Set size 6 assertion 통과
    Evidence: <attemptDir>/task-1-six-tone.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: 입력 순서·본문 수정·reload가 tone을 바꾸지 않는다
    Tool:     bash
    Steps:    `npm test -- --test-name-pattern='실패 이야기 6톤.*(재정렬|수정|reload)'`
    Expected: 명령 exit 0; id별 tone map이 세 변형 모두에서 원본과 deepEqual
    Evidence: <attemptDir>/task-1-six-tone-stability.txt
  ```

  Rollback: 새 `src/lib/failureStoryTone.ts`/`.test.ts`만 제거하고 `src/lib/failureExhibition.ts:215-230`, `src/lib/failureExhibition.test.ts:159-200`를 작업 시작 시 patch와 동일하게 복원한다. 다른 dirty file은 건드리지 않는다.

  Commit: NO | Message: `refactor(failure-exhibition): derive six stable story tones` | Files: [`src/lib/failureStoryTone.ts`, `src/lib/failureStoryTone.test.ts`, `src/lib/failureExhibition.ts`, `src/lib/failureExhibition.test.ts`]

- [ ] 2. 릴레이가 필수 tone을 전달하고 탐색 버튼을 symbol-only로 만든다

  What to do: `StudentFailureRelay`가 전체 `relayStories`에서 Task 1의 `createFailureStoryToneIndex`를 호출하고, `displayedStories.map`에서 `toneIndex.get(story.id)`로 얻은 필수 `tone` prop을 `StudentFailureMessage`에 넘긴다. `StudentFailureMessageProps`에 readonly `tone: FailureStoryTone`을 추가하고 direct `getFailureStoryTone(story.id)` import/call을 제거해 `data-story-tone={tone}`만 렌더한다. 같은 SSR fixture를 offset/reorder로 렌더해 story별 `data-story-tone`이 이동 전후 동일함을 검증한다. toolbar에서는 보이는 `<span>이전</span>`/`<span>다음</span>`만 제거하고 현재 button, aria-label, title, icon, click direction을 유지한다. SSR test는 7-story markup에 접근성 이름 두 개가 존재하고 `>이전<`, `>다음<` visible text가 없으며 SVG가 `aria-hidden="true"`임을 검증한다.
  Must NOT do: 현재 사용자가 수정한 `ChevronLeft`/`ChevronRight`, `move(-1)`/`move(1)`, pointer x/y swipe, wheel, ArrowLeft/Right/Up/Down, interval/pause logic, toolbar의 7개 이상 조건을 변경하지 않는다. title만 accessible name으로 의존하지 않는다. tone을 `StudentFailureMessage` 내부에서 position/index로 다시 계산하지 않는다.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [3] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/components/student/StudentFailureRelay.tsx:59-76` - 전체 story list, displayed window, offset 이동의 현재 state seam.
  - Pattern:  `src/components/student/StudentFailureRelay.tsx:205-240` - keyed motion wrapper와 message prop 전달 위치; 여기서 전체 collection 기반 tone을 전달한다.
  - Pattern:  `src/components/student/StudentFailureRelay.tsx:245-255` - 현재 7개 이상에서만 보이는 이전/다음 버튼과 보이는 text 제거 위치.
  - API/Type: `src/components/student/StudentFailureMessage.tsx:13-24` - required readonly prop 계약을 추가할 interface.
  - Pattern:  `src/components/student/StudentFailureMessage.tsx:43-47` - direct ID hash 대신 전달받은 tone을 소비할 `data-story-tone` seam.
  - Test:     `src/lib/failureExhibition.test.ts:202-292` - SSR relay order, own-story inclusion, 6/7-story toolbar DOM 계약.
  - External: `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button` - icon-only native button은 명확한 accessible name이 필요하다.
  - External: `https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/` - focusable control의 accessible name과 `title` 비의존 원칙.
  - External: `https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label` - SVG-only button의 `aria-label` 및 decorative icon 예시.
  - External: `https://www.w3.org/WAI/ARIA/apg/patterns/carousel/` - 이전/다음 carousel control을 native button으로 유지하는 패턴.

  Acceptance criteria (agent-executable only):
  - [ ] red 후 green 순서로 `npm test -- --test-name-pattern='릴레이.*(톤|탐색 버튼)'`을 실행하고 각 출력을 `<attemptDir>/task-2-relay-red.txt`, `<attemptDir>/task-2-relay-green.txt`에 남긴다.
  - [ ] `StudentFailureMessageProps.tone`은 required readonly이고 `StudentFailureMessage.tsx`에는 story id 기반 계산 import/call이 없다.
  - [ ] 12-story fixture에서 offset을 바꾼 두 window의 공통 story id가 같은 `data-story-tone`을 렌더하고, default six markup은 tone 0~5를 각각 한 번 렌더한다.
  - [ ] 6-story markup에는 toolbar가 없고 7-story markup에는 `aria-label="이전 이야기 보기"`, `aria-label="다음 이야기 보기"`가 각각 한 번 존재한다.
  - [ ] `rg -n '<span>이전</span>|<span>다음</span>' src/components/student/StudentFailureRelay.tsx`가 결과 없음이고, 두 `Chevron*`은 `aria-hidden="true"`를 유지한다.
  - [ ] `npm run lint`와 `npm test -- --test-name-pattern='실패 릴레이|게시글 배경색|실패 이야기 6톤'`가 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 일곱 이야기의 탐색 버튼은 아이콘만 보이고 접근성 이름을 유지한다
    Tool:     bash
    Steps:    `npm test -- --test-name-pattern='릴레이.*탐색 버튼'`
    Expected: SSR markup에 두 aria-label/native button/decorative SVG가 있고 visible 이전/다음 span은 없음
    Evidence: <attemptDir>/task-2-symbol-buttons.txt   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: 카드가 window 위치를 바꿔도 story tone은 유지된다
    Tool:     bash
    Steps:    `npm test -- --test-name-pattern='릴레이.*톤.*이동'`
    Expected: 두 offset의 공통 story id별 `data-story-tone` 값이 전부 동일하고 누락 tone 없음
    Evidence: <attemptDir>/task-2-tone-movement.txt
  ```

  Rollback: `StudentFailureRelay.tsx`의 tone map/prop과 button span 제거만 되돌리고 `StudentFailureMessage.tsx`의 tone prop을 제거해 Task 1 API 이전 상태로 복원한다. 기존 swipe/arrow/rail dirty changes는 절대 되돌리지 않는다.

  Commit: NO | Message: `feat(failure-exhibition): keep tones stable through relay navigation` | Files: [`src/components/student/StudentFailureRelay.tsx`, `src/components/student/StudentFailureMessage.tsx`, `src/lib/failureExhibition.test.ts`]

- [ ] 3. 여섯 파스텔 스타일을 연결하고 정확한 1280×800에서 회귀 검증한다

  What to do: 먼저 Task 2 상태의 실제 화면에서 0~5 tone attribute가 렌더되어도 computed background Set size가 3 이하인 red visual assertion을 실행·저장한다. 이어 `src/index.css:12620-12639`의 기존 mint/coral/lavender 세 토큰을 유지·미세 조정하고, warm cream/sky/butter 계열에서 서로 분명히 구분되는 세 파스텔 토큰을 추가한다. `src/index.css:14123-14125`에 `[data-story-tone="3"]`, `"4"`, `"5"` selector를 추가한다. 색만 바꾸고 text contrast, border, hover/focus, expanded layout은 그대로 둔다. symbol-only toolbar에 맞춰 `src/index.css:14037-14056`의 button grid를 단일 아이콘 중앙 정렬로 축소하되 최소 `var(--apple-control-min)` hit target과 rail 폭을 유지한다. `npm run dev:stable`로 mock 서버를 띄우고 disposable localStorage fixture 12개를 주입한 뒤 실제 실패 전시관을 열어 exact 1280×800, browser 100%, `window.innerWidth === 1280`, `window.innerHeight === 800`를 먼저 증명한다. 기본 여섯 카드의 computed background가 6개 distinct인지 확인하고 탐색 후 공통 story의 computed background가 그대로인지 확인한다. 그 뒤에만 1024×800, 1366×800을 보조 확인한다.
  Must NOT do: 색상 검증을 hex 문자열 hardcode snapshot만으로 끝내지 않는다. viewport가 1075×672처럼 scale된 경우 CSS를 조정하거나 완료 처리하지 않는다. 생성 FAB, 응원, 카드 본문, 책장 진입 등 실제 data mutation control은 클릭하지 않는다. `src/index.css`의 failure 섹션 밖 token을 광범위하게 정리하지 않는다.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked by: [2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/index.css:12620-12639` - 현재 failure palette와 세 story tone token; 같은 token layer에 세 색을 추가한다.
  - Pattern:  `src/index.css:13793-13798` - 기존 책장의 six indexed color/data selector 관례.
  - Pattern:  `src/index.css:13958-14005` - exact 3×2 feed와 우측 rail geometry; six-color 변경에서 보존한다.
  - Pattern:  `src/index.css:14024-14056` - toolbar/button/icon sizing 및 focus/press rules.
  - Pattern:  `src/index.css:14110-14125` - message main background와 `data-story-tone` selector 소비 지점.
  - Pattern:  `src/index.css:14549-14619` - 1024급 및 767 이하, 낮은 높이 responsive rules.
  - API/Type: `src/lib/studentLife.ts:37-42,153-160,262-285` - disposable localStorage fixture shape와 실제 persistence 경계; QA 후 해당 disposable profile만 폐기한다.
  - Pattern:  `src/RootApp.tsx:15,37-60` - disposable 학생 entry를 선택하는 localStorage key.
  - Pattern:  `src/pages/AuctionPage.tsx:197-214,404-424` - 학생 failure 전시관 hash/navigation 흐름.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n 'data-story-tone="[0-5]"' src/index.css`가 0~5 selector를 각각 정확히 한 번 찾고, `npm run lint && npm test && npm run build`가 모두 exit 0이다.
  - [ ] exact primary viewport에서 `window.devicePixelRatio`와 무관하게 `innerWidth=1280`, `innerHeight=800`, browser zoom 100%가 증거에 기록된다.
  - [ ] `.student-failure-feed-window` 안 visible `.student-failure-message`가 정확히 6개이고 `getComputedStyle(.student-failure-message-main).backgroundColor`의 Set size가 6이다.
  - [ ] primary viewport에서 feed/cards/toolbar/FAB의 bounding boxes가 viewport와 gallery bounds 안에 있고 overlap, unintended page scroll, clipped icon이 없다.
  - [ ] 이전/다음 버튼의 accessible names가 유지되고 `innerText.trim() === ''`, SVG만 visible이며, Tab focus ring과 Enter/Space activation이 동작한다.
  - [ ] 다음 버튼으로 이동한 뒤 공통 five story ids의 `data-story-tone`과 computed background가 이동 전과 동일하다.
  - [ ] exact 1280×800 통과 후 1024×800 및 1366×800에서 horizontal overflow/overlap이 없고, `prefers-reduced-motion: reduce`에서도 즉시 이동하며 tone이 유지된다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 1280×800 기본 창에 여섯 파스텔 카드와 symbol-only controls가 안전하게 보인다
    Tool:     browser:control-in-app-browser
    Steps:    `npm run dev:stable`을 실행해 `http://127.0.0.1:3000`을 연다. 새 disposable browser tab에서 `school-timer-entry-number-v1='1'`과 `school-timer-student-life={letters:[],books:[],failureProfileAssignments:{},failureStories:[12개의 unique id/createdAt/failure/lesson/stamps:[]]}`를 설정하고 reload한다. role button name `실패 전시관과 책장 열기`를 클릭한다. device toolbar를 1280×800, zoom 100%로 지정한 뒤 `window.innerWidth`, `window.innerHeight`, `.student-failure-message` count, 각 `data-story-tone`, 각 main computed background, feed/toolbar bounding boxes, `document.documentElement.scrollWidth <= 1280`을 평가하고 full-page screenshot을 캡처한다.
    Expected: 1280×800/100%가 정확히 기록됨; 카드 6개; tone/background Set size 6; 두 toolbar button의 innerText는 빈 문자열이고 accessible name은 유지; clipping/overlap/page overflow 없음
    Evidence: <attemptDir>/task-3-1280x800.png   (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, .omo/evidence/ulw/<session>/<goalId>/a<attempt>)

  Scenario: 이동·reload·reduced-motion에서도 story 색상이 유지되고 데이터 mutation이 없다
    Tool:     browser:control-in-app-browser
    Steps:    같은 disposable tab에서 이동 전 visible story id/tone/background map과 localStorage fixture 문자열을 메모리에 보관한다. `다음 이야기 보기`에 focus 후 Enter를 보내 transition 완료 신호를 기다리고 공통 story map을 비교한다. reload 후 다시 전시관을 열어 id/tone map을 비교한다. `prefers-reduced-motion: reduce`를 emulate하고 Space로 한 번 이동해 다시 비교한다. 마지막에 localStorage fixture 문자열이 시작 값과 byte-for-byte 같은지 확인하고 tab을 닫는다.
    Expected: 모든 공통 story의 tone/background 동일; 접근성 버튼 동작; localStorage fixture 불변; 실제 응원/작성/화폐 mutation 요청 0건
    Evidence: <attemptDir>/task-3-stability.json
  ```

  Rollback: 추가한 tone 3~5 token/selector와 symbol-only에 필요한 toolbar sizing만 되돌린다. 현재 사용자가 만든 3×2 grid, rail, story font, 기존 tone 0~2, responsive rules는 복원 대상이 아니다.

  Commit: NO | Message: `style(failure-exhibition): add six pastel story backgrounds` | Files: [`src/index.css`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- 현재 작업 트리는 관련 사용자 변경을 포함해 dirty하므로 각 task의 `Commit: NO`를 따른다. F1-F4 승인 결과를 사용자에게 제시하고 Git commit에 대한 명시적 승인을 받은 뒤에만 위 메시지/파일 목록으로 선택적으로 stage·commit한다.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/failure-story-six-tone-relay.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
