# Task 3 pointer/control manual QA

## Scope and runtime

- Plan criterion: `.omo/plans/canvas-library.md` Task 3 acceptance, especially lines 84-85: fresh 1280×800 surface, zero document overflow, intended controls >=44 CSS px, modal interaction, and real pointer/keyboard behavior.
- Surface: `.omo/evidence/canvas-library/play.html`, real `CanvasLibraryGame` fixture at `http://127.0.0.1:3024`, viewport `1280×800`, device scale factor 1.
- CUA was attempted first. Its available browser control has click/drag but no held `mouse.down`/`mouse.up`; the required held-pointer cases therefore ran through bundled Playwright against native Chrome with `--disable-crash-reporter --disable-crashpad --no-sandbox`.
- Owned server invocation: `npm run dev -- --host 127.0.0.1 --strictPort --port 3024`. Non-local and `/api/**` requests were aborted by the QA route guard. Owned server was stopped with Ctrl-C and port 3024 was confirmed free.
- The current source hash set matches the pinned `.omo/evidence/canvas-library/root-play-qa.json`; no product source was changed by this QA run.

## Result

Pointer/control behavior is independently evidenced as PASS. Overall Task 3 pointer QA is **FAIL** because the carrying-near-placed-book Canvas cue is misleading: it renders `Enter 책 보기` although the actual DOM action and `E` key open the shelf picker (`책을 둘 자리`). This is a product finding, not an evidence or harness failure.

> Capture integrity note: the receipt and screenshots were generated at `2026-09-05T06:25:56.666Z`, while the renderer source still had the mismatching branch. A follow-up worker subsequently changed `CanvasLibraryRenderer.ts`; the hash in A1 is therefore a deliberate pre-fix pin, not a claim about the post-fix source. Do not reuse this FAIL as the final post-fix verdict without a fresh rerun.

## `manualQa.surfaceEvidence`

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| PTR-001 | Task 3 §84; pointer model | Canvas directional controls | `page.getByRole('button',{name:'오른쪽으로 이동',exact:true})`; `page.mouse.move(center)`; `page.mouse.down()`; `page.waitForTimeout(150)`; read `canvas.dataset.playerX/Y`; `page.mouse.up()`; wait 150ms + 180ms; repeat twice | PASS | A1, A2 |
| PTR-002 | Task 3 pointercancel cleanup | Canvas directional controls | Same exact locator/invocation as PTR-001, then after real hold dispatch `new PointerEvent('pointercancel',{bubbles:true,pointerId:observedRealId})`; wait 150ms + 180ms; repeat twice | PASS | A1, A2 |
| PTR-003 | Task 3 lost-capture cleanup | Canvas directional controls | Same exact locator/invocation as PTR-001, then dispatch `new PointerEvent('lostpointercapture',{bubbles:true,pointerId:observedRealId})`; wait 150ms + 180ms; repeat twice | PASS | A1, A2 |
| PTR-004 | Task 3 §84 controls >=44px | Initial, registration, details, slots states | `page.locator('button:visible, input:visible').evaluateAll(...)`; assert each `getBoundingClientRect().width >= 44 && height >= 44` | PASS | A1, A3 |
| PTR-005 | Task 3 pointer model, no teleport/remote interaction | Initial Canvas | Map shelf visual rect center to the real Canvas bounds; `page.mouse.click(shelfPoint.x,shelfPoint.y)`; assert `page.getByRole('dialog').count() === 0` | PASS | A1, A4 |
| PTR-006 | Task 3 spatial hotspot access | Near registration desk | Real keyboard walk to dataset position `{x≈109,y≈304}`; `page.getByRole('button',{name:'가까운 곳 살펴보기: 책 등록',exact:true}).click()`; assert registration dialog/textbox | PASS | A1, A5 |
| PTR-007 | Task 3 lifecycle cleanup | Separate QA unmount fixture importing the same real component | `page.goto('http://127.0.0.1:3024/.omo/evidence/canvas-library/unmount.html')`; real direction `mouse.down()` + 120ms; `page.evaluate(() => window.__qaUnmount())`; `mouse.up()`; wait 220ms; assert `#root` empty, no `[role=application]`, no page errors | PASS | A1, A6 |
| PTR-008 | Task 3 contextual interaction guidance | Carrying second draft near placed book | Real registration/placement loop; walk to `{x≈196,y≈122}`; capture; assert semantic action `가까운 곳 살펴보기: 책장 열기`; click and press `E`, each assert heading `책을 둘 자리` | FAIL | A1, A7, A8 |

