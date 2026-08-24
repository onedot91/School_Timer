# Code quality review: non-stock minimal UI patch

## Scope

Reviewed only the requested hunks:

- Explicit `type="button"` additions in `src/components/student/StudentBankPage.tsx` and `src/components/student/StudentShopPage.tsx`.
- The four `transition-all` replacements in `src/pages/TimerPage.tsx`.

The review deliberately did not inspect or assess stock/securities assets, icons, or `StudentStockTrend`. Other concurrent worktree changes shown by `git diff` were excluded.

## Evidence inspected

- Scoped `git diff --unified=0` and `git diff --check` for the three files.
- Current TSX/CSS contexts for the changed controls and their hover/active styles.
- Reported executor evidence: `npm test` (157 tests), `npm run lint`, `npm run build`, and `git diff --check` passed. This review independently re-ran scoped `git diff --check`; it passed. The complete test/build logs were not supplied as artifacts, so their pass status is recorded as reported rather than independently reproduced.

## Skill-perspective check

Ran: `omo:programming` (TypeScript reference) and `omo:remove-ai-slops`.

- `programming`: no new untyped escape hatch, assertion, needless abstraction, parsing, or boundary validation appears in the scoped hunks.
- `remove-ai-slops`: no deletion-only, tautological, or implementation-mirroring tests were added; no needless production extraction, parsing, normalization, or abstraction was introduced. The explicit button types use the native HTML behavior directly and are appropriately minimal.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

1. `src/pages/TimerPage.tsx:8014` — the new transition list omits `box-shadow`, although `.add-slot-button:hover` changes it at `src/index.css:1872-1875`. Previously that hover elevation animated via `transition-all`; it now snaps. Add `box-shadow` to this list if preserving the prior hover motion is part of the transition narrowing.

## Review notes

- The bank action buttons at `StudentBankPage.tsx:92`, `:100`, and `:108`, and shop action buttons at `StudentShopPage.tsx:118`, `:183`, `:187`, and `:199`, now explicitly avoid implicit form submission. This does not alter their click handlers and is safe even if a parent form is introduced later.
- `TimerPage.tsx:7833` includes the properties that change for the day buttons; `:7953` covers the slot card's border/shadow states.
- `TimerPage.tsx:9828` omits `color` and `opacity` locally, but this is not a defect: `.bgm-reveal-zone .sound-toggle` supplies `opacity`, `transform`, `background-color`, `border-color`, `color`, and `box-shadow` with `!important` at `src/index.css:8776-8783`, so it wins over the utility class.

## Residual risk

No behavioral test specifically covers these presentational properties or the explicit button type attributes. The reported project suite is library/API focused, so visual transition behavior remains a manual-browser concern.

## Result

- `codeQualityStatus`: WATCH
- `recommendation`: APPROVE
- `blockers`: None. The LOW finding is a small visual-regression risk, not an approval blocker.
