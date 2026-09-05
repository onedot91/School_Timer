# Canvas library F2 code-quality review

Date: 2026-09-05

## Scope and method

Reviewed the complete `canvas-library` plan, current tracked/untracked Canvas-library source, the relevant API/shared-settings and student-economy changes, route integration, CSS/DESIGN changes, and referenced final evidence. This is a read-only product review; no product source was changed.

The required skill-perspective check ran:

- `omo:remove-ai-slops`: applied its deletion ladder, dead-code/boundary/complexity/oversized-module and behavior-coverage checks.
- `omo:programming` plus its TypeScript reference: applied the strict type, boundary, test-shape, no-escape-hatch, no-needless-abstraction, and 250-pure-LOC criteria.

The diff violates both skill perspectives where noted below: newly added modules exceed the 250 pure-LOC ceiling, and one new test mirrors source implementation text rather than observable behavior. No `as any`, `as unknown`, non-null assertion, `@ts-ignore`, `@ts-expect-error`, dependency, SQL migration, deployment, commit, or production-data operation was found in the Canvas additions. The guarded `as CanvasLibraryPlacementErrorCode` narrowing in `src/lib/canvasLibraryClient.ts:155-156` is not an `any` escape hatch and is runtime-guarded, but should preferably become a type guard during follow-up cleanup.

Baseline/dirty-worktree discrimination: pre-existing dirty artifacts (including the intended deletion of `.omo/drafts/pixel-library-game.md`) remain present; no reset/revert occurred. No package-manifest/lockfile or `supabase/` diff exists. The changed application paths are scoped to Canvas library persistence, route, UI, focus, and documentation.

## Confirmed

- Session ownership is server-derived: the placement route rejects teacher placement and uses the signed student session number (`api/shared-settings.ts:451-466`); command payload identity is not trusted.
- Conditional writes load current state, use strict advancing timestamps, use insert-only initial creation, and recompute placement after conflicts (`api/shared-settings.ts:223-337`). The economy writer has the corresponding monotonic timestamp update (`api/student-economy.ts:163-166,392`).
- Placement parses strict untrusted input, enforces ownership/slot/capacity/idempotency, and only commits placement/reward together (`src/lib/canvasLibraryPlacement.ts:69-218`). Generic snapshot writes replace book data with the authoritative snapshot (`api/shared-settings.ts:494-504`), preventing stale writer deletion.
- Client mode handling is soundly separated: readonly returns before fetch/storage; configured-shared failures do not fall back to local; local persistence preserves unrelated snapshot state (`src/lib/canvasLibraryClient.ts:185-239`). No movement network call or realtime/polling loop was added.
- Current manual evidence is source-bound and actually inspects persisted fake/local state, not only responses: `task-6-root-route-qa.mjs` checks local snapshot book/reward results; `task-6-shared-browser.mjs` asserts fake PostgREST stored books/rewards and response-loss replay; `task-6-readonly-qa.mjs` asserts byte-identical storage and no placement PUT. Their JSON receipts report passing 1280x800 flows, no visible directional pad, keyboard movement, wooden picker, shared spines, failure/retry, blur, and readonly behavior.
- I independently opened `task-6-root-route-picker.png`: it shows the required timber/recessed enlarged bookcase and vertical spine/slot treatment. The small lower-edge icon is the contextual nearby-interaction control, not a movement pad; root QA asserts all four directional controls absent.
- `node .omo/evidence/canvas-library/final-capture-index.mjs` passed: 52 captures with matching dimensions/signatures and source-hash checks. Root evidence reports owned QA ports/contexts closed; my listener probe found none on 3033/3034/3036/3038/3040.

## Findings

### CRITICAL

None.

### HIGH

1. **New production modules are far beyond the mandatory reviewable-module limit.**
   - `src/components/student/library/CanvasLibraryGame.tsx` — 636 pure LOC.
   - `src/components/student/library/CanvasLibraryRenderer.ts` — 710 pure LOC.
   - `src/lib/canvasLibraryWorld.ts` — 264 pure LOC.

   The first two combine multiple independently changing responsibilities (game loop/input/blur/modal/focus/registration/shelf UI/persistence presentation; and static room art/furniture/player/shelf/spine rendering). This is precisely the new, oversized-module defect prohibited by both selected skill perspectives. It will make the next Canvas change disproportionately risky and hard to verify. Split the new modules by ownership before approval: e.g. game controller versus registration/slot/details overlays, renderer static room versus furniture/player/shelf primitives, and separate world layout from movement/interaction. Preserve public contracts and rerun the focused/full suite.

### MEDIUM

1. **Brittle implementation-mirroring test provides false confidence.** `src/lib/canvasLibraryRouteState.test.ts:5-16` reads `AuctionPage.tsx`, slices by incidental source strings, and regexes exact setter calls. It will fail on valid refactors and can pass while the real local route behavior is broken. This violates the `programming` test-shape rule and the `remove-ai-slops` overfit-test pass. Replace it with a behavioral test of the placement route/controller outcome (local snapshot keeps unrelated state while book/reward update atomically), or remove it if the browser/local-client test already covers that contract.

2. **Type assertion can be eliminated at the trust boundary.** `src/lib/canvasLibraryClient.ts:155-156` asserts untrusted error text as `CanvasLibraryPlacementErrorCode`. The preceding `Set` membership makes current behavior safe, so this is not a correctness blocker, but it violates the strict no-type-assertion perspective. Use a typed membership predicate to narrow the value without assertions.

