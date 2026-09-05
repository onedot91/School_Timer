# Library competition server evidence

Date: 2026-09-05. Scope: API/service/placement/SQL preparation only; production DB unchanged.

## Observed verification

- RED: season parsing rejected a valid season; generic snapshot replaced protected competition (2 failing assertions).
- RED: initial API commands returned 400 and readonly projection had no competition state (3 failing assertions).
- RED: immediate teacher downward adjustment was not visible because the CAS timestamp advanced beyond wall time. Fixed server projection clock at least the committed timestamp; frozen-clock regression passes.
- RED: month rollover lost speed/pause. Fixed baseline adjustment carrying only speed/pause, never old counts; regression passes.
- `npm run lint`: exit 0.
- `node --import tsx --test tests/api/libraryCompetition.test.ts tests/api/shared-settings.test.ts src/lib/canvasLibraryPlacement.test.ts src/lib/vercelFunctionImports.test.ts`: 63 pass, 0 fail.
- Competition API suite: 19 scenarios, including 23 distinct signed student identities, first initialization race, stale season placement, archive failure, lost commit responses, teacher authorization/optimistic conflict/downward and 100-count adjustments, pause-only settings, missing SQL fallback, protected generic snapshots, and archived readback.
- `node .omo/evidence/library-competition-server/verify-http.mjs`: actual local HTTP handler driven with `curl -i`; 200/17 standings, 403 student teacher-command rejection, 409 stale-season placement rejection. This uses an in-memory PostgREST seam, **not a real PostgreSQL engine**.

## SQL readiness and limit

`supabase/library_competition.sql` prepares a service-role-only RPC and archive table, row/advisory locking, CAS, archive+clear transaction, preservation checks and a direct generic-write protection trigger. No production SQL executed. `psql`, `postgres`, Docker and local Homebrew PostgreSQL were unavailable. Actual PostgreSQL execution/rollback/RLS proof remains unverified and must precede deployment. API fallback for an absent RPC is verified: only competition unavailable, legacy inactive library placements still work.

## Cleanup

Initial manual HTTP fixture on port 51976 / PID 62500 terminated. Final repeatable driver uses an ephemeral port, always SIGTERM-closes its child in `finally`, and observed child exit. User port 3000 and existing browser tabs untouched. No dependencies, commits, production writes, or QA student records created.

## Source SHA-256

- `api/shared-settings.ts`: `7931876b4ca00340ac5dcd7f2b3c4055b49e68b79c8db777d4e4226a167b3d80`
- `src/server/libraryCompetitionRepository.ts`: `62960188ba479fc1ef4900f1565b14160bdd73f5a20ca086690b2c0a19b0f494`
- `src/server/libraryCompetitionService.ts`: `88b40d8655a568102b9973473403004e18d9f7bb7790e422773ddcaddffaee8f`
- `src/lib/canvasLibraryPlacement.ts`: `1c67b24fe8fdd0e05e111c095b609ab597b0ecbe931efd59b63b81862ccf6fa9`
- `supabase/library_competition.sql`: `8a4dcb35e6d2d4fd335034aadb5fccc05439227426211428528660fe73c55c10`
- `tests/api/libraryCompetition.test.ts`: `0bca2975e22b5dc61ce7039a043acee071027a2b95a678d29bf71c1b35309fa3`
- `tests/api/libraryCompetitionFixture.ts`: `86839c3f58197c2130e27beb0fc2d85d64e94e15a7c8dfa348f5868cea13cf38`
