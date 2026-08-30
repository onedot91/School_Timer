# Gacha slowdown final-2 — clone fidelity and motion review

## Scope and inspected evidence

- Source: `src/components/student/StudentProfileGachaDialog.tsx` (motion tokens, reel keyframes, preload path, reveal path).
- Styling: `src/index.css` (`.student-profile-gacha-*` live DOM styles).
- Fresh uninterrupted 1280×800 capture: `tmp/visual-qa/profile-gacha/slowdown-motion-final-2/01-confirm.png` and `frame-0000.jpg` through `frame-0094.jpg` (95 JPEG frames, each 1280×800; captured 2026-08-30 22:15:24–22:15:29).
- Runtime evidence supplied with the capture: `saving 12ms → shuffling 634ms → revealing 3834ms → result 4391ms`, and `resultImage === revealImage === /failure-profiles/thumbs/09-penguin.png`, `continuityProbe: same-node`.

## Findings

### CRITICAL

None. The modal, reel, gate, and flip are rendered by live React/Motion DOM; no screenshot or raster substitute is used for the UI.

### HIGH

None. The result front face uses `receipt.profileImage`, while the reel deck explicitly excludes that authoritative result. The continuous capture shows the question card flipping into the same penguin card reported by runtime evidence.

### MEDIUM

None. Frames 0010–0016 keep the saving card and Korean copy complete without duplicate text, blank thumbnails, clipping, or overlap. Frames 0020–0068 show fully loaded reel cards and progressively shorter travel; frames 0076–0082 show question-card lock, 3D edge, then penguin; frames 0090–0094 show the settled, focusable result.

### LOW

None. The visual language is token-driven: the component uses reusable `student-profile-gacha-*` primitives and CSS variables (`--apple-*`, `--failure-*`, `--student-store-*`) for color/material/style. Reel movement, gate pulse, and flip are transform/opacity-only; reduced motion keeps the short opacity route.

## Animation findings table

| Before | After | Why |
| --- | --- | --- |
| No blocking issue found | No change requested | The 3.2s `translate3d` reel has a clear late deceleration, the 160ms hold makes the selected card legible, and the following 3D flip resolves to the authoritative penguin result without a visual discontinuity. |

## Verdict

**APPROVE.** The reel is a live, token-based DOM composition, its staged slowdown is visible before the lock, and the visual result continuously resolves to the persisted authoritative card. No clipping, unreadable Korean text, blank card, or unexpected document overflow was found in the inspected 1280×800 evidence.
