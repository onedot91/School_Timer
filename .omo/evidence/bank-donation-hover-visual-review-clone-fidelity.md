# Bank and donation CTA hover visual review

## Recommendation

APPROVE

## Evidence inspected

- `/private/tmp/school_timer_bank_hover.png` — hover-state capture of the bank deposit CTA.
- `/private/tmp/school_timer_donation_hover.png` — hover-state capture of the donation CTA.
- `src/index.css:18015-18050` — default, disabled, break, and repay CTA rules.
- `src/index.css:21739-21753` — new pointer-hover treatment and exclusions.
- `DESIGN.md:5-7, 140-144, 149-157, 229-236` — restrained operational hierarchy, semantic motion tokens, depth, and interaction contract.

## Findings

### CRITICAL

None. The reviewed CTAs remain live CSS-rendered controls; neither screenshot indicates a raster substitute or a layout replacement.

### HIGH

None. The new selector excludes `.student-bank-break-button` and `.student-bank-repay-button`, so their red and yellow semantic action treatments remain intact.

### MEDIUM

None. The hover gradient and modest shadow use the existing accent and pressed accent tokens. The captured white labels remain legible, and the state does not change control geometry or cause text clipping/overlap.

### LOW

The supplied captures are `1075x672` JPEG files despite their `.png` names. They are adequate for inspecting the hover treatment itself, but not for the project's required `1280x800` at 100% primary-layout QA. This is an evidence limitation, not a defect in the reviewed hover rule.

## Conclusion

The treatment is restrained and consistent with the existing primary-action gradient/depth recipe. No visual/design-system change is required for the scoped bank and donation hover treatment.
