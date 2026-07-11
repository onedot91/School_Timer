# Todo 1 evidence-harness code review

Scope reviewed: `.omo/evidence/fixtures/` and `.omo/evidence/task-1-apple-ui-refresh-plan/` only. `src` was not edited; staged/unstaged `src` diffs and `src` status are empty.

## Findings

No blocking fixture-only finding remains.

- Deadline control flow: `createWholeRunDeadline` reserves cleanup time from the whole 110,000 ms limit. The matrix is rejected at the work boundary; cleanup operations use only the remaining total budget. The 6,000 ms low-timeout execution returned exit 1 and still stopped the two owned local servers before its free-port audit.
- Misleading output: success is calculated only after 22 non-empty, dimension-valid screenshots, zero unexpected console/page errors, local-only REST audits with zero live count, free ports, no runner errors, and a completed deadline. The temporary timeout output cannot be marked canonical.
- Stale state: every case gets a fresh browser context, state setup goes through the resettable fake fixture, clocks are fixed, and canonical JSON binds current source plus every fixture module hash.
- Both reset branches are observable: the canonical JSON contains independent `altMetaEnter: PASS` and `altCtrlEnter: PASS` assertions and matching screenshot pairs.

## Overfit and slop review

| Class | Review result |
| --- | --- |
| Excessive/useless tests | No. Eleven scenarios cover distinct user-observable contracts; no redundant recovery run is used as canonical evidence. |
| Deletion-only/removal-only tests | None. No test was removed to obtain a pass. |
| Tautological or implementation-mirroring checks | No blocker. DOM assertions, screenshots, request URLs, exit codes, and free ports are observable outputs. The PNG decoder is limited to required dimensions and the named black-block regression. |
| Unnecessary production extraction/parsing/normalization | None. The only parsing is fixture-local PNG validation; no `src` production code or data boundary changed. |
| Maintenance size | Pass. `task-1-baseline.mjs` orchestrates scenarios; `task-1-baseline-runtime.mjs` owns lifecycle/deadline; `task-1-baseline-images.mjs` owns image audit. Each is below 250 pure LOC and has one responsibility. |
| Fixture-only scope | Pass. No product files, app behavior, dependencies, or live classroom data were modified. |

## Residual risk

The opaque-black component test deliberately detects the reported mobile artifact, not arbitrary visual regressions. The retained 390x844 PNG remains the primary visual evidence.
