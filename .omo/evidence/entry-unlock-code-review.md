# Code quality review — entry unlock

## Scope and evidence

- Goal: remove the hidden admin-reveal button once `isZeroVisible` becomes true, and rename its accessible label to `0번 표시 잠금 해제`.
- Reviewed diff: `src/pages/EntrySelectPage.tsx` only.
- Evidence inspected: the current working-tree diff and numbered source at `src/pages/EntrySelectPage.tsx:10-68`.
- ULW status lookup: unavailable (`omo` executable is not installed on `PATH`), so this uses the required fallback artifact path.

## Skill-perspective check

- `omo:programming`: ran, including the TypeScript reference. No new untyped escape hatch, assertion, needless abstraction, parsing/validation, or brittle prompt test was introduced.
- `omo:remove-ai-slops`: ran. The change removes an empty `title` attribute and adds only the state guard needed to remove the control after unlock; no production-data extraction/normalization or slop category violation was introduced.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. No automated regression coverage accompanies the altered five-activation unlock path (`src/pages/EntrySelectPage.tsx:15-26`, `31-38`). A future change could unintentionally leave the invisible control mounted after unlock or change the activation threshold without detection. This is a coverage/maintenance gap, not evidence of a current defect. The repository has no in-scope test evidence supplied for this interaction.

### LOW

None.

## Assessment

- Correctness: after the state update sets `isZeroVisible` to `true`, the conditional at `src/pages/EntrySelectPage.tsx:31-38` unmounts the reveal button. The pre-existing handler guard at line 16 remains a safe protection against any stale queued invocation.
- Accessibility: while the control is present it retains `type="button"`, an explicit accessible name, and its click handler. `aria-label="0번 표시 잠금 해제"` accurately identifies its action; deleting the empty `title` avoids an empty tooltip attribute. Once unlocked, removing the non-essential control from both the DOM and tab order is appropriate.
- Scope/maintainability: minimal JSX-only change; no new abstraction, validation, data handling, or type escape hatch.
- Tests: no tests were changed or supplied. No test was run in this read-only, file-scoped review.

## Residual risk

This review did not inspect the CSS definition of `entry-admin-reveal` by request, so it cannot independently prove the invisible control's focus treatment or visual hit area. That is pre-existing behavior and outside the reviewed file.

## Verdict

- `codeQualityStatus`: WATCH
- `recommendation`: APPROVE
- `blockers`: none
