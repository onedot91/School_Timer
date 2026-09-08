# Teacher schedule header layout QA

## Scenario: two warning actions at narrow control-pane width

- Invocation: local mock Vite server at `http://localhost:3002/.omo/evidence/teacher-schedule-header-layout-20260908/schedule-header-fixture.html`, rendered through the in-app browser at a `1280×650` viewport.
- Fixture: the exact schedule-header classes and the current `/src/index.css`, with `저장 오류 6`, `보상 점검 31`, and `설정` in a `395px` control pane.
- Binary observable: date text is `9월 8일화요일`; its `scrollWidth` and `clientWidth` are both `352`; all three buttons are visible and enabled; their heights are `44`, `44`, and `44`; the document is `1280px` wide with no horizontal overflow.
- Captured artifact: `schedule-header-fixture.html`.

## Scenario: two warning actions when a wide pane would otherwise keep one row

- Invocation: the same local fixture with the `warning-wide` pane at `520px`.
- Binary observable: `:has(.teacher-save-warning)` applies a separate date row and action row. Date text is complete with `scrollWidth === clientWidth === 477`; `저장 오류 6`, `보상 점검 31`, and `설정` are visible, enabled, and each `44px` high; document width remains `1280px` with no horizontal overflow.
- Captured artifact: `schedule-header-fixture.html`.

## Scenario: real mock teacher screen at required browser-content heights

- Invocation: `npm run dev` in mock mode, select `0번 학급 시계` in the disposable in-app browser, then set `1280×650`, `1280×600`, and `1280×800` viewports.
- Binary observable: the schedule header visibly renders complete `9월 8일 화요일`, `보상 점검`, and `설정` controls at every tested height; no production profile or live student data was opened or changed.
- Captured artifact: this record and the loaded local fixture; browser screenshots were inspected in the in-app browser during this run.

## Scenario: settings remains reachable from the header

- Invocation: at the local mock teacher `1280×650` screen, activate the visible `설정` header button, then press `Escape` on its close control.
- Binary observable: the accessible `dialog "설정"` opened with `설정 닫기` focused; after Escape the dialog closed and focus returned to the `설정` header button.
- Captured artifact: this record.

## Static and type checks

- Invocation: `git diff --check`.
- Binary observable: exit code `0` with no whitespace errors.
- Invocation: `npm run lint`.
- Binary observable: exit code `0`.
- Captured artifact: `lint.txt`.
