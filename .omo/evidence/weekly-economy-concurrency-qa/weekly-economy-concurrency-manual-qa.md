# Manual QA: weekly economy concurrency

Verdict: PASS

Scope: changed `src/lib/weeklyMission.ts` and `src/lib/weeklyMission.test.ts`. All scenarios use isolated in-memory fake settings. No production, Supabase, localStorage, balance, bid, award, or currency-history writes were made.

## Surface evidence

| Scenario | Criterion reference | Surface | Exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|---|
| MC-01 | stale teacher save preserves house purchase | library seam | `node --import tsx .omo/evidence/weekly-economy-concurrency-qa/driver.ts` | PASS | A1, A2 |
| MC-02 | stale teacher save preserves shop purchase | library seam | same driver invocation | PASS | A1, A2 |
| MC-03 | stale teacher save preserves stock investment debit/position | library seam | same driver invocation | PASS | A1, A2 |
| MC-04 | stale teacher save preserves stock withdrawal credit/removal | library seam | same driver invocation | PASS | A1, A2 |
| MC-05 | bank transfer preserves sender and recipient currency | library seam | same driver invocation | PASS | A1, A2 |
| MC-06 | zero-delta house selection preserves economy state | library seam | same driver invocation | PASS | A1, A2 |
| MC-07 | zero-delta investment settlement remains a no-op | library seam | same driver invocation | PASS | A1, A2 |
| MC-08 | zero-delta investment settlement preserves state-only update | library seam | same driver invocation | PASS | A1, A2 |
| MC-09 | repeated purchase merge is idempotent | library seam | same driver invocation | PASS | A1, A2 |
| MC-10 | repeated transfer merge is idempotent | library seam | same driver invocation | PASS | A1, A2 |
| MC-11 | duplicate history ID is not double-applied | library seam | same driver invocation | PASS | A1, A2 |
| MC-12 | impossible negative economy reconciliation is rejected | library seam | same driver invocation | PASS | A1, A2 |
| MC-13 | teacher weekly tax + allowance retains remote purchase and state | library seam | same driver invocation | PASS | A1, A2 |
| MC-14 | newer teacher reset keeps purchase state without restoring the old debit | library seam | same driver invocation | PASS | A1 |
| MC-15 | changed-path unit behavior | Node test runner | `node --import tsx --test src/lib/weeklyMission.test.ts src/lib/studentEconomy.test.ts` | PASS | A3 |
| MC-16 | regression suite | Node test runner | `npm test -- --test-reporter=dot` | PASS | A4 |
| MC-17 | type safety after change | TypeScript compiler | `npm run lint` | PASS | A5 |
| MC-18 | teacher tax uses concurrent economy state | library seam | `node --import tsx .omo/evidence/weekly-economy-concurrency-qa/tax-reset-race.ts` | PASS | A6 |

## Adversarial cases

| Scenario | Criterion reference | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| ADV-01 | stale teacher save | stale overwrite | Remote shop/house state and its debit are retained when teacher snapshot has empty history/state. | PASS | A1, A2 |
| ADV-02 | stale teacher save | cross-student accounting | Transfer debit and recipient credit are both retained; sender economy retains transfer recipient. | PASS | A1, A2 |
| ADV-03 | merge safety | duplicate/idempotence | Re-merging the same remote state does not add a second debit/credit or history entry. | PASS | A1, A2 |
| ADV-04 | merge safety | zero-delta mutation | State-only selection and a state-changing settlement with no currency delta survive by processed request ID; no-op settlement does not mutate. | PASS | A1, A2 |
| ADV-05 | merge safety | bounds/conflict | An impossible negative result raises `CURRENCY_RECONCILIATION_CONFLICT` rather than emitting inconsistent currency. | PASS | A1, A2 |
| ADV-06 | teacher cycle | tax/reset interaction | Weekly tax+allowance recomputes from the latest purchase; a newer intentional reset remains 100 while purchase ownership survives. | PASS | A1 |
| ADV-07 | changed implementation | regression | Existing weekly mission/economy tests remain green with no skips or failures. | PASS | A3, A4 |
| ADV-08 | teacher weekly tax | state transformation race | A concurrent 200-goma deposit is taxed with the latest remote economy state while preserving the deposit. | PASS | A6 |

## Artifacts

| ID | Kind | Description | Path |
|---|---|---|---|
| A1 | driver | Isolated executable driver covering 16 economy/concurrency scenarios. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/driver.ts` |
| A2 | transcript | Driver invocation and observed JSON result: 16/16 passed, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/driver-run.txt` |
| A3 | transcript | Targeted changed-path test run: 58/58 passed, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/targeted-tests.txt` |
| A4 | transcript | Full repository test run: 473/473 passed, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/full-suite.txt` |
| A5 | transcript | TypeScript lint: `tsc --noEmit`, exit 0. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/lint.txt` |
| A6 | transcript | Tax/deposit race: production cycle observes wallet 100/deposit 145 as expected; raw merge-only comparison is recorded as a lower-level limitation; reset passes. | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/weekly-economy-concurrency-qa/tax-reset-race-run.txt` |
