# Bookshop quality code review

Reviewed: 2026-09-05 (current-tree re-review)

Scope inspected: current working-tree bookstore-quality diff, including `CanvasLibraryGame.tsx`, `CanvasLibraryRenderer.ts`, `CanvasLibraryCharacter.ts`, `canvasLibraryPose.ts`, `canvasLibraryAudio.ts`, `canvasLibraryWorld.ts`, scoped CSS/UI changes, tests, and `dev/library-review.tsx`.

## Verdict

- **codeQualityStatus:** WATCH
- **recommendation:** APPROVE
- **blockers:** None.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **The new audio fake bypasses the production audio boundary's type contract.**  
   `src/lib/canvasLibraryAudio.test.ts:51` coerces `FakeContext` with `as unknown as AudioContext`. The fake implements only the methods currently read by the implementation, so a future production call to an unmodeled Web Audio member can compile while this test fake remains silently incompatible. Define a narrow internal context/node interface for `createLibraryAudio`'s injection seam and make both `AudioContext` and `FakeContext` satisfy it without a double cast. This is test-maintainability debt, not a runtime blocker.

### LOW

None.

## Verified behavior and scope observations

- The 100 slot IDs remain `0..99` and placement still uses the existing `slotId` contract. The new room tests exercise empty and full-book target reachability; this is meaningful behavioral coverage, not a removal-only or implementation-constant test.
- `canvasLibraryPose.ts` centralizes the hand/book motion. Its tests cover four facings, the receive-to-carry endpoint, the placement endpoint, reduced motion, and action duration boundaries. The tests assert externally useful geometry/state, so they are not tautological.
- The earlier undefined `book` references are fixed in this revision: `drawWoodBlock` now only uses its explicit rectangle, and placed-book thickness/height is exclusively calculated in `drawPlacedBook`.
- The placement logic delays rendering the persistent placed-book entity until the transfer reaches 80% and draws the travelling book only while it is not in the hands. Reading the state transitions shows no deliberate duplicate-book interval or a 500 ms visibility gap; this remains unverified visually because this review did not run browser QA.
- Final renderer re-review: the back-facing transfer is drawn immediately before its character body, so it is hidden by the bear as intended; other facings draw the transfer in the final action layer. `getLibraryPlacedBookRect`, `getLibraryBookMotion`, and `drawLibraryBookSpine` now share the same final rectangle and stable tone source. The 14 pose tests cover all slots at multiple page counts through the 399 ms to 400 ms insertion boundary.
- Audio has an explicit dispose/pause path. `setPaused`/mute stop and disconnect active voices, disposal is idempotent and closes the context once, and re-enabling retains the same context intentionally. The broad catches in `canvasLibraryAudio.ts` are acceptable for this project because optional audio failures are explicitly non-fatal; no production parsing/data-normalization was added.
- `dev/library-review.tsx` now registers `import.meta.hot?.dispose(() => reactRoot.unmount())`. Unmount runs the review component cleanups for animation frames, keyboard/visibility listeners, input-driver timer, recording streams, recorder callbacks, and object URLs. Its local `onPlace` changes in-memory state only; it is a Vite development entry and not part of the production app graph.
- The new `CanvasLibraryCharacter.ts` is 143 pure LOC. `CanvasLibraryRenderer.ts` (965 pure LOC) and `CanvasLibraryGame.tsx` (818 pure LOC) remain oversized under the strict `remove-ai-slops` size heuristic, but both predate this diff and the character extraction reduces renderer responsibility. This is existing architectural debt, not a new scope-blocking finding.

## Skill-perspective check

Ran: yes. Consulted `omo:remove-ai-slops` and `omo:programming` before judging test relevance and maintainability.

- **remove-ai-slops:** No new deletion-only, prompt-text, tautological, or implementation-mirroring tests found in the reviewed additions. The relevant reachability, pose, and audio tests lock observable behavior. No needless production data extraction, parsing, or normalization was added.
- **programming:** No production `any`, `@ts-ignore`, unchecked persistence cast, or needless public abstraction found. The test-only double cast at `canvasLibraryAudio.test.ts:51` is the MEDIUM finding above. Optional-audio error swallowing is justified by the existing non-fatal audio requirement and remains limited to that boundary.

## Validation evidence

- `git diff --check`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 706 tests.
- `node --import tsx --test src/lib/canvasLibraryPose.test.ts`: passed, 14 tests, after the final depth/continuity revision.
- No browser/manual visual claim is made; no screenshot or runtime recording from this review was inspected as proof of the new visual result.

## Exact reviewed content (SHA-256)

```
2efcd0f4ac5cba7b6585eb07503960da4b6ed794db76bacbf619007581225d51  src/components/student/library/CanvasLibraryRenderer.ts
41a939dff7e22efb8a1ea49961248e8c3fbd5d8dec7de24ffaa2288c2ebddc8f  src/components/student/library/CanvasLibraryGame.tsx
ebe47135a7e816fc3e1f4760e1d7e15ddec978fa20ecaade5a6e1ff00452fb07  src/lib/canvasLibraryAudio.ts
15dbf9cfe21c9d9b87d83b1e3713f1bc6c375438f1c41b31955f95f942bd8a06  src/lib/canvasLibraryAudio.test.ts
9b9669ae1f4a366a6e6af9babe2064a4636322f5224166b0d3d2ddb0d354f79e  dev/library-review.tsx
604428c989b0e8def11022599c5cea4ed74d461ba6f226e51d996bd44982b4d1  src/lib/canvasLibraryPose.ts
8ac5f12e82e7a0641863b2e9da1c4f1b1c6939d60ea4c037069021c2c47f8bef  src/lib/canvasLibraryPose.test.ts
fe07f017543fcfc0ecdffe1907379bbe4c2dd31783245b439a8f294ec738434d  src/components/student/library/CanvasLibraryCharacter.ts
11d28d45bbe15d088bc36efdcdf7033afbaf4875db1a432f42ec6258d14571a9  DESIGN.md
```
