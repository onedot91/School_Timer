# Task 6 server independent review — CONFIRMED (WATCH)

Reviewed 2026-09-05. This is an independent, read-only review of the current
working tree. It does **not** rely on the executor's result claims as proof.

## Frozen reviewed inputs

| File | SHA-256 |
| --- | --- |
| `api/shared-settings.ts` | `e8cb14910d687087995fa83726d8371f242ae2eac059e75648a1804b16200289` |
| `api/student-economy.ts` | `a2c503fdabdac71c192977b569d08a005c03910398c81355d9a408caf430bb70` |
| `tests/api/shared-settings.test.ts` | `bdb714621d910a385c0b3ba1a7457a69d00bcd11ac39aecd04f60be367ad2e62` |
| `tests/api/student-economy.test.ts` | `1fc74117c2143ee804c7f1108fbfe0a23524e1a2ca1dfe7d7ef2b6cb75fe2322` |
| `src/lib/canvasLibraryPlacement.ts` | `799b7523f750f2a95f2f3b325235e8326d2a5a777ca03628b43d80ad0d1f9d20` |

The worker report `task-6-server.md` was inspected, but assertions there were
verified against source, executable tests, and current hashes above. The listed
hashes match its source freeze exactly.

## Independent results

- `node --import tsx --test tests/api/shared-settings.test.ts tests/api/student-economy.test.ts` — **PASS**, 34/34, 0 failures (856 ms).
- `npm run lint` (`tsc --noEmit`) — **PASS**.
- `git diff --check -- api/shared-settings.ts api/student-economy.ts tests/api/shared-settings.test.ts tests/api/student-economy.test.ts src/lib/canvasLibraryPlacement.ts` — **PASS** (no output).
- Read-only HTTP check against root-owned, current-source synthetic harness `127.0.0.1:3031`: `curl -i /api/shared-settings` returned **401** `{ "error": "DEVICE_REGISTRATION_REQUIRED" }`; `/qa/state` contained exactly one synthetic timeout-replay book in slot 12, student 1 balance 10, and one reward-history entry. I neither reset, wrote to, nor stopped that root-owned harness.

The server flow is substantively correct for the requested atomic placement:

1. A fresh full-row read is used for each placement attempt; PATCH is conditional on both fixed id and `updated_at` ([shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:212), [shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:252)).
2. Same-slot collision, different-slot retry retention, initial-row insert-only retry, and post-commit timeout idempotency are state-asserted by the stateful fake, not status-only tests ([shared-settings.test.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts:793), [shared-settings.test.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts:824), [shared-settings.test.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts:846)).
3. `nextUpdatedAt` is monotonic against the loaded version, and the parallel economy/library test proves no fixed-millisecond alias drops either write ([shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:223), [shared-settings.test.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts:908)). The equivalent economy writer change is present at [student-economy.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/student-economy.ts:163).
4. Generic writes re-read the authoritative row and replace incoming books before saving, including a post-replacement 1 MB size check ([shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:481), [shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:494)).
5. Placement is student-only; command parsing has exact keys, bounded fields, UUID request IDs, and slot capacity; responses are projected to the calling student ([shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:450), [canvasLibraryPlacement.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/canvasLibraryPlacement.ts:69), [shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:240)).

## Edge probes and evidence limits

- Malformed command, malformed authoritative row, server-write 500, student/teacher scope, cross-site request, initial row, stale CAS, and five-conflict retry exhaustion are directly covered by the focused suite.
- Untrusted metadata: accepted placement metadata is reconstructed from the exact parsed command; arbitrary keys and malformed nested books fail parsing. Authoritative-row parsing rejects missing/invalid id/value/timestamp.
- Timeout/replay: a committed PATCH followed by `TimeoutError` reloads and returns the stored receipt without another reward.
- Cache staleness: writes do not consult `updatedAtCache`; they call `loadRow` for each retry. Metadata cache generation prevents an older metadata response overwriting a newly written cache value.
- Bounded retries/hung fetch: placement has five attempts and each fetch has `AbortSignal.timeout(8000)`; jitter is 20–100 ms. No unbounded loop was found.
- `saveValue` treating any nonempty successful `select=id` array as saved ([shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:281)) is **not a demonstrated boundary flaw**: PostgREST's id/updated_at-filtered PATCH and `select=id` response make a nonempty array the mutation-match contract. A forged/malformed successful body from a trusted Supabase service could make it report success, but it cannot be induced by client input and the task's stateful fake already verifies the actual stored state. Keep this as defense-in-depth only, not a correctness blocker.
- Raw JSON string commands are not accepted because placement parsing precedes the legacy `parseBody` string parsing. **N/A for deployed Vercel JSON requests**, whose parsed `req.body` is the handler contract; it is a compatibility concern only for a custom raw-body adapter, which is not present in scope.
- Manual HTTP mutation was intentionally not run against 3031 because it is root-owned and the assignment prohibits mutating it. The read-only HTTP check above and isolated in-process authoritative-state tests are the independent evidence; no production network/credentials, dependency, SQL, commit, or product edit occurred.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. [shared-settings.ts:464](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:464) adds a blanket `catch` that turns every unexpected placement failure into `LIBRARY_SAVE_FAILED` without narrowing or logging. This violates the consulted `programming` perspective and makes a coding defect indistinguishable from an upstream failure. It did not mask any tested required outcome, so this is WATCH rather than a blocking correctness finding.
2. [shared-settings.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/shared-settings.ts:1) is now 490 pure LOC (was already oversized, and this change adds another persistence responsibility). It mixes metadata cache, auth/scope policy, generic writer, CAS transport, and placement orchestration. The consulted `remove-ai-slops`/`programming` 250-LOC perspective is violated; a scoped follow-up decomposition is warranted, but an unrequested broad refactor should not block the atomic behavior gate.
3. [shared-settings.test.ts:871](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/shared-settings.test.ts:871) combines generic-book authority, monotonicity, and size-limit rejection in one test, and seeds the timestamp with live wall time at line 880 while asserting exactly `+1 ms` at line 891. That is avoidable timing coupling; use a fixed `Date.now` as the cross-writer test does, and split the independent outcomes. The focused run passed, but this is a maintainability/flake risk.

### LOW

None.

## Skill-perspective check

Ran: `omo:remove-ai-slops` and `omo:programming`, including the TypeScript data-modeling and error-handling references. No deletion-only tests, prose/prompt pins, tautological status-only placement tests, implementation-constant mirrors, untyped `any`/assertion escapes, or unnecessary new production parsing/normalization were found. The diff does violate both perspectives in the two MEDIUM production-quality findings above (broad catch and oversized mixed-responsibility module); the test-shape/timing finding also violates the programming test discipline.

## Cleanup receipt

An attempted private `127.0.0.1:3035` harness could not bind in the sandbox and was not left running. The copied temporary harness/driver and log remain only under `/private/tmp/canvas-task6-independent-*`; no workspace product file was edited. Root-owned port 3031 process was not killed or mutated. Existing dirty tree entries were observed and preserved.

## Verdict

- `codeQualityStatus`: **WATCH**
- `recommendation`: **APPROVE** for the Task 6 atomic-server correctness gate
- `blockers`: **None**

