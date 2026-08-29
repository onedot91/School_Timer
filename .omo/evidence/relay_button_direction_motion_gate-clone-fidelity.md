# Clone-fidelity review — relay_button_direction_motion_gate

## Recommendation

**APPROVE (PASS)**

## Evidence inspected

- `src/components/student/StudentFailureRelay.tsx:66-73,134-140,181-191,203-257`
- `src/components/student/studentFailureRelayMotion.ts:1-35`
- `src/lib/failureRelayMotion.test.ts:1-54`
- `src/index.css:13948-14063`
- `src/lib/failureExhibition.ts:320-336`
- `DESIGN.md:289`
- Exact 1280×800 PNG frames: `tmp/failure-relay-horizontal-before-1280x800.png`, `tmp/failure-relay-horizontal-mid-1280x800.png`, `tmp/failure-relay-horizontal-after-1280x800.png`
- Fresh runtime measurements supplied with the review: left action A `x=32.2 → -220.1` (Δ `-252.3`); reset then right action A `x=32.2 → 305.3` (Δ `+273.1`).
- Fresh automatic-motion measurement at the exact same CSS `1280×800` viewport: after waiting `5.58s`, A changes from `x=32.2` to `x=414.7` (Δ `+382.5`) and the settled rows are `[[G,A,B],[C,D,E]]`.
- Reproduced checks: `npm test` — PASS (284/284); `npm run lint` — PASS.

## Findings

### CRITICAL

None. The relay is live React/Motion DOM (`StudentFailureMessage` inside per-lane `AnimatePresence`), not a raster, screenshot, or background-image substitute.

### HIGH

None. The chevrons and measured card movement agree: left control uses move `+1`, which sets `older` and translates exiting cards left; right control uses move `-1`, which sets `newer` and translates exiting cards right. The physical measurements independently confirm the sign of both movements.

### MEDIUM

None. Both visible labels/titles align with the newest-first source order: left is `이전 이야기 보기` / `더 오래된 이야기`, right is `다음 이야기 보기` / `더 새로운 이야기`. `STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE` is the right-button move and the interval consumes that constant (`StudentFailureRelay.tsx:134-140`); the fresh wait measurement verifies that automatic movement also travels right.

### LOW

None.

## Fidelity assessment

- **Layer/layout:** the live window is exactly two clipped, three-card horizontal lanes; neither the full container nor any card animation changes the Y axis.
- **Motion:** variants use only `translateX`; the shared transition is a zero-bounce spring with `duration: 0.28`. There is no added opacity, blur, stagger, or layout-property animation.
- **Handoff:** a lane-boundary card exits on one horizontal lane and enters the opposite edge of the other lane, preserving the intended non-diagonal cyclic relay.
- **Cohesion and pause:** the automatic interval uses the identical signed move as the right chevron. Any hover, focus, expanded card, stamp menu, external pause, or held navigation control tears down the interval through `shouldPauseStudentFailureRelay`; release creates a fresh interval. The focused unit test proves the held-navigation condition.
- **Regression protection:** current unit coverage verifies row split, X-only variants, directional button mapping, automatic move mapping, and held-control pausing. Keyboard arrows intentionally swap without motion; reduced motion also disables layout/entry/exit motion.

## Blockers

None.
