# Non-stock controls code review — 68

## Scope

Reviewed only the requested non-stock changes in the shared dirty worktree:

- `src/components/student/StudentMissionsPage.tsx`: Sudoku settings trigger capture and modal focus return.
- `src/pages/TimerPage.tsx`: four quick-utility `aria-controls` links and panel IDs.
- `src/index.css`: disclosure `:focus-visible` ring and disabled delete-hover neutral state.

Securities/stock assets, mappings, profiles, and related files were intentionally excluded. Other dirty hunks in these large files were not attributed to this batch.

## Skill-perspective check

Ran the `omo:remove-ai-slops` and `omo:programming` reviews before judging maintainability and test relevance.

- **remove-ai-slops:** no new extracted data, parsing, normalization, type escape, copy-heavy implementation, or tautological/deletion-only test was introduced by the scoped hunks.
- **programming:** the focus-return change reuses the existing `useModalFocus` boundary; it does not add an unnecessary abstraction, prompt/implementation-mirroring test, or untyped escape hatch.

Neither skill perspective finds a production-code slop violation in the scoped changes. The coverage gap below should not be addressed with brittle static tests that merely assert the new IDs or selectors.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

> **Resolved in re-review:** the four quick-utility controls now render `aria-controls` only while their corresponding open state mounts the target panel. The IDs remain unique and present whenever they are referenced:
> `timer-currency-panel`, `timer-youtube-panel`, `timer-library-panel`, and `timer-question-submission-panel`.

### LOW

1. **No UI-level regression evidence covers the new focus/linkage behavior.** Existing automated tests are domain/API tests; none exercises `StudentMissionsPage`, `TimerPage`, `useModalFocus`, or these CSS states. Verify manually or with a browser-level interaction test that opening Sudoku settings from keyboard, then closing via each supported dismissal path, returns focus to the originating trigger; also inspect disclosure controls in closed and open states. Do not add a source-string test that only mirrors these implementation constants.

2. **No exact 1280×800 at 100% visual proof was supplied for the focus outline and disabled-hover state.** This review does not treat scaled screenshots as primary visual evidence. The code changes are narrowly scoped and do not intentionally change layout, but the project’s required visual QA still needs the exact viewport check before a visual-completion claim.

## Verified behavior and scope checks

- `StudentMissionsPage.tsx` captures `document.activeElement` before opening the Sudoku modal and passes the stable ref to the existing `useModalFocus` hook. The hook validates that the return target is connected and enabled, then safely falls back, so this change is semantically sound.
- The disclosure focus ring is correctly limited to native `summary` elements under `.settings-disclosure`; it adds no visible copy. The disabled delete-hover rule neutralizes the ordinary hover border/background without changing action semantics.
- No scoped code introduces data mutation, stock-related behavior, dependencies, or visible user copy.

## Verification run

Executed in the current worktree:

- `git diff --check` — passed.
- `npm test` — passed, 157/157 tests. The expected malformed weekly-mission response log appears during a passing test.
- `npm run lint` (`tsc --noEmit`) — passed.
- `npm run build` — passed. Existing bundle-size warning remains (`index` CSS/JS each exceed the 500 kB warning threshold); this is not caused by the scoped patch.

## Re-review update

Re-inspected the targeted TimerPage fix after the initial review. `aria-controls={isOpen ? 'target-id' : undefined}` now accurately follows each conditionally mounted region, resolving the prior dangling-IDREF finding. `git diff --check` was rerun and passed; the reported automated validations (157 tests, TypeScript lint, and production build) remain passing. No securities/stock files were reviewed.

## Recommendation

**APPROVE.** The scoped implementation is now clear, minimal, and has no remaining code-quality blocker. The two LOW visual/interaction-evidence caveats above remain appropriate follow-up verification, not approval blockers.
