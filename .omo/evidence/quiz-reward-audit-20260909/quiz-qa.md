# Manual QA: classword quiz client reward confirmation

Revision under test: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`

Environment: Vite SSR production module load; disposable in-memory browser storage; synthetic `fetch`; no Supabase, database, browser account, or live student data.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| Q1 | C1 correct answer reward | classwordClient production SSR | `node /tmp/quiz-runtime-qa.mjs`; `client.submitClasswordQuizAnswer({ dateKey: '2026-09-09', studentNumber: 3, answer: '지구' })` with HTTP 200 fixture | PASS | A1 |
| Q2 | C2 incorrect answer no award | classwordClient production SSR | `node /tmp/quiz-runtime-qa.mjs`; `client.submitClasswordQuizAnswer({ dateKey: '2026-09-09', studentNumber: 4, answer: '오답' })` with HTTP 200 fixture | PASS | A1 |
| Q3 | C3 lost POST receipt recovery | classwordClient production SSR | `node /tmp/quiz-runtime-qa.mjs`; POST `/api/classword` transport loss, then GET `/api/classword?requestId=<same>` with `{committed:true,result}` | PASS | A1 |
| Q4 | C4 retry stable request identity | classwordClient production SSR | `node /tmp/quiz-runtime-qa.mjs`; same `submitClasswordQuizAnswer` invocation after `CLASSWORD_CONFIRMATION_REQUIRED` | PASS | A1 |
| Q5 | C5 missing reward pending state | classwordClient production SSR | `node /tmp/quiz-runtime-qa.mjs`; `client.loadClasswordQuizStudentState('2026-09-09', 7)` with completed state and `rewardAmount:null` | PASS | A1 |
| T1 | C1-C5 regression coverage | Node test runner / API handler fixtures | `node --import tsx --test src/lib/classwordClient.test.ts src/lib/classwordQuiz.test.ts src/lib/classwordQuizLocalStore.test.ts src/lib/classwordQuizReward.test.ts tests/api/classword.test.ts tests/api/classwordAnnual.test.ts tests/api/classwordRepository.test.ts` | PASS (48/48) | A2 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| Q2 | C2 | incorrect answer | Return `correct:false`, `awarded:false`, `rewardAmount:0`, `balance:null`; no completion/reward success is fabricated. | PASS | A1 |
| Q3 | C3 | transport loss after commit | Confirm by receipt lookup using the original request ID and return the committed paid result. | PASS | A1 |
| Q4 | C4 | transport loss with unknown receipt | Surface `CLASSWORD_CONFIRMATION_REQUIRED`; a later retry reuses the exact request ID and clears pending storage only after success. | PASS | A1 |
| Q5 | C5 | completed answer with missing reward row | Preserve `completed:true` and `rewardAmount:null` so the UI can represent a pending reward. | PASS | A1 |
| Q1 | C1 | valid reward boundary | Accept integer reward amount 7 and numeric balance 107 from a 200 response. | PASS | A1 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | runtime transcript | Production SSR synthetic fetch execution for Q1-Q5. | `/tmp/quiz-runtime-qa-output.md` |
| A2 | test transcript | Existing classword client, quiz, API, annual, and repository fixture tests; 48 passed. | `/tmp/quiz-api-tests-output.md` |
| A3 | revision scope | Exact SHA and worktree scope check. | `/tmp/quiz-revision-output.md` |

## Verdict

PASS. All five requested runtime scenarios executed with non-empty evidence artifacts at the requested SHA. The shared worktree had unrelated concurrent changes in `src/lib/studentCharacters.ts`, `src/pages/TimerPage.tsx`, and `tmp/character-direction-qa/`; no classword client or classword test files were changed.
