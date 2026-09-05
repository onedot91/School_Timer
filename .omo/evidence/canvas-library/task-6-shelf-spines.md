# Task 6 — Canvas shelf spines

## Implementation

`src/components/student/library/CanvasLibraryRenderer.ts` `drawPlacedBook` now renders each placed book as a centered narrow vertical spine. `pageCount` deterministically maps to `clamp(round(pageCount / 100), 3, 7)`, then the width is capped at `floor(height * 0.45)`, clamped inside the slot with a 2px minimum. `slotId % 3` continues to select the coral/blue/sage palette and provides the 0/1/2px height inset. The existing corner selection cue and decorative table-book renderer are unchanged.

## Evidence

| Criterion | Exact invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Empty room remains safe at Chromebook viewport | `npm run dev -- --host 127.0.0.1 --port 3039`; `node .omo/evidence/canvas-library/task-6-shelf-spines-qa.mjs` with `?mode=empty` | Canvas `624x376`, CSS `1248x752`, document overflow `[0,0]`, no browser errors or blocked requests | [`task-6-shelf-spines-empty.png`](./task-6-shelf-spines-empty.png), [`task-6-shelf-spines-qa.json`](./task-6-shelf-spines-qa.json) |
| Full synthetic 100-slot room across all shelf styles | Same command with `?mode=full` and slots `0..99` occupied | `count:100`, `allHaveBasePixels:true`, `allVertical:true`, `allWithinSlots:true`, `allHaveBindingBands:true`, width range `2..4`, no errors/blocked requests | [`task-6-shelf-spines-full-100.png`](./task-6-shelf-spines-full-100.png), [`task-6-shelf-spines-qa.json`](./task-6-shelf-spines-qa.json) |
| Type/build/diff validation | `npm run lint`; `npm run build`; `git diff --check -- src/components/student/library/CanvasLibraryRenderer.ts` | lint exit `0`; Vite build exit `0`; diff check exit `0` | [`task-6-shelf-spines-lint.log`](./task-6-shelf-spines-lint.log), [`task-6-shelf-spines-build.log`](./task-6-shelf-spines-build.log), [`task-6-shelf-spines-diff-check.log`](./task-6-shelf-spines-diff-check.log) |

Viewport QA was run at `1280x800` on isolated `stableVite3039`. The server and temporary Chrome tab were closed after capture; `lsof -nP -iTCP:3039 -sTCP:LISTEN` returned no listener.

## Current hashes

```text
bbed35c35c5d2d50b5d2488b89a431fc523762a6b781a1c610e55d884326819d  src/components/student/library/CanvasLibraryRenderer.ts
1e04c2ded633cc759f8d2a1802b32bb97a960ae2ee4b93bc9c54d595d4b98d03  .omo/evidence/canvas-library/task-6-shelf-spines-qa.json
a1bb41784e65c55c97d250a84c9aac7d8eae0d615329066ef5c5e6fde350a230  .omo/evidence/canvas-library/task-6-shelf-spines-empty.png
4cc6a6e238b46b10c85271e9778bc1f2769d52e2186a1be314fd4e35b93500f3  .omo/evidence/canvas-library/task-6-shelf-spines-full-100.png
```
