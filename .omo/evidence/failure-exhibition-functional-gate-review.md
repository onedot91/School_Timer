# 실패 자랑소 전시 리디자인 기능·접근성 최종 게이트

- recommendation: **REJECT**
- goalId: `failure-exhibition-functional-gate`
- reportPathFallbackReason: `omo ulw-loop status --json` 실행 불가 (`omo: command not found`)

## blockers

1. `violatedCriterion`: **C13 — no data/schema changes**
   - observation: UI/모션 범위를 벗어나 새 localStorage marker를 추가하고, mock 모드 첫 로드 시 저장된 `failureStories`를 비운 뒤 전체 student-life 상태를 다시 저장한다. 이는 데이터 변경이 없다는 계약을 직접 위반하며, 기존 연습 데이터가 사용자 동작 없이 삭제된다.
   - evidencePointer: `src/lib/studentLife.ts:52`, `src/lib/studentLife.ts:165-167`, `src/lib/studentLife.ts:268-278`; 의도적으로 삭제 동작을 고정한 `src/lib/studentLife.test.ts:20-57`

## originalIntent

실패 자랑소를 정확한 1280×800에서 3×2 종이 전시로 다듬고, 릴레이를 X축으로만 움직이며 행 경계에서도 수평 퇴장·진입하도록 한다. 내부 종이만 ±0.4deg에서 280ms 이내로 안착하고, 오른쪽 버튼과 5.5초 자동 이동은 같은 오른쪽 방향이어야 한다. 상호작용·포커스·확장·메뉴·모달 동안 자동 이동을 멈추고, 키보드 및 reduced motion은 즉시 전환한다. 기존 접근성 및 데이터 스키마/내용은 보존한다.

## desiredOutcome

사용자는 1280×800 첫 화면에서 겹침이나 스크롤 없이 6장의 wire→clip→paper 전시를 보고, 버튼·자동·키보드로 예측 가능한 릴레이를 이용한다. 빈 상태와 작성 모달도 키보드/스크린리더로 사용할 수 있으며, 화면을 열었다는 이유로 저장 데이터가 변경되거나 삭제되지 않는다.

## userOutcomeReview

시각·모션·접근성 계약은 현재 소스와 제공된 최신 1280×800 증거에서 대체로 충족된다. 그러나 `loadStoredStudentLifeState`가 mock 모드 첫 로드에 기존 실패 이야기를 삭제하고 새 marker를 저장하므로, 데이터 무변경이라는 사용자 결과는 충족하지 못한다. 이 한 항목이 배포 차단 사유다.

## criterionReview

- C1 exact 1280×800 3×2 papers: PASS — `tmp/failure-exhibition-refined-1280x800-settled.png`은 1280×800이며 6장의 3×2 배치, 문서 내 클리핑/겹침 없음이 보인다. 제공 runtime 측정도 document 1280×800 및 6 cards를 보고한다.
- C2 outer relay X-axis only: PASS — `studentFailureRelayMotionVariants`는 `translateX`만 설정한다 (`src/components/student/studentFailureRelayMotion.ts:23-32`). 제공 matrix 측정은 y=0이다.
- C3 3↔4 horizontal boundary handoff: PASS — 두 개의 3-card row와 각 row의 clipped `AnimatePresence` 구조가 경계 카드를 수평 출입시킨다 (`StudentFailureRelay.tsx:202-240`, `index.css:13972-14008`). 최신 runtime 자료는 양방향 고정 Y 및 matrix y=0을 보고한다.
- C4 paper-only settle ±0.4deg→0 ≤280ms: PASS — 별도 inner wrapper와 rotate-only variant/0.28s transition (`StudentFailureRelay.tsx:217-237`, `studentFailureRelayMotion.ts:10-14,34-42`).
- C5 right button and 5.5s auto move right: PASS — 자동 상수는 right move와 동일하고 interval은 5,500ms (`StudentFailureRelay.tsx:26,134-140,251-255`; `studentFailureRelayMotion.ts:3-9`). 제공 runtime 방향 측정도 일치한다.
- C6 pause on hold/focus/expanded/menu/modal: PASS — 모든 상태가 `shouldPauseStudentFailureRelay`에 합쳐지고 interval effect가 중단된다 (`StudentFailureRelay.tsx:42-62,134-140,243-249`; `StudentFailureExhibitionPage.tsx:156-162`).
- C7 keyboard/reduced motion immediate: PASS — arrow key는 `move(..., false)`를 사용하고 reduced motion은 layout/entry/exit motion을 비활성화한다 (`StudentFailureRelay.tsx:181-191,203-218`; `index.css:14643-14651`).
- C8 wire→clip→paper visible: PASS — 최신 settled screenshot과 feed pseudo-wire, relay-item clip, paper DOM/CSS 순서에서 확인 (`index.css:13993-14038,14120-14149`).
- C9 fixed two-line rows do not overlap: PASS — 두 행의 최소 높이와 12px runtime gap 증거 (`index.css:14187-14238`). 최신 screenshot에서도 겹침이 보이지 않는다.
- C10 empty state accessible: PASS — 상태 텍스트는 `role=status`, 유일 작성 버튼은 명시적 label 및 dialog state를 제공 (`StudentFailureExhibitionPage.tsx:148-184`). 단, 제공 empty screenshot은 1075×672 scaled preview라 primary viewport 증거로 사용하지 않았다.
- C11 compose modal accessible: PASS — dialog semantics/focus management은 `FailureComposerDialog`와 `useModalFocus`에 유지되고, 정확한 1280×800 compose screenshot에서 clipping이 없다.
- C12 tests/lint/build: PASS — 직접 재현: `npm test` 287/287, `npm run lint` 성공, `npm run build` 성공(기존 bundle-size warning만 존재).
- C13 no data/schema changes: **FAIL** — blocker 1 참조.

