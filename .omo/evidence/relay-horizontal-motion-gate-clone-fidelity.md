# Relay horizontal-motion clone-fidelity review

- Goal: `relay_horizontal_motion_gate`
- Recommendation: **APPROVE** (`PASS`)
- Scope: read-only re-review of the uncommitted relay-motion implementation, using fresh current-source exact CSS `1280×800` frames.

## Evidence inspected

- Current implementation: `src/components/student/StudentFailureRelay.tsx`, `src/components/student/studentFailureRelayMotion.ts`, `src/index.css`, `src/lib/failureRelayMotion.test.ts`, and `DESIGN.md:289`.
- Fresh rendered evidence, all valid `1280×800` RGB PNG and captured after the current source mtimes:
  - `tmp/failure-relay-horizontal-before-1280x800.png` (`18:57:34`)
  - `tmp/failure-relay-horizontal-mid-1280x800.png` (`18:57:34`)
  - `tmp/failure-relay-horizontal-after-1280x800.png` (`18:57:35`)
- Exact-source runtime samples supplied for review: at `0/30/60/90/120/160/220ms`, outgoing C in the top lane stays at `top=138.6` and incoming C in the bottom lane stays at `top=472.0`, with `transform` matrix Y component `0`; reverse D `4→3` stays at `138.6/471.6` with Y component `0`; reduced motion leaves exactly one final C with the identity transform after `20ms`.
- `git diff --check` passes.

The previous report's evidence-staleness finding is superseded. These current-source captures are valid PNGs, have the exact requested dimensions, and were visually inspected in this review.

## Findings table

| Before | After | Why |
| --- | --- | --- |
| N/A | No change requested | The fresh rest/mid/settled sequence visibly satisfies the specified horizontal handoff without a perceptible defect. |

## Findings by severity

### CRITICAL

None. The relay is live React/Motion DOM; no screenshot, raster, or background-image substitute is used.

### HIGH

None. At the slot `3→4` boundary, the visual design intentionally renders C twice only during the handoff: outgoing C is clipped at the top lane's right edge while incoming C is clipped at the bottom lane's left edge. This reads as a continuous cyclic relay, not a diagonal flight or an unintentional duplicate. The corresponding reverse D `4→3` runtime geometry is symmetric.

### MEDIUM

None. The current primary viewport frames show neither card overlap nor unintended clipping: the only clipping is the deliberate lane-edge masking required for the handoff. Korean labels retain visible padding and do not collide with the rail or neighboring papers in the inspected frames.

### LOW

None.

## Motion standards assessment

- **Horizontal-only / physical continuity:** pass. Each row is a clipped three-column lane (`src/index.css:13961-13980`); the C handoff is represented as paired outgoing/incoming lane instances rather than one node traversing Y. The fresh mid-frame and supplied matrices prove fixed lane tops and `y=0`.
- **Live, reused component tree:** pass. The rows map live `StudentFailureMessage` components within `AnimatePresence` (`src/components/student/StudentFailureRelay.tsx:203-239`), not a visual mock.
- **Motion properties:** pass. Variants set only `translateX` (`studentFailureRelayMotion.ts:14-21`); no opacity, blur, stagger, top/left, or container/page translation is introduced.
- **Timing:** pass. The shared transition is a `spring`, `duration: 0.28`, `bounce: 0` (`studentFailureRelayMotion.ts:3-7`), within the requested 280ms zero-bounce contract.
- **Keyboard and reduced motion:** pass. Arrow navigation requests `move(..., false)` (`StudentFailureRelay.tsx:181-191`), and the supplied exact-source reduced-motion result has one final item with identity transform after 20ms.
- **Regression coverage:** the unit test remains narrow (`src/lib/failureRelayMotion.test.ts:8-29`), but it is no longer a release blocker because the required current-browser geometry and reverse/reduced-motion samples were directly evidenced. A future UI test would be useful defense-in-depth, not a remaining observable defect.

## Verdict

**Approve / PASS.** No feel-breaking motion, unmasked duplication artifact, clipping regression, responsive/CJK defect in the inspected primary viewport, or design-contract mismatch remains actionable. The temporary dual C at the two lane edges is the specified non-diagonal handoff and is cleanly clipped.
