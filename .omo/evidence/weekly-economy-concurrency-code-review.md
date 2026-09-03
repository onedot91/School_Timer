# Code quality review — weekly-economy-concurrency

## Verdict

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- `reportPath`: `.omo/evidence/weekly-economy-concurrency-code-review.md`
- `blockers`:
  1. Remote-side resets are omitted from the reconciliation boundary, so an older remote economy debit can be replayed after that reset and change the teacher's intended balance.

## Scope and evidence inspected

Reviewed the current unstaged diff in `api/shared-settings.ts`, `api/student-economy.ts`, `src/lib/currency.ts`, `src/lib/studentLife.ts`, `src/lib/weeklyMission.ts`, `src/pages/TimerPage.tsx`, and the three changed test files.

The requested ULW status command, `omo ulw-loop status --json`, was unavailable (`omo: command not found`), so the artifact uses the mandated fallback path for goal `weekly-economy-concurrency`. Existing reports were treated as untrusted and not used as review evidence.

Validation executed during this review:

- `git diff --check` — pass
- `npm run lint` — pass
- `npm test` — pass, 481 tests
- `npm run build` — pass (pre-existing-size-style Vite chunk warning only)

## Findings

### CRITICAL

None.

### HIGH

1. **Remote reset boundary is not considered before importing economy entries.**
   - `src/lib/weeklyMission.ts:503-513`
   - The code obtains `latestResetTime` solely from `nextHistory`. In a valid stale-save race, `remoteHistory` can contain a purchase at T1 and a reset at T2, while the stale `nextHistory` has neither. The server state has already reset the balance at T2, but the predicate treats T1 as newer than reset time `0`, imports the debit, and applies it to the teacher's stale balance. It also fails to carry the remote reset record forward. This resurrects a transaction from before the authoritative reset and produces an incorrect balance/history.
   - The current reset test at `src/lib/weeklyMission.test.ts:514-553` exercises a reset contained in `next`, not a reset contained in `remote`; it cannot detect this direction of the race.
   - Required correction: derive the boundary from the authoritative/current and intended histories (or otherwise preserve the newest reset and only import entries after it), then add a regression covering a remote purchase followed by a remote reset against a stale snapshot.

### MEDIUM

1. **The new authorization helpers are unreachable/redundant production complexity.**
   - `api/shared-settings.ts:81-98`, `api/shared-settings.ts:143-153`
   - `canStudentUpdate` first rejects every change to the caller's `studentEconomy` value at line 145. If that equality succeeds, the processed-request-ID comparison at lines 146-149 necessarily succeeds. The helper layer consequently adds parsing and apparent policy coverage without influencing an allowed outcome.
   - This is needless validation/parsing in production and a false signal of fine-grained ledger authorization. Remove the unreachable checks/helpers or replace the policy with a single intentional boundary rule plus a test of its observable permission contract.

2. **The weekly CAS behavior is only unit-tested at the helper seam, not through retry/recompute.**
   - `src/pages/TimerPage.tsx:6932-6954`; `src/lib/weeklyMission.test.ts:628-649`
   - The test proves `createWeeklyCurrencyCycle` for one supplied snapshot, but does not exercise the 409 retry where the updater receives a newer row. A regression that invokes the updater twice with distinct snapshots (first stale, second containing a purchase) is needed to lock the required recomputation contract.

### LOW

None.

## Targeted contract review

- **Exact transaction IDs:** standard economy mutations now use `currency-economy-${requestId}-${studentKey}` for sender and transfer recipient (`api/student-economy.ts:278-303`), and reconciliation matches that exact constructed ID (`src/lib/weeklyMission.ts:506-512`). Profile IDs remain intentionally distinct as `currency-profile-${requestId}` and match the profile write path (`api/student-economy.ts:201-234`). No incompatibility found.
- **Ledger continuity:** imported entries are sorted newest-first and rebased from the final balance (`src/lib/weeklyMission.ts:522-524`); the focused continuity assertion is meaningful (`src/lib/weeklyMission.test.ts:561-582`). The HIGH reset defect invalidates continuity across an authoritative remote reset.
- **StudentLife field merge:** arrays are unioned by ID and profile assignments are merged by key (`src/lib/studentLife.ts:168-200`). The added integration test covers letters and distinct assignment keys (`src/lib/weeklyMission.test.ts:584-626`). For duplicate immutable book/story IDs, remote-wins is a reasonable conflict policy; no separate defect established.
- **API compatibility:** the new deterministic ledger IDs are covered for normal and transfer writes (`tests/api/student-economy.test.ts:85-132`); no public response shape change was identified.

## Skill-perspective check

Ran: **yes**. I loaded and applied `omo:remove-ai-slops` and `omo:programming` before judging maintainability/test relevance.

- `remove-ai-slops`: No deletion-only tests, prompt-text tests, tautological tests, or test-only requested-removal checks found. The redundant authorization helpers are unnecessary production parsing/validation and violate this perspective.
- `programming`: No new `any`, type suppression, brittle prose/prompt tests, or needless public abstraction found. The unreachable helper layer is needless complexity and violates the programming perspective. The missing CAS-retry regression leaves a behaviorally important orchestration seam unpinned.
