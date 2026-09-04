# Latest commit code review — `ebe7fc6..739de87`

## Scope and evidence

- Goal reviewed: optimize shared-settings polling and lazy-load route/feature pages.
- Changed files reviewed in full: `api/shared-settings.ts`, `src/RootApp.tsx`, `src/lib/routeCodeSplitting.test.ts`, `src/pages/AuctionPage.tsx`, and `tests/api/shared-settings.test.ts`.
- Adjacent contracts inspected: `src/lib/supabaseSettings.ts`, `src/lib/studentSettingsSync.ts`, `api/student-economy.ts`, the teacher/student refresh paths, and repository `AGENTS.md` files.
- `omo ulw-loop status --json` is unavailable in this environment (`omo: command not found`), so no `currentAttemptDir` could be resolved. This is the required fallback report location.
- No executor report/evidence paths were supplied; review evidence is the committed diff and commands listed below.

## Skill-perspective check

Ran: `omo:remove-ai-slops` and `omo:programming` (including the TypeScript reference).

- `remove-ai-slops`: production diff is narrowly scoped and adds no needless parsing, normalization, extraction, or abstraction. The changed source files are already oversized (not created by this diff); that pre-existing issue is not made materially worse by this targeted change.
- `programming`: no new `any`, non-null assertion, unchecked cast, or boundary-validation duplication was introduced. The added source-regex test is implementation-mirroring and includes an unnecessary exact UI-copy assertion; see MEDIUM-1.
- Therefore the diff violates neither perspective in production code, but does violate the testing-quality perspective described in MEDIUM-1.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **The new shared-settings test proves only in-flight coalescing, not the one-second cache that is the stated polling optimization.**
   - `tests/api/shared-settings.test.ts:75-89`
   - Both requests are started concurrently, so one request is expected even if the TTL cache at `api/shared-settings.ts:218-244` is removed and only `updatedAtRequest` remains. It also does not exercise a second request after the first has settled, expiry, failed fetch cleanup, or a direct `/api/student-economy` write changing the same `app_settings` row. The test can therefore stay green while the cache optimization regresses or gives stale metadata for its permitted one-second window.
   - Add deterministic sequential/expiry coverage (inject or control time) and document/test the intended bounded-staleness policy around independent writers.

2. **Feature code-splitting regression coverage is brittle and incomplete.**
   - `src/lib/routeCodeSplitting.test.ts:24-30`
   - The assertions pin exact `lazy(() => import(...))` source text and the Korean fallback sentence, rather than the generated chunk/dependency contract. They cover only `StudentMissionsPage` and `StudentStorePage`, while this commit lazily imports eleven feature modules at `src/pages/AuctionPage.tsx:183-193`. A later eager import of any of the other nine modules would regress the primary initial-bundle goal without failing this test. The exact UI-copy regex also blocks harmless wording changes.
   - Prefer a build-manifest/chunk assertion or a structural test over every intended deferred import, and assert fallback semantics (e.g. a status region) rather than its prose.

### LOW

1. **The metadata cache is intentionally eventually consistent but has no invalidation path for the independent economy writer.**
   - `api/shared-settings.ts:218-244`; independent write at `api/student-economy.ts:387-401`
   - A warm `updatedAtCache` can return the old version for up to 1,000 ms after `/api/student-economy` updates the same row. Consumers then skip their full reload: the student store polls every 2,000 ms (`src/lib/studentSettingsSync.ts:5-8`) and the teacher poll is 5,000 ms (`src/pages/TimerPage.tsx:4946-4968`). This produces a bounded extra propagation delay, not data loss: writes retain their compare-and-swap guard and the initiating client forces a full refresh. It should be an explicit accepted trade-off or be addressed by a cross-writer invalidation strategy.

### NIT

None.

## Verification performed

- `git diff --check ebe7fc6..739de87` — passed.
- `npm test -- --test-name-pattern='(registered devices can poll only|route|code splitting)'` — project test script ran all tests; 507 passed, 0 failed.
- `npm run lint` — passed (`tsc --noEmit`).
- `npm run build` — passed. Vite emitted separate `AuctionPage`, `TimerPage`, and feature chunks including `AuctionRoom`, `StudentMissionsPage`, `StudentStorePage`, and the other deferred feature pages.

## Decision

- `codeQualityStatus`: **WATCH**
- `recommendation`: **APPROVE**
- `blockers`: None. The two MEDIUM findings should be repaired for durable regression coverage, but no CRITICAL/HIGH correctness, type-safety, concurrency, cache-coherency, or Suspense-boundary failure was demonstrated in the committed implementation.
