# Canvas library task 6: atomic server placement

## Outcome

- Existing `PUT /api/shared-settings` now accepts the frozen `placeLibraryBook` command for signed student sessions 1..23. Teacher placement is rejected.
- Each attempt loads and validates the full authoritative row, applies the task-5 pure transition, and writes through a version-conditional PATCH. CAS/initial insert conflicts reload and recompute, up to five attempts with 20-100ms jitter.
- Initial creation is insert-only. A 409 or PostgREST `23505` error body triggers reload; no merge-upsert is used.
- Versions use `max(Date.now(), Date.parse(current.updated_at) + 1)`. The same rule was added to the whole-row student-economy writer after the cross-writer CAS alias was reproduced as a blocking dependency.
- Generic teacher/student writes load current state, preserve authoritative books after student merge, enforce the 1MB limit before and after replacement, and use the same monotonic timestamp/insert-only write helper.
- Success is `200 {book, updatedAt, value}`. `value` is a student projection: shared student fields plus only the session student's scoped map entries.

## Criterion evidence

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Existing baseline | `node --import tsx --test tests/api/shared-settings.test.ts` before edits | exit 0; 19/19 | `task-6-server-pin.log` |
| Command and concurrency RED | same command after stateful tests, before implementation | exit 1; 6 new failures | `task-6-server-red.log` |
| Same-slot concurrency | targeted Node tests with a two-read barrier | statuses 200/409; exactly one stored book | `task-6-server-targeted.log` |
| Different-slot concurrency | targeted Node tests with a two-read barrier | statuses 200/200; slots 10 and 11 both stored | `task-6-server-targeted.log` |
| Initial-row race | targeted Node tests with two null snapshots | both 200; two POST attempts; final two books; no `on_conflict` | `task-6-server-targeted.log` |
| Timeout after commit | targeted test throws after mutating fake state, then reloads receipt | 200; book 1; balance +10; reward history 1 | `task-6-server-targeted.log` |
| Fixed-ms cross writer | library and student-economy start from the same snapshot behind a barrier | both 200; book 1; deposit 30; balance 125; version +2ms | `task-6-server-targeted.log` |
| Ownership/projection/malformed row/upstream failure | focused handler tests | expected 400/403/409/502 and no false success | `task-6-server-targeted.log` |
| Capacity, request reuse, own existing book, 600 legacy records | task-5 pure transition tests imported by server verification | all pass without deletion or duplicate reward | `task-6-server-targeted.log` |
| 1MB generic write | stateful fake before/after assertion | 400 and row byte-for-byte unchanged | `task-6-server-targeted.log` |
| Auth/CORS/live concurrency | real handler over loopback HTTP + isolated fake PostgREST | 401/403/400; races and timeout state match | `task-6-server-http.json`, `task-6-server-driver.mjs`, `task-6-server-harness.mjs` |
| Type/import/session regressions | `npm run lint` and focused 52-test invocation | exit 0; 52/52 | `task-6-server-lint.log`, `task-6-server-targeted.log` |
| Repository regression | `npm test` | exit 0; 570/570 | `task-6-server-full-test.log` |
| Production build | `npm run build` | exit 0; Vite build completed | `task-6-server-build.log` |
| Whitespace | `git diff --check` | exit 0 | executor command receipt; no output |

## Source freeze

- `api/shared-settings.ts`: `e8cb14910d687087995fa83726d8371f242ae2eac059e75648a1804b16200289`
- `api/student-economy.ts`: `a2c503fdabdac71c192977b569d08a005c03910398c81355d9a408caf430bb70`
- `tests/api/shared-settings.test.ts`: `bdb714621d910a385c0b3ba1a7457a69d00bcd11ac39aecd04f60be367ad2e62`
- `tests/api/student-economy.test.ts`: `1fc74117c2143ee804c7f1108fbfe0a23524e1a2ca1dfe7d7ef2b6cb75fe2322`
- frozen task-5 `src/lib/canvasLibraryPlacement.ts`: `799b7523f750f2a95f2f3b325235e8326d2a5a777ca03628b43d80ad0d1f9d20`

No SQL, dependency, deployment, production write, commit, push, or new API route was used. Existing dirty files outside the assigned server/test/evidence scope were preserved. HTTP QA used only a hard-coded synthetic secret and loopback fake state; no `.env` or operational credentials were read.

## Final deterministic monotonic-test repair

- Independent review identified a test-only wall-clock race: the generic-writer test initialized `updated_at` with the live clock, then required the result to equal exactly `current + 1ms`; a scheduler delay could instead correctly exercise the `Date.now()` branch.
- The same test now fixes both the authoritative version and `Date.now()` to `2026-09-05T00:00:00.000Z`, preserves the exact `+1ms`, authoritative-book, and unchanged-oversize-state assertions, and restores the clock in `finally`.
- Final test SHA-256: `19c6783650fe0005e8d6d0caf643cf1c5101dee8c1151ec8b796b46dcb2f7d53`.
- Manual repeat: `node --import tsx --test tests/api/shared-settings.test.ts` ran twice in independent processes; both exited 0 with 27/27 passing. Receipts: `task-6-server-flake-run-1.log` (`f0758e2d960cafebd01ba1c5d7bb6ee96383d3ec42b38f24c633a47f1bee6562`) and `task-6-server-flake-run-2.log` (`82201fd8bdd8d58d2fbfc28319c6a4383760142acca297070da4d63e5dd1a89a`).
- Focused server regression remained 52/52 passing; `git diff --check` exited 0. This test-only repair created no process, port, browser, or external/UI resource requiring cleanup.
