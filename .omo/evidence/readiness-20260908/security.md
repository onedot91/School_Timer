# Security/isolation review — exact SHA `98c14b58f53dc98dfe63089b2095fe25342c879d`

## Verdict

**PASS** — no criterion-blocking security or isolation defect found for tomorrow's classroom storage sharing. Confidence: **HIGH** for the reviewed API/SQL/backup boundaries. This is a read-only review; no production data was modified and no secrets were extracted.

## Scope and intent

- Diff: `87fb3f344d827d6ad9f0bf11af8486a15eb73639..98c14b58f53dc98dfe63089b2095fe25342c879d` in `/tmp/school-storage-review-20260908`.
- User outcome: simultaneous teacher/student storage use must preserve each student's private data, bind receipts to the authenticated actor, reject incompatible/maintenance writes, keep wallet and ledger changes atomic, expose privileged RPCs only to the server role, and provide a tamper-evident private backup/restore path.
- Full relevant sources read: `api/shared-settings.ts`, `api/student-economy.ts`, `api/save-alerts.ts`, `src/server/deviceSession.ts`, `src/server/requestRateLimit.ts`, `src/server/storageScope.ts`, `src/server/storageCommandScope.ts`, `src/server/economyStorageScope.ts`, `src/server/storageCommandHandler.ts`, `src/server/storageV2Repository.ts`, `supabase/storage_v2.sql`, `supabase/storage_scoped_v2.sql`, `supabase/storage_audit_v2.sql`, `dev/storageBackup.ts`, `dev/storageRestoreDrill.ts`, and their focused unit/API/PostgreSQL tests.

## Findings by severity

### CRITICAL / HIGH / MEDIUM

None.

### LOW / NOTE

- **NOTE (non-blocking):** Cross-site rejection is based on `Sec-Fetch-Site: cross-site`, while the signed device cookie is also `Secure; HttpOnly; SameSite=Strict` (`src/server/requestRateLimit.ts:38-40`, `src/server/deviceSession.ts:91-97`). This is appropriate layered protection for supported browsers. Absence of the Fetch Metadata header alone is not treated as cross-site, but the strict host cookie prevents normal cross-site credential attachment; no stated criterion requires Origin/Referer enforcement.
- **NOTE (evidence limitation):** The final production catalog evidence was supplied by the root reviewer rather than independently queried in this lane: deployment `dpl_7Wt4aGrKusAY4W8Dajrx4muAhb9g`, exact SHA, READY, `icn1`, `STORAGE_PROTOCOL_VERSION=2`, 18 storage/wallet RPCs with anon/authenticated execute=false, active=true, maintenance=false, 23 wallets, 2761 ledger rows, reconcile `[]`. This lane did not touch production.

## Security/isolation criteria

1. **Student scope and receipt actor binding — PASS.**
   - Student identity comes from an HMAC-verified, expiring device cookie; student POST/GET economy requests reject a different `studentNumber` before storage RPC access (`api/student-economy.ts:422-473`).
   - Generic command actor keys are derived solely from the verified session (`src/server/storageCommandHandler.ts:25,48-53,63-79`); receipt lookup keys include role/student and, for economy, the target student (`api/student-economy.ts:439,473`).
   - Student command scopes use the session's student number and reject non-`student.*` actions (`src/server/storageCommandScope.ts:32-53`). Mail selection is participant-bound and SQL repeats recipient/sender predicates (`src/server/storageScope.ts:75-83`, `supabase/storage_scoped_v2.sql:59-66`).
   - Focused tests prove another student sees `unknown`, foreign letters are absent, recipient wallet/history are absent from the actor response, and changed payload replay is rejected.

2. **Cross-site, protocol, old-browser, and maintenance fail-closed — PASS.**
   - Mutating shared-settings/economy requests reject cross-site requests before handlers (`api/shared-settings.ts:456-462,505-513`; `api/student-economy.ts:448-452`). The session cookie is `SameSite=Strict`.
   - Generic commands require projection capability before receipt or mutation work and require `protocolVersion === 2` (`src/server/storageCommandHandler.ts:37-57`). Economy POST and receipt GET independently require protocol v2 and `X-Storage-Projection: 1` before RPC work (`api/student-economy.ts:427-471`).
   - SQL `storage_require_writable()` takes the cutover lock and rejects inactive or maintenance state before mutation (`supabase/storage_v2.sql:75-83`); scoped commit calls it first (`supabase/storage_scoped_v2.sql:145`).
   - Tests show old clients create zero receipts/writes/RPC calls and maintenance produces no transaction writes.

