# Non-stock UI/accessibility review

Scope reviewed: only the requested non-stock UI/accessibility changes in `TimerPage`, `StudentShopPage`, `StudentCharacterGacha`, `StudentEmotionPage`, `StudentEmotionOrb`, `index.css`, and `nonStockUiSemantics.test.ts`. Securities/stock icons, assets, mappings, and unrelated dirty-worktree changes were excluded.

## Skill-perspective check

- `omo:remove-ai-slops`: consulted and applied. The new source-string tests are implementation-mirroring rather than observable behavior checks.
- `omo:programming`: consulted and applied. No untyped escape hatch or needless production abstraction was introduced in the reviewed changes; the test implementation is brittle against behavior-preserving refactors.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `src/lib/nonStockUiSemantics.test.ts:7-39` — all four tests read TSX files and assert fixed source fragments, offsets, and nearby literal text. This only proves that this exact implementation spelling remains; it does not exercise the claimed keyboard exclusion, accessible names, or focus-return behavior. A behavior-preserving refactor (for example, extracting the ARIA props or moving `useModalFocus` options) will fail the tests, while a broken runtime interaction can still pass. Replace these with a DOM/component-level accessibility test when a supported browser/DOM test harness is available; otherwise remove the source scans and retain typecheck plus manual accessibility QA rather than presenting them as regression coverage.

### LOW

None.

## Verified observations

- The extra timer now has a stable `aria-controls` target, a matching panel `id`, closed-state `inert`, and a state-aware open/close accessible name (`src/pages/TimerPage.tsx:10148-10161`).
- Purchase controls expose item/price or house/action names without changing visible copy (`src/components/student/StudentShopPage.tsx`).
- Result and emotion dialogs return focus to their originating controls; the gacha return target remains programmatically focusable at `tabIndex={-1}` (`src/components/student/StudentCharacterGacha.tsx:104-112,206-211`; `src/components/student/StudentEmotionPage.tsx:123-137,168-173`; `src/components/student/StudentEmotionOrb.tsx:65-75`).
- Hover effects are pointer-capability gated, dialog controls have focus/active styling, and reduced-motion rules disable the reviewed motion (`src/index.css:13118-13121,13165-13168,19814-19829,21822-21843`). The selectors are page/component-scoped.
- The reviewed changes add no visible product copy and do not invoke or test any live currency, purchase, or other mutating path.

## Verification run

- `npm run lint` — passed.
- `node --import tsx --test src/lib/nonStockUiSemantics.test.ts` — passed (4/4), with the coverage limitation above.
- `npm run build` — passed. Existing Vite chunk-size warning remains (`index` JS >500 kB).
- `git diff --check` — passed.

## Result

`codeQualityStatus: WATCH`  
`recommendation: REQUEST_CHANGES`  
`blockers: Replace or remove the implementation-mirroring tests in src/lib/nonStockUiSemantics.test.ts before treating this as behavioral regression coverage.`
