# Task 6 — shared Canvas library client and route cutover

## Outcome

- Added a typed `canvasLibraryClient` boundary for shared `/api/shared-settings` placement and one-record local mock/no-config persistence.
- Replaced the old bookshelf form route with the full 100-slot Canvas room. The route receives every placed class book plus only the current student's unplaced legacy choices.
- Shared success applies the returned authoritative snapshot and `updatedAt`, invalidates the writable shared cache, and updates the student snapshot cache. Submitted state is never cached as authoritative.
- Placement keeps the carried draft on expected failures. A ref lock blocks repeated submit before React rerenders; late unmounted results do not write component state; unexpected errors are rethrown.

## PIN / RED / GREEN

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Old form was active and Canvas absent before cutover | Root isolated full-app 1280×800 baseline | old form present; Canvas absent | `task-6-route-baseline.png`, `task-6-route-baseline.json` |
| Adapter boundary RED | `node --import tsx --test src/lib/canvasLibraryClient.test.ts` before implementation | missing module; later 3 explicit adversarial tests failed before fixes | this report; terminal receipts in task history |
| Typed adapter GREEN | `node --import tsx --test src/lib/canvasLibraryClient.test.ts` | 13 passed, 0 failed | `src/lib/canvasLibraryClient.test.ts` |
| Stable identity | same carried new draft retried at same and different slots after rejected fetch | request IDs are equal | focused test output above |
| Response validation | malformed envelope, wrong receipt/student/metadata/slot, and envelope/snapshot mismatch | `INVALID_LIBRARY_RESPONSE`; cache invalidation count remains 0 | focused test output above |
| Mode/fallback rules | readonly without config, mock with injected config, configured 502/network/hung fetch | readonly blocked; mock local; configured failures never call local store; hung fetch aborts | focused test output above |
| Local coupled persistence | pure placement with existing combined snapshot and failing storage | one successful write contains book+reward; failed storage returns error and leaves input unchanged | focused test output above |
| Existing legacy book | own unplaced draft with `bookId` | exact `{kind:'existing',bookId}` command; no new metadata command | focused test output above |

## Real route surface

Invocation:

```text
npm run dev:stable -- --host 127.0.0.1 --port 3032 --strictPort
node .omo/evidence/canvas-library/task-6-client-route-qa.mjs
```

The Playwright driver uses the preinstalled runtime and Chrome, an isolated context, synthetic student 23 local data, and blocks every non-local request while faking unrelated `/api/**` background reads. It uses actual keyboard movement from spawn to the desk and shelf; no position teleport or production data is used.

Binary observables:

- viewport `1280×800`; stage `[12,12,1256,776]`; Canvas `1248×752`; document overflow `[0,0]`; StudentHeader count `0`.
- keyboard walk → registration modal → title/author/pages → carry → keyboard walk → 100-slot shelf picker → slot 0 placement → details dialog.
- combined local record contains deterministic `library:23:<uuid>` at slot 0, preserves `legacy-own-23`, contains 2 books total, changes balance 30→40, and contains exactly one weekly reward entry.
- request receipt contains no `/api/shared-settings` request in mock mode; unrelated external font/dev requests were blocked.
- PNG was directly inspected: valid `1280×800` RGB image, unified Canvas scene and readable semantic details dialog, no clipping/overlap.

Artifacts:

- `task-6-client-route-qa.mjs`
- `task-6-client-route.json`
- `task-6-client-route.png`

CUA was attempted first but reported `Browser is not available: chrome`; the plan-approved preinstalled Playwright fallback was used. The first two Playwright runs exposed only evidence-driver assertions (non-exact accessible-name matching and an incorrect reward discriminator); both driver defects were corrected and the complete scenario reran from a fresh isolated context. The final stable Vite process was stopped with Ctrl-C after capture.

## Final verification

| Command | Result |
| --- | --- |
| `npm run lint` | PASS (`tsc --noEmit`) |
| `npm test` | PASS, 571/571 |
| `npm run build` | PASS, 2240 modules transformed |
| `git diff --check` | PASS |

## Final source hashes (SHA-256)

