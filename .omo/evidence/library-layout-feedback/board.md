# Library failure-board integration evidence

Recorded: 2026-09-05 (Asia/Seoul)

## Route consolidation and callback reuse

- Scenario: each previously released library route renders `StudentLibraryPage`; legacy `library` and `library-bookstore` begin with the physical failure board open, while `library-bookshelf` begins in the same game without opening it.
- Invocation: `npm run lint`
- Binary observable: exit status `0`; TypeScript accepted the unified three-route `StudentLibraryPage` props, including the existing create/stamp callbacks and `initialFailureBoardOpen`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board.md`

## Embedded bulletin board content

- Scenario: the embedded exhibition renders the cork-board dialog, title, close control, empty/create content, and no standalone `student-header` or bookshelf navigation.
- Invocation: `node --import tsx --test src/lib/failureExhibition.test.ts src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryRouteState.test.ts src/lib/canvasLibraryPlacement.test.ts`
- Binary observable: `tests 57`, `pass 57`, `fail 0`; includes `도서관 게시판 모드는 기존 실패 전시 기능만 포함하고 별도 페이지 머리말을 만들지 않는다`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board.md`

## Physical board availability and placement safety

- Scenario: the full library world exposes the failure board as an independently reachable nearby target while the book placement/retry and stale-writer safety cases remain valid.
- Invocation: `node --import tsx --test src/lib/failureExhibition.test.ts src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryRouteState.test.ts src/lib/canvasLibraryPlacement.test.ts`
- Binary observable: exit status `0`; the run includes `전체 도서관의 실패 이야기 게시판은 상호작용 범위 안에서 독립 대상으로 선택된다` and `모든 슬롯이 차도 두 책장 피커와 실패 이야기 게시판은 이동으로 닿을 수 있다`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board.md`

## Modal and keyboard ownership

- Scenario: an embedded board is the only modal owner until composer/cheer opens; then the board becomes hidden/inert and its focus hook is disabled. Escape on an open stamp menu is captured by the menu and closes only that menu.
- Invocation: `npm run lint`
- Binary observable: exit status `0`; `StudentFailureExhibitionPage` and `StudentFailureMessage` compile with the focused modal and capture-phase Escape handlers.
- Captured artifact: `.omo/evidence/library-layout-feedback/board.md`

## Production artifact

- Scenario: the production Vite bundle can include the unified library route and its embedded failure board.
- Invocation: `npm run build`
- Binary observable: exit status `0`; Vite reported `✓ built in 2.58s` and emitted `dist/assets/StudentLibraryPage-CY-c8Hkr.js`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board.md`

## Isolated callback browser QA

- Scenario: rejected create draft retention, pending create close/Escape/duplicate-submit blocking, and successful return to the one-owner board modal.
- Invocation: local Chrome fixture at `http://127.0.0.1:3043/board-states.html?mode=reject` and `?mode=pending`.
- Binary observable: rejection retained both draft values; pending state rendered disabled close and `저장하는 중` even after Escape; success returned to one active board modal with the created card.
- Captured artifact: `.omo/evidence/library-layout-feedback/board-states.md`

## Full-route browser QA handoff

- Scenario: 1280×800 physical-board interaction, real local callback persistence, stamp-menu Escape isolation, and no clipping/scrolling.
- Invocation: root-agent route QA, as assigned by the task owner.
- Binary observable: pending root-agent capture; not claimed by this implementation record.
- Captured artifact destination: `.omo/evidence/library-layout-feedback/`
