# 실패 자랑소 클론·시각·CJK·모션 충실도 검토

- Goal: `failure_exhibition_visual_gate`
- Recommendation: **REQUEST_CHANGES**
- Review mode: read-only, current working tree inspected 2026-08-29

## Evidence inspected

- Current source and uncommitted diff:
  - `DESIGN.md:207-234, 286-289`
  - `src/components/student/StudentFailureExhibitionPage.tsx:122-200`
  - `src/components/student/StudentFailureRelay.tsx:38-260`
  - `src/components/student/studentFailureRelayMotion.ts:1-48`
  - `src/components/student/studentFailureRelayState.ts:1-17`
  - `src/components/student/StudentFailureMessage.tsx:45-111`
  - `src/index.css:13819-14419, 23942-24002`
- Fresh supplied render artifacts, opened and visually inspected:
  - `tmp/failure-exhibition-refined-1280x800-settled.png` — actual `1280×800`
  - `tmp/failure-exhibition-refined-compose-1280x800.png` — actual `1280×800`
  - `tmp/failure-exhibition-refined-empty-1280x800.png` — actual `1075×672`, as disclosed; supplemental only
- Supporting current evidence: `tmp/failure-relay-horizontal-{before,mid,after}-1280x800.png`, `tmp/failure-relay-final-{mid,settled}-1280x800.png`, `src/lib/failureRelayMotion.test.ts:12-85`, `src/lib/failureStoryOverflow.test.ts:14-34`, and the supplied runtime measurements (12px gap, document no-overflow, six 42.3984px clips, outer `y=0`/no rotation, inner-only rotation, settled identity).

The render evidence is a live DOM implementation, not a pasted screenshot or a CSS background-image substitute: React maps `StudentFailureMessage` into two `AnimatePresence` rows (`StudentFailureRelay.tsx:203-239`); the only image in each paper is the genuine profile thumbnail (`StudentFailureMessage.tsx:65-72`).

## Findings

### CRITICAL

None. The display is rendered from reusable React components and CSS layers; no raster or background-image is standing in for the papers, clip, wire, or writing content.

### HIGH

1. **The clip primitive bypasses, and contradicts, its documented design token.** `DESIGN.md:230` defines the failure paper clip as `2.25rem × .7rem`, but the live clip pseudo-element hardcodes `width: 2.65rem; height: .92rem` in `src/index.css:14011-14020`. The supplied measured width, `42.3984px`, confirms the rendered system follows the hardcoded 2.65rem implementation rather than the documented 2.25rem primitive. This breaks the token-driven geometry contract for the named reusable material layer, so the current result is not a rigorous design-system implementation even though it looks orderly.

   Required correction: establish one named clip-size token (or update the documented token to the approved measured geometry) and consume it for the pseudo-element; the CSS and `DESIGN.md` must agree.

### MEDIUM

None.

### LOW

None.

## Non-blocking visual, CJK, and motion assessment

- **Material/layer hierarchy:** pass visually. The settled 1280×800 screen clearly reads wire → centered sand-metal clip → white paper → colored writing field. All six clips are visible, horizontally centered on their papers/wire, and the right rail remains outside the paper grid.
- **Composition and CJK typography:** pass in the inspected populated and compose states. The six writing fields use visibly distinct mint, aqua, butter, sky, lavender, and blush tones. Korean copy begins on consistent left edges; main/lesson pairings maintain a readable hierarchy with no observed collision, crop, isolated trailing syllable, or footer/profile overlap. The source reinforces this with `word-break: keep-all`, `text-wrap: pretty`, two-line clamps, and appropriately sized two-row content tracks (`src/index.css:14185-14237`).
- **Profiles/footer/right rail:** pass. Profile circles share a consistent left footer anchor; the utility rail and pencil action do not cover papers in the primary settled frame.
- **Compose and empty material:** pass visually. The compose dialog uses the same paper/ink/mint vocabulary without becoming a disconnected surface. The supplementary empty rendering retains a wire, clip, white sheet, colored field, and expanded single creation action. It is not exact-primary-viewport evidence, but it is sufficient for the stated material-consistency check and is explicitly identified as scaled.
- **Motion:** pass on code plus supplied runtime evidence. The outer card variant changes only `translateX` (`studentFailureRelayMotion.ts:33-41`); the inner paper variant rotates only ±0.4° (`:43-48`). Both transitions use 0.28s springs; outer bounce is zero and inner bounce is 0.16 (`:16-26`). Keyboard navigation disables layout motion (`StudentFailureRelay.tsx:181-191`), `useReducedMotion` disables it (`:38, 65`), and held controls pause the interval (`:55-62, 242-249`). This matches the stated X-only, under-280ms, interruptible, reduced-motion-safe contract.

## Blockers before approval

1. Resolve the named failure-paper clip size token mismatch and remove the hardcoded geometry at `src/index.css:14016-14017`; update `DESIGN.md:230` or the CSS so one token governs the live primitive.

