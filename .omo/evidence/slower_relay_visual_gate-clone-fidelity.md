# Clone-fidelity review — slower_relay_visual_gate

## Recommendation

**APPROVE (PASS)**

## Scope and success criteria reviewed

- Intent: failure-exhibition relay papers should move more smoothly and slightly more slowly, without disturbing the existing two-lane gallery hierarchy.
- Required motion contract: outer X-axis spring `280ms → 360ms` with no bounce; inner paper landing `280ms → 360ms`, bounce `0.16 → 0.10`.
- Visual checks: exact `1280×800` rest/mid/settled frames; no overlap, unintended clipping, CJK regression, or hierarchy regression.

## Evidence inspected

- Current live component tree and motion wiring:
  - `src/components/student/StudentFailureRelay.tsx:205-235`
  - `src/components/student/studentFailureRelayMotion.ts:16-48`
  - `src/index.css:13975-14059,14139-14252,14683-14696`
  - `src/lib/failureRelayMotion.test.ts:59-94`
- Design contract: `DESIGN.md:293-295`.
- Captured primary-viewport frames, directly opened and visually inspected:
  - `/private/tmp/failure-relay-motion-rest-1280x800.png`
  - `/private/tmp/failure-relay-motion-mid-1280x800.png`
  - `/private/tmp/failure-relay-motion-settled-1280x800.png`
- Supplied runtime facts treated as corroboration, not replacement for the above inspection: exact live `1280×800`, no overflow; every moving card had `translateY=0` at mid-frame; outer and inner transforms were identity after settling.
- `git diff --check` completed cleanly.

## Findings

### CRITICAL

None. The gallery is a live React/Motion component tree: each row maps `StudentFailureMessage` inside `AnimatePresence`, with two nested `motion.div` layers. No screenshot, raster, canvas, or CSS background substitutes for the interactive cards.

### HIGH

None. The changed timing is implemented once as shared constants and consumed by the live outer and inner motion layers. The outer transition is a `spring` with `duration: 0.36` and `bounce: 0`; the inner paper is a `spring` with `duration: 0.36` and `bounce: 0.1` (`studentFailureRelayMotion.ts:16-26`). This exactly represents the requested slower, calmer movement rather than an unrelated visual effect.

### MEDIUM

None. The rest, mid, and settled frames retain the same six-paper `3 × 2` hierarchy, utility rail, hanging-wire/clip layer, paper edge, footer controls, and colored reading fields. In the mid-frame the lane handoff stays horizontal: papers remain level in their two lanes, with no diagonal or vertical jump. The supplied zero Y translation is consistent with the rendered frame.

The Korean text remains legible at the captured primary viewport, preserving word units and its two-line treatment without collision with profile art, response controls, the rail, or neighboring papers. The only edge masking is the intended `overflow: clip` lane boundary (`src/index.css:13975-13996`); no content is accidentally cut at rest or after settle.

### LOW

None. The mid-frame has the expected focused next-control ring, which is a visible keyboard-focus affordance rather than a visual artifact. At rest and settling, the inner paper returns to a level identity transform, matching the hanging-paper hierarchy.

## Fidelity assessment

- **Token/system use:** motion is centralized in reusable exported transition constants and follows the design contract’s dedicated relay rule (`DESIGN.md:295`), rather than hardcoding timing at individual cards.
- **Layering:** outer layer owns X travel; inner layer owns only the ±`0.4deg` landing rotation with a top-center origin. Static metal clip and wire layers retain their place above/behind the moving paper as intended.
- **Motion coherence:** 360ms is visibly more deliberate than the prior short relay handoff, but remains appropriate for one-card gallery navigation. Zero outer bounce prevents the large cards from feeling elastic; the `0.10` inner bounce supplies a subtle, physical paper-settle cue without competing with text.
- **Accessibility/reduced motion:** arrow-key swaps already disable layout motion; `useReducedMotion` disables the relay motion, and the CSS reduced-motion rule clears the inner transform/will-change (`StudentFailureRelay.tsx:41,69,183-193`; `src/index.css:14683-14696`).

## Blockers

None.

## Verdict

**PASS.** The requested smoother, slightly slower relay is coherently represented by live, reusable motion primitives and maintains the visual hierarchy, clipping boundaries, text treatment, and settled state at the exact primary viewport.
