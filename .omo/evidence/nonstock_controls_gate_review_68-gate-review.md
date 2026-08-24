# Non-stock controls final gate review 68

## recommendation

APPROVE

## blockers

없음.

## originalIntent

증권/종목 아이콘 작업은 중단하고, 비증권 화면의 좁은 접근성·상호작용 개선만 안전하게 반영한다. 검토 범위는 Sudoku 설정 모달의 호출 요소 포커스 복귀, TimerPage 유틸리티 패널 네 쌍의 `aria-controls`/`id`, 설정 disclosure의 키보드 포커스 표시, 비활성 삭제 버튼의 hover 상태 제거다.

## desiredOutcome

- Sudoku 설정 모달을 닫으면 모달을 연 실제 요소로 포커스가 돌아간다.
- TimerPage의 화폐·유튜브·도서관·질문 제출 현황 버튼이 자신이 제어하는 패널을 명시한다.
- 설정 disclosure 요약 요소가 키보드 포커스를 명확히 표시한다.
- 비활성 시간표 삭제 버튼은 hover 시 활성 가능한 것처럼 보이지 않는다.
- 이 배치로 새 사용자 노출 문구, 불필요한 추상화·의존성·테스트가 추가되지 않는다.

## userOutcomeReview

요청 범위를 충족한다. `StudentMissionsPage`는 열기 직전 `document.activeElement`를 `HTMLElement`로 좁혀 ref에 저장하고 기존 `useModalFocus`의 `returnFocusRef` 경로를 사용한다. 해당 훅은 cleanup에서 연결 상태와 disabled 상태를 확인한 뒤 `focus({ preventScroll: true })`를 호출하므로 포커스 복귀 경로가 실제로 연결되어 있다.

TimerPage의 네 trigger와 네 panel ID는 각각 일대일로 일치하고 중복되지 않는다. 최종 수정 후 각 `aria-controls`는 대응 패널이 열린 경우에만 출력되므로 조건부 DOM 마운트와도 일치한다. CSS 두 규칙은 기존 선택자에 최소한으로 추가되었고 레이아웃이나 표시 문구를 변경하지 않는다. 범위 내 diff에는 새 visible text가 없다.

## checkedArtifactPaths

- `src/pages/StudentMissionsPage.tsx`
- `src/lib/useModalFocus.ts`
- `src/pages/TimerPage.tsx`
- `src/index.css`
- `.omo/evidence/nonstock_controls_code_review_68-code-review.md` — 존재하지 않음; 아래 직접 검토로 보완

## exactSourceEvidence

- `StudentMissionsPage.tsx`: `sudokuSettingsTriggerRef`, `returnFocusRef: sudokuSettingsTriggerRef`, 모달 open 직전 active element 캡처.
- `TimerPage.tsx`: `timer-currency-panel`, `timer-youtube-panel`, `timer-library-panel`, `timer-question-submission-panel`의 trigger/panel 쌍. 각 ID는 한 번만 선언되며 `aria-controls={is...Open ? '...' : undefined}`로 대응 패널의 조건부 마운트와 동기화됨.
- `index.css`: `.settings-disclosure > summary:focus-visible`에 3px focus outline과 offset, `.slot-delete:disabled:hover`에 투명 border/background 및 disabled 색상 복원.

## finalStateReaudit

- 리뷰 요청 수정 후 현재 source를 다시 확인했다.
- 화폐, 유튜브, 도서관, 질문 제출 현황의 네 `aria-controls`는 모두 각 open state가 `true`일 때만 존재한다.
- 네 대상 panel은 동일 open state의 조건부 렌더링 안에서 마운트된다. 닫힌 상태에서 존재하지 않는 ID를 참조하는 관계가 제거됐다.
- 증권/종목 아이콘 파일은 본 재검토에서 열거나 판정하지 않았다.

## automatedEvidenceReproduced

- 최종 수정 후 `npm test`: PASS — 157 tests, 157 passed, 0 failed.
- 최종 수정 후 `npm run lint`: PASS — `tsc --noEmit`.
- 최종 수정 후 `npm run build`: PASS — Vite production build. 기존 500kB 초과 chunk 경고만 존재.
- 최종 수정 후 `git diff --check`: PASS.

## removeAiSlopsAndProgrammingReview

- 직접 `omo:remove-ai-slops`와 `omo:programming` 기준으로 범위 내 production diff와 검증을 재검토했다.
- 새 helper, wrapper, parser, normalization, dependency, type suppression이 없다.
- 변경은 기존 훅과 기존 DOM 구조를 재사용하는 최소 선언적 수정이다.
- 요청 제거만 고정하는 deletion-only 테스트, 구현을 그대로 복제하는 테스트, tautological 테스트, visible-copy pinning 테스트가 추가되지 않았다.
- 별도 code-review 보고서는 없지만 직접 검토와 재현된 전체 test/type/build/diff-check가 완료 근거를 제공한다.

## exactEvidenceGaps

- 이 배치 전용 브라우저 E2E/포커스 이동 자동화 테스트는 없다. 기존 훅의 연결 경로, 정적 DOM 매핑, 전체 157개 테스트 및 타입/빌드 검증으로 보완되며 명시 성공 기준 위반은 아니다.
- 정확한 1280×800·100% 신규 시각 캡처는 제공되지 않았다. 이번 범위는 레이아웃 변경이 아닌 ARIA/ref 및 focus/disabled 상태 스타일 변경이므로 승인 차단 사유로 보지 않는다.
- 공유 worktree에는 범위 밖 변경이 다수 존재한다. 본 판정은 위 네 항목의 정확한 source hunk만 대상으로 하며 증권/종목 아이콘 변경은 검토하지 않았다.
