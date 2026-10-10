# Read and loading performance evidence

Date: 2026-10-10. All database/browser data is disposable synthetic local data. No production deployment or database change.

## Changes

- `api/shared-settings.ts`: opt-in overview projection and teacher revision-manifest changes endpoint; complete responses support compact projection encoding while older clients retain value payloads.
- `src/lib/supabaseSettings.ts`: validates compact responses; keeps partial overview outside writable cache; teacher manifest baseline/invalidation and actor boundaries; partial patches merge through existing revision-aware projection cache.
- `src/pages/AuctionPage.tsx`: home reads only required fields; other features wait for full read; no eager full backfill; pending navigation queues full fetch; partial values are not stored as complete snapshots. Server weekly mission checks require no client feature data and continue after overview hydration.
- `src/pages/TimerPage.tsx`: supported teacher changes use one request per poll and inspect revisions even when updated_at is unchanged.
- `src/server/storageProgressiveRead.ts`, `src/lib/storageReadManifest.ts`, `supabase/storage_progressive_reads.sql`: stable MVCC read wrapper with category revision/deletion digests, changed wallets/history, empty idle fast path, concurrent read sharing, service-role permissions and unknown-category full fallback.

## Scenarios and artifacts

| Scenario | Invocation / observation | Binary result | Artifact |
|---|---|---|---|
| API + SQL revision changes, old timestamps, nulls, deletion, legacy fields, student isolation, compact full teacher/student | `STORAGE_TEST_PG_PORT=55447 STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js node --import tsx --test tests/storage/progressiveReads.integration.test.ts` | exit 0 | `postgres-test.log`, `postgres-metrics.json` |
| Client compact, partial/full, teacher patch, actor change, invalidation baseline | `node --import tsx --test src/lib/progressiveSettingsRead.test.ts` | exit 0 | `client-tests.log`, final combined `initial-loading-tests.log` |
| Initial overview vs feature, no eager backfill, no partial snapshot persistence, stale rejection, in-flight navigation | `node --import tsx --test src/lib/studentInitialLoading.test.ts src/lib/progressiveSettingsRead.test.ts` | exit 0 | `initial-loading-tests.log` |
| Mission hydration and teacher unchanged-timestamp polling | `node --import tsx --test src/lib/studentMissionScheduling.test.ts src/lib/teacherConnectionPolling.test.ts` | exit 0 | `polling-tests.log` |
| Existing read and API regressions | `node --import tsx --test src/lib/auctionRefreshResilience.test.ts src/lib/supabaseSettings.test.ts src/lib/storageResponseOrder.test.ts src/lib/sharedSettingsConcurrency.test.ts tests/api/shared-settings.test.ts src/lib/vercelFunctionImports.test.ts` | exit 0 | `unit-tests.log` |
| Build | `npm run build`; fixture build `VITE_SUPABASE_URL=https://fixture.invalid VITE_SUPABASE_ANON_KEY=fixture-only ./node_modules/.bin/vite build --outDir .omo/evidence/read-loading/dist` | exit 0 | `build.log`, `browser-build.log` |
| Real browser baseline and optimized student home | CUA Playwright; same production fixture build, flag off/on; actual viewport 1280x650, 1280x600, 1280x800 | all document dimensions equal viewport; 100 balance and main controls present; no console warnings/errors | `before-650.jpg`, `before-600.jpg`, `before-800.jpg`, `after-650.jpg`, `after-600.jpg`, `after-800.jpg` |
| Feature transition after partial home | click `고마 쓰기 열기`; loading screen then `고마 광장`, balance 100, bank/shop/auction/investment/donation controls | full-gated feature becomes usable; no document overflow at 1280x650; no console warnings/errors | `feature-loaded-650.jpg`, `browser-rpc-metrics.json` |

## Reproducible load measurements

Run `tests/storage/progressiveReadsBenchmark.ts` with the PostgreSQL variables above. Latest preexisting scoped/history/execution/snapshot/ancestor SQL was applied on both sides before comparison. Fixture: 130 resources, 2,300 history records; 23 students plus 2 teacher clients, 3 rounds, real local PostgreSQL, no simulated network delay.

`benchmark.json` and `benchmark.log` contain raw measured values. For the final compact version:

- 25 initial HTTP responses: 9,861,719 → 2,087,552 bytes.
- DB responses: 6,106,550 → 1,665,391 bytes.
- RPC count: 24 → 24 (same concurrent teacher read is shared).
- Initial HTTP p95 across rounds: 117.6–150.4 → 47.6–50.8 ms.
- Teacher idle read carries a digest cost and larger response than metadata-only polling; this is a deliberate tradeoff for revision-safe changes, not an idle-speed claim. Raw local DB/RPC p50 approximately 0.15 → 0.36 ms, body 48 → 2,861 bytes.
- Changed teacher response drops from approximately 1.43 MB to 3.08 KB. Exact HTTP and DB timing are in the final JSON.

These are local fixture results, not live classroom latency or CPU utilization measurements. The fixture has substantial history but only 130 resource rows; resource-heavy production digest cost still needs post-release observation.

Additional teacher browser observation: initial teacher screen and latest saved synthetic notice loaded with no console errors (`teacher-final-650.jpg`, `teacher-final-dom.txt`). A subsequent direct fixture revision-only notice edit with an old timestamp was not observed automatically on that screen during the check. This extra browser scenario is **not claimed as passed**. The teacher fixture contains incomplete settings, so an existing dirty/pending guard may be involved, but that cause was not established. API/PostgreSQL, client revision-merging and teacher polling VM scenarios for unchanged timestamps passed independently as recorded above. `teacher-delta-650.jpg` is an intermediate observation, not proof of successful automatic delta application.

Follow-up during teacher-priority work: the blocked browser read was traced to null random-draw results normalizing to 1 and creating a false dirty field plus restored draft warning. `src/lib/randomDraw.ts` now preserves null/undefined results; the normalizer is idempotent for empty and saved states. A fresh synthetic origin then showed clean read guards and automatically displayed the old-timestamp notice revision. Injected upstream failures produced an API read error while the teacher timer kept counting down. See `../teacher-priority/teacher-offline.png` and `docs/storage-speed-2026-10-10.md` for final verification. This resolves the earlier unverified browser scenario; it does not turn its earlier screenshot into evidence of success.

## Rollout and boundaries

Apply the additive `supabase/storage_progressive_reads.sql` only through the user's deployment procedure, then enable server `STORAGE_PROGRESSIVE_READS=1` with protocol 2. Flag off keeps legacy full reads and metadata polling; compact complete responses remain backward compatible through explicit client capability header. Unknown legacy categories use full snapshots to prevent omission.

Overview application normalizes unloaded fields to defaults, but non-home surfaces remain behind full hydration and no partial row enters writable or persisted complete snapshot cache. Overview mutation handlers retain server command paths; generic updater reloads complete scope. Weekly mission endpoint receives only student number/protocol and checks authoritative evidence on the server.

Initial toolkit `omo-agent-toolkit ulw-loop status --json` was unavailable (`command not found`), so evidence uses `.omo/evidence/read-loading/`.