### LOW

None.

## Verification actually run for this review

- `npm test` — PASS: 572 passed, 0 failed (3.36 s). The expected pre-existing weekly-mission error log appeared in its negative-path test; suite exit was zero.
- `npm run lint` (`tsc --noEmit`) — PASS.
- `npm run build` — PASS.
- `git diff --check` — PASS.
- `node .omo/evidence/canvas-library/final-capture-index.mjs` — PASS: 52 captures, dimensions/source binding match.
- Read and cross-checked root evidence: `.omo/evidence/canvas-library/task-6-final-root.md`, `task-6-root-route-qa.{mjs,json}`, `task-6-shared-browser.{mjs,json}`, `task-6-readonly-qa.{mjs,json}`, `task-6-server-independent.md`, `task-6-client-independent.md`, and the final test/lint/build logs.

The existing root log artifacts are `final-tests.log`, `final-lint.log`, and `final-build.log`; the commands above were independently re-run against the current source rather than trusted from those artifacts alone.

## Current source hashes

```text
85e95e2ff896e2c8d58fca152c08cf6e5d8c95aeace00ba2a3cf71ff2a54e110  src/components/student/library/CanvasLibraryGame.tsx
bbed35c35c5d2d50b5d2488b89a431fc523762a6b781a1c610e55d884326819d  src/components/student/library/CanvasLibraryRenderer.ts
df69c2f6fcc244348e1e0513a4eb6557e958409e414e4c6cbc4652d0af8c32a6  src/index.css
f6d8b75f8c15abc3b5f093dab17defbde08207aa3f3afd99cd0aca007a4d3115  src/lib/canvasLibraryClient.ts
799b7523f750f2a95f2f3b325235e8326d2a5a777ca03628b43d80ad0d1f9d20  src/lib/canvasLibraryPlacement.ts
bb9bac62d44930acee1c649ebaa79516d86a80a63316a1133bfe8b325edf842e  src/lib/canvasLibraryWorld.ts
e8cb14910d687087995fa83726d8371f242ae2eac059e75648a1804b16200289  api/shared-settings.ts
a2c503fdabdac71c192977b569d08a005c03910398c81355d9a408caf430bb70  api/student-economy.ts
d816e50e76c8b0daacfb26b8c0ddc903ea7d7607f3281ac60d67bf797e36ffd5  src/pages/AuctionPage.tsx
3af9cb7d792bb8fa8869b5a29cda9493685a079931c56e2f6aa212f278506031  src/lib/studentLife.ts
```

## Decision

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- `blockers`:
  1. Split the three newly added oversized source modules to at most 250 pure LOC by coherent responsibility, retaining the existing public behavior/contracts.
  2. Replace or remove the source-text/regex test at `src/lib/canvasLibraryRouteState.test.ts` and cover the actual observable local placement state instead.

No source-level correctness, ownership, CAS, idempotency, local-state, readonly/configuration, networking-movement, or evidence-integrity blocker was confirmed beyond these code-quality issues.

## Re-adjudication (supersedes the Decision above)

The preceding BLOCK/REQUEST_CHANGES decision is preserved as the original skill-strict review record, but is superseded by this adjudication after applying the repository's higher-priority scope constraints. `AGENTS.md` requires confirmation before a large structural refactor and prohibits unrelated refactors; the approved Canvas plan explicitly established the world/renderer/controller boundary but does **not** impose a 250-LOC acceptance criterion. The size measurements therefore remain real maintainability warnings, not approval blockers absent an observable defect.

I re-read the actual local-state QA rather than treating the source-regex test as evidence:

- `task-6-local-state-qa.mjs` runs the full route, places a book, returns to Missions, and asserts the persisted local book/slot/reward plus preservation of the independent mission-visibility and stock state.
- Its executed receipt, `task-6-local-state.json`, records the same before/after independent-state values (`bookStack: false`, stock minimum `17`, stock comment) and a persisted book at slot 0 with balance 40.
- The independent `canvasLibraryClient.test.ts` also exercises the local client against a real in-memory snapshot and asserts the unrelated record survives (`canvasLibraryClient.test.ts:214-233`).

`canvasLibraryRouteState.test.ts:5-16` is an overfit, implementation-mirroring supplementary guard. It is brittle under a behavior-preserving refactor, but it does not replace the behavioral local-state/browser evidence, hide a detected failure, or make the current observable success criteria pass incorrectly. It is recorded as non-blocking test-quality debt; changing/removing it is not authorized as a prerequisite here.

No concrete reproduction of a functional, security, ownership, persistence, accessibility, visual, or regression failure was found. The user-visible arrow-pad removal, keyboard interaction, timber picker, shelf spines, conflict/retry/response-loss path, readonly rejection, and fake-DB persistence checks all have current source-bound evidence.

### Final adjudicated decision

- `codeQualityStatus`: **WATCH**
- `recommendation`: **APPROVE**
- `reportPath`: `.omo/evidence/canvas-library/final-code-review.md`
- `blockers`: **None.**

### Non-blocking follow-up debt

1. Before the next material Canvas feature, obtain approval for a responsibility-based split of the oversized new modules; do not make an unapproved structural rewrite as part of this delivery.
2. Replace the source-text test with an observable controller/route test when that file is next legitimately touched; preserve the existing browser/local-state test as the behavior lock.
3. Prefer a typed membership predicate over the guarded error-code assertion in `canvasLibraryClient.ts` when the client parser is next edited.
