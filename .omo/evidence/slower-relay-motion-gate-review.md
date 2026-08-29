# Slower relay motion — final gate review

## recommendation

APPROVE

## blockers

None.

## originalIntent

Make the failure-exhibition card movement smoother and slightly slower while preserving movement direction, the 5.5-second automatic interval, X-only card travel, reduced-motion behavior, and all data behavior.

## desiredOutcome

Relay cards use a restrained, slightly longer transition, move only horizontally in the established direction, settle fully level, and leave timing triggers, accessibility motion reduction, and persisted state unchanged.

## userOutcomeReview

- SC-1 smoother/slightly slower movement: PASS. `STUDENT_FAILURE_RELAY_TRANSITION` and `STUDENT_FAILURE_PAPER_TRANSITION` both use a 0.36-second spring. Outer motion has zero bounce; the inner paper has only 0.10 bounce and returns to zero rotation.
- SC-2 direction preserved: PASS. Left/right and automatic movement mappings are unchanged in the motion module; enter/exit signs remain direction-dependent and consistent with the existing controls.
- SC-3 automatic interval preserved: PASS. `StudentFailureRelay.tsx` retains the 5.5-second timer and uses `STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE`.
- SC-4 X-only card movement: PASS. Card variants contain only `translateX`; live mid-motion evidence reports zero Y translation.
- SC-5 reduced-motion behavior preserved: PASS. `canAnimateRelay` still gates variants/layout, and the disabled path uses immediate duration 0 with no paper entrance rotation.
- SC-6 data behavior unchanged: PASS. The scoped motion module and transition consumption do not read, normalize, or write story data.
- SC-7 exact viewport visual result: PASS. Evidence is 1280×800 at 100%; the 450ms settled state has identity card transforms and identity paper rotation, without clipping or first-screen overflow.

## direct remove-ai-slops / programming pass

- No new dependency, unsafe type escape, suppression, dead code, speculative abstraction, boundary violation, or data normalization was introduced by the scoped timing change.
- The timing test directly pins the requested observable configuration and distinguishes card bounce from paper landing bounce. It is narrow and not tautological: changing either duration or bounce fails it.
- Direction/X-only/automatic-direction tests cover preserved contracts. They do not merely test deletion or mirror a new parser/normalizer.
- The small motion module remains cohesive and well below the oversized-module threshold.
- NOTE: exact configuration assertions are intentionally coupled to the motion contract; for this request, duration and bounce are the user-visible behavior, not an incidental implementation detail.

## checked artifact paths

- `src/components/student/studentFailureRelayMotion.ts`
- `src/components/student/StudentFailureRelay.tsx`
- `src/lib/failureRelayMotion.test.ts`
- `DESIGN.md`
- `/private/tmp/failure-relay-motion-rest-1280x800.png`
- `/private/tmp/failure-relay-motion-mid-1280x800.png`
- `/private/tmp/failure-relay-motion-settled-1280x800.png`

## reproduced verification

- `npm test -- --test-name-pattern=...`: PASS, 299/299 (the project script forwarded the pattern after its glob, so the full suite ran).
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS; only the existing >500 kB chunk-size warning was emitted.

## exact evidence gaps

- The `omo` executable is unavailable in this environment, so `currentAttemptDir` could not be read. This report uses the required fallback `.omo/evidence/<goal>-gate-review.md` location.
- No separate code-review report or manual-QA matrix path was supplied. Direct source, test, DOM-measurement evidence, and all three screenshots support every stated criterion, so this is not a blocker.
