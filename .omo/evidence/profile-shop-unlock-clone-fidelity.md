# Profile shop unlock — clone / visual fidelity review (final-2)

**Recommendation:** APPROVE

## Scope and fresh evidence

- Goal: before a free random-profile draw, expose only the Profile tab while visibly communicating that Goma skin and House are locked; after the draw, expose all three destinations. At exactly `1280×800`, avoid overlap, unintended document overflow, clipped copy, duplicate copy, and unnatural Korean breaks.
- Source inspected:
  - `src/components/student/StudentShopPage.tsx:36-42, 65-76, 104-216`
  - `src/index.css:22675-22721, 22762-23030, 23426-23510, 23744-23770`
- Complete render-state set inspected (both are valid JPEGs, `1280×800`, created `2026-08-30 17:47:10`, after the source edits at `17:45`):
  - `tmp/visual-qa/profile-shop-unlock/initial-onboarding-final-2.jpg`
  - `tmp/visual-qa/profile-shop-unlock/after-free-profile-final-2.jpg`
- Independent passes:
  - Design-system/functional integrity: PASS
  - Visual/CJK precision: PASS

## Findings

### CRITICAL

- None. The UI is live React DOM with state-derived conditionals; no screenshot, raster background, or static composition substitutes for the interactive UI.

### HIGH

- None. The `hasProfile` condition drives the real tab/panel tree, so the pre-profile one-tab and post-profile three-tab states are not faked (`StudentShopPage.tsx:71-76, 107-115, 212-216`).

### MEDIUM

- None. The initial state has distinct onboarding content rather than a duplicated profile-selection catalog (`StudentShopPage.tsx:120-149`), and the full profile catalog continues in its intended internal scroll container after unlock (`src/index.css:22762-22769, 23744-23756`).

### LOW

- None. The prior initial-title issue is resolved: `한 명` is protected by a nowrap span (`StudentShopPage.tsx:127`, `src/index.css:22831-22842`) and renders as the natural `동물 친구 한 명을 / 만나 보세요` line break in the final-2 initial capture.

## Verified behavior and fidelity

- Before profile assignment, only the Profile destination is rendered in the tablist; Goma skin and House are presented solely as visibly muted lock rows (`StudentShopPage.tsx:107-115, 144-148`).
- After assignment, the same live component renders exactly three tabs: Profile, Goma skin draw, and House. The final-2 after capture retains `100 고마` and no onboarding copy remains.
- The onboarding uses the primary first-screen panel deliberately: illustration, CTA, explanatory copy, and locked-destination preview form a balanced three-column layout without overlap or clipping.
- Styling uses existing shared surface/text/accent/radius/shadow/motion tokens for the added panel (`src/index.css:22685-22721, 22771-23030`); the visual assets are individual DOM `<img>` illustrations, not page-as-image substitution.
- Both screenshots are fully composed at exactly `1280×800`; the supplied gate metrics report inner/document bounds at `1280×800`, with tab count `1→3`, balance `100→100`, and onboarding `1→0`.

## Blockers

None.
