# Task 1 manual QA: current bookshelf baseline

실행일: 2026-09-05 (Asia/Seoul)

## 실행 환경

- 격리 fixture: [baseline.html](./baseline.html), [baseline.tsx](./baseline.tsx)
- 브라우저 launcher: [baseline-qa.mjs](./baseline-qa.mjs)
- surface: Playwright Chromium API로 실행한 별도 Google Chrome headless context (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`)
- exact invocation: `node .omo/evidence/canvas-library/baseline-qa.mjs`
- viewport: 1280×800, deviceScaleFactor 1
- server: Vite direct child PID 75033, `127.0.0.1:3020`, `--strictPort`, `VITE_DATA_MODE=mock`, `VITE_DISABLE_REACT_DEVTOOLS=1`
- request policy: owned browser context에서 `127.0.0.1:3020` 정적/module 요청만 continue; `/api`와 `/api/**`, 그 밖의 모든 host는 abort. 실행 결과 차단 요청 0건.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-01 | T1 baseline: current bookshelf with one synthetic book | browser UI, bookshelf | `node .omo/evidence/canvas-library/baseline-qa.mjs`; fixture loads `baseline.html` and asserts `.student-book-stack article` count 1 and `달빛 우체국` visible | PASS | A1, A2 |
| S-02 | T1 PIN: existing add form and confirmation dialog | browser UI, add form/dialog | same invocation; `getByRole('textbox', {name:'책 제목'})`=`별빛 도서관`, `글쓴이`=`김하늘`, `쪽수`=`120`; click `책 쌓기` | PASS | A1 |
| S-03 | T1 PIN: cancel leaves record unchanged | browser UI, confirmation dialog | same invocation; dialog `취소` click, assert dialog count 0 and bookshelf count 1 | PASS | A1 |
| S-04 | T1 PIN: confirm adds exactly once and retains baseline | browser UI, bookshelf mutation | same invocation; reopen dialog, dialog `책 쌓기` click, assert count 2 and added article contains `별빛 도서관`/`120쪽` | PASS | A1, A2 |
| S-05 | T1 adversarial invalid page 0 | browser UI, number input | same invocation; fill `쪽수` with `0`, assert submit button disabled, dialog count 0, bookshelf count remains 2 | PASS | A1 |
| S-06 | T1 RED: new Canvas walkable room is absent from current surface | browser UI, current bookshelf page | same invocation; assert `canvas` count 0 and no walkable-room/game copy in `.student-library-view` | RED (expected) | A1, A2 |
| S-07 | T1 isolation: no external/API requests | browser network policy | same invocation; context route aborts `/api`, `/api/**`, and non-local hosts, records all blocked requests | PASS | A1 |
| S-08 | T1 capture integrity and exact viewport | browser screenshot artifact | same invocation; screenshot `baseline.png`, assert PNG signature, dimensions 1280×800, non-zero bytes, and browser `window.innerWidth×innerHeight`=`1280x800` | PASS | A1, A2 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-01 | T1 | invalid numeric input (page count 0) | native constraint plus React disabled state prevents opening confirmation or changing records | PASS | A1 |
| ADV-02 | T1 | cancel/abort confirmation | cancel closes dialog and leaves exactly the original synthetic record | PASS | A1 |
| ADV-03 | T1 | duplicate action / repeated confirmation | one confirmation click adds one record; count changes 1→2, not more | PASS | A1 |
| ADV-04 | T1 | external/API request leakage | all non-local and `/api` requests are blocked in the owned context; no blocked request was observed | PASS | A1 |
| ADV-05 | T1 | source drift | JSON stamps SHA-256 of current `StudentLibraryPage.tsx`, `studentLife.ts`, and `index.css` used by the capture | PASS | A1 |
| ADV-06 | T1 | live-data/persistence contamination | fixture supplies only in-memory `qa-baseline`; no app bootstrap, localStorage, Supabase client, or live student records are imported | PASS | A1, A3 |
| ADV-07 | T1 | new Canvas room feature | current bookshelf page has no Canvas/walkable room surface; this is the requested expected RED, not a skipped run | RED (expected) | A1, A2 |
| ADV-08 | T1 | destructive data / migration / production write | not_applicable — fixture contains no destructive control, migration, production endpoint, or live record | N/A | A3 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | json | Fresh Playwright scenario output: fixture book, dialog text, cancel/confirm counts, invalid page result, Canvas absence, request policy, viewport, source SHA-256, server/browser cleanup metadata | [baseline.json](./baseline.json) |
| A2 | screenshot | Fresh actual bookshelf screenshot, no helper overlay; PNG signature `89504e470d0a1a0a`, 1280×800, 340318 bytes | [baseline.png](./baseline.png) |
| A3 | source | Isolated fixture source that renders actual `StudentLibraryPage` with one in-memory synthetic `StudentBook`; no app bootstrap | [baseline.tsx](./baseline.tsx) |

## cleanup

`baseline-qa.mjs` closes the isolated Playwright context/browser in `finally` and sends SIGTERM to its owned Vite child. The successful run recorded server PID 75033 and port 3020; no user tabs or other servers were closed.
