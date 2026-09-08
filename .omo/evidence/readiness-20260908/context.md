# Context-mining gate review

- `recommendation`: **APPROVE**
- `reviewedSha`: `98c14b58f53dc98dfe63089b2095fe25342c879d`
- `baseline`: `87fb3f3`
- `blockers`: none

## originalIntent

Verify that the storage-v2 follow-up does not leave a reachable legacy shared-settings writer, lose scoped projection state while ordering responses, misrepresent library month rollover, or mishandle Korean day/week reward settlement. This lane reviews repository context and caller intent only; production deployment/region/protocol and the PostgreSQL/HTTP release gate are owned and independently reproduced by the root reviewer.

## desiredOutcome

At the reviewed SHA, browser production writes use protocol-v2 commands or the explicitly retained protocol-v2 library `PUT` commands, scoped responses merge without erasing unrelated state, read-only library reads do not mutate a season, and date-based rewards settle from authoritative Korean-calendar evidence without creating tomorrow/current-day awards prematurely.

## userOutcomeReview

The four previously speculative risks do not reproduce as criterion failures in the checked source and tests.

1. **Legacy `PUT /api/shared-settings`.** `saveSharedSettings`, `updateSharedSettings`, and `updateStudentSharedSettings` remain exported in `src/lib/supabaseSettings.ts`, including their old `PUT {value}` fallback, but `rg` found no non-test production caller at this SHA. Active teacher/student mutations call `executeStorageCommand` through `TimerPage.tsx`, `studentStorageCommand.ts`, and `teacherStorageClient.ts`, which sends `POST` with `protocolVersion:2` and `X-Storage-Projection:1`. The remaining production `PUT` callers are library competition/placement clients; they send `protocolVersion:2` and the projection capability header. On a v2 server, `api/shared-settings.ts:517-520` rejects a legacy value PUT with `409 STORAGE_PROTOCOL_REQUIRED`, `:535-536` and `:557-558` reject old library clients with `426`, and `:578-580` rejects any other PUT with `409 STORAGE_COMMAND_REQUIRED`. Therefore the fallback functions can remain for non-v2/direct-Supabase compatibility without providing a reachable legacy production write after v2 activation.

2. **`orderResult` merges then omits `storagePatch`.** This is intentional response normalization, not data loss. `storageCommandClient.ts:75-78` feeds the parsed patch into the actor-scoped `StorageResponseOrder`, then returns the merged `value`, monotonic `updatedAt`, and command-local `result`. Actual callers in `TimerPage.tsx`, `studentStorageCommand.ts`, and `teacherStorageClient.ts` consume those three fields; none consumes `saved.storagePatch`. Receipt confirmation already calls `orderResult` and is marked `ordered:true`, preventing a second application. Tests reproduce out-of-order full/partial responses, command-local results, actor switches, malformed patches, tombstones, and revision ordering. The focused suite passed.

3. **Library GET reports `rolledOver:false`.** `GET ?libraryCompetition=1` is the read-only path. `createLibraryCompetitionClient.read()` maps app `readonly` mode to GET, and its test asserts that it never initializes local or remote state. Production/open/enter callers (`TeacherLibraryCompetitionPanel`, `AuctionPage`, `LibraryCompetitionPanel`, and the pre-placement check) use a protocol-v2 library command via PUT; `ensureCompetition()` performs initialization/rollover there and returns the real `rolledOver` value. Settings writes also call `ensureCompetition(false)` and reject when a rollover occurred. Thus GET's constant `false` means “this read did not roll over” and does not conceal a write settlement.

