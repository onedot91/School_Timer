# Code Review — code_review_final3

## Verdict

- `codeQualityStatus`: **CLEAR**
- `recommendation`: **APPROVE**
- `blockers`: None

`omo ulw-loop status --json` was unavailable (`omo: command not found`), so this report uses the required fallback path.

## Scope reviewed

Latest working-tree diff, with focused review of:

- `src/lib/currency.ts`
- `src/lib/weeklyMission.ts`
- `src/lib/weeklyMission.test.ts`
- `src/pages/TimerPage.tsx`
- `api/shared-settings.ts`, `api/student-economy.ts`
- `src/lib/studentLife.ts`
- API tests under `tests/api/`

## Correctness findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Focused verification

- The purchase → remote reset → stale teacher-save sequence is covered by the regression at `src/lib/weeklyMission.test.ts:558`. The merge keeps the remote reset balance (100), retains the ledger in newest-first order (`reset`, then `shop_purchase`), and retains ownership state.
- `src/lib/weeklyMission.ts:508-524` detects a remote reset newer than the stale snapshot and rebuilds the balance/history from the remote post-reset state. `:525-545` then applies only server-verified, post-reset economy entries, preventing the old purchase debit from being restored.
- The weekly write uses the current CAS value to recalculate tax and allowance at `src/pages/TimerPage.tsx:6932-6949`, before the concurrent-state merge. This avoids basing the cycle on the stale UI snapshot. `updateSharedSettings` retries the updater against a freshly loaded row after a 409 (`src/lib/supabaseSettings.ts:176-203`), so the calculation is repeated against the then-current value.
- The former page-local cycle composition is replaced by `createWeeklyCurrencyCycle` (`src/lib/currency.ts:646-695`). The remaining `appendCurrencyChangesToHistory` in `TimerPage` has three non-weekly callers (`src/pages/TimerPage.tsx:6653`, `:6769`, `:6796`), so it is not an obsolete duplicate.
- The test at `src/lib/weeklyMission.test.ts:666-687` checks the observable ordering and tax baseline for the shared helper. It is not a deletion-only, tautological, implementation-constant, or prompt-text test.

## Skill-perspective check

Ran after loading `omo:remove-ai-slops` and `omo:programming` plus its TypeScript references (`README`, `data-modeling`, `type-patterns`, `error-handling`).

- **remove-ai-slops:** no deletion-only tests, prompt/prose tests, tautological assertions, or unneeded parsing/normalization were introduced. `createWeeklyCurrencyCycle` is a necessary shared seam for the local and CAS-retry flows; `mergeStudentLifeStates` prevents a real concurrent purchase side effect from being lost.
- **programming:** no new `any`, `@ts-ignore`, non-null assertion, or implementation-mirroring/prompt test was found. The code follows the repository's existing guarded-`unknown` normalization boundary. No diff-level violation requiring a change was found.

## Evidence

- `node --import tsx --test src/lib/weeklyMission.test.ts tests/api/shared-settings.test.ts tests/api/student-economy.test.ts`: **PASS** — 51 passed, 0 failed.
- `npm run lint`: **PASS** (`tsc --noEmit`).
- `npm run build`: **PASS**. Vite reported only the existing large-chunk warning; no build error.
- `git diff --check`: **PASS**.

## Residual risk

The modified production modules are already above the 250 pure-LOC guideline (`src/lib/currency.ts` 844; `src/lib/weeklyMission.ts` 593; `src/lib/studentLife.ts` 335). This is pre-existing architectural debt rather than an introduced duplicate or a correctness defect in this focused change; splitting it is outside the requested review scope.
