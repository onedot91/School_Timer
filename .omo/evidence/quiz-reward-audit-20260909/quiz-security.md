# Word quiz reward authorization and data integrity review

- Verdict: **PASS**
- Reviewed commit: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`
- Repository: `/tmp/school-storage-audit-20260909`
- Scope: `api/classword.ts`, `src/server/classwordRepository.ts`, `supabase/storage_classword_v2.sql`, `supabase/storage_rewards_v2.sql`, `supabase/storage_v2.sql`, and focused tests.

## Result

No actionable authorization or reward-integrity defect was found in the requested scope.

### Student cannot choose target, amount, or fake a correct answer

- `api/classword.ts:319-352` requires a student device session, verifies participation, loads the authoritative server-side quiz definition, checks the submitted answer against that definition, and passes `session.studentNumber` (not a body field) into `saveClasswordQuizCompletion`.
- The parsed `answer_quiz` body at `api/classword.ts:141-147` contains only `dateKey` and `answer`; it accepts no student target, reward amount, mission type, or question id.
- `src/server/classwordRepository.ts:347-352` derives RPC actor and payload from server arguments. The reward amount is absent from the command payload.
- `supabase/storage_classword_v2.sql:81-88` fixes mission type to `classword_quiz_correct`, fixes the completion owner to `p_actor`, and calls the reward function without a caller-selected amount.
- `supabase/storage_rewards_v2.sql:34-47` restricts student and mission values and generates quiz reward server-side as an integer from 1 through 10.
- A previously completed student may submit any later answer and receive the existing completion response (`api/classword.ts:329-345`), but the unique completion and weekly reward key prevent another award. This is idempotent response behavior, not a reward bypass.

### Receipt cross-actor reuse

- `supabase/storage_v2.sql:52-60` defines receipt identity as `(actor_key, request_id)`.
- `supabase/storage_classword_v2.sql:29-47` constructs `actor_key` from the authenticated API-selected actor, locks that actor/request pair, and rejects same-actor request-id reuse when the action/payload hash differs.
- `src/server/classwordRepository.ts:256-274` scopes lost-response receipt lookup to `classword:<session actor>`; `api/classword.ts:226-230` supplies the signed session actor. Reusing another student's request id therefore cannot retrieve or replay that student's result.

### SQL grants and direct-call boundary

- `supabase/storage_classword_v2.sql:121-123` revokes `classword_command_v2` from `public`, `anon`, and `authenticated`, then grants it only to `service_role`.
- `supabase/storage_rewards_v2.sql:204,208` likewise revokes `claim_weekly_mission_reward_v2` from browser roles and grants only `service_role`.
- `supabase/storage_v2.sql:371-379` revokes storage table access from browser roles and grants storage function execution only to `service_role`.
- The database command trusts the server-provided quiz id rather than proving the answer itself, but browser roles cannot invoke it. In the deployed trust model, the API performs the answer proof before the service-role command.

### Concurrency and atomicity

- `supabase/storage_classword_v2.sql:42-47` serializes identical actor/request receipts with a transaction advisory lock.
- `supabase/storage_classword_v2.sql:49-51` locks the student's wallet before completion/reward work.
- `supabase/storage_classword_v2.sql:83-87` inserts completion with a unique-key conflict no-op and claims the reward in the same database transaction.
- `supabase/storage_rewards_v2.sql:39-67` locks the wallet row before checking/inserting the unique weekly reward record and applying the wallet delta. Concurrent requests for the same student serialize on the wallet row, so only the first creates and credits the reward.

## Verification reproduced

Command:

```text
node --import tsx --test tests/api/classword.test.ts tests/api/classwordRepository.test.ts src/lib/classwordSql.test.ts src/lib/weeklyMissionSql.test.ts
```

Result: 29 tests passed, 0 failed, duration 168 ms. This includes API wrong/correct/repeat behavior, session student ownership, actor-scoped lost-response lookup, atomic command routing, SQL grants, reward range, and lock-order assertions.

## Slop and maintainability pass

Direct review under `omo:remove-ai-slops` and `omo:programming` found no scope-blocking extraction, normalization, tautological deletion test, or production complexity added for this feature at the reviewed SHA. The focused SQL tests are mostly source-pattern assertions and cannot by themselves reproduce PostgreSQL concurrency; approval relies on direct inspection of the transaction lock order and uniqueness constraints as well as the API behavior tests. No unrelated hardening requirement was used as a blocker.

## Evidence gaps

- No live PostgreSQL race test was present or run. This is not a failure of a stated criterion because the lock/unique/transaction behavior is explicit in the reviewed SQL, but a database integration race test would provide stronger regression evidence.
- The reviewed commit itself changes teacher settings retry files only; the quiz security implementation predates it. Review was performed against the exact tree at the requested SHA.
