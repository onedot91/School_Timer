# Manual QA: storage/sharing readiness

- 대상 SHA: `98c14b58f53dc98dfe63089b2095fe25342c879d`
- 대상 경로: `/tmp/school-storage-review-20260908`
- 실행 시각: `2026-09-08` (Asia/Seoul)
- verdict: **PASS** for backend runtime QA in the stated synthetic local scope.
- fixture: `STORAGE_TEST_PG_MODULE=/tmp/school-storage-runtime/node_modules/pg/lib/index.js`, `STORAGE_TEST_DATABASE_URL=postgresql://postgres:local-fixture-only@127.0.0.1:55439/postgres`.
- release manifest reports `passed:true`, `unchanged:true`, Node `v24.16.0`, source hash `226ea0462cb0be5fe046508f6afcbbd8b14c26d5c05c7b2397f11e5bbd1002c6`; all ten release steps passed.
- No production data, production credentials, or student live transactions were used. Browser UI and production read-only checks are outside this lane and are handled by the parent lane.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S01 | S8 release gate | release runner + isolated PG preflight | `STORAGE_TEST_PG_MODULE=/tmp/school-storage-runtime/node_modules/pg/lib/index.js STORAGE_TEST_DATABASE_URL=postgresql://postgres:local-fixture-only@127.0.0.1:55439/postgres npm run verify:release` | PASS | A01, A02 |
| S02 | S8 type safety | TypeScript compiler | `npm run lint` (release step `typecheck`) | PASS | A03, A02 |
| S03 | S8 unit/API compatibility | Node test runner | `npm test` (release step `unit-api`) | PASS: 1047 passed, 0 failed, 0 skipped | A04, A02 |
| S04 | S5/S9 storage helpers | Node test runner | `node --import tsx --test src/server/storageV2Repository.test.ts src/server/storageScope.test.ts dev/storageCutover.test.ts dev/verifyRelease.test.mjs dev/storageBackup.test.ts` | PASS: 27 passed | A05 |
| S05 | S5 scoped snapshot | real PostgreSQL integration | `node --import tsx --test src/server/storageV2.integration.test.mjs src/server/storageScope.integration.test.mjs` | PASS: scoped reads, private mail, independent inserts, atomic reward, tombstones, receipt coverage | A06 |
| S06 | S6 concurrency/history | real PostgreSQL integration | same `storage-sql` invocation; lossless migration with 24 independent writers | PASS: atomic money, receipts, maintenance, immutable history | A06 |
| S07 | S1/S6 reward claims | real PostgreSQL + SQL concurrency runner | `node tests/storage/run-rewards-v2.mjs` | PASS: 24 concurrent sessions, 23 quiz claims, donation replays, teacher planning, exact wallet/ledger/mail totals | A07 |
| S08 | S5 classword idempotency | real PostgreSQL + SQL concurrency runner | `node tests/storage/classword-concurrency.mjs` | PASS: 23 students same initial, exactly one winner; 24 identical quiz requests, one reward and one completion | A08 |
| S09 | S6 economy scope | HTTP harness + PostgreSQL | `node --import tsx --test tests/storage/economyScope.integration.test.ts` (release `http` step) | PASS: `economyFullReads:0`, `economyFullCommits:0`, `scopedReads:10`, `scopedCommits:4`, reconciliation `[]` | A09 |
| S10 | S6 command/receipt recovery | HTTP harness + PostgreSQL | `node --import tsx --test tests/storage/httpHarness.test.ts tests/storage/rewardAudit.test.ts tests/storage/economyScope.integration.test.ts` | PASS: 24 writers, 30 committed receipts, loss recovery, stale teacher and privacy cases, zero mismatches | A09 |
| S11 | S1/S2 reward audit | teacher-only audit HTTP surface | same `http` invocation; audit fixture reports `missingRewardDetected:6` | PASS: read-only, concurrent false-positive `false` | A09 |
| S12 | S7 emitted runtime | bare Node ESM emitted handlers | `node --test tests/storage/emittedRuntime.test.mjs` | PASS: 10 handlers, 91 emitted modules, 11 probe cases, no loader/`process.execArgv`, full command reads `0`, reconciliation `[]` | A10 |
| S13 | S10 backup/restore | disposable local PostgreSQL databases | `node --import tsx dev/storageRestoreDrill.ts` | PASS: two fresh restore copies, identical manifest/table hashes, replay additional entries `0`, one new entry each, reconciliation `[]` | A11 |
| S14 | S8 production artifact | Vite production build | `npm run build` (release step `production-build`) | PASS: 2317 modules transformed; build completed | A12 |
| S15 | S7 HTTP auth/projection | real `curl -i` against newly started synthetic HTTP harness on `127.0.0.1:3037` | `curl -i http://127.0.0.1:3037/api/shared-settings`; then `curl -i -c <synthetic-cookie-jar> http://127.0.0.1:3037/__fixture/session?student=17`; then `curl -i -b <synthetic-cookie-jar> -H 'x-storage-projection: 1' http://127.0.0.1:3037/api/shared-settings`; then `curl -i -b <synthetic-cookie-jar> http://127.0.0.1:3037/api/student-economy` | PASS: unauthenticated `401`, fixture session `302`, student scoped read `200`, malformed economy GET `400`; cookie redacted | A13 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A01 | S8 | missing prerequisite / nonlocal DB | release checks fail closed with actionable error; nonlocal database is rejected before driver use; no skipped PASS | PASS: 3 release-gate tests passed | A05 |
| A02 | S7 | emitted module defect | intentionally missing extension or runtime export is rejected by bare Node | PASS: both negative emitted fixtures rejected | A10 |
| A03 | S9/S10 | backup tampering / partial restore | tampered, incomplete, unsafe sequence, traversal, duplicate-PK, or changed-source backup is rejected; failed restore emits no success manifest | PASS: negative restore list and helper tests passed | A05, A11 |
| A04 | S5/S6 | cross-student scope / readonly mutation | scoped response rejects another student data; known readonly rows cannot be modified/deleted; private mail is not exposed | PASS: parser/helper and real HTTP privacy cases passed | A05, A09 |
| A05 | S6/S10 | idempotency, response loss, stale writer | receipt replay adds no duplicate entry; response loss is recoverable by receipt; stale teacher and concurrent wallet writes preserve reconciliation | PASS: 30 receipts, 24 writers, zero mismatches; replay `0` additional entries | A06, A09, A11 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A01 | release-log | Full `npm run verify:release` stdout/stderr; exit 0 | `/tmp/school-storage-review-evidence/98c14b58-release/verify-release.log` |
| A02 | release-manifest | Release manifest with ten PASS steps, source hash, `unchanged:true` | `/tmp/school-storage-review-evidence/98c14b58-release/manifest.json` |
| A03 | compiler-log | `npm run lint` / typecheck output | `/tmp/school-storage-review-evidence/98c14b58-release/typecheck.log` |
| A04 | test-log | Full `npm test` output, 1047 passing tests | `/tmp/school-storage-review-evidence/98c14b58-release/unit-api.log` |
| A05 | server-test-log | Storage backup/restore/release/scope helper tests, 27 passing tests including negative cases | `/tmp/school-storage-review-evidence/98c14b58-release/server-dev.log` |
| A06 | postgres-test-log | Two real PostgreSQL storage integration tests | `/tmp/school-storage-review-evidence/98c14b58-release/storage-sql.log` |
| A07 | reward-sql-log | SQL install and 24-session reward/donation concurrency output | `/tmp/school-storage-review-evidence/98c14b58-release/reward-sql.log` |
| A08 | classword-sql-log | Classword concurrency output | `/tmp/school-storage-review-evidence/98c14b58-release/classword-sql.log` |
| A09 | http-test-log | Real HTTP + PostgreSQL economy, command/receipt, and audit output | `/tmp/school-storage-review-evidence/98c14b58-release/http.log` |
| A10 | emitted-runtime-log | Bare Node import negatives and 10-handler HTTP/PG probe | `/tmp/school-storage-review-evidence/98c14b58-release/emitted-runtime.log` |
| A11 | restore-log | Synthetic source/restore hashes, two copies, replay/new-entry checks, negative restore outcomes | `/tmp/school-storage-review-evidence/98c14b58-release/restore-drill.log` |
| A12 | build-log | Vite production build output | `/tmp/school-storage-review-evidence/98c14b58-release/production-build.log` |
| A13 | curl-log | Redacted `curl -i` HTTP responses from fresh synthetic harness | `/tmp/school-storage-review-evidence/98c14b58-release/curl-http.log` |

The source worktree remained at the requested SHA after the run; only pre-existing untracked `.debug-journal.md` and `node_modules` were present. This report is a backend runtime verdict only; it does not claim browser UI or production verification.
