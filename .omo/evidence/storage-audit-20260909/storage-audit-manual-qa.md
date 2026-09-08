# Storage audit manual QA

- Reviewed SHA: `6aff30b3aff7de9c2c66494b24832b929a2d267d`
- Surface scope: Node runtime library clients with synthetic `fetch`; no production writes, no browser sessions.
- Result: **FAIL**. The targeted suite passed 41/41 tests, but the direct production-shaped probe exposed a timestamp ordering defect for PostgreSQL's accepted space-separated `+00` form.

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| SC-01 | success 200 response decoding; PostgreSQL timestamp | Node library runtime, `storageCommandClient.executeStorageCommand` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-01) | PASS | A1, A2 |
| SC-02 | reversed response arrival must retain newest authoritative snapshot | Node library runtime, two concurrent `executeStorageCommand` calls | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-02) | FAIL | A1, A2 |
| SC-03 | success 200 response decoding; PostgreSQL timestamp | Node library runtime, `studentEconomyClient.updateStudentEconomy` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-03) | PASS | A1, A2 |
| SC-04 | uncertain write resolves by same-request committed receipt | Node library runtime, `studentEconomyClient.updateStudentEconomy` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-04) | PASS | A1, A2 |
| SC-05 | success 200 response decoding; PostgreSQL timestamp | Node library runtime, `canvasLibraryClient.placeBook` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-05) | PASS | A1, A2 |
| SC-06 | malformed 200 response is rejected as retryable | Node library runtime, `canvasLibraryClient.placeBook` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-06) | PASS | A1, A2 |
| SC-07 | PostgreSQL microsecond ordering | Node library runtime, `compareStorageTimestamps` | `cd /tmp/school-storage-audit-20260909 && node --import tsx storage-audit-runtime.mjs` (driver case SC-07) | FAIL | A1, A2 |
| TS-01 | existing response-order, projection, economy, canvas, and availability contracts | Node test runner | `cd /tmp/school-storage-audit-20260909 && node --import tsx --test src/lib/storageResponseOrder.test.ts src/lib/storageProjectionPatch.test.ts src/lib/studentEconomyClient.test.ts src/lib/canvasLibraryClient.test.ts src/lib/storageAvailabilityClients.test.ts` | PASS (41/41) | A3 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-01 | response ordering | reversed arrival with same millisecond, distinct PostgreSQL microseconds `.123456+00` then `.123457+00` | Older response must not overwrite wallet 500 with 400 | FAIL: returned 400 | A1, A2 |
| ADV-02 | partial snapshot safety | partial/late projections from different features | Preserve unrelated books, letters, profiles, wallets and merge by revision | PASS: covered by targeted projection/economy tests | A3 |
| ADV-03 | receipt retry | POST response lost after possible commit; GET receipt returns committed | Issue one POST, query same request ID, return committed result | PASS: SC-04 and targeted test observed POST then GET | A1, A2, A3 |
| ADV-04 | malformed success | HTTP 200 missing authoritative book/value | Reject with retryable `INVALID_LIBRARY_RESPONSE`; do not report success | PASS: SC-06 | A1, A2 |
| ADV-05 | PostgreSQL timestamp equivalence | space-separated timestamp with `+00` timezone and sub-millisecond difference | Compare microseconds, while accepting the timestamp as valid | FAIL: comparator returned 0 for `.123457+00` vs `.123456+00` | A1, A2 |

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | runtime-log | Synthetic production-shaped driver output; SC-01/03/04/05/06 PASS, SC-02/07 FAIL | [/tmp/storage-audit-runtime-output.log](/tmp/storage-audit-runtime-output.log) |
| A2 | driver | Disposable runtime driver source for all seven cases | [/tmp/school-storage-audit-20260909/storage-audit-runtime.mjs](/tmp/school-storage-audit-20260909/storage-audit-runtime.mjs) |
| A3 | test-log | Targeted Node test runner output; 41 passed, 0 failed, 0 skipped | [/tmp/storage-audit-targeted-tests.log](/tmp/storage-audit-targeted-tests.log) |
| A4 | source | Timestamp comparator implementation reviewed for failure localization | [/tmp/school-storage-audit-20260909/src/lib/storageResponseOrder.ts](/tmp/school-storage-audit-20260909/src/lib/storageResponseOrder.ts:19) |

## Finding

`src/lib/storageResponseOrder.ts:24` extracts fractional seconds only when the timestamp ends in `Z`, `+HHMM`, or `+HH:MM`. `Date.parse` accepts PostgreSQL's space-separated `+00` form but truncates it to milliseconds; therefore two commits in the same millisecond compare equal and the later-arriving older response can win. The current live-shaped probe used `+00`; root's production probe reports deployed responses as ISO `T...+00:00`, so this is a latent accepted-input defect rather than confirmed loss on the deployed timestamp shape.

No source files were edited. The weekly mission direct-POST/reporting omission was not runtime-tested in this storage-client lane; root has separately classified it as pre-existing.

