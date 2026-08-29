# Student rapid-click warning — final gate review

- recommendation: APPROVE
- blockers: []

## originalIntent

학생 화면에서 한 버튼을 장난처럼 연속으로 누르는 행동을 감지해 경고하되, 정상 입력과 교사/진입 화면에는 영향을 주지 않는다.

## desiredOutcome

- 같은 활성 버튼의 pointer click 8회가 2초 창 안에서 발생하면 8번째 동작을 막고 경고한다.
- 다른 버튼 또는 시간 경과는 카운트를 초기화한다.
- keyboard-generated click은 제외한다.
- 학생 화면에만 적용하고 교사/진입 화면은 제외한다.
- 경고는 접근 가능한 `alertdialog`이며 확인 후 원래 버튼으로 초점을 돌린다.

## userOutcomeReview

요청 결과를 충족한다. 순수 추적 로직은 동일 target identity와 2,000ms 창을 사용하고 8번째에만 `shouldWarn`을 반환한 뒤 상태를 초기화한다. React capture guard는 활성 `HTMLButtonElement`만 추적하고 `detail === 0` keyboard click 및 ignore-marked 확인 버튼을 제외하며, 경고 시 8번째 click을 `preventDefault`/`stopPropagation`한다. `RootApp`은 학생 분기에만 guard를 배치한다. 경고는 기존 modal focus helper를 통해 초기 확인 버튼 초점, focus trap, dismiss 후 source button 초점 복귀를 제공한다.

최신 1280×800 이미지에는 잘림·겹침·문서 overflow 없이 중앙 경고가 표시되며 한국어 문단은 단어 단위 두 줄로 보인다. 전달된 브라우저 재현 결과는 8회 좌표 click → alertdialog 정확히 1개, 초기 초점 `알겠어요`, dismiss 후 source stock button 복귀, Enter 8회 → modal 없음이다.

## direct remove-ai-slops / programming pass

- Production code is narrowly scoped: one pure tracker, one shared student wrapper, one routing seam. No unnecessary parser/normalizer/extraction or dependency was introduced.
- Tests cover the state-machine contract (threshold/block point, different-target reset, elapsed-window reset) with independent timestamps and target identities. They are not deletion-only, tautological, prose-pinning, or implementation-mirroring tests.
- No `any`, type suppression, unsafe cast, new dependency, or unrelated refactor is present.
- The two unit tests do not directly prove DOM behavior, but the fresh browser evidence covers the requested user-visible interaction and accessibility paths; this is not a blocking criterion gap.

## checkedArtifacts

- `src/lib/studentRapidClick.ts`
- `src/lib/studentRapidClick.test.ts`
- `src/components/student/StudentRapidClickGuard.tsx`
- `src/RootApp.tsx`
- `src/index.css`
- `DESIGN.md`
- `/private/tmp/student-rapid-click-warning-1280x800.png` (verified 1280×800 and visually inspected)
- `src/lib/useModalFocus.ts`
- current `git diff` and `git diff --check`

## evidenceStatus

- Supplied fresh browser QA after final CSS edit: PASS for exact 1280×800 viewport/document, no overflow, pointer threshold, single dialog, initial focus, focus restoration, keyboard exclusion, and Korean two-line wrapping.
- Supplied automated evidence before final CSS edit: `npm run lint` PASS; 301/301 tests PASS; `npm run build` PASS.
- Final CSS rebuild is assigned to the root reviewer and was not independently rerun in this subreview.

## exactEvidenceGaps

- No current-task code-review report or manual-QA matrix path was supplied or found. This does not block approval because the direct gate pass covers programming/slop criteria and the concrete browser evidence covers every stated user-visible criterion.
- `omo ulw-loop status --json` could not run because `omo` is unavailable, so the required fallback report path was used.
