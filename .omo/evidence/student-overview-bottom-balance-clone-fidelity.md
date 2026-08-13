# Clone Fidelity Review: student overview bottom balance

## Recommendation

**APPROVE**

## Scope and target

- Intent reviewed: remove the student-overview top header and place student number, available balance, and reserved balance in one centered floating bar at the bottom of the home canvas, reclaiming the vertical space.
- Design contract: `DESIGN.md` requires the overview to omit a separate top header and to place the compact grouped identity-and-balance summary at the bottom center of the 16:9 canvas.

## Evidence inspected

- Fresh rendered capture: `.omo/evidence/student-overview-bottom-balance-current.jpg` (1280x720), directly inspected at native resolution.
- Live React composition: `src/components/student/StudentOverviewPage.tsx:99-147`.
- Live balance primitive: `src/components/student/StudentBalanceSummary.tsx:12-44`.
- Live artwork/hotspot tree: `src/components/student/StudentPetStage.tsx:114-236`.
- Layout and component tokens: `src/index.css:15345-15370`, `src/index.css:16518-16642`, `src/index.css:14430-14529`.
- Design-system requirement: `DESIGN.md:145`, `DESIGN.md:147`, `DESIGN.md:162-163`, and `DESIGN.md:196`.

## Findings

### CRITICAL

None. The balance bar is a live `StudentBalanceSummary` React component inside the overview hero; it is not a pasted screenshot or full-screen background substitute. The home illustration remains a bounded 16:9 canvas with separately rendered mailbox, library, egg, emotion, character, and pet controls.

### HIGH

None. The change uses the existing reusable balance primitive and scoped overview tokens (`--student-overview-balance-width`, `--student-overview-balance-bottom`, and `--student-balance-compact-height`) rather than introducing a second one-off balance UI.

### MEDIUM

None. In the inspected capture the dock is centered on the canvas (its visual midpoint aligns with the canvas midpoint), remains above the lower ground only, and does not obscure the visible mailbox, library, egg, house, emotion control, or the two destination cards. The dock is explicitly pointer-transparent at `src/index.css:16612-16620`, so it also cannot intercept those stage controls.

### LOW

None. Korean labels and numbers are fully visible with no clipping, collision, or ellipsis in the capture. The grouped hierarchy reads correctly: student number, dominant `사용 가능 고마` value, then quieter `예약 고마` value. The dark green/brown type on the pale translucent material has adequate apparent contrast, and the 1280px low-height rule raises supporting balance text to the documented 0.875rem minimum.

## Visual QA result

- No empty top header band is present; the canvas begins at the top inset and receives the recovered height.
- The dock is visually centered and has enough translucency, border, and shadow to read as a floating status layer without competing with the house scene.
- The bottom action cards stay separate from the canvas and remain fully visible.
- No CJK clipping or awkward wrapping was observed in `1번`, `사용 가능 고마`, `150 고마`, `예약 고마`, `0 고마`, `고마 벌기`, `미션 시작`, `고마 쓰기`, or `경매장·기부 보기`.

## Blockers

None.

## Residual evidence limit

This verdict is limited to the supplied fresh 1280x720 capture and the inspected implementation. It does not claim a new 1280x800 or zoom capture was produced in this review.
