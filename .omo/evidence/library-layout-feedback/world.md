# Library world layout evidence

Date: 2026-09-05

## Focused world scenario

Invocation:

```sh
node --import tsx --test src/lib/canvasLibraryWorld.test.ts
```

Binary observable: exit code `0`; Node reported `tests 22`, `pass 22`, and `fail 0`.

Covered behavioral assertions:

- Full room has exactly two 5×10 bookcases, 100 unique stable slot IDs `0..99`, 6px-or-wider slots, and 1–3px adjacent horizontal gaps.
- Spawn `(312, 340)` is within 28 logical pixels of the desk interaction point `(312, 341)`.
- The failure board target resolves as `kind: 'failure-board'` at its interaction point.
- No furniture colliders overlap; deterministic movement reaches every bookcase slot target and the failure board.
- Invalid and stale slot IDs preserve draft and placement state; invalid movement, bounds, collision substeps, and deterministic timing remain covered by the same suite.

Captured output: [world-test.log](world-test.log).

## Type and patch integrity

Invocation:

```sh
npm run lint
git diff --check -- src/lib/canvasLibraryWorld.ts src/lib/canvasLibraryWorld.test.ts src/components/student/library/CanvasLibraryRenderer.ts
```

Binary observable: both commands exited `0`; TypeScript emitted no diagnostics and `git diff --check` emitted no whitespace errors.

Captured output: [world-lint.log](world-lint.log), [diff-check.log](diff-check.log).

## Renderer scope

`CanvasLibraryRenderer.ts` renders the code-drawn cork/paper failure board only when `room.failureBoard` is present. In that state it omits the reading table, bench, and decorative books; placed books fill their authored slot width rather than rendering as sparse centered slivers. Browser-route QA is owned by the root integration task because it supplies the target callback and modal.
