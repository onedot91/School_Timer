# Tomorrow classroom readiness — goal/constraints review

- Exact reviewed SHA: `98c14b58f53dc98dfe63089b2095fe25342c879d`
- Diff: `87fb3f344d827d6ad9f0bf11af8486a15eb73639..98c14b58f53dc98dfe63089b2095fe25342c879d`
- Verdict: **PASS**
- Confidence: HIGH for the reviewed source/unit/API artifacts; the parent owns the full release and production recheck.
- Source edits: none.

## Original intent and desired outcome

The user needs the classroom ready tomorrow after 17-student state and six-unit reward loss, plus conflicts during parallel student saves. The required outcome is that all students' unrelated state survives scoped saves; wallet, reward, and history changes remain atomic; retrying the same request cannot pay twice; maintenance/upgrade keeps drafts for an explicit manual retry; and an unconfirmed response is never shown as success.

## Criterion review

| Criterion | Result | Evidence |
| --- | --- | --- |
| C1 Preserve every student's unrelated/shared state during scoped and parallel saves | PASS | `src/server/storageCommandScope.ts`, `src/server/storageV2Repository.ts:240-287`, `supabase/storage_scoped_v2.sql:132-167`; focused tests `tests/api/storageCommands.test.ts:52-67` and `src/server/storageScope.test.ts:28-49` passed. |
| C2 Wallet/reward/history mutations are atomic and immutable | PASS | Scoped transaction validates wallet/ledger scope in `supabase/storage_scoped_v2.sql:132-167`; historical rows are emitted only as additions in `src/server/storageV2Repository.ts:140-153`; focused history test `src/server/storageScope.test.ts:71-77` passed. Deployment artifact records reconciliation `[]` before and after. |
| C3 Same-request retries are idempotent, including response loss | PASS | Receipt is checked before mutation and replayed in `src/server/storageCommandHandler.ts:65-83`; SQL locks by actor/request and replays existing receipt before current-row validation. `tests/api/storageCommands.test.ts:43-49,69-78` passed and proves same payload pays once while changed payload is rejected. |
| C4 Maintenance/upgrade preserves drafts and requires user action | PASS | Draft identity/state handling is in `src/lib/studentStorageCommand.ts:47-87,92-131`; exact operational errors are separated from uncertainty. Focused library/draft and storage-availability tests passed, including durable reload, changed actor isolation, and zero automatic mutation retry. |
| C5 No false success for network loss, malformed response, or missing receipt | PASS | `src/lib/storageCommandClient.ts:80-113` performs one POST, read-only receipt checks, and ends with `STORAGE_CONFIRMATION_REQUIRED`; it only returns saved on a parsed response or matching receipt. The focused test run passed the lost-response, malformed-response, unknown-receipt, and server-maintenance-during-confirmation cases. |
| C6 Missing/incorrect rewards and wallet mismatches are visible without writing | PASS | `supabase/storage_audit_v2.sql:1-26` supplies one stable snapshot; `src/lib/rewardAudit.ts:39-48` nets matching ledger entries; `src/server/rewardAuditRepository.ts:29-78` distinguishes missing/mismatch/unavailable evidence. KST-midnight and `document` visibility regression tests passed under `TZ=UTC`. |

## Five edge-case traces

1. **23 simultaneous student mailbox saves:** each request receives a server-derived actor scope, scoped loads replace full-class loads, each commit writes only the actor-visible letter rows, and all 23 responses are 200 while pre-existing private mail remains. Evidence: `src/server/storageCommandHandler.ts:63-83`, `tests/api/storageCommands.test.ts:52-67`.
2. **Commit succeeds but response is lost:** the first POST returns an error to the client, the durable receipt remains, GET resolves that exact actor/request, and replay of the same payload returns the stored result without another +6. Evidence: `src/server/storageCommandHandler.ts:48-53,65-70`, `tests/api/storageCommands.test.ts:69-78`.
3. **Same request ID with changed payload:** receipt verification hashes action+payload; a duplicate identical payload replays, while a changed payload gets 409 and cannot mutate current data. Evidence: `src/server/storageV2Repository.ts:102-111`, `tests/api/storageCommands.test.ts:43-49`.
4. **Maintenance appears while confirming an uncertain write:** the original POST is never automatically repeated; maintenance on receipt GET does not prove rejection or publish a maintenance success/failure state, and the caller remains in confirmation-required state. Evidence: `src/lib/storageCommandClient.ts:84-106`, `src/lib/storageAvailabilityClients.test.ts:73-83`.
5. **Reward claim/marker exists but ledger credit is absent at Korean midnight:** the audit derives the Korean date from the checked timestamp, excludes only today's unfinished word entry, nets ledger IDs, and reports +6/0 as missing rather than trusting a claim marker. Evidence: `src/server/rewardAuditRepository.ts:29-47`, `src/lib/rewardAudit.ts:39-48`; focused reward tests include the `TZ=UTC` Korean-midnight regression and marker-without-ledger case.

## Independent reproduction

Command: `TZ=UTC node --import tsx --test` over storage scope/projection/order/availability, student economy, library draft/client, reward audit/polling, and API command/economy/audit suites.

Result: **85 passed, 0 failed, 0 skipped**, duration 5.17s. `git diff --check` found whitespace only in two evidence markdown reports; no production source whitespace error.

The provided deployment record `.omo/evidence/storage-followup-deployment.json` reports a 10-stage release gate, 1,047 unit/API tests, two synthetic restores with zero replay additions and zero reconciliation entries, and unchanged 23 wallets/2,761 ledger rows across production deployment. I treated those claims as supporting artifacts, not as a substitute for the independent focused run above.

## Direct remove-ai-slops / programming pass

The focused tests distinguish observable failure modes: they are not deletion-only, requested-removal, prompt/prose, tautological, or output-derived assertions. Scope parsing/projection code is required at an untrusted DB/browser boundary and is exercised by foreign-row, stale-response, tombstone, ordering, receipt, and concurrency cases. The existing code-review reports explicitly state both skill perspectives and overfit criteria.

NOTE (not a blocker): `src/server/storageV2Repository.ts` has 285 nonblank/noncomment lines, exceeding the programming skill's 250-line maintenance threshold. This does not violate a stated classroom-readiness success criterion, and splitting it immediately would add release risk, so it remains a nonblocking maintenance note.

NOTE (artifact clarity): `.omo/evidence/reward-audit-code-review.md` still says REQUEST_CHANGES for the former timezone and visibility defects. Current source fixes them at `src/server/rewardAuditRepository.ts:33` and `src/components/teacher/TeacherRewardAudit.tsx:35-36`, and both focused regressions pass. The stale prose should not be read as the current code verdict.

## Blockers

None found against C1-C6.

## Evidence gaps

- This lane did not rerun PostgreSQL, restore-drill, emitted-runtime, Vite build, or production endpoints; those are assigned to the parent release gate.
- No production student transaction was used, as required. Therefore this review proves the implementation and synthetic scenarios, not a new live student write after deployment.
