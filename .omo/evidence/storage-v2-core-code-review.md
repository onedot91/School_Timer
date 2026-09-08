# Storage v2 final code review

## Scope

Read-only re-audit of the storage core, command paths, rewards, cutover runner, and their focused tests before production cutover. No source files, deployment state, or live records were changed.

## Evidence inspected

- `supabase/storage_v2.sql`, `supabase/storage_rewards_v2.sql`, `supabase/storage_classword_v2.sql`, `supabase/storage_today_friend_v2.sql`
- `src/server/storageV2Repository.ts`, `storageCommandHandler.ts`, `studentStorageCommands.ts`, `teacherStorageCommands.ts`, library and classword repositories
- `api/shared-settings.ts`, `api/student-economy.ts`, reward/donation handlers
- `dev/storageCutover.ts`, `STORAGE_CUTOVER.md`, storage SQL/HTTP fixtures
- Focused command executed: `node --import tsx --test dev/storageCutover.test.ts tests/api/storageCommands.test.ts tests/api/student-economy.test.ts` — 23 passed, 0 failed.

## Findings

### CRITICAL

None.

### HIGH

None.

The former student-economy receipt leak is addressed: `scopeEconomyResult` filters balances, history, and mail before both POST responses and stored/replayed receipt responses (`api/student-economy.ts:377-393`, `419`, `453`, `475+`). The focused tests cover both POST and receipt replay (`tests/api/student-economy.test.ts:279-302`), and the live HTTP harness has the matching assertions (`tests/storage/httpHarness.test.ts:51-59`).

### MEDIUM

None.

### LOW / operational watch

- The reopen gate is correctly coupled to reconciliation in the CLI (`dev/storageCutover.ts:219-223`), and the runbook explicitly requires deploying and verifying `STORAGE_PROTOCOL_VERSION=2` while maintenance remains enabled (`STORAGE_CUTOVER.md:47-50`). This is a deployment configuration gate rather than a code defect: do not run `reopen` until that environment value and the staged server/client response are verified.

## Invariants checked

- Legacy writes to `school-timer-main` are rejected while active or in maintenance (`supabase/storage_v2.sql:95-109`); legacy reward functions reject calls (`supabase/storage_rewards_v2.sql:1-17`), and dedicated Classword/Today Friend table writers have v2 guards.
- Generic commands use receipt-first idempotency, wallet-first lock ordering, scoped/revision checks, and immutable new ledger entries (`supabase/storage_v2.sql:192-295`; `src/server/storageCommandHandler.ts:82-104`). There is no ordinary global mutation lock.
- Wallet mutation requires a ledger delta whose before/after chain matches the locked account (`supabase/storage_v2.sql:235-259`), while bootstrap retains legacy history as historical and opens each wallet at its current balance (`321-357`).
- Bootstrap/reconcile compare the complete raw `school-timer-main` projection, all 23 wallets, ledger reconciliation, and preserved feature tables before activation/reopen (`dev/storageCutover.ts:175-223`).
- Teacher currency adjustments lock all affected wallets and append matching ledger history through the generic transaction path (`src/server/teacherStorageCommands.ts:67-84`; `src/server/storageV2Repository.ts:138-149`).
- The old shared-settings `PUT` path is blocked when protocol v2 is configured (`api/shared-settings.ts:498-555`); remaining direct REST calls are reads or dedicated v2 RPC paths. `save-alerts`/announcement data are outside `school-timer-main` and not storage-core writers.

## Skill-perspective check

Ran both `omo:remove-ai-slops` and `omo:programming` perspectives. The reviewed production additions need the boundary validation and transaction abstractions they contain; I found no untyped escape hatch, implementation-mirroring/brittle prompt test, deletion-only test, tautological test, needless production parsing, or unnecessary abstraction in this reviewed scope. The standalone cutover CLI is intentionally cohesive and documents its safety boundary.

## Decision

- `codeQualityStatus`: CLEAR
- `recommendation`: APPROVE
- `blockers`: None in code. Operationally preserve maintenance until the documented production environment and staged endpoint checks pass.

## Deployment-runtime addendum (2026-09-08)

Reviewed the additional runtime-only patch in `src/lib/studentPet.ts`, `src/lib/dailyWriting.ts`, `src/lib/studentSettingsSync.ts`, and `src/lib/vercelFunctionImports.test.ts`.

- The six `.js` specifiers correct Node ESM resolution in modules reached by server handlers; no browser-only extensionless imports were broadened.
- `vercelFunctionImports.test.ts` starts at every `api/*.ts` entry point, transpiles the dependency graph to ESM, and verifies each emitted relative import carries `.js`; this is an observable deployment invariant rather than a source-text-only test.
- The timestamp change uses the existing microsecond-aware comparator, with precision regression cases in `studentSettingsSync.test.ts`. It prevents an older PostgreSQL commit in the same JS millisecond from replacing a newer snapshot.
- The daily-writing positive-net check correctly recognizes a cancelled reward as no longer active while recognizing a later re-award whose ledger ID is suffixed with the request id.
- Validation rerun: `npm run lint` passed; `node --import tsx --test src/lib/vercelFunctionImports.test.ts src/lib/studentSettingsSync.test.ts src/lib/dailyWriting.test.ts src/lib/studentPet.test.ts` passed 29/29.

No CRITICAL, HIGH, or MEDIUM findings. LOW: the static `compareStorageTimestamps` import is placed at the end of `src/lib/studentSettingsSync.ts`; it is valid ESM and not a runtime risk, but should join the top import group in a later formatting cleanup.

Decision remains `codeQualityStatus: CLEAR`, `recommendation: APPROVE`, `blockers: None`.
