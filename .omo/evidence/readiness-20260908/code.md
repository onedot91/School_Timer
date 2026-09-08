# Storage v2 code-correctness review

- Reviewed commit: `98c14b58f53dc98dfe63089b2095fe25342c879d`
- Reviewed range: `87fb3f344d827d6ad9f0bf11af8486a15eb73639..98c14b58f53dc98dfe63089b2095fe25342c879d`
- Verdict: **PASS**
- Review scope: scoped storage reads/writes, request receipts and retry identity, stale response projection merging, student economy and library integration, and SQL scope enforcement.

## Evidence inspected

- Scoped command processing and replay: `src/server/storageCommandHandler.ts:35-98`, `src/server/storageCommandScope.ts:14-80`, `src/server/storageV2Repository.ts:101-113,240-292`, and `supabase/storage_scoped_v2.sql:139-179`.
- Student economy scopes and returned projection: `src/server/economyStorageScope.ts:6-63`, `api/student-economy.ts:396-410,473-504`, and `src/lib/studentEconomyClient.ts:37-46,115-125,134-185`.
- Client request identity and uncertain-write confirmation: `src/lib/storageCommandClient.ts:34-98`, `src/lib/studentStorageCommand.ts:43-130`, and `src/lib/teacherStorageClient.ts:14-43`.
- Projection ordering and partial merge behavior: `src/lib/storageResponseOrder.ts:37-76`, `src/lib/storageProjectionPatch.ts:102-128`, and `src/server/storageProjection.ts:8-29`.
- Library scoped mutation/projection: `src/server/libraryCompetitionRepository.ts:18-58`, `src/lib/canvasLibraryClient.ts:200-276`, and `src/lib/libraryCompetitionClient.ts:27-91`.

## Findings

### CRITICAL

None.

### HIGH

None. The reviewed command paths derive scopes server-side, constrain writes to the loaded scope in both TypeScript and SQL, verify receipt hashes before replay, and return partial projections through revision-aware patch application. The economy transfer/house paths include the recipient wallet and ledger in their explicit scope, while keeping the recipient's data out of the caller response.

### MEDIUM

1. `src/server/storageV2Repository.ts:1-292` is 285 pure LOC and now owns transport parsing, full snapshots, scoped snapshots, ordering reconciliation, mutation construction, and commits. This exceeds the consulted programming/remove-ai-slops size criterion. It is not a demonstrated functional failure in this range, but it makes this central lost-update boundary harder to audit and raises future regression risk. Split the scoped snapshot/mutation logic from the base repository seam before further storage changes.

### LOW

1. `src/server/storageV2Repository.ts:2` imports `storageScopeRevisionKeys`, but no production code in that module uses it. Remove the unused import. The helper is used by fixtures/tests, so this is not dead behavior.

## Validation

- `git diff --check 87fb3f344d827d6ad9f0bf11af8486a15eb73639..HEAD` found only trailing whitespace in pre-existing review evidence artifacts under `.omo/evidence/`; no source diff whitespace error was found.
- `npm run lint` passed (`tsc --noEmit`).
- `npm test -- --test-name-pattern='(storage|Storage|economy|Economy|projection|Projection|receipt|Receipt|library|Library)'` passed: 1047 tests, 0 failures.
- Relevant tests include concurrent transfers, stale wallet deductions, lost-response receipt recovery, scoped command/receipt reads, 23 mailbox writes, library slot races, partial projection preservation, and old-client rejection. I inspected the tests and their fixtures; they exercise observable state and concurrency outcomes rather than only asserting a requested removal.

## Skill-perspective check

Ran after consulting `omo:remove-ai-slops` and `omo:programming`. No deletion-only, tautological, implementation-constant-only, or brittle prompt tests were found in the reviewed storage paths. Boundary parsing/validation is appropriate here because these modules consume HTTP/SQL/local-storage data. The only violations under those perspectives are the MEDIUM oversized central repository module and the LOW unused import above.

## Decision

`codeQualityStatus: WATCH`  
`recommendation: APPROVE`  
`blockers: []`
