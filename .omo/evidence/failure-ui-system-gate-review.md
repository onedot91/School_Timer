# Failure Exhibition UI — Final Gate Review

- recommendation: APPROVE
- blockers: []

## originalIntent

연습 모드의 기존 실패 이야기만 한 번 초기화하고, 빈 상태를 기존 전시 시스템과 일관되게 표현하며, 여섯 이야기의 고유 톤과 아이콘 전용 탐색을 유지하고, 릴레이 전환을 카드별 이동이 아닌 전체 6장 창의 수평 이동으로 바꾸는 것.

## desiredOutcome

운영/공유 데이터와 실패 이야기 외 학생 생활 데이터는 보존된다. 빈 전시는 기존 벽·와이어·클립·종이·우측 레일 안에서 하나의 작성 행동만 제공한다. 여섯 카드의 톤은 이동 후에도 이야기 ID별로 안정적이고 서로 다르다. 릴레이 탐색은 아이콘만 보이며, 전환 중 두 6장 창이 동일한 세로 좌표에서 수평으로 교대한다.

## userOutcomeReview

요청 결과를 충족한다. `loadStoredStudentLifeState`는 `mock` 모드에서 새 reset marker가 없을 때만 `failureStories`를 비우고 즉시 상태와 marker를 저장한다. `clearPracticeFailureStories`는 letters, books, failureProfileAssignments의 참조를 보존한다. production/readonly 공유 경로에는 초기화를 적용하지 않는다. 빈 상태 스크린샷은 기존 전시 벽과 레일을 보존하면서 단일 걸린 종이와 `첫 이야기 걸기` 하나만 표시한다. 릴레이 코드는 현재 6장 전체를 하나의 keyed `motion.div`로 이동시키며, 중간 프레임 증거에서 두 창의 y 및 행 top이 동일하다. 안정된 화면은 여섯 고유 톤과 아이콘 전용 이전/다음 버튼을 보여 준다.

## checkedArtifacts

- `src/components/student/StudentFailureRelay.tsx`
- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/index.css`
- `src/lib/studentLife.ts`
- `src/lib/failureExhibition.test.ts`
- `src/lib/studentLife.test.ts`
- `DESIGN.md`
- `tmp/failure-empty-audit-1280x800.png`
- `tmp/failure-empty-audit-1024x800.png`
- `tmp/failure-empty-audit-1366x800.png`
- `tmp/failure-empty-audit-640x800.png`
- `tmp/failure-relay-final-settled-1280x800.png`
- `tmp/failure-relay-final-keyboard-mid-1280x800.png`
- reproduced: `npm run lint` PASS
- reproduced: `npm test` PASS (277/277)
- reproduced: `npm run build` PASS (bundle-size warning only)
- `git diff --check` PASS

## criterionReview

- C1 practice reset: PASS — mock-only, marker-gated one-time reset; other student-life fields preserved; future stories survive after marker.
- C2 empty-state system consistency: PASS — exact 1280×800 evidence plus 1024/1366/640 variants show no clipping or duplicate creation control.
- C3 six stable distinct tones: PASS — production tone index is story-ID based; tests cover six uniqueness and stability under reorder/body change/new story; runtime evidence covers 3+ moves.
- C4 icon-only navigation: PASS — visible toolbar contains chevrons with accessible labels and no visible 이전/다음 text.
- C5 whole-window horizontal relay: PASS — one keyed motion window owns all six items; synchronized enter/exit variants are horizontal; runtime mid-transition geometry confirms both windows share y=111 and row tops 139/472.

## removeAiSlopsAndProgrammingPass

- NOTE: `failureExhibition.test.ts` assertions for `student-failure-feed-window-motion` presence and `student-failure-relay-item-motion` absence mirror implementation/class deletion rather than directly proving motion behavior. They are not blockers because C5 is independently proven by inspected production structure and runtime mid-transition evidence.
- NOTE: source modules exceed the external skill's preferred 250 pure-LOC ceiling, but this is pre-existing project structure and not a stated success criterion; no scope-drift refactor is warranted by this gate.
- No new `any`, type suppression, non-null assertion, debug logging, dead wrapper, or unnecessary production normalization was found in the reviewed diff.

## evidenceGaps

- No automated browser test asserts mid-transition group geometry; current C5 proof relies on the supplied exact-viewport runtime artifact and measurements plus direct code inspection.
- The reset test covers the pure field-preservation helper, not the localStorage marker sequence end-to-end. Direct code inspection establishes the one-time behavior; this does not fail a stated criterion.
- `omo ulw-loop status --json` was unavailable (`omo: command not found`), so the required fallback report path was used.
