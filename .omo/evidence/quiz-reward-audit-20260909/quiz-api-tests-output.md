# Existing API/client test evidence

Revision: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`

Exact invocation:

```text
node --import tsx --test src/lib/classwordClient.test.ts src/lib/classwordQuiz.test.ts src/lib/classwordQuizLocalStore.test.ts src/lib/classwordQuizReward.test.ts tests/api/classword.test.ts tests/api/classwordAnnual.test.ts tests/api/classwordRepository.test.ts
```

Exit: `0`

Result: `tests 48`, `pass 48`, `fail 0`, `skipped 0`, `todo 0`.

The run used the repository's synthetic handler fixtures and local memory storage. No DB or real student account was used.