3. **RLS/service-role RPC isolation — PASS.**
   - New `SECURITY DEFINER` functions have fixed search paths and explicit `REVOKE ALL ... FROM public,anon,authenticated`, followed by execute grants only to `service_role` (`supabase/storage_scoped_v2.sql:68-69,139-142,183-191`; `supabase/storage_audit_v2.sql:1-26`).
   - Production catalog evidence reports all 18 storage/wallet RPCs non-executable by anon/authenticated. Supabase advisor reports only INFO for RLS-with-no-policy on 19 service-only tables and no WARN/ERROR; this matches the service-role-only design.

4. **SQL scope tamper resistance and wallet atomicity — PASS.**
   - SQL validates scope shape, bounded student IDs/paths, and write-within-read inclusion (`supabase/storage_scoped_v2.sql:9-56`). Commit revalidates every resource against `writeResources`, every wallet/ledger student against `writeWallets`, and every changed key against expected revisions before calling the single transactional mutation RPC (`supabase/storage_scoped_v2.sql:145-179`).
   - The underlying mutation performs receipt serialization/idempotency and wallet/resource/ledger work in one PostgreSQL function transaction; immutable ledger guards and `storage_reconcile_wallets()` provide integrity checks (`supabase/storage_v2.sql`).
   - Reproduced real-PostgreSQL tests: forged `/studentPets/4` deletion under student 17 scope was rejected; private mail remained invisible; 23 concurrent student inserts survived; reward replay credited once; ledger deletion was rejected; reconcile returned `[]`. Economy integration also passed transfer/house counterparty wallet updates, replay-once behavior, zero full reads/commits, and reconcile `[]`.

5. **Safe backup constraints — PASS.**
   - Backup capture requires `REPEATABLE READ READ ONLY`, exact 21-table/one-sequence schema sets, declared PK order, lossless bigint/numeric/json text encoding, deterministic row sorting, and SHA-256 hashes (`dev/storageBackup.ts:7-119`).
   - Writes use a private `0700` directory and exclusive `0600` files; the manifest is written last. Reads reject symlink directories, non-private modes, unexpected/missing files, followed symlinks (`O_NOFOLLOW`), shape/hash/schema/protocol mismatches, duplicate/missing PKs, unsafe sequences, and tampered rows (`dev/storageBackup.ts:122-139`).
   - Restore is restricted to a fresh local database, rejects existing/remote targets and tampered backups before destination creation, imports transactionally, emits no success marker after failure, and validates two independent restores plus receipt replay/wallet reconciliation (`dev/storageRestoreDrill.ts:31-82,137-179`).

## Reproduced verification

- `git rev-parse HEAD` → `98c14b58f53dc98dfe63089b2095fe25342c879d`.
- Focused unit/API command: `node --import tsx --test src/server/storageScope.test.ts tests/api/economyStorageScope.test.ts tests/api/storageCommands.test.ts tests/api/student-economy.test.ts dev/storageBackup.test.ts` → **37 passed, 0 failed**.
- Real PostgreSQL scoped security test with `STORAGE_TEST_PG_MODULE=/private/tmp/school-storage-runtime/node_modules/pg` → **1 passed** (private mail, forged scope rejection, receipt scope, concurrency, reward atomicity, tombstones, immutable ledger).
- Real PostgreSQL economy integration → **1 passed**; emitted `{economyFullReads:0,economyFullCommits:0,scopedReads:10,scopedCommits:4,reconciliation:[]}`.
- `git diff --check` found only trailing whitespace in pre-existing evidence Markdown additions, not production/API/SQL code. This is a NOTE, not a security criterion failure.

## Slop/programming direct pass

Consulted `omo:remove-ai-slops` and `omo:programming` directly. The focused tests assert observable authorization, privacy, atomicity, replay, and filesystem behavior; none merely verifies deletion, mirrors a requested removal, or pins prose. The SQL/TypeScript validation is justified at independent trust boundaries (server and privileged RPC), rather than unused normalization. No new unchecked `as any`, `@ts-ignore`, credential logging, payload logging, or secret-bearing browser import was found in this lane. The existing code-review artifact `.omo/evidence/storage-scope-code-review.md` explicitly records the same skill perspectives and overfit/slop coverage; its claims were independently reproduced here.

## Exact evidence gaps

- No gap that violates the stated security/isolation criteria.
- This lane did not run the full release gate or full restore drill because the QA lane owns release verification. It did run the two relevant real-PostgreSQL isolation/atomicity integrations and focused backup unit tests.
- Production catalog claims are referenced from the root reviewer's read-only query result and should be linked to that reviewer's persisted catalog artifact in the aggregate gate report.