4. **Tomorrow/date and weekly reward settlement.** `api/weekly-missions.ts` derives `dateKey`, `previousDateKey`, and ISO `weekKey` from one `now` using KST-safe helpers. It loads today's entries only for `pending`, loads all finalized rows before today, skips already rewarded student/date keys, and claims each finalized date in chronological source order. With no finalized claim for the requesting student it probes only `previousDateKey` with a null source ID; the RPC cannot award without authoritative evidence. The focused test `월요일 접속 시 주말 동안 미처리된 날짜를 오래된 순서대로 모두 정산한다` verifies Friday/Sunday backlog settlement, while `마감 전에 삭제된 전날...` verifies that today's entry remains pending and a missing prior source is not paid. Reward audit uses `getKoreanDateKey(new Date(checkedAt))`; the KST-midnight regression at `tests/api/rewardAudit.test.ts:28` passed. No path was found that derives tomorrow as the claim key or pays current-day Classword word entries before finalization.

## Direct slop/programming pass

Consulted `omo:remove-ai-slops` and `omo:programming`. The reviewed change adds observable state-merging and boundary behavior rather than deletion-only or implementation-mirroring tests. The targeted tests exercise independently distinguishable values (older/newer projections, different actor state, partial versus complete patches, rollover mutation versus read-only GET, and finalized versus current-day reward evidence). I found no tautological removal test, prompt/prose pin, useless production normalization, or new abstraction that causes a stated success criterion to fail. Existing source-module size/style concerns outside this bounded lane are notes only.

## Checked artifacts and commands

- Source/diff: `git diff 87fb3f3..HEAD`; `api/shared-settings.ts`; `src/lib/supabaseSettings.ts`; `src/lib/storageCommandClient.ts`; `src/lib/storageResponseOrder.ts`; `src/lib/storageProjectionPatch.ts`; `src/lib/libraryCompetitionClient.ts`; `src/lib/canvasLibraryClient.ts`; `src/server/libraryCompetitionService.ts`; `api/weekly-missions.ts`; `src/server/rewardAuditRepository.ts`; `src/server/rewardAuditActivities.ts`.
- Callers: `src/pages/TimerPage.tsx`; `src/pages/AuctionPage.tsx`; `src/lib/studentStorageCommand.ts`; `src/lib/teacherStorageClient.ts`; `src/components/teacher/TeacherLibraryCompetitionPanel.tsx`; `src/components/student/library/LibraryCompetitionPanel.tsx`.
- Tests: `src/lib/storageResponseOrder.test.ts`; `src/lib/storageProjectionPatch.test.ts`; `src/lib/libraryCompetitionClient.test.ts`; `src/lib/canvasLibraryClient.test.ts`; `tests/api/libraryStorageV2.test.ts`; `tests/api/libraryScopedProjection.test.ts`; `tests/api/libraryProjectionCapability.test.ts`; `tests/api/shared-settings.test.ts`; `tests/api/weekly-missions.test.ts`; `tests/api/rewardAudit.test.ts`.
- History/context: `git log --oneline -20`; `git log -S orderResult`; `git blame` for `storageCommandClient.ts:65-114` and `api/weekly-missions.ts:145-230`; `STORAGE_CUTOVER.md`; `.omo/plans/storage-v2-followups.md`; `.omo/evidence/storage-scope-code-review.md`; `.omo/evidence/reward-audit-code-review.md`.
- Reproduced focused tests: 85 passed, 0 failed in 3.88s using `node --import tsx --test ...` across the files listed above. The expected malformed-question warning was emitted by its negative-path test.
- `git diff --check 87fb3f3..HEAD` is not clean because committed review artifacts contain Markdown trailing spaces at `.omo/evidence/reward-audit-code-review.md:71-72` and `.omo/evidence/storage-scope-code-review.md:10-11`. This is a NOTE: it is unrelated to the four context criteria and does not affect the shipped runtime.

## Evidence gaps and external sources

- `omo ulw-loop status --json` was unavailable because the `omo` executable is not installed in this checkout environment; the parent supplied the required report path, which was used directly.
- No production database, Vercel deployment, Supabase dashboard, or external question service was accessed in this read-only lane. Per task scope, runtime deployment and full PostgreSQL/HTTP evidence are evaluated by the root reviewer, so these are not blockers here.
- Repository-local untracked `.debug-journal.md` and `node_modules/` were not treated as source changes.

