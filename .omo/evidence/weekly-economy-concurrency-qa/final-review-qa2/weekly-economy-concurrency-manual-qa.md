# Manual QA Matrix: weekly economy concurrency (fresh final QA)

Verdict: PASS

Scope: Current unstaged implementation as observed on 2026-09-03. HTTP requests ran against a localhost wrapper with an in-memory fake Supabase row and disposable signed sessions. Library checks used isolated snapshots. No production Supabase, browser localStorage, real student balance, bid, award, or currency history was mutated.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA2-01 | house purchase | HTTP student economy API | `curl -i -sS -X POST http://127.0.0.1:55187/api/student-economy` with student 1, `buy_house(pink-cottage)`, request `qa2-house-buy-01` | PASS | A3, A4 |
| QA2-02 | shop purchase | HTTP student economy API | `curl -i -sS -X POST http://127.0.0.1:55187/api/student-economy` with student 2, `buy_item(snack)`, request `qa2-shop-buy-02` | PASS | A3, A4 |
| QA2-03 | stock invest/withdraw | HTTP student economy API | two `curl -i -sS -X POST .../api/student-economy` calls for student 3: invest 40 on 2026-09-03, then withdraw on 2026-09-04 | PASS | A3, A4 |
| QA2-04 | transfer | HTTP student economy API | `curl -i -sS -X POST http://127.0.0.1:55187/api/student-economy` with student 2 transferring 25 to student 3, request `qa2-transfer-02-01` | PASS | A3, A4 |
| QA2-05 | profile purchase | HTTP student economy API | `curl -i -sS -X POST http://127.0.0.1:55187/api/student-economy` with student 4, `draw_profile`, request `qa2-profile-draw-04` | PASS | A3, A4 |
| QA2-06 | zero-delta | HTTP student economy API | `curl -i -sS -X POST http://127.0.0.1:55187/api/student-economy` with student 5, `select_house(null)`, request `qa2-house-select-05` | PASS | A3, A4 |
| QA2-07 | reset after remote purchase | library merge seam / fake snapshots | `node --import tsx .omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/logic-qa2.ts` | PASS | A1, A2 |
| QA2-08 | next-side reset canonicalization | library merge seam / fake snapshots | same `logic-qa2.ts` invocation; next raw balance 999 with reset `after=100` | PASS | A1, A2 |
| QA2-09 | weekly tax and allowance | library currency cycle / fake snapshot | same `logic-qa2.ts` invocation | PASS | A1, A2 |
| QA2-10 | weekly tax racing deposit | library currency cycle / fake snapshot | same `logic-qa2.ts` invocation; deposit 200 is applied before cycle | PASS | A1, A2 |
| QA2-11 | ledger continuity | library merge seam / fake snapshots | same `logic-qa2.ts` invocation; concurrent manual and purchase entries | PASS | A1, A2 |
| QA2-12 | forged request/history blocking | HTTP shared settings API | `curl -i -sS -X PUT http://127.0.0.1:55187/api/shared-settings` with student 1 forged `processedRequestIds` and forged `reset` history | PASS | A3, A4 |
| QA2-13 | studentLife concurrent merge | library merge seam / fake snapshots | same `logic-qa2.ts` invocation; remote and next letters/profile assignments | PASS | A1, A2 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV2-01 | duplicate economy request | idempotence / replay | Replaying `qa2-house-buy-01` returns `applied=false`, balance remains 200, and history remains one entry. | PASS | A4 |
| ADV2-02 | zero-delta selection | no-op accounting | House selection changes state but does not append a currency history entry or alter balance. | PASS | A2, A4 |
| ADV2-03 | remote reset + stale teacher | stale overwrite / reset precedence | Reset balance 100 survives; purchased house ownership remains; pre-reset debit is not restored. | PASS | A1, A2 |
| ADV2-04 | next reset raw balance 999 | forged/reset canonicalization | Reset ledger `after=100` is authoritative; output balance is 100 and ownership is retained. | PASS | A1, A2 |
| ADV2-05 | tax + concurrent deposit | race / ordering | Latest economy deposit is included in tax, then allowance is added; wallet 100 and deposit 150 are observed. | PASS | A1, A2 |
| ADV2-06 | manual + economy entries | ledger continuity | Merged entries are newest-first and chain continuously (`189→199`, then `289→189`). | PASS | A1, A2 |
| ADV2-07 | unverified stock history | forged history injection | Economy-looking history without matching verified request activity is ignored; stale balance stays 100. | PASS | A1, A2 |
| ADV2-08 | student forged request ID | authorization / scope | Student generic PUT is rejected with HTTP 403 `STUDENT_SETTINGS_SCOPE_VIOLATION`; no upstream patch occurs. | PASS | A4, A5 |
| ADV2-09 | student forged reset history | authorization / ledger forgery | Student generic PUT is rejected with HTTP 403 `STUDENT_SETTINGS_SCOPE_VIOLATION`; no upstream patch occurs. | PASS | A4, A5 |
| ADV2-10 | remote + next studentLife | concurrent merge / loss prevention | Both unique letters and both profile assignments survive normalization and merge. | PASS | A1, A2 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | executable driver | Fresh isolated logic driver covering economy actions, zero-delta, both reset orderings, tax race, ledger, forgery, and studentLife merge. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/logic-qa2.ts` |
| A2 | transcript | Fresh logic invocation: 13 scenarios passed, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/logic-qa2-run.txt` |
| A3 | executable server | Local HTTP wrapper with in-memory fake Supabase and disposable signed sessions. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/http-qa-server.ts` |
| A4 | transcript | Fresh `curl -i` HTTP observations for house, shop, stock, transfer, profile, zero-delta, replay, and forged PUT cases. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/http-qa2-run.txt` |
| A5 | transcript | Fresh handler guard run: 16 passed, 0 failed, 0 skipped; includes forged request/history/reset cases. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/api-forgery-tests-run.txt` |
| A6 | transcript | Fresh full repository run: 483 passed, 0 failed, 0 skipped. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/full-suite-run.txt` |
| A7 | transcript | Fresh TypeScript validation: `tsc --noEmit` exit 0 with no diagnostics. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review-qa2/lint-run.txt` |
