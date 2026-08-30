# Capybara profile visual-fidelity review

## Recommendation

APPROVE

## Evidence inspected

- `/private/tmp/capybara-profile-final-1280x800.jpg` — supplied final 1280×800 capture. The file signature and extension both identify it as JPEG; `sips` reports 1280×800. Direct visual inspection confirms the capybara card is fully visible in the second visible profile row, with no card/copy clipping.
- `public/failure-profiles/thumbs/71-capybara.png` — direct visual inspection; 192×192 RGB PNG.
- `public/failure-profiles/thumbs/{17-hippo,32-camel,38-beaver,54-rhinoceros,55-anteater}.png` — direct visual inspection; each is a 192×192 RGB PNG and provides the nearby collection baseline.
- `src/lib/failureExhibition.ts:9-112` — verifies the image is a live selectable option and that the final label is `카피바라`.
- `src/components/student/StudentShopPage.tsx:120-157` and `src/index.css:22521-22595` — verifies the card is live DOM (`button` + `img` + text), uses the existing reusable grid/card styles, and crops images with `object-fit: cover`.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Good aspects

- The capybara is a genuine 192×192 collection asset, not a rasterized substitute for the complete UI. It renders through the same live profile-option component and CSS as all adjacent cards.
- The cyan-green pastel field, matte low-detail clay treatment, broad asymmetric silhouette (muzzle on the left / body mass on the right), and rounded crop align with the hippo, camel, beaver, rhinoceros, and anteater collection language.
- At the shown card size, the thick dark horizontal closed-eye line remains legible; the left-facing muzzle and small smile read clearly without visual noise.
- The screenshot shows `카피바라` and `선택` centered on separate lines, with neither Korean label truncated, overlapped, nor spilled outside its card. The card is fully within the 1280×800 viewport.

## Blocking findings

None. The previous format mismatch is resolved: the refreshed evidence is named `.jpg` and contains JPEG bytes.
