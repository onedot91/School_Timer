# Manual QA Matrix: weekly economy concurrency (final review)

Verdict: PASS

Scope: Current unstaged implementation. All state was isolated in memory or mocked `fetch` responses. No Supabase, browser `localStorage`, real student balance, bid, award, or currency history was mutated.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA-01 | house purchase survives stale teacher save | library seam / fake settings | `node --import tsx .omo/evidence/weekly-economy-concurrency-qa/final-review/final-driver.ts` | PASS | A1, A2 |
| QA-02 | shop purchase debits wallet and stores inventory | library seam / fake state | same final-driver invocation | PASS | A1, A2 |
| QA-03 | stock invest and withdraw preserve position and wallet | library seam / fake state | same final-driver invocation | PASS | A1, A2 |
| QA-04 | bank transfer preserves sender debit and recipient credit | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-05 | profile random and selected purchase paths update assignment atomically | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-06 | weekly tax then allowance uses persisted economy and ledger order | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-06b | weekly tax racing concurrent deposit uses latest economy state | library seam / fake settings | `node --import tsx .omo/evidence/weekly-economy-concurrency-qa/tax-reset-race.ts` | PASS | A6 |
| QA-07 | newer teacher reset does not restore old debit and preserves ownership | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-08 | repeated merge is idempotent | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-09 | unverified forged history cannot alter stale balance | library seam / fake settings | same final-driver invocation | PASS | A1, A2 |
| QA-10 | API profile, deposit, transfer, stock, scope, and forged-ID guards | API handler with mocked fetch | `node --import tsx --test tests/api/student-economy.test.ts tests/api/shared-settings.test.ts` | PASS | A3 |
| QA-11 | repository regression suite | Node test runner | `npm test -- --test-reporter=dot` | PASS | A4 |
| QA-12 | type safety | TypeScript compiler | `npm run lint` | PASS | A5 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-01 | stale teacher save | stale overwrite | Remote house/shop/stock state and matching debits remain when the teacher snapshot has empty state/history. | PASS | A1, A2 |
| ADV-02 | bank transfer | cross-student accounting | One transfer retains both sender debit and recipient credit. | PASS | A1, A2 |
| ADV-03 | economy actions | duplicate request / idempotence | Repeating the same request or merge does not add a second mutation or ledger entry. | PASS | A1, A2, A3 |
| ADV-04 | economy state merge | zero-delta mutation | State-only house selection survives; no-op settlement remains unapplied. | PASS | A1, A2 |
| ADV-05 | reconciliation | bounds/conflict | Impossible negative reconciliation raises `CURRENCY_RECONCILIATION_CONFLICT`. | PASS | A2 |
| ADV-06 | teacher weekly cycle/reset | tax/reset race | Weekly cycle recomputes from latest persisted economy; newer reset keeps intended balance and ownership. | PASS | A1, A2 |
| ADV-06b | teacher weekly cycle | concurrent economy state transformation | A concurrent 200-goma deposit is taxed from the latest remote economy, yielding wallet 100 and deposit 145 after tax/allowance. | PASS | A6 |
| ADV-07 | forged history | unverified ledger injection | Economy-looking history without verified processed request activity is ignored. | PASS | A1, A2, A3 |
| ADV-08 | API authorization | cross-student / generic settings forgery | Student session cannot act for another number or forge `processedRequestIds`. | PASS | A3 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | executable driver | Fresh isolated fake-state driver covering house, shop, stock, transfer, profile, weekly tax/allowance, reset, idempotence, and forged history. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/final-driver.ts` |
| A2 | transcript | Fresh driver invocation and observed 10/10 pass result, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/final-driver-run.txt` |
| A3 | transcript | Fresh mocked API handler run, 20/20 tests passed, 0 skipped. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/api-tests-run.txt` |
| A4 | transcript | Fresh full repository run, 480/480 tests passed, 0 skipped. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/full-suite-run.txt` |
| A5 | transcript | Fresh `tsc --noEmit` run with no diagnostics. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/lint-run.txt` |
| A6 | transcript | Fresh tax/deposit race run: production weekly cycle observes wallet 100 and deposit 145; reset path has no error. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/final-review/tax-reset-race-run.txt` |
