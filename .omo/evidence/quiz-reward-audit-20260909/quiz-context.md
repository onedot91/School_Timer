# Word quiz reward historical/migration compatibility review

- `verdict`: **CONDITIONAL / concrete legacy-key compatibility gap found**
- `reviewedSha`: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`
- `scope`: read-only source, history, tests, and repository evidence in `/tmp/school-storage-audit-20260909`

## Supported conclusions

1. **The reported concurrent `+6` disappearance class is fixed for current settings merges.** `src/lib/weeklyMission.ts:321-341` now preserves every positive remote `weekly_mission` ledger row by ID and rebases the balance; commit `7a90884` replaced the former fixed-amount allowlist, which did not include variable quiz rewards 1–4 or 6–9. The regression iterates all amounts 1..10 and proves a stale teacher value retains the reward exactly once. This directly covers a quiz `+6` being overwritten by a stale shared-settings save.

2. **V2 preserves legacy history and claim amounts.** `storage_bootstrap` inserts every encoded legacy history row into `wallet_ledger` with the original ID, delta, before/after, timestamp, order, and JSON value, and imports every `weekly_mission_rewards` row into `storage_reward_claims` (`supabase/storage_v2.sql:321-357`). The original `weekly_mission_rewards` table remains authoritative for replay amount. `claim_weekly_mission_reward_v2` reads its stored amount first and returns `awarded:false`; `tests/storage/rewards-v2.sql:26-33` covers a recovered quiz amount 6 and preservation of an unrelated +6 through a later command. Restore drill evidence also retains a historical +6 ledger row byte-for-byte.

3. **Current daily quiz completion and payout are atomic and replayable.** `classword_command_v2(..., 'complete_quiz', ...)` inserts the completion and calls the reward function in one transaction; an error rolls both back. Same request receipts replay one result. An already-completed current-day quiz still enters that command, so a completion left by the pre-V2 split-write path can receive its missing daily payout on retry. Focused API/annual tests passed.

4. **A claim marker cannot conceal a missing +6.** Reward audit derives the expected amount from `weekly_mission_rewards`, but totals only matching wallet ledger IDs. The focused test with a `reward_amount:6` marker and no ledger reports expected 6 / paid 0. The HTTP/PostgreSQL evidence separately records the same read-only scenario.

## Concrete compatibility gap

The August key migration (`8f5d3fe`) changed Classword entry/quiz claims from ISO week keys such as `2026-35` to calendar-day keys such as `2026-08-30`, while deliberately accepting both formats in the existing table. No migration aliases an old quiz ledger ID to the new daily ID.

If both pieces of legacy evidence survive for one quiz — a completion at `quiz_date=D` and a paid pre-change claim at `week_key=W` — current audit constructs two independent expectations:

- from the old claim: `weekly-mission-classword_quiz_correct-N-W`;
- from the completion: `weekly-mission-classword_quiz_correct-N-D`.

Only the week-key ledger entry exists, so the completion-derived daily expectation is reported missing even though the historical payout occurred. Conversely, a completion with no claim from the old split-write period can be repaired only while its date is still accepted by the participation gate; historical dates cannot be resubmitted after rollover, leaving audit/manual resolution as the recovery route. The current tests cover “completion plus daily ledger without claim,” “daily claim marker without ledger,” and V2 replay, but do **not** cover “legacy week-key paid claim plus same quiz_date completion.” This is a specific old/new-key compatibility hole, not a claim that production data currently contains such a pair.

The hard-coded 2026-09-08 resolution does not generalize this case. Its quiz item is the week-key ID `weekly-mission-classword_quiz_correct-12-2026-29`, and suppression requires expected 5 / paid 0. It neither aliases a completion-derived daily ID nor suppresses variable +6 cases. That narrow behavior is appropriate for the recorded teacher decision, but it is not migration compatibility.

## Recommendation

Treat current V2 awarding and the stale-save `+6` loss as verified. Before claiming complete historical compatibility, add a narrow audit regression for a legacy week-key quiz claim + matching `quiz_date` completion + matching week-key ledger, and define the intended alias/deduplication rule. Also add a regression for a historical completion without claim to document that it remains visible and requires explicit recovery rather than being silently considered paid.

## Direct quality/slop pass

Consulted `omo:programming` and `omo:remove-ai-slops`. The relevant tests assert observable balances, ledger counts, replay results, and audit issues. They are not deletion-only, tautological, prose-pinning, or implementation-mirroring tests. The V2 transaction and boundary parsing are necessary production seams. The missing legacy mixed-key fixture is meaningful coverage, not test-count padding.

## Reproduced evidence

- `node --import tsx --test src/lib/weeklyMission.test.ts tests/api/classword.test.ts tests/api/classwordAnnual.test.ts tests/api/rewardAudit.test.ts tests/api/rewardAuditActivities.test.ts`
- Result: **81 passed, 0 failed**.
- Checked history: `27dcd94`, `8f5d3fe`, `7a90884`, `87c65a5`, `92ed48a`, `aa23ade`.
- No live reads/writes and no source edits.
