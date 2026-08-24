# Shop tabs code review

## Scope

- Goal: add keyboard-accessible shop tabs (initial items; ArrowRight, End, and Home activate and focus the expected tab/panel).
- Reviewed only `src/components/student/StudentShopPage.tsx` and `src/components/student/StudentCharacterGacha.tsx`.
- Stock artwork/assets were intentionally excluded.

## Skill-perspective check

- Ran: `omo:programming` plus its TypeScript reference, and `omo:remove-ai-slops`.
- Programming perspective: no new `any`, type assertion, non-null assertion, or unchecked external-input parsing was introduced. The keyboard handler is small and uses the existing tab pattern; no needless abstraction was added.
- Remove-ai-slops perspective: no deletion-only, tautological, implementation-constant, or prompt tests were added. No unnecessary production data extraction, parsing, or normalization was introduced. The diff does not violate either skill perspective, apart from the accessibility finding below.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `aria-controls` has dangling ID references for every inactive tab. The three tab buttons always expose `aria-controls` at `src/components/student/StudentShopPage.tsx:96-98`, but their corresponding panels are conditionally unmounted at `:101`, `:165`, and `:169`. For example, on the initial items tab, `student-shop-tab-characters` controls an element that does not exist. This breaks the tab-to-tabpanel semantic association for assistive technology. Keep each tabpanel mounted and hide inactive ones (or otherwise ensure every referenced panel ID exists) while retaining the roving `tabIndex` behavior.

2. There is no automated regression coverage for the new tab behavior in `src/components/student/StudentShopPage.tsx:74-89`. The 157 passing tests are all `src/lib/*.test.ts` or `api/*.test.ts`; they do not mount this component or exercise ArrowRight/ArrowLeft/Home/End, focus movement, or `aria-selected`/tabpanel pairing. Add a behavior-level component/browser test for the stated keyboard sequence, including focus and active panel assertions. Avoid implementation-mirroring checks of private constants.

### LOW

None.

## Verification

- `npm test`: passed, 157/157.
- `npm run lint`: passed (`tsc --noEmit`).
- `git diff --check` for the two scoped files: passed.
- The supplied successful build claim was not rerun because this review is read-only and `vite build` writes `dist/`.

## Re-review (current diff)

- `src/components/student/StudentShopPage.tsx:101-109` now renders one hidden, labelled tabpanel stub for every inactive tab. The active panel is rendered at its normal location, so all three `aria-controls` targets exist exactly once at all times. The former dangling-ID finding is resolved.
- The supplied browser sequence (items → ArrowRight characters → End houses → Home items) and `unresolvedControls=[]` are consistent with the reviewed handler at `:74-89` and the current DOM structure. In this node-only test setup, the absence of a component-test runner is not a release blocker for this small UI-only change; no tautological test is warranted.
- Rechecked `npm run lint`: passed. Scoped `git diff --check`: passed.
- The prior programming/remove-ai-slops skill-perspective check still applies: the updated stubs introduce no type escape hatch, unnecessary parsing, or needless production abstraction.

## Decision

- codeQualityStatus: CLEAR
- recommendation: APPROVE
- blockers: None.
