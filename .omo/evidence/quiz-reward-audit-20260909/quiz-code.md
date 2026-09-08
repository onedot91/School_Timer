# Word quiz client/UI reward-flow review

- **Reviewed revision:** `b733abd1aa3a73728c79453cd7206d5d303cd6e5`
- **Verdict:** **FAIL**
- **codeQualityStatus:** `BLOCK`
- **recommendation:** `REQUEST_CHANGES`
- **Scope:** `src/lib/classwordClient.ts`, quiz state/codec, `StudentClasswordPage`, `ClasswordQuiz`, and the `AuctionPage` reward callback; server/RPC paths were read only to verify the client contract.

## Findings

### CRITICAL

None.

### HIGH

1. **A correctly solved local/mock quiz can become permanently completed while its reward is absent.**  `submitClasswordQuizAnswer` writes the completion first through `submitLocalClasswordQuizAnswer` ([classwordClient.ts:265](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:265)), then attempts the unrelated pet snapshot write that contains the balance/history ([classwordClient.ts:279](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:279)-[290](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:290)). If that second write throws (for example quota failure), it returns `CLASSWORD_REWARD_SAVE_FAILED` but does not undo or record a recoverable pending award. The already-written completion reloads as completed ([classwordQuizLocalStore.ts:135](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordQuizLocalStore.ts:135)-[146](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordQuizLocalStore.ts:146)), and the UI disables all submissions when completed ([ClasswordQuiz.tsx:104](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/ClasswordQuiz.tsx:104), [115](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/ClasswordQuiz.tsx:115)). The student can no longer invoke the existing idempotent claim code after storage becomes available.

   Reproduction (disposable in-memory `Storage`): make only `school-timer-student-pets-v1` writes throw `QuotaExceededError`, submit today’s correct answer in `VITE_DATA_MODE=mock`; the call rejects `CLASSWORD_REWARD_SAVE_FAILED`, then reload returns `{"completed":true,"rewardAmount":7}`, with quiz completion present and wallet snapshot absent.

2. **The shared-storage capacity path likewise records completion without a payable reward, and the UI initially represents that state as an awarded amount.**  The command inserts `classword_quiz_completions` before it asks `claim_weekly_mission_reward_v2` for payment ([storage_classword_v2.sql:83](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/storage_classword_v2.sql:83)-[88](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/storage_classword_v2.sql:88)). The reward function silently leaves `awarded=false` when `v_balance > 999999 - v_reward` ([storage_rewards_v2.sql:44](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/storage_rewards_v2.sql:44)-[65](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/supabase/storage_rewards_v2.sql:65)); no reward row is created. The API/client nevertheless return `correct: true` and a numeric `rewardAmount` ([api/classword.ts:345](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/classword.ts:345)-[363](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/api/classword.ts:363), [classwordClient.ts:314](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:314)-[333](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:333)). `StudentClasswordPage` stores that amount without considering `awarded` ([StudentClasswordPage.tsx:181](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:181)-[185](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:185)), and `ClasswordQuiz` renders `정답 N고마` whenever a completed state has an amount ([ClasswordQuiz.tsx:120](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/ClasswordQuiz.tsx:120)-[137](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/ClasswordQuiz.tsx:137)). On the subsequent GET, the missing reward row produces `rewardAmount: null` ([classwordRepository.ts:329](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/server/classwordRepository.ts:329)-[344](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/server/classwordRepository.ts:344)); the disabled completed UI has no retry/recovery route, even if the balance later falls below the cap.

   Disposable synthetic claim confirmed the same state shape: at balance `999999`, correct completion stays `true` and the claim returns `awarded:false`.

### MEDIUM

1. **An indeterminate quiz submission loses its user-visible recovery guidance.**  The client preserves the request ID and attempts receipt confirmation ([classwordClient.ts:132](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:132)-[153](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:153)), which is correct. But an unresolved confirmation becomes `CLASSWORD_CONFIRMATION_REQUIRED` ([classwordClient.ts:150](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:150)), absent from the UI’s error map ([StudentClasswordPage.tsx:38](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:38)-[62](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:62)). The quiz reduces it to “정답을 확인하지 못했어요.” ([StudentClasswordPage.tsx:189](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:189)-[196](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:196)). It does not say that the same answer should be retried to reuse the retained receipt identity, nor show a permitted diagnostic code/status. This creates unnecessary duplicate-attempt uncertainty despite the underlying idempotency design.

2. **Regression coverage does not exercise the client/UI behaviors above.** Existing focused API tests pass, including the handler’s replay test, but they mock the command result and do not cover a missing reward, wallet-cap non-award, local snapshot-write failure, retained request identity after a timeout, or the `AuctionPage` refresh-only callback. The handler test at [classwordAnnual.test.ts:131](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tests/api/classwordAnnual.test.ts:131) only proves an already-completed API request returns `awarded:false`; it does not test a recoverable payment outcome. Add behavior-level tests around the client/local storage and rendered recovery action before changing the flow.

### LOW

None.

## Verified non-findings

- The reward callback does **not** overwrite the wallet with a potentially stale receipt balance: the child invokes it only as a refresh trigger ([StudentClasswordPage.tsx:181](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentClasswordPage.tsx:181)), and `AuctionPage` calls authoritative `refreshAuctionState({ forceFull: true })` ([AuctionPage.tsx:2046](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:2046)-[2048](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx:2046)). This is the safe choice for replayed historical balances.
- The request store retains an unresolved quiz request identity; a same-answer retry reuses it. The defect is the missing UI explanation/recovery affordance, not an observed request-ID overwrite.
- `withSaveFailureReporting('classword', ...)` records diagnostics for teacher-visible save-failure handling ([classwordClient.ts:135](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/classwordClient.ts:135), [saveFailureClient.ts:96](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/saveFailureClient.ts:96)-[114](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/saveFailureClient.ts:114)); the finding above concerns the immediate student recovery message.

## Evidence

- `node --import tsx --test tests/api/classword.test.ts tests/api/classwordAnnual.test.ts tests/api/classwordRepository.test.ts` — **37/37 passed**.
- Disposable synthetic capacity path — completed quiz remained completed with `rewardAwarded:false`.
- Disposable mock partial-write path — `CLASSWORD_REWARD_SAVE_FAILED` after the completion record was written; reloaded state was completed and no wallet snapshot was stored.

## Skill-perspective check

Ran `omo:remove-ai-slops` and `omo:programming` before judging maintainability/tests. The reviewed flow does not introduce an untyped escape hatch, prompt-text test, deletion-only test, or implementation-constant-only test. It does violate both perspectives’ behavioral-coverage standard: the critical recovery boundary has no focused observable regression test, and the current response shaping hides the `awarded`/recoverability distinction the UI needs. No needless parsing, normalization, or abstraction was found in the reviewed reward callback.

## Blockers

1. Make correct completion and payout recoverable as one durable workflow in both mock and shared modes: do not leave a disabled completed quiz after a failed/unpaid award, or persist an explicit pending claim with a user-accessible retry path.
2. Do not render `정답 N고마` unless payment is confirmed. Carry the payment/completion state through the response codec and present the correct recovery state.
3. Add focused behavior tests for local snapshot failure, shared capacity/non-award behavior, and same-request retry/receipt confirmation; update the immediate error copy to instruct the safe retry.
