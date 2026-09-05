---
slug: canvas-library
status: executing
intent: clear
review_required: false
pending-action: execute task1 contract/baseline then small room
approach: native Canvas2D cohesive pixel room, visual gate before expansion, authenticated atomic existing-settings placement last
---

# Draft: canvas-library

## Components (topology ledger)
| id | outcome | status | evidence |
| --- | --- | --- | --- |
| art | unified pixel world | active | DESIGN.md scoped contract pending |
| play | movement / desk / carry / slot / inspect | active | plan tasks1–3 |
| space | 100 reachable positions | active | plan task4 |
| shared | authorized atomic placement preserving records | active | plan tasks5–7 |
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

## Open assumptions (announced defaults)
- Native Canvas2D, no additional dependencies; compact topdown room with code-authored bear and scarf identity; reversible presentation choices.
- Existing record capacity is not reduced to100. Only shared shelf positions are bounded to100. Unplaced legacy books remain available.
- Direct delivery, no commit or deployment.
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

## Findings (cited - path:lines)
- StudentLibraryPage.tsx:1-129 currently renders form/stack; no game implementation remains.
- api/shared-settings.ts:139-170 shallow studentLife merging lacks own-book/placement protection. Server integration must close library writes without breaking other own-record operations.
- api/shared-settings.ts:321-370 uses conditional version PATCH but new-row upsert and same-millisecond timestamp require task6 tests.
- bookStackMission.ts:39-78 retains existing book/reward transform; studentLife MAX_BOOKS600 cannot be changed to100 as record deletion.
- Baseline git status: only deleted old `.omo/drafts/pixel-library-game.md` plus new canvas-library draft; no restored old product code.

## Decisions (with rationale)
- Scope/sequence exactly follows active goal. Existing active goal reused, no duplicate creation.
- User explicitly requested plan then implement; no-plan bootstrap approval applies. Optional high-accuracy review not requested. Mandatory Metis checks written plan before worker dispatch.
- Metis /root/canvas_plan_review terminal CLEAR after geometry, shared draw state, inline placement/API/CAS/cache semantics and atomic route cutover corrections; bundled Playwright availability independently confirmed. No new dependencies.
- External beui reference fetch previously failed DNS; no external dependency/asset workaround. Canvas interaction mechanism defined locally.

## Scope IN
- Entire goal through shared persistence,100slots,actual1280×800play,tests/typecheck/build,final evidence.

## Scope OUT (Must NOT have)
- Image generation, realtime, restoring discarded work, new dependencies/DB migrations/production/commits without approval.

## Open questions
- None blocks local small-room implementation. If shared integration needs DB migration, stop only that operation and request separate approval.

## Approval gate
status: approved-by-explicit-plan-and-execute-goal
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
