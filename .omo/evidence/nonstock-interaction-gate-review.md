# Non-stock interaction gate review

- recommendation: **REJECT**
- originalIntent: Stop changing stock/securities icons and move to non-stock UI review, improving interaction polish without adding visible text or layout sizing.
- desiredOutcome: Emotion and shop tabs have coherent hover/press/focus behavior, timer/admin controls have visible keyboard focus, and reduced-motion users see no transform-driven control motion. Stock assets/mappings remain outside this patch.
- userOutcomeReview: The scoped hover/focus additions are coherent and do not add copy or layout dimensions. The selectors are limited to emotion tabs, shop tabs, the failure FAB, and timer control/settings panes. However, the failure FAB still translates upward on hover under `prefers-reduced-motion: reduce`, so the accessibility outcome is incomplete. Exact 1280×800 at 100% visual QA is also unavailable and therefore cannot be counted as a pass.

## Blockers

1. violatedCriterion: `RM-1 — reduced-motion transforms are fully neutralized for affected controls`
   - observation: `.student-failure-create-fab:hover` applies `transform: translateY(-.15rem)` at `src/index.css:13611`, while the reduced-motion override only clears transforms for `:active` at `src/index.css:21809-21824`. Hover still causes an immediate positional jump with motion reduction enabled.
   - evidencePointer: `src/index.css:13611`, `src/index.css:21791-21825`

2. violatedCriterion: `QA-1280 — latest UI implementation is observed at exactly 1280×800 and 100%`
   - observation: The app browser reports 1075×672; no exact 1280×800/100% post-change artifact exists. Project instructions explicitly forbid treating scaled evidence as primary QA.
   - evidencePointer: parent task context; no matching exact-size artifact under `.omo/evidence/`

## Checks performed

- `npm test`: PASS, 157/157.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS; existing >500 kB chunk warning only.
- `git diff --check`: PASS.
- Direct `omo:remove-ai-slops` pass: no new tests, helpers, abstractions, normalization, comments, or production extraction were added by the scoped CSS patch. No tautological/deletion-only/implementation-mirroring test was introduced.
- Direct `omo:programming` pass: the change is CSS-only and minimally scoped; no TypeScript/type boundary is altered.
- Code-review coverage: no dedicated latest-patch code-review report was found. This is not an independent blocker because the direct skill-perspective pass above was completed.

## Scope findings and notes

- No visible text or `content:` property was added by the scoped interaction patch.
- No layout sizing was added by the scoped interaction patch; changes are transition, color, shadow, outline, and transform-state declarations only.
- `.student-emotion-section-tabs button` and `.student-shop-tabs > button` hover/focus selectors are class-scoped and exclude disabled/selected states appropriately.
- Timer focus rules are scoped beneath `.timer-main-shell` and further limited to `.editorial-control-pane` / `.editorial-settings-dialog`; no unrelated-surface spill was found.
- Stock profile PNGs and stock-related files are already dirty in the shared worktree, so whole-worktree status cannot prove historical authorship. The scoped CSS hunks under review do not reference stock/securities selectors, assets, mappings, or copy.

## Exact evidence gaps

- A reduced-motion rule that also neutralizes the FAB hover transform, e.g. a hover-state transform reset inside the media query.
- A post-fix screenshot/DOM measurement proving `window.innerWidth === 1280`, `window.innerHeight === 800`, and 100% preview scale.
