# Gate Review: student-store-header-balance

- recommendation: APPROVE
- blockers: []
- originalIntent: Move the existing store balance summary from the store body into the right side of `StudentHeader`, retain exactly one grouped available/reserved balance display, remove the resulting vertical waste, keep the plaza immediately below, and avoid data mutation.
- desiredOutcome: One reused `StudentBalanceSummary` is rendered through `StudentHeader.actions`; desktop places it to the right of the title, narrow layouts keep it inside the header without overlap or horizontal overflow, and `student-store-content` begins directly after the header with the plaza.

## User Outcome Review

PASS. `StudentStorePage` passes the existing `StudentBalanceSummary` component as `StudentHeader.actions` and no longer renders a second body-level summary. The component continues to receive `availableBalance`, `reservedAmount`, and `isLoading`. At 1280px the summary is visibly on the header's right; at 768px and 375px it responsively wraps beneath the title but remains inside the header. All captures show the plaza as the next surface with a compact 18/12/12px visual gap and no visible overlap or horizontal clipping. The reviewed relocation introduces no event handler, state update, persistence call, or data mutation.

## Direct Slop / Programming Pass

- No duplicate replacement component, pass-through helper, parser, normalizer, or speculative abstraction was added for the relocation.
- No deletion-only, tautological, implementation-mirroring, or removal-verification test was added for this change.
- Component reuse is genuine: `StudentBalanceSummary` is imported once by `StudentStorePage` and supplied through the existing `actions: ReactNode` seam in `StudentHeader`.
- CSS is narrowly scoped under `.student-store-view > .student-header`; the responsive rule only changes placement inside the header.
- NOTE: `StudentBalanceSummary` retains its pre-existing unused `balance` prop. This relocation neither introduces nor worsens it and it does not violate the stated criteria.
- NOTE: `DESIGN.md:126` says task-page `StudentHeader` contains only return action and title, which conflicts with the newer explicit user intent. The requested outcome takes precedence; the stale sentence should be reconciled separately, but it does not block this criterion set.

## Checked Artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStorePage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentHeader.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBalanceSummary.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-store-header-balance/store-1280.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-store-header-balance/store-768.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-store-header-balance/store-375.jpg`
- Working-tree diff for the named source files
- `npm test -- --run`: 56/56 pass
- `npm run lint`: `tsc --noEmit` exits 0

## Exact Evidence Gaps

- The supplied DOM metrics have no persisted machine-readable report in the named evidence directory; only the three JPEG captures are present. Source inspection and direct visual review support the same outcome, so this is not a blocker.
- Vite build was not rerun because this review was constrained to read-only operation and a build writes `dist`; the supplied build claim remains externally reported. Passing `tsc --noEmit`, tests, source inspection, and captures are sufficient for the stated criteria.
- No separate code-review report or manual-QA matrix was supplied. Direct inspection covers the required functional, responsive, programming, and overfit/slop perspectives.

