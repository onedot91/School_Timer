# Storage redesign compatibility audit

- **Verdict:** FAIL
- **Reviewed SHA:** `6aff30b3aff7de9c2c66494b24832b929a2d267d`
- **Scope:** `/tmp/school-storage-audit-20260909`; recent storage cutover/follow-up history, `HEAD` diff, student/teacher/library clients, API projection contracts, focused tests
- **Mode:** read-only audit; no live writes

## What HEAD correctly fixes

`6aff30b` fixes the reported library clock regression at the client projection seam. A protocol-v2 response can carry PostgreSQL `updatedAt` such as `2026-09-08T00:00:00.40954+00:00`; `projectLibraryCompetition` only accepts canonical millisecond `Z` timestamps. The prior implementation passed that database representation directly into the projector (`git show HEAD^:src/lib/libraryCompetitionClient.ts`, old lines 53-60), causing the projector's `invalid-time` error to be caught as generic `LIBRARY_COMPETITION_NETWORK`. HEAD first validates the response and derives a canonical `serverAt` via `new Date(...).toISOString()` at `src/lib/libraryCompetitionClient.ts:53-63`. The new test at `src/lib/libraryCompetitionClient.test.ts:49-65` uses the relevant PostgreSQL timestamp representation and a later server clock, so it would fail on the prior implementation and passes on HEAD.

Focused verification passed: 27/27 tests across library competition client, save progress, storage response ordering/projection, student storage commands, and student action progress (`node --import tsx --test ...`, 2026-09-09 local run).

## Concrete blocking omission

### STOR-PROGRESS-ALL-STUDENT-WRITES — FAIL

**Expected contract:** the student-level `StudentActionProgress`/`aria-busy` state added by HEAD remains active for all asynchronous student persistence that can mutate shared storage.

**Evidence:** `beginSaveProgress()` is entered by `withSaveFailureReporting` (`src/lib/saveFailureClient.ts:96-113`) and explicitly by `executeStudentStorageCommand`. However, `syncPersonalQuestionWeeklyMission` and `syncWeeklyMissions` issue mutation `POST`s directly without either seam (`src/lib/weeklyMission.ts:701-735`). `AuctionPage` invokes `syncWeeklyMissions` on the student surface (`src/pages/AuctionPage.tsx:1349-1364`), and this API can award currency/update mission state. Therefore this real student storage producer is invisible to the new global progress store.

**Action:** wrap both weekly-mission mutation functions in the same save-progress/reporting boundary (with the appropriate feature classification), or explicitly bracket them with `beginSaveProgress`; add an observable test that holds their POST promise pending and verifies `getSaveProgress()` stays true until settlement.

## Test confidence gaps / notes

1. `src/lib/studentActionProgress.test.ts:50-67` is an implementation-text grep. Its new `/isSavePending/` assertion proves only that an identifier appears in a sliced source region; it does not exercise the external store subscription, render transition, concurrent saves, or the omitted weekly mission producer. Under the `remove-ai-slops`/`programming` criteria this is implementation-mirroring coverage and gives false confidence for the user-visible progress contract. The behavioral `saveProgress.test.ts` counter test is useful, but it does not connect the counter to the rendered student surface.

2. The library regression test is a client fake, not the actual protocol-v2 API fixture. API tests separately validate `serverAt`, and projection tests separately validate patch merging, but no test passes an actual `api/shared-settings.ts` library response from `tests/api/storageV2Fixture.ts` through `createLibraryCompetitionClient`. This is a live-vs-fixture boundary gap, not evidence that HEAD is wrong. Add one HTTP-contract fixture test using PostgreSQL `updated_at` formatting and assert successful client classification plus standings projected at `competition.serverAt`.

3. Direct ISO string ordering inside the competition domain is safe for its declared domain contract: `parseCompetitionTimestamp` only accepts canonical `YYYY-MM-DDTHH:mm:ss.sssZ` (`src/lib/libraryCompetitionTime.ts:8-11`) before codec/project comparisons. PostgreSQL timestamps belong to the storage metadata contract and are compared by `compareStorageTimestamps`, which parses instants and preserves microsecond tie-breaking. I found no additional supported-format ISO comparison defect.

## Producer/consumer coverage inspected

- Progress producers: `withSaveFailureReporting`, `executeStudentStorageCommand`, nested `executeStorageCommand`, student economy, classword, today-friend, canvas library, shared settings, announcement, donation, weekly mission.
- Progress consumer: `AuctionPage` `useSyncExternalStore` -> `isStudentActionPending` -> `aria-busy` and `StudentActionProgress`.
- Storage ordering: `storageResponseOrder.ts`, `storageProjectionPatch.ts`, command receipt and partial/full merge tests.
- Library clock/API: `libraryCompetitionClient.ts`, response parser, local store, API `competitionView` responses, library API/client/projection tests.
- Teacher paths: `teacherStorageClient.ts` -> `executeStorageCommand` -> `withSaveFailureReporting`; no separate missing progress producer found there.

## Slop/maintenance pass

- No unnecessary production extraction or normalization was introduced by the five-line library clock correction; canonicalization is required at the boundary.
- `saveProgress.ts` is a small shared external-store seam with idempotent completion and concurrency semantics covered behaviorally.
- The source-text assertion added to `studentActionProgress.test.ts` is the principal overfit/slop issue. No deletion-only or tautological removal tests were added.

## Exact evidence gaps

- No test holds `syncWeeklyMissions` pending and checks the global student progress UI/store.
- No end-to-end fixture connects protocol-v2 `api/shared-settings` competition output to the browser client with PostgreSQL timestamp formatting.
- No rendered React subscription test proves `useSyncExternalStore` changes the modal/`aria-busy` state after a save begins and ends.
