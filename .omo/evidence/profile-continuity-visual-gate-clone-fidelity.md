# Clone / visual-fidelity review — profile gacha continuity

**Recommendation:** REQUEST_CHANGES  
**Visual verdict:** REVISE  
**Scope:** Web, `1280×800`, current working tree.  
**Target:** The card locked by the gacha reel must visibly become the authoritative completed result, with no decoy winner, replacement feeling, clipping, or geometry jump. The expected visual language is the existing cream/mint student design system.

## Evidence inspected

All captures were directly opened. `file` verified five JPEGs and one PNG with valid matching signatures; all are exactly `1280×800`. Their modification times (20:09–20:13) are after the reviewed source and stylesheet edits (20:08), so they are fresh for this review. The tiny black bottom-centre capture-tool pill was excluded from assessment.

1. `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0005.jpg` — fast reel: live profile thumbnails are clipped inside the reel; the centre gate is stable and no winner is implied.
2. `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0015.jpg` — deceleration: the same reel shell, centre gate, scale, and Korean copy remain clear; no clipping or awkward line break.
3. `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0020.jpg` — locked question card: the question card occupies the centre gate with a clear, intentional focus hierarchy.
4. `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0025.jpg` — flip: the question card is edge-on in the same central reel area; copy is legible and naturally wrapped.
5. `tmp/visual-qa/profile-gacha/arcade-continuity-final-3/frame-0030.jpg` — settled Polar Bear result: correct committed artwork is visible and the result is not a rasterized screen or decoy, but its card centre has moved materially upward versus the locked/flip card.
6. `tmp/visual-qa/profile-gacha/arcade-continuity-reduced-final/01-reduced-mid-100.png` — reduced-motion Penguin result: direct-result handoff is clear, fully visible, focused on `확인`, and has no CJK clipping. This is a separate run/result and is not evidence of a Polar Bear mismatch.

Runtime evidence supplied with the task states that the full-motion `revealImage` and `resultImage` were both `/failure-profiles/thumbs/78-polar-bear.png`, that the reveal front-card DOM node remained through result, and that the document/viewport was `1280×800` with no scroll. Source inspection corroborates the outcome/result branch uses `receipt.profileImage` and preserves the reveal front face across `revealing` and `result`.

## Findings

### CRITICAL

None. The UI is live React/Motion DOM with individual `<img>` and button elements, not a pasted screenshot, raster background, or image-only fake. See [StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L320) and [StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L394).

### HIGH

- [product] **The authoritative result card jumps upward instead of completing in the locked card’s geometry.** In `frame-0020` / `frame-0025` the question card centre is approximately `y=369`; in `frame-0030` the settled Polar Bear centre is approximately `y=313` (about `56px` upward). This visibly separates the completion card from the card that was just flipped, contrary to the continuity target. The source makes the outcome grid centre all its content ([index.css](../../src/index.css#L23100)); entering `result` simultaneously inserts the result label and confirmation button ([StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L451)), changing the centred grid’s occupied height without a layout animation on the winning-frame/card. The outer dialog itself also grows/recentres. **Required fix:** reserve the result copy/action space or animate the outcome layout so the locked/revealing/result card preserves one anchored centre throughout completion.

### MEDIUM

- [product] **The locked-card element is structurally replaced at the shuffle→reveal boundary, even though the later reveal/result front face persists.** The shuffling branch renders `.student-profile-gacha-locked-card` ([StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L369)); the next branch mounts a distinct `.student-profile-gacha-winning-frame` / `.student-profile-gacha-flip-face` tree ([StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L394)). The supplied runtime probe verifies continuity from the reveal front face into result, which is good, but it does not prove this preceding locked card is the same DOM/spatial element. The captures make this mostly read as a flip, but the implementation is brittle and is inconsistent with the documented “same spatial element” claim in [DESIGN.md](../../DESIGN.md#L306). **Required fix:** make the lock card and flip faces a single retained component or add an explicit shared-layout transition that preserves its exact geometry across the stage boundary.

### LOW

None. Korean headings/body labels are naturally broken and fully visible in every inspected frame. The cream/mint material, yellow frame lights, image cropping, and focused `확인` action retain the established visual hierarchy; no unexpected clipping, scroll, or duplicated winner card is visible.

## Design-system integrity

The reviewed surface uses a live component tree, semantic native buttons, token-driven colour/radius/shadow families (`--apple-*`, `--failure-*`, `--student-*`), and a shared motion constant exported from the component. The final front face reads `receipt.profileImage` directly ([StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L435)), and deck candidates explicitly exclude that image ([StudentProfileGachaDialog.tsx](../../src/components/student/StudentProfileGachaDialog.tsx#L69)); therefore a reel decoy is not presented as the committed winner.

## Blocking list

1. Remove or animate the roughly `56px` final-card vertical jump; the completion card must remain spatially continuous with the locked/flipped card.
2. Preserve the locked card as the flip card (or provide an explicit shared-layout continuation) across the shuffle→reveal boundary so the documented continuity is real rather than merely visually approximate.
