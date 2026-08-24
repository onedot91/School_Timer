# Non-stock interaction CSS review

## Scope

Reviewed only the latest non-stock interaction changes in `src/index.css`:

- emotion-tab hover, press, focus, and transition rules;
- shop-tab hover, press, focus, and transition rules;
- reduced-motion treatment for those tabs and `student-failure-create-fab`;
- Timer control/settings `:focus-visible` scope.

Securities/stock icon work was intentionally excluded.

## Skill-perspective check

- **`omo:programming`**: consulted. This is CSS-only work; no untyped escape hatches, parsing/validation, or needless TypeScript abstractions were introduced. No violation found from this perspective.
- **`omo:remove-ai-slops`**: consulted. No deletion-only, tautological, or implementation-mirroring tests were added. No unnecessary production data extraction or normalization is present. The duplicated press-scale mechanism below is avoidable interaction complexity and is recorded as a finding.

## Validation evidence

- `git diff --check -- src/index.css` completed with no whitespace error.
- Selectors were cross-checked against the rendered component markup:
  - `StudentEmotionPage.tsx:224` exposes `.student-emotion-section-tabs` and uses tab semantics.
  - `StudentShopPage.tsx:95` exposes `.student-shop-tabs` and uses tab semantics.
  - `StudentFailureExhibitionPage.tsx:163` exposes `.student-failure-create-fab`.
  - `TimerPage.tsx:10287,11260` exposes the scoped Timer control pane/settings dialog.
- No automated CSS interaction test or visual QA artifact was supplied for this patch. This review did not run a browser interaction test.

## Findings

### MEDIUM — tab press state composes two `scale(.98)` effects

`src/index.css:12406-12411` applies the global individual transform `scale: 0.98` to every active button. The new local rules also apply `transform: scale(.98)` to both the emotion tabs (`src/index.css:19607`) and shop tabs (`src/index.css:20215`). CSS composes the individual `scale` property with `transform`, so an active tab renders at about `0.98 × 0.98 = 0.9604`, not the intended 0.98. The local transition lists `transform` but not the individual `scale` property (`src/index.css:19597-19601`, `20202-20207`), so the two scale changes also have mismatched transition behavior.

Use one press-scaling mechanism for these tabs (either the existing global `scale` rule or local `transform`, not both) and ensure the transitioned property matches the selected mechanism.

### LOW — local focus rules duplicate the global focus indicator without adding a fallback

The global selector already provides the same outline and an additional surface-coloured focus ring at `src/index.css:12414-12417`. The new tab rules (`src/index.css:19608`, `20216`) and Timer-scoped rules (`src/index.css:21831-21834`) repeat only the outline declarations. This is not a visible regression because the global `box-shadow` still cascades, but it is redundant and could drift if the global focus style changes. Prefer one shared focus rule unless the scoped rule needs a deliberately distinct visual treatment.

## Confirmed correct within scope

- Emotion-tab hover is restricted to unselected, enabled tabs (`src/index.css:19603-19606`), preserving selected-tab state.
- Shop-tab hover is restricted to inactive, enabled tabs (`src/index.css:20211-20214`), preserving active-tab state.
- Reduced motion explicitly disables transitions and active transforms for both tab groups and the FAB (`src/index.css:21791-21824`), and also suppresses the FAB hover translation (`src/index.css:21826-21828`).
- The Timer focus selector is correctly scoped to `.timer-main-shell` and matches the Timer page’s control pane/settings dialog markup (`src/index.css:21831-21834`; `src/pages/TimerPage.tsx:10287,11260`).

## Re-review — follow-up change

The prior MEDIUM finding is resolved:

- The emotion-tab and shop-tab rules no longer declare local `transform: scale(.98)` press states (`src/index.css:19588-19610`, `20189-20213`). Their local transitions no longer include `transform`, so the global button `scale` transition/state at `src/index.css:12398-12411` is the sole press-scale implementation.
- The tab-local `:focus-visible` rules have also been removed; the global focus treatment at `src/index.css:12414-12417` applies to both native tab buttons.
- `git diff --check -- src/index.css` still passes.

The Timer-scoped focus rule remains at `src/index.css:21825-21829`. It has the same outline values as the global rule, so it is redundant in cascade terms but creates no different rendering or accessibility regression. It is retained as the explicitly scoped Timer/control/settings coverage requested in the review scope.

## Final decision

- `codeQualityStatus`: **CLEAR**
- `recommendation`: **APPROVE**
- `blockers`: none.
