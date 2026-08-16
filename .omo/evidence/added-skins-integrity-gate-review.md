# Added Goma Skins Integrity Gate Review

- recommendation: APPROVE
- originalIntent: Add the 16 user-supplied Goma artworks as real skins available through the existing draw flow and, once owned, through the home skin picker.
- desiredOutcome: Sixteen unique catalog entries resolve to transparent PNG assets; draw cost, ownership checks, activation, and picker filtering continue to use the established economy state without granting skins automatically.
- userOutcomeReview: The catalog now contains 31 unique skins, with `character-16` through `character-31` covering all 16 supplied designs. The gacha derives its eligible/unowned pool from that catalog, and the home picker derives its visible options from the same catalog filtered by `ownedCharacterIds`. No new ownership or balance mutation path was introduced.
- blockers: []

## Checked artifacts

- `src/lib/studentEconomy.ts`
- `src/lib/studentEconomy.test.ts`
- `src/components/student/StudentCharacterGacha.tsx`
- `src/components/student/StudentOverviewPage.tsx`
- `src/components/student/StudentPetStage.tsx`
- `public/goma-skins/beetle-goma.png`
- `public/goma-skins/cabbage-butterfly-goma.png`
- `public/goma-skins/capybara-goma.png`
- `public/goma-skins/chalkboard-goma.png`
- `public/goma-skins/cutout-goma.png`
- `public/goma-skins/desk-goma.png`
- `public/goma-skins/duck-goma.png`
- `public/goma-skins/fan-goma.png`
- `public/goma-skins/mantis-goma.png`
- `public/goma-skins/montage-goma.png`
- `public/goma-skins/refrigerator-goma.png`
- `public/goma-skins/stag-beetle-goma.png`
- `public/goma-skins/stipple-goma.png`
- `public/goma-skins/three-dimensional-goma.png`
- `public/goma-skins/upside-down-goma.png`
- `public/goma-skins/vacuum-goma.png`

## Evidence

- Catalog audit: 31 total entries; 16 additions; 31 unique IDs, names, and asset paths; zero missing added assets.
- Asset audit: all 16 added files are 1254 x 1254, 8-bit RGBA PNGs. Pixel inspection found substantial transparent regions in every asset and transparent edge corners in 15/16. `upside-down-goma.png` retains a few isolated opaque green edge pixels, but its background is transparent and the residue is sub-pixel at rendered UI size; this is a non-blocking visual note rather than a failed addition criterion.
- Economy flow: `draw_character` still charges `STUDENT_CHARACTER_DRAW_PRICE`, selects only from catalog entries absent from `ownedCharacterIds`, appends exactly the selected ID, and activates it. `select_character` still rejects non-owned IDs.
- Picker flow: `StudentOverviewPage` renders only `DEFAULT_STUDENT_CHARACTER` plus catalog entries included in `ownedCharacterIds`; no skin is granted by the UI.
- Rendering flow: `StudentPetStage` resolves the active ID against the same catalog and displays its configured asset.
- Validation: `npm run test` passed 85/85 tests; `npm run lint` (`tsc --noEmit`) exited 0.

## Direct remove-ai-slops / programming pass

- No new abstraction, parser, normalization layer, type escape hatch, dead branch, debug output, or behavior-mirroring test was introduced for the skin additions.
- The catalog-only production change reuses the existing typed `as const` catalog and its derived `StudentCharacterPrizeId` union.
- Existing tests cover draw cost, unique ownership, default re-selection, request idempotency, and insufficient funds. No deletion-only, tautological, or prose-pinning test was added.

## Evidence gaps

- No real draw or skin-selection action was triggered, by design, because those operations mutate live student balance/ownership state.
- Visual scaling and composition are covered by the separate visual QA lane rather than this integrity gate.
