# Runtime fixture evidence

Revision: `b733abd1aa3a73728c79453cd7206d5d303cd6e5`

Exact invocation:

```text
node /tmp/quiz-runtime-qa.mjs
```

Exit: `0`

The script loaded `src/lib/classwordClient.ts` through Vite SSR with `import.meta.env.PROD=true`, injected a disposable `window.localStorage`, set `navigator.onLine=false`, and replaced `globalThis.fetch` with synthetic responses. It did not contact Supabase or write student data.

Observed evidence:

```text
Q1: POST /api/classword; answer_quiz; correct=true, awarded=true, rewardAmount=7, balance=107.
Q2: POST /api/classword; answer_quiz; correct=false, awarded=false, rewardAmount=0, balance=null.
Q3: POST /api/classword transport loss, followed by GET /api/classword?requestId=56f38ff7-ee3b-4555-8a55-eb96115fc7f9; committed receipt returned the correct paid result.
Q4: first POST transport loss + GET committed=false raised CLASSWORD_CONFIRMATION_REQUIRED; second POST reused requestId=657b61ab-0623-486a-aa48-64213d280a6d and succeeded; pending request storage was cleared after success.
Q5: GET /api/classword?quiz=1&dateKey=2026-09-09 returned completed=true and rewardAmount=null; client preserved null as the pending reward state.
```
