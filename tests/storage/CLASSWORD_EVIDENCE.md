# Classword storage v2 verification

- Apply `supabase/storage_classword_v2.sql` after `storage_v2.sql` and `storage_rewards_v2.sql`.
- Dedicated local PostgreSQL database: `classword_v2_fixture` on loopback port 55439. No operational student data used.
- `node --import tsx --test src/lib/classword*.test.ts tests/api/classword*.test.ts src/lib/saveFailure.test.ts src/lib/vercelFunctionImports.test.ts`: 140 passed.
- `tests/storage/classword-concurrency.mjs` with `CLASSWORD_TEST_DATABASE_URL` pointing to that fixture and `PG_MODULE_PATH` pointing to the local test runtime: passed. The runner requires loopback and the exact fixture database name before resetting disposable tables.
- Actual PostgreSQL assertions: same request replays original result, request ID payload mismatch rejected, occupied initial is a business rejection, stale edit rejected, current edit succeeds, quiz completion/reward each committed once, legacy direct write blocked, old protocol blocked, reward failure rolls back entry and receipt.
- Actual concurrent connections: 23 students competing for one initial produce exactly one committed entry; 24 identical quiz requests produce one completion and one reward ledger row.
- Browser fixture using the actual `ClasswordBoard` and draft helpers: submitted `강아지`, simulated occupied-slot result, input remained; reloaded and input restored; switched student 2 to 4 and no student 2 draft appeared; switched back and draft restored. Final code also preserved draft after closing and reopening the editor. Fixture ran on loopback port 3016 with fake data dated 2099-09-08.
- Whole-workspace TypeScript checks were run repeatedly. Latest failures were in concurrent Today Friend/storage-response-order edits, not Classword-owned files. Root must rerun final lint/build after integration.
- Root integration note: Classword receipt contains the original committed balance. Parent wallet UI must refresh authoritative state instead of treating a replayed historical balance as current.
