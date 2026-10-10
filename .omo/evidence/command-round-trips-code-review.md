# Combined storage command code review

Date: 2026-10-10 (Asia/Seoul)

codeQualityStatus: WATCH
recommendation: APPROVE
blockers: []

## Scope and evidence

Reviewed the working-tree diff in `src/server/storageV2Repository.ts`, `src/server/storageCommandHandler.ts`, `api/student-economy.ts`, `tests/api/storageV2Fixture.ts`; read the new `supabase/storage_command_round_trips.sql`, `tests/api/storageCombinedCommands.test.ts`, `tests/storage/commandRoundTrips.integration.test.ts`, and `tests/storage/commandRoundTripsBenchmark.ts`. Consulted the existing scoped mutation/receipt/ancestor-lock SQL, snapshot parser, HTTP harness, and deployment instructions. In-progress UI and progressive-read changes are outside this review.

Goal: reduce command RPC trips while preserving actor/request idempotency, payload/action verification, scoped privacy, conflict retries and honest save confirmation.

No separate notepad was supplied. Evidence consulted: `.omo/evidence/command-round-trips/REPORT.md`, `integration.log`, and `benchmark.log`. The logs exist and match the asserted SQL/API scenarios. `omo-agent-toolkit ulw-loop status --json` returned command not found, so this report uses the required fallback evidence path.

## Findings by severity

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- Reporting consistency: `docs/storage-speed-2026-10-10.md:24` and `:25` retain an earlier benchmark run. The inspected final `benchmark.log` records letter p50 197 -> 104 ms, p95 200 -> 109 ms; deposit p50 197 -> 106 ms, p95 208 -> 113 ms. Refresh the document when integrating final evidence. This does not invalidate the observed 4 -> 2 RPC improvement or the code approval. Parent notified; document is outside the assigned implementation scope.

## Correctness assessment

- `storageV2Repository.ts:135` retains receipt action and canonical payload-hash verification. Prepare parses the receipt before returning a snapshot; changed payload reuse cannot become a successful replay.
- `storage_command_round_trips.sql:24` delegates to the existing scoped mutation, preserving receipt locking, replay-before-current-row validation, scope restrictions, expected revisions and wallet/ledger atomicity. The wrapper adds no parallel or unlocked mutation path.
- `storage_command_round_trips.sql:20` is VOLATILE; the post-mutation read is a subsequent statement. The real PostgreSQL integration log confirms own-write visibility and a single debit/reward under eight identical concurrent requests.
- Prepare is STABLE and reads receipt plus scope together. Explicit economy replay/result scopes restrict the returned projection to the acting student's result scope. The existing snapshot parser checks resource/wallet/history membership and the new parser additionally checks the expected scope.
- Retry-local timestamps and draw rolls remain outside the retry loop. Revision conflicts rebuild from a fresh snapshot; transient serialization/lock failures retain bounded backoff. Business rejection still rechecks the receipt.
- Malformed projections fail closed with 502, while receipt-only confirmation remains available. A SQL projection failure rolls back the combined transaction; lost HTTP responses can still leave a committed receipt and are handled as unconfirmed, not as definite failure or success.
- Flag-disabled calls retain the existing RPC path. New SQL functions are service-role-only, use a restricted search path and disable JIT. Documented rollout installs SQL before enabling the server-only flag; no automatic fallback can repeat a partly acknowledged commit.

## Skill-perspective check

Ran the `omo:remove-ai-slops` and `omo:programming` perspective checks after reading both skills and the TypeScript reference. No introduced blocking violation of either perspective found. Production parsing occurs at the database response boundary and checks actual privacy/shape contracts; the wrappers implement the measured round-trip reduction and flag rollback, rather than speculative abstraction. No new untyped escape hatch, prompt-text test, deletion-only test, tautological test, or implementation-constant-only test found. RPC-count assertions are relevant performance acceptance checks accompanied by persisted state, replay and privacy assertions. The real PostgreSQL test validates the behavior the HTTP fake cannot establish. Existing large repository/API modules are pre-existing; an unrelated split was not requested.

## Verification and limits

Reviewer executed:

- `node --import tsx --test tests/api/storageCombinedCommands.test.ts`: 6 passed, 0 failed.
- `node --import tsx --test tests/api/storageCommands.test.ts tests/api/studentEconomy.test.ts tests/api/storageUpstream.test.ts`: 27 passed, 0 failed.

Inspected, but did not rerun, the worker's real PostgreSQL integration (1 passed) and benchmark logs. No production or live external writes were made. Full-project lint/build and browser QA are the parent's integration responsibility; this audit did not run them. No configured security scanner was used.

Residual risks: locks now remain held through the result-scope read (`storage_command_round_trips.sql:29`); the synthetic 25-client benchmark and 8-way same-request integration did not show a failure, but production-sized scope/history and peak contention remain unmeasured. Measurements include an explicitly modeled 40 ms RPC round trip and are not an operational speed guarantee. The local HTTP-to-PostgreSQL harness does not verify PostgREST schema-cache reload or the deployed environment flag. Deployment remains a user-operated step.
