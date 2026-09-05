# Canvas library readonly manual QA

Date: 2026-09-05 (Asia/Seoul)

## Scope and surface

- Surface: real local browser UI, `#student-library-bookshelf`, `1280×800`, device scale factor 1.
- Server: dedicated port `3040`, started with `DISABLE_HMR=true VITE_DATA_MODE=readonly node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3040 --strictPort` and empty `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to exercise the no-shared-config readonly fallback.
- Browser: bundled Playwright with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; CUA Chrome extension was attempted first and visibly reached the local page's `기기 등록 확인 중` loading surface before the isolated Playwright run.
- Test data: synthetic disposable localStorage only; no live student balances, books, awards, or production records.

## Scenario results

| Scenario | Criterion reference | Surface | Exact invocation | Verdict | ArtifactRefs |
|---|---|---|---|---|---|
| RO-UI-01 | readonly placement route | Browser UI | Playwright page: `goto(http://127.0.0.1:3040/#student-library-bookshelf)` → keyboard walking → `E` at desk → fill `책 제목`/`글쓴이`/`쪽수` → `책 받기` → keyboard walking → `E` at shelf → `getByRole('button',{name:'빈자리 100',exact:true}).click()` | PASS | A1, A2, A3, A4, A5 |
| RO-CLIENT-01 | `canvasLibraryClient.test.ts` readonly guard | Node test | `node --import tsx --test src/lib/canvasLibraryClient.test.ts` | PASS | A6 |
| RO-NET-01 | no production/shared writes | Browser request boundary | Context route: `/api/*` fulfilled with synthetic `{}`; non-local requests aborted; observe `PUT /api/shared-settings` list | PASS | A1, A7 |
| RO-VIEW-01 | final layout safety | Browser screenshot | `page.screenshot({path, 1280×800})`; assert `scrollWidth-innerWidth===0` and `scrollHeight-innerHeight===0` | PASS | A1, A2, A3, A4, A5 |

## Required readonly flow evidence

- The banner reads `실제 데이터 보기 전용 / 저장과 거래는 실제 데이터에 반영되지 않아요.`.
- The final Canvas DOM has no persistent `.student-canvas-library-pad` (`persistentMovementPadRemoved: true`); keyboard WASD/arrow movement remains used by the exact route invocation.
- Draft entry is carried in React state only: after `책 받기`, localStorage is byte-for-byte unchanged from the loaded baseline.
- Clicking exact `빈자리 100` produces the visible alert `읽기 전용 모드에서는 책을 꽂을 수 없어요.`.
- The carried status remains `운반 중 · 읽기 전용 새 책` while the picker remains open; the alert is visible in the captured blocked state.
- No `PUT /api/shared-settings` request was observed. `/api/version` and `/api/question-submission-status` were synthetic; Google Fonts requests were aborted and never reached the network.
- `Escape` closes the picker and the carried draft remains visible. No dialog remains after Escape.

## Manual QA matrix (`manualQa`)

### `surfaceEvidence`

```json
[
  {"scenarioId":"RO-UI-01","criterionReference":"readonly placement route","surface":"real browser UI","exactInvocation":"keyboard WASD walking → E desk → fill title/author/pages → 책 받기 → keyboard WASD walking → E shelf → getByRole(button,{name:'빈자리 100',exact:true}).click()","verdict":"PASS","artifactRefs":["A1","A2","A3","A4","A5"]},
  {"scenarioId":"RO-CLIENT-01","criterionReference":"readonly client adapter guard","surface":"Node test runner","exactInvocation":"node --import tsx --test src/lib/canvasLibraryClient.test.ts","verdict":"PASS","artifactRefs":["A6"]},
  {"scenarioId":"RO-NET-01","criterionReference":"no production calls or placement PUT","surface":"Playwright request interception","exactInvocation":"context.route('**/*'): fulfill /api/* synthetic; abort non-local; observe placementPuts","verdict":"PASS","artifactRefs":["A1","A7"]},
  {"scenarioId":"RO-VIEW-01","criterionReference":"1280×800 no overflow","surface":"Browser screenshot/layout","exactInvocation":"page.screenshot({path}) plus PNG signature and scroll extent assertions","verdict":"PASS","artifactRefs":["A1","A2","A3","A4","A5"]}
]
```

### `adversarialCases`

| Scenario id | Criterion reference | Adversarial class | Expected behavior | Verdict | ArtifactRefs |
|---|---|---|---|---|---|
| ADV-CANCEL-01 | picker cancel/resume | cancel/resume | Escape closes picker without placement and preserves carried draft; reopening remains safe | PASS | A1, A5 |
| ADV-SHA-01 | source integrity | stale source SHA | Start/end hashes for data mode, client, Canvas game/renderer, and CSS are identical during run | PASS | A1 |
| ADV-DIRTY-01 | shared worktree safety | dirty worktree | QA changes are limited to own `.omo/evidence/canvas-library/task-6-readonly-*`; existing product changes are not reverted or touched | PASS | A8 |
| ADV-SUCCESS-01 | misleading success | misleading success | Readonly failure must not show success, persist a book, award currency, or clear carried draft | PASS | A1, A4 |
| ADV-NET-01 | external dependency isolation | non-local/live network | Non-local requests are aborted; all `/api/*` responses are synthetic only | PASS | A1, A7 |
| ADV-STALE-02 | stale source SHA | N/A | Not applicable beyond ADV-SHA-01; this run does not mutate source between start/end | not_applicable — covered by ADV-SHA-01 | A1 |
| ADV-FULL-01 | full shelf capacity | N/A | Readonly placement guard returns before capacity resolution; no capacity mutation is in scope for this route | not_applicable — mode guard blocks before placement | A1, A6 |

## Section audit

1. Actual readonly UI capture: PASS. `A2`–`A5` are fresh 1280×800 PNGs from the live local page.
2. Baseline current adapter readonly test: PASS. `A6` records all 13 targeted tests passing, including no fetch/store in readonly.
3. Dependency/production-call isolation: PASS. Dev mode banner and adapter guard are observed; production build behavior is outside this browser run, while `src/lib/dataMode.ts` is hash-recorded in `A1`. No live calls were allowed.
4. Targeted client test: PASS. `A6`.
5. Manual browser route: PASS. Exact desk → carried draft → shelf slot 100 flow completed; explicit readonly alert, unchanged snapshot, no placement PUT, Escape close, and carried retention are all asserted in `A1`.
6. Adversarial audit: PASS / N/A only where genuinely untriggered. Cancel/resume, stale hash, dirty worktree, misleading success, and network isolation are covered above.
7. Artifact integrity: PASS. `A1` includes start/end currentGame, CSS signatures, client/data-mode/CSS/Canvas hashes, all screenshot hashes/signatures, viewport, requests, persistent-pad assertion, and cleanup receipt. `A2`–`A5` are verified PNG magic `89504e470d0a1a0a`, dimensions `1280×800`, non-empty RGB PNGs. Port `3040` server was stopped after capture and the isolated Chrome browser/context was closed; no leftover browser tab was marked for handoff.

## Artifact references

| id | kind | description | path |
|---|---|---|---|
| A1 | json | Full readonly browser receipt: checks, requests, storage start/end, currentGame start/end, CSS signatures, source hashes, PNG signatures, cleanup | [.omo/evidence/canvas-library/task-6-readonly-qa.json](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-qa.json>) |
| A2 | png | Fresh entered readonly Canvas UI, 1280×800 | [.omo/evidence/canvas-library/task-6-readonly-entered.png](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-entered.png>) |
| A3 | png | Fresh registration form after desk interaction and filled draft | [.omo/evidence/canvas-library/task-6-readonly-registration.png](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-registration.png>) |
| A4 | png | Fresh blocked placement: explicit readonly alert and carried draft retained | [.omo/evidence/canvas-library/task-6-readonly-placement-blocked-carried-retained.png](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-placement-blocked-carried-retained.png>) |
| A5 | png | Fresh Escape-closed picker with carried draft retained | [.omo/evidence/canvas-library/task-6-readonly-escape-closed-carried.png](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-escape-closed-carried.png>) |
| A6 | log | Targeted `canvasLibraryClient` test output | [.omo/evidence/canvas-library/task-6-readonly-client-test.log](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-client-test.log>) |
| A7 | script | Reproducible browser driver with synthetic API/non-local request isolation and assertions | [.omo/evidence/canvas-library/task-6-readonly-qa.mjs](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-qa.mjs>) |
| A8 | receipt | Dirty-worktree and scope check observed during QA; product source was not reverted | [.omo/evidence/canvas-library/task-6-readonly-qa.json](</Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/canvas-library/task-6-readonly-qa.json>) |

## Verdict

`manualQa`: PASS for the executed readonly browser surface and targeted client adapter. No product files were edited by this QA executor. The generated script and evidence are disposable QA artifacts only.
