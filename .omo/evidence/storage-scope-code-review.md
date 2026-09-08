# Scoped storage command review

Read-only review of `storageCommandScope.ts`, `storageCommandHandler.ts`,
`storageProjection.ts`, `storageScope.ts`, `storageV2Repository.ts`, the scoped
SQL boundary, and all current student/teacher command dependencies. No operating
data was accessed and no implementation was changed.

## Result

`codeQualityStatus: CLEAR`  
`recommendation: APPROVE`  
`blockers: none found in the reviewed scope.`

## Action coverage

| Action family | Scoped inputs and writes checked |
| --- | --- |
| Student letter send/read | participant mail rows; read targets only the recipient's row |
| Student failure create/stamp | own story plus own wallet/history; individual stamped story |
| Student pet | own pet; feed also own wallet/history and auction items/bids/awards |
| Student emotion, Sudoku, baseball | own progression plus own wallet/history |
| Student auction bid | own wallet read-only plus all auction item/bid/award/history state |
| Teacher settings | only requested whitelisted settings fields |
| Teacher currency and deduction | intended target wallets/history; deduction also target economy and mail |
| Teacher role | full role state plus target wallet/history/mail |
| Teacher auction/finalize/remove/weekly close | all auction state and all wallets; close also economy, stock, settlement, archive |
| Teacher mail and writing | recipient-specific mail; writing also daily-writing state and target/all recipient rows as appropriate |
| Teacher donation reset | donation state and archive |

## Findings by severity

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Evidence

- The command scope is server selected (`storageCommandScope.ts:13-80`), and the
  SQL RPC repeats write-resource, wallet, and ledger authorization checks
  (`storage_scoped_v2.sql:132-167`).
- `buildScopedStorageMutation` rejects modifications/deletions to loaded
  read-only rows and serializes only declared writable resources and wallets
  (`storageV2Repository.ts:240-287`).
- Projection patches retain only rows visible in the scoped snapshot and include
  tombstone revisions (`storageProjection.ts:4-25`), while the client parser
  rejects unknown parents, owners, duplicate rows, or missing revisions.
- `storageScope.test.ts` covers foreign-row rejection, projection privacy,
  parent/order handling, and partial-normalizer write suppression. The separate
  PostgreSQL integration test covers scope-restricted receipts, concurrent
  per-student writes, cross-scope deletion isolation, and predicate revision
  conflicts.

## Skill perspective

The `omo:programming` and `omo:remove-ai-slops` perspectives were consulted.
The new scope boundary is a justified security/concurrency boundary, and its
tests exercise observable authorization and merge behavior. I found no
implementation-mirroring or deletion-only test, unchecked escape hatch, or
unnecessary production parsing in this reviewed change.
