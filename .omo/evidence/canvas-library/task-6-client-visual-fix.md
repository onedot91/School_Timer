# Task 6 client visual fix

## Scoped changes

- Full-capacity registration copy changed to `100자리가 모두 찼어요. 꽂힌 책은 읽을 수 있어요.` so the final `요.` no longer becomes an orphan line.
- Only while `.student-canvas-library` is mounted, the data-mode banner's descriptive `span` uses the established visually-hidden pattern. The visible `strong` mode label remains unchanged; other routes and the global banner contract are untouched.

## RED artifacts

- `.omo/evidence/canvas-library/task-6-root-route-full-desk.png`: old long capacity sentence ends with `요.` alone.
- `.omo/evidence/canvas-library/task-6-root-route-text-200.png`: at 200% text size, the full mock description overlaps the registration close button.

Both supplied PNGs are valid 1280×800 RGB screenshots and were directly inspected before editing.

## Actual verification

Invocation:

```text
npm run dev:stable -- --host 127.0.0.1 --port 3032 --strictPort
node .omo/evidence/canvas-library/task-6-client-visual-fix-qa.mjs
```

The driver uses isolated synthetic localStorage and blocks/fakes every external or `/api/**` request. It reaches the desk through real held-arrow movement, never by position mutation.

| Scenario | Binary observable | Artifact |
| --- | --- | --- |
| 100 occupied slots at 1280×800 | exact shorter sentence produced one `272.94px` text rect; no rect under 24px and no orphan syllable | `task-6-client-visual-full.png`, `task-6-client-visual-fix.json` |
| Registration at 200% root text size | banner rect `[1112.17,16,1256,82.5]`; close rect `[972,60,1060,148]`; `intersects:false` | `task-6-client-visual-200.png`, JSON receipt |
| Mode remains explicit | visible banner strong text is exactly `연습 모드`; descriptive span remains accessible in a `1×1` clipped box | JSON receipt and PNG |

Both GREEN screenshots were directly inspected. The full-capacity text is a clean single line. At 200%, the compact mode badge remains visible with clear space before the 88×88 close control.

## Static verification and cleanup

- `npm run lint`: PASS (`tsc --noEmit`).
- `git diff --check`: PASS.
- Owned Vite session on port 3032 stopped with Ctrl-C after capture. Root-owned ports were not touched.
- No dependency, asset, client/API, persistence, or other-route changes.

## SHA-256 at handoff

```text
323fc06596fd57aa2e93f1f85d0d3c1eecdbd0b9e13f4ceb8b0ae9bc0ee68a09  src/components/student/library/CanvasLibraryGame.tsx
6f0da9ccd11897571e5710f70c7b398a288c68464e6f2affa6be448226b88d4a  src/index.css
ed4e3ad8bee4e5f3f228e509a398ded8af0dbb8a81a54803a8245763d6aa5008  task-6-client-visual-full.png
26ffaebd5b859c263ce525ad0e5349e9deee869d673aff021d83852d7e6f4719  task-6-client-visual-200.png
c4a0a40d88236fbb3bb444227f965107bfd724298f71ca11f05f5ff0a5b9cdba  task-6-client-visual-fix.json
```
