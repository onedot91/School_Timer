# Today Friend Category Control — Gate Review

- recommendation: **APPROVE**
- reviewMode: read-only final gate (production files unchanged)
- originalIntent: 오늘의 친구 > 추천하기에서 네이티브 드롭다운 팝업이 아래 입력과 제출 버튼을 가리는 오류를 제거한다.
- desiredOutcome: 추천 종류를 영화/책/음악/음식 네 개의 즉시 선택 가능한 버튼으로 제공하고, 선택 상태·접근성·자동 저장·제출 payload를 보존하며 정확히 1280×800에서 입력 및 제출 UI가 겹치거나 스크롤되지 않는다.

## Success criteria

- C1: 네이티브 `select`가 추천 종류 UI에서 제거되어야 한다.
- C2: 영화/책/음악/음식 네 버튼이 있고 한 개의 선택 상태가 명확히 표현되어야 한다.
- C3: 각 선택 컨트롤은 `type="button"`과 `aria-pressed`를 갖는 접근 가능한 버튼이어야 한다.
- C4: 기존 `category` 상태, 기기 자동 저장, 추천 제출 payload 및 제출 흐름이 보존되어야 한다.
- C5: 정확히 1280×800에서 문서/필드 스크롤, 겹침, 첫 화면 overflow 없이 입력과 제출 버튼이 보여야 한다.

## User outcome review

사용자 관점의 오류는 해소되었다. 두 1280×800 캡처에서 네이티브 팝업 없이 네 버튼이 카드 안에 고정되어 있고, 책/영화 선택 상태가 각각 시각적으로 구분된다. 추천명 입력, 추천 이유, 제출 버튼이 동시에 보이며 겹침이나 잘림이 없다. `metrics.json`은 네 상태 전환 모두에서 정확히 하나의 `aria-pressed="true"`, `nativeSelectCount: 0`, document/fields overflow 0을 기록한다.

## Checked artifacts

- `src/components/student/TodayFriendMissionForm.tsx`
- `src/components/student/StudentTodayFriendPage.tsx`
- `src/index.css` (추천 버튼/폼 레이아웃 관련 selector)
- `src/lib/todayFriendMissionFormPresentation.test.ts`
- `src/lib/todayFriendLocalStore.test.ts`
- `tmp/visual-qa/today-friend-category-control/recommendation-book-1280x800.jpg`
- `tmp/visual-qa/today-friend-category-control/recommendation-movie-1280x800.jpg`
- `tmp/visual-qa/today-friend-category-control/metrics.json`
- `package.json`

## Reproduced evidence

- C1 PASS: source contains no recommendation `<select>`; metrics reports `nativeSelectCount: 0`; both screenshots show inline buttons only.
- C2 PASS: source maps four literal categories; metrics reports `categoryButtonCount: 4` and transitions for 영화/책/음악/음식 with exactly one pressed item per state. Book and movie screenshots independently show the corresponding selected styling.
- C3 PASS: source lines defining category controls use `<button type="button" aria-pressed={category === option.value}>`; containing group has an accessible Korean label; CSS has `:focus-visible` styling.
- C4 PASS: button click calls `setCategory(option.value)` and marks editing; autosave effect passes the same `category`; `buildPayload()` emits the same `category` in recommendation payload; submit still sends the recommendation and then calls `onSave(payload, true)`. Parent `saveMission` routes `true` to `submitStudentTodayFriendMission`.
- C5 PASS: both supplied images are exactly 1280×800. Metrics records viewport 1280×800, document overflow `{horizontal: 0, vertical: 0}`, fields overflow `{horizontal: 0, vertical: 0}`, reason bottom 646.04, actions top 709.43 and bottom 763.03, proving positive separation and in-viewport submission visibility.
- `npm run lint`: PASS (`tsc --noEmit`, exit 0).
- Targeted test command: PASS, 15 tests / 0 failures (`todayFriendMissionFormPresentation`, `todayFriendLocalStore`, `todayFriend`).

## Direct remove-ai-slops / programming pass

- Production change for the category selector is minimal: one constant category list, one mapped button group, direct state update, and localized CSS. No new dependency, parser, normalization layer, helper, type escape hatch, dead branch, or needless abstraction was introduced for this control.
- The component is 191 pure LOC, below the 200 healthy threshold and 250 defect ceiling.
- The presentation test contains a deletion-oriented assertion (`doesNotMatch(<select)`) and implementation-detail regex checks. This is overfit/slop-style evidence and would provide limited behavioral confidence by itself. It is a NOTE, not a blocker, because runtime transition metrics, screenshots, direct source tracing, typecheck, and related tests independently establish C1–C5.
- No excessive new test set or production extraction was found for this control.

## Report coverage and evidence gaps

- No task-specific executor report, code-review report, manual-QA matrix, or notepad path was supplied/found for this exact goal.
- Therefore no external code-review report exists that explicitly repeats the `remove-ai-slops` and `programming` checks. Direct gate review above covers those perspectives and supports completion; the missing reports are not required by C1–C5.
- The supplied metrics file is an artifact rather than a reproducible capture script. Its claims were cross-checked against source and both images. This is a NOTE, not a stated-criterion failure.

## Blockers

None.

## Notes

- The worktree contains many unrelated changes; this review approves only the requested recommendation category control outcome, not the entire worktree.
- The selected test file also covers unrelated Today Friend presentation changes. Those are outside this gate's approval scope.
