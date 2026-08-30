# Profile gacha visual gate — clone fidelity

## Recommendation

REQUEST_CHANGES

## Evidence inspected

- Target/design contract: `DESIGN.md` (profile shop/random-profile flow) and the assigned warm cream/mint/paper, 34rem, 1280×800 brief.
- Current implementation: `src/components/student/StudentProfileGachaDialog.tsx:1-349`, its caller `src/components/student/StudentShopPage.tsx:259-266`, modal focus primitive `src/lib/useModalFocus.ts:60-151`, and dialog CSS `src/index.css:23032-23347`.
- Captures: `tmp/visual-qa/profile-gacha/confirm-1280.png`, `saving-1280.png`, `shuffle-1280.png`, `result-1280.png`, `error-1280.png`, and `unlocked-1280.png` (each validated as a 1280×800 PNG).
- Motion evidence: `tmp/visual-qa/profile-gacha/profile-gacha-demo.mp4`, `video-midpoint.png`, and `video-config.json`.

## Findings

### CRITICAL

None. The dialog is rendered from live React elements and motion state variants; the images are card contents rather than a rasterized replacement for the modal. There is no `background-image`/screenshot substitute.

### HIGH

1. **[evidence] Final-source visual proof is stale and cannot approve the current revision.** `StudentProfileGachaDialog.tsx` was modified at `2026-08-30 18:32:19`, after all six required 1280×800 PNG captures at `18:22:48` and after the source demo MP4 at `18:30:59`. The final integration then changed `src/components/student/StudentShopPage.tsx:72, 134-142, 159-173, 261-268` and `src/pages/AuctionPage.tsx:1713-1726` at `18:36:12`: focus now returns to the random-profile trigger and the global progress overlay is suppressed for the gacha save. The latter can directly alter the saving state. `video-midpoint.png` was created later, but it is an extraction from that MP4 (`video-config.json` lists the earlier PNG captures as its inputs), not a current-build capture. Re-capture all six exact 1280×800 states and the transition video after the final UI edit, then re-run this gate.

### MEDIUM

1. **[evidence] Capture contamination risk.** `confirm-1280.png`, `saving-1280.png`, `shuffle-1280.png`, and `error-1280.png` visibly include an unexplained black floating control at the lower center. No matching dialog element is present in `StudentProfileGachaDialog.tsx:200-347`; it appears to be capture/browser chrome rather than product UI. It does not obscure the dialog, but final captures should exclude it so the evidence represents only the app.

### LOW

1. **[product] Reduced-motion busy feedback remains continuously animated.** Under `prefers-reduced-motion`, the loader swaps from rotation to an infinite opacity pulse in `src/index.css:23315-23325`. This is a restrained fallback and does not affect layout, but a completely still busy indicator would be more conservative for motion-sensitive users.

## What is verified as good

- The component tree is live and stateful: confirm, saving, shuffling, error, and result are conditionally rendered from the same modal (`StudentProfileGachaDialog.tsx:250-340`), with real controls and semantic card images.
- Color, radius, material, shadows, controls, and text colors consistently inherit project tokens (`src/index.css:23045-23061`, `23112-23125`, `23219-23242`); no one-off color palette or external asset is introduced for the modal.
- The inspected 1280×800 images show a contained ~34rem modal, readable Korean copy without orphaned syllables, clear hierarchy, no dialog clipping, and no duplicate dialog text. The focus ring is visible on the primary action in the confirm capture.
- The declared animation encodes the required state transition rather than decorative motion: staggered card positions/rotations are live motion values (`StudentProfileGachaDialog.tsx:286-301`), followed by a real returned profile card (`:314-339`).
- Dialog semantics, busy status, live announcements, focus containment/return, Escape/backdrop dismissal policy, and reduced-motion timing are implemented (`StudentProfileGachaDialog.tsx:103-146`, `192-245`; `src/lib/useModalFocus.ts:73-150`).

## Blockers before approval

1. Produce clean, browser-rendered evidence for every listed state at exactly 1280×800 after the final edit to `StudentProfileGachaDialog.tsx`, without non-app overlay chrome; re-record the motion evidence from those captures.
