# Crossword quiz reward gate review

- **Verdict:** FAIL
- **Reviewed SHA:** `b733abd1aa3a73728c79453cd7206d5d303cd6e5`
- **Scope:** `api/classword.ts`, `src/server/classwordRepository.ts`, `supabase/storage_classword_v2.sql`, `supabase/storage_rewards_v2.sql`, related tests and student submit UI
- **User intent:** After the storage redesign, a correct word quiz answer must complete and credit one immutable random 1–10 Goma reward exactly once. Lost responses/retries, wallet-cap pending rewards, and teacher question replacement must not lose, redraw, duplicate, or falsely report the reward. The historic `+6` concern must remain a data-audit issue rather than a new arithmetic regression.

## Blocking finding

### QUIZ-REWARD-ATOMICITY / QUIZ-MAXBALANCE-PENDING — violated

At the wallet maximum, `complete_quiz` commits a completion without creating durable reward evidence, yet the API returns a completed state with a random non-null reward amount and the UI disables retry.

Evidence chain:

1. `supabase/storage_classword_v2.sql:81-88` inserts `classword_quiz_completions` first and always calls the reward function in the same transaction. Atomic rollback is available only if the callee throws; the cap branch does not throw.
2. `supabase/storage_rewards_v2.sql:41-47` generates the random 1–10 amount before checking capacity. At `v_balance > 999999 - v_reward`, the body at lines 48-63 is skipped: no `weekly_mission_rewards`, wallet ledger, or reward claim is persisted. Lines 66-67 still return `completed=false`, `awarded=false`, and the transient random `rewardAmount`.
3. `tests/storage/rewards-v2.sql:24-25` explicitly proves/accepts this behavior: the max-balance call returns `awarded=false` and no reward row exists. Thus the pending reward and its originally drawn amount are not durable. A later request ID reruns `random()` (`storage_rewards_v2.sql:44-46`), so the promised random amount is not immutable while pending.
4. `api/classword.ts:345-362` ignores `reward.completed`, sets `state.completed=true`, and puts `reward.rewardAmount` into the completed UI state.
5. `src/components/student/ClasswordQuiz.tsx:41-43,104-116,120-132` refuses submission when `state.completed`, disables input/button, and displays `정답 N고마`. Therefore the student sees a paid-looking terminal state even though no Goma was credited and cannot retry from the screen after balance is reduced.
6. A refresh does not repair this. `api/classword.ts:248-257` finds the committed completion, then `src/server/classwordRepository.ts:329-344` looks only for a persisted weekly reward; none exists, so the response is still completed with `rewardAmount=null`. The UI remains disabled.

This is a concrete correctness failure, although it requires the rare wallet-cap boundary and no live-production failure was inspected or claimed.

## Other reviewed properties

- **Normal completion/reward atomicity:** PASS for non-cap calls. Completion, reward row, wallet ledger, reward claim, and command receipt execute inside one PL/pgSQL transaction (`supabase/storage_classword_v2.sql:26-27,81-88,116-118`; `supabase/storage_rewards_v2.sql:55-63`). An exception rolls the unit back.
- **Retry / lost-response idempotency:** PASS after a successful persisted award. Actor/request advisory lock plus receipt payload hash returns the exact stored result (`supabase/storage_classword_v2.sql:42-47,116-118`). The client confirms an uncertain response by the same request ID (`src/lib/classwordClient.ts:132-150`). SQL replay coverage exists at `tests/storage/classword-v2.sql:26-29`.
- **Random 1–10 immutability after successful award:** PASS. The amount is generated only when no mission row exists and is then read from that row on later claims (`supabase/storage_rewards_v2.sql:41-46,55-67`). SQL verifies one ledger entry and the retained amount (`tests/storage/rewards-v2.sql:17-23`).
- **Question replacement:** NOTE. Completion identity includes `(date, question_id, student)` (`supabase/classword.sql:31-36`), while reward identity is one `(student, date, classword_quiz_correct)` (`supabase/app_settings.sql:79-86`). Replacing a question can require answering the new question, but it does not pay twice; the original persisted reward amount is reused. This matches a daily reward interpretation and is not itself a stated-criterion failure. At the wallet-cap boundary it worsens the blocker because no original reward row/amount exists.
- **Historic `+6` concern:** No new arithmetic error found in this path. A pre-existing recovered reward row of 6 is not paid twice (`tests/storage/rewards-v2.sql:26-29`), and an independent +6 ledger delta remains included in the next balance (`tests/storage/rewards-v2.sql:30-33`). This is synthetic evidence, not a live-data audit.

## Verification performed

- Confirmed exact `HEAD`: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`.
- Ran `npm test -- --test-name-pattern='classword|퀴즈'`; project runner executed the full suite: **1,064 passed, 0 failed**, duration about 19.8s.
- Direct `remove-ai-slops` / `programming` pass: existing tests are mostly behavior-oriented, but the max-balance test locks an incomplete contract and gives false confidence. No production extraction/parsing slop explains the failure; the issue is the missing durable pending state and ignored `reward.completed` field. Some presentation tests assert source/CSS text, but that does not block this business-correctness criterion.
- No production writes or live-data reads were performed. Local PostgreSQL concurrency verification is delegated to the root reviewer as requested.

## Exact evidence gap

There is no test proving: “a correct quiz answer at wallet cap remains visibly pending/retryable, preserves the first random amount, and credits that same amount exactly once after capacity becomes available.” The current test at `tests/storage/rewards-v2.sql:24-25` proves the opposite storage behavior.
