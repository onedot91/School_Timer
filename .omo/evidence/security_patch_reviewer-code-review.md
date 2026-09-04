# Code review: security patch candidate

## Scope and evidence inspected

- Goal: prevent students from reading the complete shared-settings row through `GET /api/shared-settings?full=1`, while retaining teacher full reads and safe student updates; prevent an in-flight metadata response from replacing or returning a version invalidated by a completed write.
- Changed files reviewed: `api/shared-settings.ts`, `src/lib/supabaseSettings.ts`, `tests/api/shared-settings.test.ts`, and `src/lib/supabaseSettings.test.ts`.
- Direct callers of `updateSharedSettings` and its student-side updater shapes were inspected in `src/pages/AuctionPage.tsx`, `src/lib/useStudentSudokuState.ts`, and `src/lib/useStudentNumberBaseballState.ts`.
- `omo ulw-loop status --json` was unavailable (`omo: command not found`), so this fallback report is stored at `.omo/evidence/security_patch_reviewer-code-review.md`.

## Verification

- `node --import tsx --test tests/api/shared-settings.test.ts src/lib/supabaseSettings.test.ts`: PASS (25/25).
- `npm run lint`: PASS (`tsc --noEmit`).
- `git diff --check`: PASS.
- Skill-perspective check: ran. I consulted `omo:remove-ai-slops` and `omo:programming` (including the TypeScript reference) before assessing test relevance and maintainability.

## Security and regression assessment

- The `full` query no longer affects authorization: only `session.role === 'teacher'` selects `loadRow` (`api/shared-settings.ts:285-289`). String and array query variants therefore remain scoped for a student.
- Student GET uses a SQL projection and wraps only the caller's entries for the five scoped maps (`api/shared-settings.ts:195-228`). Teacher GET continues to select and return the complete row.
- Student PUT first reloads the current complete row, merges only allowed sparse map updates, then runs the existing ownership/protected-ledger checks against that merged value (`api/shared-settings.ts:161-169`, `321-326`). This preserves other students' entries and the existing CAS conflict/retry client flow (`src/lib/supabaseSettings.ts:156-183`).
- An in-flight metadata request captures a cache generation; after a successful write increments that generation, its completion returns the write-populated cache instead of storing or returning its old value (`api/shared-settings.ts:236-263`, `354-359`). Rejected metadata fetches never populate the cache; the request guard is cleared in `finally`.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `src/lib/supabaseSettings.test.ts:94-103` is an implementation-text test: it asserts the literal absence of `?full=1` and literal `fetchJson` spelling instead of exercising the client-observable request/result contract. This is an overfit test under both skill perspectives; it can fail after behavior-preserving refactoring and gives false confidence about role-scoped server authorization. It does not create a demonstrated security or functional regression because API handler tests cover the behavior. Replace it with an observable client-boundary test when that module can be dependency-injected/tested.

### LOW

None.

## Decision

- `codeQualityStatus`: WATCH
- `recommendation`: APPROVE
- `blockers`: None. No surviving bypass or normal-input regression was found in the candidate scope.

## Skill-perspective conclusion

The production diff does not violate either skill perspective for this bounded security fix: the sparse-merge helper is required at the server boundary, no new untyped escape hatch was introduced, and the concurrency guard directly represents the write-vs-read invariant. The one MEDIUM test finding above violates the test-relevance/implementation-mirroring guidance.