## `manualQa.adversarialCases`

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-001 | Task 3 pointer model | cancel/resume interruption | `pointercancel` clears held direction; position is unchanged after the post-cancel settle window | PASS | A1, A2 |
| ADV-002 | Task 3 pointer model | repeated interruptions / timing | Each of pointerup, pointercancel, and lostpointercapture is repeated twice; movement occurs only during hold and remains stable after stop | PASS | A1, A2 |
| ADV-003 | Task 3 source integrity | stale hashes | Current seven source hashes equal pinned `root-play-qa.json` hash receipt before/after browser run | PASS | A1, A9 |
| ADV-004 | Repository safety | dirty-worktree preservation | QA inspects existing dirty tree and does not revert or edit product files; source hash comparison remains unchanged | PASS | A1, A9 |
| ADV-005 | Runtime hygiene | bounded commands / cleanup | Owned browser closes in `finally`; owned Vite is Ctrl-C stopped; `lsof` reports `PORT_3024_FREE` | PASS | A1, A10 |
| ADV-006 | Existing coverage boundary | malformed/prompt injection | Not applicable to this pointer/control-only change; untrusted-text coverage is already recorded by `root-play-qa.json` | NOT_APPLICABLE | A9 |
| ADV-007 | QA evidence discipline | misleading output vs assumed PASS | A Canvas screenshot and source line are compared with DOM/E outcomes; mismatch is recorded as FAIL rather than inferred PASS | FAIL | A1, A7, A8 |

## `manualQa.artifactRefs`

| id | kind | description | path |
|---|---|---|---|
| A1 | JSON | Full bounded run receipt: real pointerup/cancel/lostcapture observations, control scans, modal outcomes, unmount, blocked requests, errors, source hashes, and confirmed finding | [.omo/evidence/canvas-library/task-3-pointer-qa.json](./task-3-pointer-qa.json) |
| A2 | script | Bounded Playwright script with exact locator, `mouse.down/up`, 150ms timing, two repetitions per stop path, and interruption dispatch | [.omo/evidence/canvas-library/task-3-pointer-qa.mjs](./task-3-pointer-qa.mjs) |
| A3 | PNG | 1280×800 initial and modal state screenshots used with recorded CSS bounding boxes | [pointer-initial.png](./pointer-initial.png), [pointer-registration.png](./pointer-registration.png), [pointer-details.png](./pointer-details.png), [pointer-slots.png](./pointer-slots.png) |
| A4 | JSON | Far shelf Canvas click result with exact mapped point and zero dialogs | [.omo/evidence/canvas-library/task-3-pointer-qa.json](./task-3-pointer-qa.json) |
| A5 | JSON | Near registration semantic click opens registration form | [.omo/evidence/canvas-library/task-3-pointer-qa.json](./task-3-pointer-qa.json) |
| A6 | fixture + JSON | Real React unmount fixture and observed empty root/no stale errors while pointer was held | [unmount.html](./unmount.html), [unmount.tsx](./unmount.tsx), [.omo/evidence/canvas-library/task-3-pointer-qa.json](./task-3-pointer-qa.json) |
| A7 | PNG | Fresh 1280×800 carrying-near-placed screenshot showing Canvas cue `Enter 책 보기` | [pointer-carrying-near-placed.png](./pointer-carrying-near-placed.png) |
| A8 | source | Source-backed cue branch and semantic branch disagree | [CanvasLibraryRenderer.ts:607](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/library/CanvasLibraryRenderer.ts:607), [CanvasLibraryGame.tsx:461](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/library/CanvasLibraryGame.tsx:461) |
| A9 | JSON | Pinned source SHA-256 values and zero blocked requests/page errors | [.omo/evidence/canvas-library/task-3-pointer-qa.json](./task-3-pointer-qa.json) |
| A10 | text | Port teardown receipt | [task-3-pointer-port-free.txt](./task-3-pointer-port-free.txt) |

## Source-backed note

The pointer handlers in `CanvasLibraryGame.tsx:439-451,522-525` set capture, store the pointer direction, and delete it on `pointerup`, `pointercancel`, or `lostpointercapture`; the run above observes those paths, not just source intent. The confirmed product issue is at `CanvasLibraryRenderer.ts:607`, where every `placed-book:*` target is painted with `Enter 책 보기`; `CanvasLibraryGame.tsx:463-464` intentionally exposes `가까운 곳 살펴보기: 책장 열기` when `carriedDraft` exists. No fix was applied in this QA task.
