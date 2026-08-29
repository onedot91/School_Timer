# Clone / visual fidelity re-gate — dual-lane failure relay

**Recommendation:** REQUEST_CHANGES (visual gate result: **REVISE**)

## Scope and criteria

- States reviewed: rest, true mid-transition (~70 ms), settled (one sequence; all are 1075×672 JPEGs).
- Required behavior at eight or more stories: two stable three-card lanes; one outgoing and one incoming card per lane per move; exactly two newly visible stories; lane-local horizontal movement; four card DOM nodes per lane in flight; three per lane at rest/settled.
- Primary Chromebook proof requires exactly 1280×800 at 100% with `window.innerWidth === 1280` and `window.innerHeight === 800`. That proof was not supplied and was not substituted with the 1075×672 files.

## Artifacts inspected

- `tmp/failure-relay-dual-lane-rest-1075x672.jpg` — direct visual inspection; JPEG signature, 1075×672; modified 2026-08-29 19:56:53.
- `tmp/failure-relay-dual-lane-true-mid-1075x672.jpg` — direct visual inspection; JPEG signature, 1075×672; modified 2026-08-29 19:59:58.
- `tmp/failure-relay-dual-lane-settled-1075x672.jpg` — direct visual inspection; JPEG signature, 1075×672; modified 2026-08-29 19:56:54.
- `src/components/student/StudentFailureRelay.tsx` (especially lines 68–79, 209–245), `src/components/student/studentFailureRelayMotion.ts` (lines 16–48), `src/lib/failureExhibition.ts` (lines 220–221, 342–384), `src/index.css` (lines 12633–12649, 13972–14056), and `DESIGN.md` (lines 224–233, 291–293).
- `src/lib/failureRelayCycle.test.ts` and `src/lib/failureRelayMotion.test.ts`; `npm test` (293 passing) and `npm run lint` (passing), executed during review.

The captures are newer than the relay source file. Their JPEG format has no alpha channel, so no alpha-channel assertion is available; no opaque/black compositor failure was visible in the shown relay surface.

## Findings

### CRITICAL

None found. The reviewed relay is live React/Motion DOM rather than a pasted image: it maps rows into real `motion.div` cards and renders the real `StudentFailureMessage` component ([StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:210)).

### HIGH

1. **[product] Header disappears in the supplied true-mid frame.** In `failure-relay-dual-lane-true-mid-1075x672.jpg`, the Home control, “실패 자랑소” title/catchphrase, and bookshelf control present in the rest and settled frames are absent; only the practice-mode banner remains. This is outside the documented relay movement and violates the requirement that the cards, rather than the surrounding page UI, are the moving surface. The header is rendered outside the relay ([StudentFailureExhibitionPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureExhibitionPage.tsx:123)), while lane animation is scoped to cards ([StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:213)). The evidence therefore exposes either a real surrounding-page rendering regression or a defective mid-capture path; it cannot be approved as an intentional transition.

2. **[evidence] The primary 1280×800 at 100% visual gate is unproven.** All supplied files are 1075×672. Per the project’s viewport contract, these may support observations only; they cannot establish no clipping, no overlap, no unintended scroll, or first-screen fit at the required primary viewport. This is an evidence gap, not a claim that the 1280×800 product is wrong.

### MEDIUM

None found in the relay itself.

- The card-level outer variants use `translateX(...)` only ([studentFailureRelayMotion.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/studentFailureRelayMotion.ts:33)); supplied matrix observations likewise report `translateY = 0`. The small `±0.4deg` transform belongs only to the inner paper layer ([studentFailureRelayMotion.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/studentFailureRelayMotion.ts:43)) and is explicitly allowed by the current motion contract ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:293)); it is not a lane/card translation.

### LOW

1. **[evidence] Mid-state provenance is underspecified.** The true-mid frame shows a visible focus outline on the right navigation control while rest/settled do not. This may be a valid keyboard transition, but the capture record does not state the trigger. Record trigger/focus state with the replacement sequence so comparison is deterministic.

2. **[evidence] JPEGs cannot provide the visual-QA alpha check.** Use PNG for the replacement sequence if alpha/compositor integrity is expected to be asserted. This did not conceal a visible defect in the current frames.

## What passes and must not regress

- **[product] Real component/layer tree:** two row containers each own `AnimatePresence`; each card is a live `motion.div` wrapping a live `StudentFailureMessage`, not a raster or `background-image` substitute ([StudentFailureRelay.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentFailureRelay.tsx:209)).
- **[product] Token-driven surface:** wire offset, clip geometry, story palette, typography, rail width, and feed measure are named in `DESIGN.md` and backed by CSS custom properties ([DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:224), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12633)). No one-off screenshot-matching color or image layer was found in the relay.
- **[product] Lane data model:** at ≥8 stories the oldest-first archive is split once into stable lanes and each row advances independently ([failureExhibition.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureExhibition.ts:342)); the focused cycle test proves two retained cards per row and two unique arrivals ([failureRelayCycle.test.ts](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/failureRelayCycle.test.ts:36)).
- **[product] Motion geometry in the supplied sequence:** rest and settled visibly return to three cards per row. True-mid shows each row as outgoing + two retained + incoming with only left/right edge cropping. The supplied matrix measurement and source both support X-only outer motion; there is no visual evidence of row-crossing, diagonal card travel, or card-content overlap.
- **[product] Wire/clip hierarchy:** both resting states keep a wire per row and centered hook/clip above each paper. In true-mid the clips remain card-owned and visually aligned with their moving sheets; the wire remains row-owned. The CSS z-index/layer arrangement matches that reading ([index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:13985)).
- **[product] CJK and settled layout:** fully visible Korean titles and next-step lines have no observed missing glyphs, baseline clipping, isolated particles, or bad semantic wraps. Edge-clipped mid-frame text is the expected result of offscreen card transit, not intrinsic CJK truncation. The 3×2 rest/settled spacing remains clear and the toolbar/FAB does not cover a card or wire.

## Blockers before approval

1. Resolve or disprove the true-mid header disappearance with one complete fresh **same-input** capture sequence. Verify the header element’s bounding box/opacity/computed transform remains unchanged through the card move; if the absence is a capture-pipeline artifact, replace the frame rather than changing product code.
2. Capture rest, ~70 ms mid, and settled as PNG at exact 1280×800/100%, with the browser toolbar and `window.innerWidth/innerHeight` confirming `1280/800`. Reconfirm three/four/three cards per row, no overlap, header persistence, wire/clip alignment, and CJK legibility.

## Independent review reconciliation

Two read-only reviewers directly opened all three files. Both confirmed the live two-lane card structure, 4-card mid-state, edge-only crop, wire/clip alignment, no card-content overlap, and clean fully visible CJK. Both independently flagged the missing primary viewport proof and the header disappearance. One reviewer additionally inferred vertical row movement from the frame and treated the inner rotation as a horizontal-motion failure. That conclusion is not retained: the visible wire positions are stable, the supplied outer matrices have zero Y translation, and the current `DESIGN.md` expressly permits inner-only landing rotation.

## Final gate

**REVISE.** The dual-lane relay mechanics themselves meet the stated visual/motion intent in the available frames, but the vanishing header in true-mid and the missing authoritative viewport evidence prevent approval.
