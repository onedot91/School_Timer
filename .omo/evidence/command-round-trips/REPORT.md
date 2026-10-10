# Combined command SQL evidence

Date: 2026-10-10 Asia/Seoul. Disposable local synthetic classroom only; no production calls or writes.

## Setup and invocation

PostgreSQL 17 cluster created exclusively for this attempt at `/private/tmp/school-command-pg-20261010`; loopback port 55447. Existing pg driver reused, no dependencies installed. SQL applies additively and leaves original functions intact. Feature activation is `STORAGE_COMBINED_COMMANDS=1`; disabling that variable returns callers to existing RPCs without destructive rollback SQL.

```sh
/opt/homebrew/opt/postgresql@17/bin/initdb -D /private/tmp/school-command-pg-20261010 -U postgres -A trust > .omo/evidence/command-round-trips/initdb.log
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /private/tmp/school-command-pg-20261010 -l /private/tmp/school-command-pg-20261010/server.log -o '-p 55447 -h 127.0.0.1 -k /private/tmp' start
/opt/homebrew/opt/postgresql@17/bin/psql -h 127.0.0.1 -p 55447 -U postgres -d postgres -c 'create role anon; create role authenticated; create role service_role;'
STORAGE_TEST_PG_PORT=55447 STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js node_modules/.bin/tsx --test tests/storage/commandRoundTrips.integration.test.ts > .omo/evidence/command-round-trips/integration.log 2>&1
STORAGE_TEST_PG_PORT=55447 STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js node_modules/.bin/tsx tests/storage/commandRoundTripsBenchmark.ts > .omo/evidence/command-round-trips/benchmark.log 2>&1
```

Sandbox initially denied PostgreSQL shared memory initialization; permission-reviewed rerun succeeded. Both final test invocations exited 0. `omo-agent-toolkit` is unavailable on PATH, so evidence uses `.omo/evidence/`.

## Scenarios and binary observables

Invocation: integration command above. Artifact: `.omo/evidence/command-round-trips/integration.log` (1 test, 1 pass, 0 failures).

- Fresh HTTP deposit: exactly `storage_prepare_command`, `storage_commit_scoped_and_load`; response wallet balance 90 immediately after its write.
- Replay: exactly one prepare RPC, no second debit. Different payload with same actor/request returns HTTP 409; different actor may reuse request ID independently.
- Eight concurrent identical deposits: wallet ends at 90, exactly one receipt. Eight concurrent identical teacher rewards: wallet ends at 106, not 148.
- Replay scope: stored scope wins over new request scope; explicit replay scope wins over stored scope; null legacy receipt scope falls back to supplied scope.
- Transfer/replay: recipient wallet changes once to 120; both HTTP response projections contain only actor wallet 6/history scope 6.
- Stale expected revision returns saved=false with no snapshot. Maintenance rejects new command with HTTP 503.
- SQL applied twice; all existing function bodies/configuration unchanged. New functions SECURITY DEFINER, search_path pg_catalog/public, jit off; anon/authenticated denied, service_role allowed. Prepare STABLE; commit VOLATILE.
- Wallet reconciliation equals empty array.

Invocation: benchmark command above. Artifact: `.omo/evidence/command-round-trips/benchmark.log`. Each condition has 12 sequential real HTTP saves, real PostgreSQL, identical read/ancestor-lock SQL. Artificial RPC roundtrip delay is 40 ms and included in all measurements.

| Scenario | Flag | RPC count | p50 ms | p95 ms |
| --- | --- | ---: | ---: | ---: |
| Letter save | off | 48 | 197 | 200 |
| Letter save | on | 24 | 104 | 109 |
| Deposit | off | 48 | 197 | 208 |
| Deposit | on | 24 | 106 | 113 |
| 23 students + 2 teachers simultaneous | off | 100 | 200 | 208 |
| 23 students + 2 teachers simultaneous | on | 50 | 129 | 156 |

Observed request count halves (4 to 2); modeled network latency improves around 47%. These are local synthetic results, not production performance claims. Production SQL installation and environment activation remain user deployment steps.

The 25 simultaneous mixed-writer scenario confirms 25 receipts, 23 saved letters, exactly 6 currency units per teacher award, and empty wallet reconciliation in each condition. No retries occurred; RPC totals were exactly 100 and 50. Combined max latency was 157 ms versus 210 ms baseline. SQL emits `notify pgrst,'reload schema'`; the direct PostgreSQL HTTP adapter verifies SQL execution, but does not run a real PostgREST schema cache listener.

Benchmark first used disallowed amount 1 and returned INVALID_BANK_AMOUNT. Corrected to amount 10 across independent synthetic students and reran all four conditions successfully; final artifact contains only the complete successful run.