```text
f6d8b75f8c15abc3b5f093dab17defbde08207aa3f3afd99cd0aca007a4d3115  src/lib/canvasLibraryClient.ts
24222266dd67d0c47f478b41e231e148e568a3dc99ae6d214d2f84781bca0de3  src/lib/canvasLibraryClient.test.ts
bb9bac62d44930acee1c649ebaa79516d86a80a63316a1133bfe8b325edf842e  src/lib/canvasLibraryWorld.ts
0269b7386ddc2679e2abf3071cffbcae35c6e96f185ac6a148bfcea455651c63  src/components/student/StudentLibraryPage.tsx
a5753c84b0d24ed56a807646f962bd796bfc6207c76d5b74c1394ed336291a5a  src/components/student/library/CanvasLibraryGame.tsx
ddd587726b57cec970ee08210b2a4a5df161a4a40ccf3e921ce660e8cb12f05f  src/pages/AuctionPage.tsx
13398f2a82431fc4a2c90c542fa906bb8cbec97b7f765983bd2157a4c52f45e9  src/index.css
2c5ff8bc5c9712263f56aa781cfe9168fda96fb6ee353581f7b5de00f3533909  task-6-client-route.png
0b1a8f6d25baef778887e7e71d29cdbf2f7409caa498720b74ac9dd87ef9e958  task-6-client-route.json
```

The repository was already dirty from tasks 1–5 and the parallel server lane. No unrelated changes were reverted, no dependency/image/SQL/production data/commit/deploy action was performed.

## Local success state regression addendum

Independent review found that a mock/no-config placement success passed its intentionally partial `StudentPetLocalSnapshot` through `applySharedSettingsValue`. Missing `studentMissionVisibility` and `studentStockMarket` keys were consequently normalized to defaults in React state, even though local storage still held the configured values.

RED was pinned by `src/lib/canvasLibraryRouteState.test.ts`: the old callback applied `result.value` before the shared/local branch. GREEN keeps the shared authoritative projection/version/cache path unchanged, while the local branch calls only:

- `setStudentLifeSnapshot(normalizeStudentLifeState(result.value.studentLife))`
- `setCurrencyBalances(normalizeCurrencyBalances(result.value.currencyBalances))`
- `setCurrencyHistory(normalizeCurrencyHistory(result.value.currencyHistory))`

Focused invocation `node --import tsx --test src/lib/canvasLibraryRouteState.test.ts src/lib/canvasLibraryClient.test.ts src/lib/canvasLibraryPlacement.test.ts` passed `25/25`; `npm run lint` and `git diff --check` passed.

Actual full-app invocation used fresh `npm run dev:stable -- --host 127.0.0.1 --port 3032 --strictPort` plus `.omo/evidence/canvas-library/task-6-local-state-qa.mjs`. In an isolated Chrome profile, the driver observed the real `AuctionPage` React hook state and visible mission page before and after keyboard-driven book placement:

| Observable | Before | After |
| --- | --- | --- |
| visible `읽은 책 쌓기` mission count | `0` | `0` |
| `studentMissionVisibility.bookStack` | `false` | `false` |
| stock minimum | `17` | `17` |
| stock comment | `보존 표식: 금요일 급등` | unchanged |
| placed book / balance | absent / `30` | slot `0` / `40` |

Artifacts: `task-6-local-state.json`, `task-6-local-state-after.png`, and `task-6-local-state-qa.mjs`. The PNG is a valid 1280×800 RGB capture and was directly inspected; it visibly shows the book mission remains absent and the reward balance is 40. External and unrelated `/api/**` traffic was blocked/faked. The owned Chrome context and Vite 3032 session were closed; root-owned ports were not touched.

Updated SHA-256:

```text
d816e50e76c8b0daacfb26b8c0ddc903ea7d7607f3281ac60d67bf797e36ffd5  src/pages/AuctionPage.tsx
4367db3e4384f6a7061f29a92eabc6b1d61a17890a0fffbd9ce7cfc24b697003  src/lib/canvasLibraryRouteState.test.ts
6c0ea9cc6b7e53501d13a15b9a5009dfcf74666efc96fe9c849e7ffcf98bc2a3  task-6-local-state.json
7a5166fd8a0240c5739b5efed559bd57017051b2e7c9c47fc89ae85bdc8dedc5  task-6-local-state-after.png
```
