# Functional Gate Review — no-profile student shop layout

- recommendation: APPROVE
- blockers: []
- originalIntent: Reduce excessive empty space and improve the student shop UI arrangement.
- desiredOutcome: At 1280×800, a student without a profile sees a compact, useful onboarding surface that fills the available content region, keeps the free random-profile CTA, and omits the redundant one-item tab bar; students with profiles retain the three-tab shop.
- userOutcomeReview: The supplied 1280×800 screenshot shows a live rendered header and one full-height onboarding card spanning the remaining content area, with the illustration, explanatory copy, free CTA, and locked-feature summary distributed across the width. No clipping, overlap, unintended scrolling, or first-screen overflow is visible. The measured onboarding rect `[12,96,1253.609375,688]` corroborates that it fills the available region rather than leaving an unused tab row or narrow content island.

## Checked artifacts

- `src/components/student/StudentShopPage.tsx`
- `src/index.css`
- `src/lib/studentShopPresentation.test.ts`
- `tmp/visual-qa/profile-shop-layout/onboarding-layout-current-1280.png`
- Runtime evidence: viewport/document `1280×800`, `tablists=0`, onboarding rect `[12,96,1253.609375,688]`
- Validation evidence supplied: `git diff --check` PASS; `npm run lint` PASS; `npm test` 389/389 PASS; `npm run build` PASS with only the Vite chunk warning

## Criterion review

- Redundant single tab hidden: confirmed by the conditional tablist render in `StudentShopPage.tsx`; the no-profile server-render test asserts no `tablist` or tab ids, matching runtime `tablists=0`.
- Free random CTA retained: confirmed by the no-profile branch and `무료로 뽑기` button, which opens the profile gacha at price 0.
- Live DOM/CSS and remaining-space fill: confirmed by source structure, the 1280×800 screenshot, measured rect, and the 1280-oriented grid rules that collapse the no-profile hub to one `minmax(0, 1fr)` row and stretch the panel/card.
- Profile-present state retains exactly three tabs: `getVisibleStudentShopTabs(true)` returns items/characters/houses; source renders those three buttons, and the test counts exactly three `role="tab"` elements.
- Accessibility: the profile-present tablist retains tab roles, selected state, controls, roving tab index, and keyboard handling. With no profile, the orphan tab semantics are removed and the content is labelled by the visible heading; CTA and locked-feature aside have explicit accessible labels.
- Student data safety: reviewed paths only stage/open dialogs; the evidence interaction is read-only and contains no balance/bid/award mutation. No evidence indicates a mutation was invoked.

## Direct remove-ai-slops / programming pass

- No production extraction, parser, normalization, dependency, dead branch, debug code, or scope-expanding abstraction was introduced for this layout criterion.
- The test contains several negative markup assertions that are close to requested-removal checks and therefore provide limited behavioral confidence individually. This is a NOTE, not a blocker: the key observable contract is independently supported by the runtime DOM count, screenshot, source conditional rendering, and positive three-tab state test.
- The CSS addition is sizable, but it directly implements the requested live layout and responsive/accessibility states; no stated success criterion is violated.

## Evidence gaps / notes

- `omo ulw-loop status --json` could not be consulted because `omo` is unavailable in PATH, so the documented fallback evidence path is used.
- No separate code-review report or manual-QA matrix path was provided. Direct source/evidence review covers the stated criteria, so this is not a blocker.
- Validation was independently reproduced in this gate: `git diff --check`, `npm run lint`, all 389 tests, and `npm run build` passed; build emitted only the stated Vite chunk-size warning.
