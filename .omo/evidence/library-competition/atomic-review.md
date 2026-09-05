# Independent competition atomic/domain review

Date: 2026-09-05. Reviewer: competition_atomic_review. Scope: read-only production inspection, executable existing tests and isolated in-memory probes. No production database access or mutations.

## Verdict: confirmed (code/fixture functional scope; SQL engine remains unverified)

### Fixed and independently confirmed: rollover now retains teacher pause/speed

- Locations: `src/server/libraryCompetitionService.ts:24` and `src/lib/libraryCompetitionLocalStore.ts:74`.
- Original repro: a teacher-paused August competition at speed 0.5 became unpaused at speed 1 in September without a resume command.
- Freshly inspected server and local fixes now carry speed/paused as a new-season adjustment with `counts: []`; they preserve increasing revision and do not carry old rival points or growth opportunities.
- Independently reran August-to-September local probe with school-01 manually at 100 and pause=true/speed=0.5. Actual result: `{rolledOver:true, settings:{speed:0.5,paused:true}, inheritedCounts:[], revision:2, ourCount:0}`.
- Server and local rollover regression tests both passed in the fresh 84-test run below.

### Fixed and independently confirmed: monotonic CAS clock versus projection clock

- Initially `competitionTimestamp` advanced a same-millisecond row timestamp by 1ms while `competitionView` projected at raw wall time. A just-initialized season could throw `invalid-time` after commit.
- Root added the default projection timestamp clamp to `max(Date.now(), row.updated_at)` during this audit.
- Reprobe with Date.now frozen at `2026-09-05T01:00:00.000Z` and a same-timestamp row now returns `{startedAt:'2026-09-05T01:00:00.001Z', serverAt:'2026-09-05T01:00:00.001Z', rows:17}`.

## Evidence and inspected invariants

Executed again after fixes: `node --import tsx --test tests/api/libraryCompetition.test.ts src/lib/libraryCompetition*.test.ts`: 84 tests, 84 passed, 0 failed (695ms). Earlier run was 75/75; this fresh result supersedes it.

Observed through tests and source:

- One persisted seed under 23 concurrent initial-open calls. The refreshed fixture supports numeric identities and the first-open test now passes distinct 1..23 student identities.
- Teacher settings role rejection and cross-site rejection happen before mutations.
- Read-only GET does not initialize or roll over; readonly client prevents settings writes.
- Placement validates active season before replay/new-book creation; successful book and competition placement event share a commit.
- Archived month is only the last active month; unused intermediate months are not fabricated.
- RPC archive/clear uses one transaction with advisory lock, row lock, expected timestamp, archive primary key, exact old placed-book comparison, exact retained unplaced-book comparison, and unrelated-history comparison. Trigger prevents generic updates from changing active competition/books. Service-role-only RPC grants are present.
- API failure fixture preserves original state and books on failed archive; unavailable RPC does not disable legacy placement before initialization.
- Generic teacher snapshot merge restores authoritative competition/books, preventing stale resurrection.
- Raw-record rollover comparison inspected: initial competition creation writes normalized `studentLife`; placement also writes normalized life, and the generic merge preserves normalized authoritative books. Thus normal active-state book rows compare identically with the RPC's raw JSON arrays. No false mismatch found on these canonical paths. A noncanonical manually inserted life payload can make the strict history comparison reject rollover; rejection preserves old data rather than silently normalizing away unknown records. This is not an engine-executed claim.
- Deterministic seed excludes student IDs; role counts, capped/passive/delayed growth, pause opportunity discard, manual downward/100 overrides, tie-break ordering covered by passing domain cases.

## Explicit evidence gap

SQL has not been executed against a real PostgreSQL engine in this review. Fetch fixtures model success/CAS but do not execute PL/pgSQL, row locks, trigger privileges, or transaction rollback. Do not present this review as proof of engine-level concurrency/migration success. Production SQL remains unapplied and requires the user's separate approval.

## Source identity at review snapshot (SHA-256, dirty working tree)

| File | SHA-256 |
| --- | --- |
| api/shared-settings.ts | 7931876b4ca00340ac5dcd7f2b3c4055b49e68b79c8db777d4e4226a167b3d80 |
| src/server/libraryCompetitionRepository.ts | 62960188ba479fc1ef4900f1565b14160bdd73f5a20ca086690b2c0a19b0f494 |
| src/server/libraryCompetitionService.ts | 88b40d8655a568102b9973473403004e18d9f7bb7790e422773ddcaddffaee8f |
| supabase/library_competition.sql | 8a4dcb35e6d2d4fd335034aadb5fccc05439227426211428528660fe73c55c10 |
| src/lib/libraryCompetition.ts | 5afcd7ea122c29147a8d9615da88e4c5f8cdf408ea043c9bd551d52c5176aadc |
| src/lib/libraryCompetitionProjection.ts | b29ee9f26c56395137f754c56d043631a07b79425e1d33b5222366b814b216ef |
| src/lib/libraryCompetitionEvents.ts | cf53d78edb7b2f833e47f78e67ced3694bec0ed8a81711f9da01c479b4b6e8f6 |
| src/lib/libraryCompetitionLocalStore.ts | c0a44530530bd67bbeb5bdf877debcde1fae7615aea534d5fad957362fd8a4d1 |
| src/lib/canvasLibraryPlacement.ts | 1c67b24fe8fdd0e05e111c095b609ab597b0ecbe931efd59b63b81862ccf6fa9 |
| tests/api/libraryCompetition.test.ts | 0bca2975e22b5dc61ce7039a043acee071027a2b95a678d29bf71c1b35309fa3 |

## Cleanup receipt

All command processes exited. Probes used process-local state only and restored Date.now in finally. No server, port, browser, fixture file, production data, or background process was created. Only this report was written.