## removeAiSlopsAndProgrammingPass

- 직접 검토 결과, `failureStoryOverflow.test.ts`는 CSS 선언 문자열을 파싱해 구현을 그대로 확인하고, `failureExhibition.test.ts`의 class-name assertions도 DOM 구현에 밀접하다. 실제 브라우저 결과를 독립적으로 보장하는 테스트는 아니므로 false confidence 위험이 있으나, 해당 성공 기준들은 최신 runtime/screenshot 및 production inspection으로 별도 확인되어 NOTE다.
- `studentLife.test.ts`의 새 테스트는 요청된 제거가 아니라 데이터 삭제 동작 자체를 고정한다. C13 위반을 보호하는 회귀 테스트이므로 성공 근거가 아니라 blocker 증거다.
- 새 motion/state 추출은 production에서 재사용되는 좁은 순수 계약이며 불필요한 parsing/normalization은 발견하지 못했다.
- 새 `any`, type suppression, non-null assertion, debug code는 확인되지 않았다. 타입체크와 빌드도 성공했다.
- 기존 `.omo/evidence/failure-ui-system-gate-review.md`는 skill-perspective 항목을 포함하지만 현재 코드와 다른 "whole keyed motion window" 구조를 서술해 일부 stale하다. 최신 relay 보고서 두 개는 현 구조를 설명하지만, 어떤 보고도 이번 C13 `no data/schema changes` 계약을 적용하지 않았다. 보고서의 기존 APPROVE는 이번 직접 게이트를 대체하지 못한다.

## checkedArtifactPaths

- `src/components/student/StudentFailureExhibitionPage.tsx`
- `src/components/student/FailureComposerDialog.tsx`
- `src/components/student/StudentFailureRelay.tsx`
- `src/components/student/studentFailureRelayMotion.ts`
- `src/components/student/studentFailureRelayState.ts`
- `src/index.css`
- `src/lib/studentLife.ts`
- `src/lib/studentLife.test.ts`
- `src/lib/failureExhibition.test.ts`
- `src/lib/failureRelayCycle.test.ts`
- `src/lib/failureRelayMotion.test.ts`
- `src/lib/failureRelayPause.test.ts`
- `src/lib/failureStoryOverflow.test.ts`
- `tmp/failure-exhibition-refined-1280x800-settled.png`
- `tmp/failure-exhibition-refined-compose-1280x800.png`
- `tmp/failure-exhibition-refined-empty-1280x800.png` (supplementary only; CSS viewport 1075×672)
- `.omo/evidence/failure-ui-system-gate-review.md`
- `.omo/evidence/relay-horizontal-motion-gate-clone-fidelity.md`
- `.omo/evidence/relay_button_direction_motion_gate-clone-fidelity.md`

## exactEvidenceGaps

- 빈 상태의 primary QA는 exact 1280×800·100% 증거가 없다. 제공 파일은 1075×672 scaled preview이므로 AGENTS.md 기준상 primary 증거로 승인하지 않았다. 이는 empty-state exact viewport를 별도 성공 기준으로 명시하지 않은 현재 계약에서는 NOTE다.
- 자동 이동, hover/focus/expanded/menu/modal pause, keyboard 및 reduced-motion에 대한 통합 브라우저 자동화 artifact는 없다. production 흐름과 제공 runtime 측정으로 확인했지만 일부 unit test는 순수 helper만 검사한다.
- 코드 리뷰 보고서에는 이번 명시 계약인 C13 데이터 무변경 검토가 없다.

