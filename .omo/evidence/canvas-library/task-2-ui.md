# Task 2 UI evidence

## PIN / RED

- Source: independently captured task 1 fixture, `.omo/evidence/canvas-library/baseline.json` and `baseline.png`.
- Scenario: render the existing isolated student library at `1280x800` with synthetic metadata.
- Invocation: `node .omo/evidence/canvas-library/baseline-qa.mjs` (task 1 capture).
- Binary observable before implementation: `canvasCount === 0`; no interactive Canvas library exists.
- Expected GREEN: `.omo/evidence/canvas-library/play.html` mounts the real `CanvasLibraryGame`, exposes one `624x376` Canvas, and supports keyboard desk registration, carrying, shelf placement, and semantic book inspection without network/storage.

Implementation and smoke receipts will be appended after the real fixture run.

## GREEN / SURFACE

### One-book play loop

- Scenario: student 7 walks from the real spawn `(312,340)` to the registration desk using held `a`/`w`, opens registration with the pointer-accessible action `가까운 곳 살펴보기: 책 등록`, carries `달빛 우체국`, walks to the wide shelf using held `d`/`w`, places it in `빈자리 1`, returns to the Canvas, reopens the shelf, and inspects that exact book.
- Invocation: bundled Playwright module at `/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`, Chrome channel, `1280x800`, against `http://127.0.0.1:3021/.omo/evidence/canvas-library/play.html`; keys were driven only with `page.keyboard.down/up`, never by setting player position.
- Binary observables: after placement `dialogCount === 0`; after `ArrowDown`, focused slot `aria-label === "빈자리 7"`; inspecting the occupied slot exposes `달빛 우체국`, `김별`, `80쪽`, `7번`; visible idle status panels after first movement `=== 0`; document overflow `[0,0]`; blocked/API/nonlocal requests `=== 0`.
- Artifacts: `.omo/evidence/canvas-library/task-2-play.png` (placed book visible in the room) and `.omo/evidence/canvas-library/task-2-details.png` (semantic details dialog).

### Registration validation

- Scenario: submit a whitespace-only title and page count `0`, then correct the same form to title `달빛 우체국`, author `김별`, pages `80`.
- Invocation: the same isolated Playwright fixture and semantic label/role locators.
- Binary observable: invalid submit keeps the form open and renders alert `책 제목은 1~50자로 입력해 주세요.`; corrected submit creates only a carried draft and does not add a shelf book until slot selection.

### Geometry and semantics

- Scenario: inspect the live Canvas and DOM at the authoritative viewport.
- Invocation: CUA first-pass scene/AX inspection, followed by the exact-size bundled Playwright run.
- Binary observables: Canvas CSS box `1248x752`, intrinsic buffer `624x376`, page overflow `0x0`; scene, back, nearby action, four direction buttons, labelled form fields, slot buttons, and one active dialog are semantic DOM targets. The movement pad occupies the reserved lower patch and does not cover the lower-centre spawn.

### Validation and cleanup

- `npm run lint`: PASS after the world and renderer contracts landed.
- `git diff --check -- src/components/student/library/CanvasLibraryGame.tsx src/index.css .omo/evidence/canvas-library/play.html .omo/evidence/canvas-library/play.tsx .omo/evidence/canvas-library/task-2-ui.md`: PASS.
- The owned in-app browser tab and Vite PID/port are closed during task cleanup. Task 3 owns the independent whole-scene art verdict and exhaustive blur/modal/text-stress gate; this report does not claim those pending gates.

## Focus-trap repair

### PIN

- Scenario: before the repair, open the ordinary registration dialog at the real desk and drive seven forward Tabs plus Shift+Tab from `책 제목`.
- Invocation: bundled Playwright Chrome at `1280x800` against the isolated root server on port 3023, walking from spawn with held keyboard input.
- Binary observable: all seven forward Tab stops remained inside the registration dialog; Shift+Tab moved to `책 등록 닫기`. This preserved the existing non-roving modal behavior.

### RED

- Durable artifact: `.omo/evidence/canvas-library/task-2-root-interim.md`, section `Stable-source follow-up`; it records two reproductions, including one after explicit initial-focus readiness. The failing root run was observed at `2026-09-05T06:01:34.647Z`; its mutable JSON receipt was subsequently replaced by the GREEN rerun and is not cited as a currently failing file.
- Scenario: open the wide shelf, move roving focus from `빈자리 1` to `빈자리 7` with ArrowDown, then press Tab.
- Binary observable: `passed === false`, failure `Tab 0 escaped slot dialog` at `.omo/evidence/canvas-library/root-play-qa.mjs:91`.
- Cause: `getFocusableElements` selected every enabled button even when the roving slot assigned `tabindex="-1"`; the trap therefore calculated an unreachable last element and allowed native Tab to leave the dialog.

### GREEN

- Fix: `src/lib/useModalFocus.ts` now retains only visible, non-hidden candidates whose resolved `element.tabIndex >= 0`.
- Full invocation: `node .omo/evidence/canvas-library/root-play-qa.mjs`.
- Full observable: `.omo/evidence/canvas-library/root-play-qa.json` has `passed === true`; `slotKeyboardAndFocusTrap`, `actualBookLoop`, `pointerDeskAndSecondBook`, `untrustedTextIsLiteral`, `text200CloseReachable`, real blur clearing, and reduced-motion play are all true; requests/errors are empty and the owned Chrome context closed.
- Shift+Tab invocation: `node .omo/evidence/canvas-library/focus-trap-qa.mjs`.
- Shift+Tab observable: ArrowDown focuses `빈자리 7`; Shift+Tab focuses `책장 닫기`; another Shift+Tab wraps to `빈자리 7`; Escape returns focus to Canvas. Helper SHA-256 stayed `2e161b8d3e8f54b839e9cbdad243ed4873c2532c03a4f1213f770e7ad65307fa` throughout the run.

### Long-title visual follow-up

- Finding: the initial 49-character Korean title capture left a single `책` glyph on the final line.
- Fix: the scoped Canvas library dialog heading uses `text-wrap: balance` while retaining `overflow-wrap: anywhere`, so full titles remain visible and unbroken strings still have an emergency wrap path.
- Invocation: `node .omo/evidence/canvas-library/root-play-qa.mjs`, generated `2026-09-05T06:08:29.883Z`.
- Binary observables: `passed === true`, `text200CloseReachable === true`, viewport overflow remains `0x0`, requests/errors are empty, and source hashes include the focus helper plus final CSS.
- Visual artifacts inspected: `.omo/evidence/canvas-library/root-long-details.png` distributes the 49-character title without a one-glyph orphan; `.omo/evidence/canvas-library/root-text-200.png` preserves the complete title and metadata; `.omo/evidence/canvas-library/root-text-200-actions.png` proves the `도서관으로` action remains reachable through dialog-owned scrolling inside the 800px viewport.

### Final validation

- `npm run lint`: exit 0.
- `npm test`: 531 passed, 0 failed, 0 skipped, exit 0.
- `git diff --check -- src/lib/useModalFocus.ts src/index.css .omo/evidence/canvas-library/task-2-ui.md .omo/evidence/canvas-library/focus-trap-qa.mjs`: exit 0.
- Both repair-owned Chrome runs closed in `finally`. Root-owned Vite PID 77952 on port 3023 remained running as requested for the parent gate.
