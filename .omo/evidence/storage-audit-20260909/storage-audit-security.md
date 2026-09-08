# Storage redesign security/data-scope review

- Recommendation: **PASS**
- Reviewed SHA: `6aff30b3aff7de9c2c66494b24832b929a2d267d`
- Scope: `api/shared-settings.ts`, `api/student-economy.ts`, `src/server/storageScope.ts`, `src/server/storageProjection.ts`, `src/server/storageCommandScope.ts`, `src/server/storageCommandHandler.ts`, `supabase/storage_scoped_v2.sql`, and targeted tests.
- Constraints honored: read-only source review; no live backend writes; no unrelated hardening review.

## Original intent and desired outcome

After the storage v2 redesign, a student-authenticated request must not read or write another student's scoped records, display normalizers must not turn defaults from a partial projection into writes that overwrite peers, and retry/recovery must remain exactly-once at the actor/request boundary.

## User outcome review

The reviewed artifact satisfies that outcome in the inspected paths. API handlers derive identity from the signed device session, server code derives storage scope from session plus a known action, mutation construction filters writes against that scope, and the SQL RPC validates both old and proposed resource rows plus wallet/ledger students. Receipts are keyed by actor and request ID, serialized by an advisory transaction lock, and replayed through the existing mutation function, which checks the payload hash.

## Evidence

### Authorization and scope selection

- `api/student-economy.ts:420-432` authenticates the device session and rejects a student GET for another student before receipt access.
- `api/student-economy.ts:457-477` requires protocol v2, rejects a student POST whose session number differs from the body student number, and keys receipts with the authenticated actor plus target student.
- `src/server/storageCommandHandler.ts:56-63` validates protocol/body and enforces student/teacher action namespaces before selecting scope.
- `src/server/storageCommandScope.ts:13-14` documents and implements server-selected dependencies; `:32-52` binds every student action to the authenticated `own` student and rejects unknown actions.
- `src/server/storageScope.ts:53-73` requires every write selector and wallet to be contained in its read scope.

### Partial projections cannot overwrite peers

- `src/server/storageScope.ts:75-85` matches resources by explicit path and owner/mail selector.
- `supabase/storage_scoped_v2.sql:156-174` requires each proposed resource/wallet/ledger key to have an expected revision and be within `writeResources`/`writeWallets`; it checks both the old row and proposed row, preventing owner reassignment and out-of-scope delete/update.
- `src/server/storageScope.test.ts:28-37` proves extra default wallet/resource values produced by normalization are omitted from the mutation.
- `src/server/storageScope.test.ts:39-49` proves known read-only peer rows cannot be changed/deleted and out-of-scope peer response data is rejected.
- `tests/api/shared-settings.test.ts:1223-1355` exercises student read-then-save behavior with another student's balances, history, pet, economy, emotion, Sudoku and baseball state and verifies preservation plus forbidden writes.

### Idempotency boundary

- `supabase/storage_scoped_v2.sql:151-155` serializes `(actor_key, request_id)` with an advisory transaction lock and performs receipt replay before current-row conflict validation.
- `supabase/storage_scoped_v2.sql:175-177` records the authoritative scope only after a saved mutation.
- `src/server/storageCommandHandler.ts:65-67` checks the same actor/request/action/payload receipt before retry work.
- `tests/api/storageCommands.test.ts:43-49` verifies identical replay succeeds and changed payload with the same request ID conflicts.
- `tests/api/storageCommands.test.ts:69-77` verifies a lost response is recovered from the receipt without duplicate credit.
- `tests/api/student-economy.test.ts` targeted suite verifies economy retry, transfer/house effects, and receipt privacy.

## Reproduced verification

Command:

`node --import tsx --test src/server/storageScope.test.ts tests/api/storageCommands.test.ts tests/api/student-economy.test.ts tests/api/shared-settings.test.ts`

Result: **59 passed, 0 failed**. This includes hostile cross-student access, peer preservation, default-normalization filtering, stale replay, lost-response recovery, concurrent mail writes, and economy scope cases.

## Remove-AI-slops / programming pass

Direct review found no criterion-blocking overfit or slop in the scoped evidence. The relevant tests assert observable persisted values, response scope, forbidden status, replay count/effect, and peer preservation. They do not merely assert that lines or prose were removed, mirror a normalization implementation, or introduce extraction solely for tests. The scope model adds necessary trust-boundary validation rather than speculative parsing. Large-file/style preferences were treated as notes only because they are not failures of the requested storage-security criteria.

## Blockers

None.

## Exact evidence gaps / notes

- No live PostgreSQL or Supabase write was run, per the task constraint. The SQL conclusions are from direct function review and the targeted synthetic API/unit fixtures; the repository's real-PostgreSQL integration scenarios were inspected but not executed in this review.
- The reviewed HEAD commit itself contains the known library clock follow-up; the storage redesign files are evaluated as present at this SHA rather than as changes introduced only by that commit.
