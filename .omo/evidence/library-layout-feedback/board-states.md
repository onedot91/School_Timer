# Failure-board callback state fixture

Browser: local Chrome at `http://127.0.0.1:3043` during the run; fixture-only callbacks and stories, with no student or shared data access.

## Rejected create

- Scenario: the create callback resolves `false` after both required fields are filled.
- Invocation: open `board-states.html?mode=reject`, open `실패 이야기 전시하기`, enter `거절되어도 남는 실패` and `다시 써 볼래요`, then activate `자랑하기`.
- Binary observable: the browser accessibility tree still contained `student-failure-compose-dialog`, the two exact field values, and the enabled `자랑하기` button after the callback returned.
- Captured artifact: `.omo/evidence/library-layout-feedback/board-states.md`

## Pending create

- Scenario: the callback remains pending for 10 seconds after a valid submit.
- Invocation: open `board-states.html?mode=pending`, fill both fields, activate `자랑하기`, then press Escape while the request is pending.
- Binary observable: browser accessibility tree showed disabled `작성 창 닫기` and disabled `저장하는 중`; after Escape the same composer and both draft values remained present. The disabled submit is the observable duplicate-submit guard.
- Captured artifact: `.omo/evidence/library-layout-feedback/board-states.md`

## Successful completion and board ownership

- Scenario: the delayed pending callback resolves successfully.
- Invocation: wait for the fixture callback completion after the pending scenario.
- Binary observable: composer closed, the new owner card `지연 저장 실패 저장 완료 뒤 확인 내가 쓴 글` appeared, the board's create trigger regained focus, and a browser DOM query reported `{ "modalCount": 1, "boardActive": true }`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board-states.md`

## Browser error check

- Scenario: rejected, pending, and resolved fixture interactions.
- Invocation: browser developer-log query for `error` and `warn` levels after the successful completion.
- Binary observable: `[]`.
- Captured artifact: `.omo/evidence/library-layout-feedback/board-states.md`

## Cleanup receipt

- Local fixture server: Python PID `38643` on `127.0.0.1:3043` terminated after verification.
- Browser: the agent-created Chrome fixture tab was closed.
- Temporary fixture files (`board-states.html`, `board-states.tsx`, and generated `board-states.js`) were removed after their observations were recorded here.
