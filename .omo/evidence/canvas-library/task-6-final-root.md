# Final root verification

Current product freeze: Game `85e95e2ff896e2c8d58fca152c08cf6e5d8c95aeace00ba2a3cf71ff2a54e110`, CSS `df69c2f6fcc244348e1e0513a4eb6557e958409e414e4c6cbc4652d0af8c32a6`, Renderer `bbed35c35c5d2d50b5d2488b89a431fc523762a6b781a1c610e55d884326819d`. All additional source hashes are in `final-capture-index.json` and its referenced receipts; the synthetic shared build verified all250 source files unchanged.

Root personally ran final actual browser flows, not a static fixture substitute:
- `node .omo/evidence/canvas-library/task-6-root-route-qa.mjs`: session91448 exit0;34 actual1280×800 states, local registration/carry/place/reload/details/legacy, failed storage and retry, held-key real blur, reduced motion,200%text, all5 empty/mixed/full bookcases, no directional pad.
- `task-6-shared-browser.mjs` with final build manifest: session88147 exit0;10 actual1280×800 states, isolated students1/2/23 through actual handler with disposable fake PostgREST. Competing slot winner, precommit failure, postcommit response loss, idempotent retry, persisted four books and reward once, student2 sees student1 after refresh. No production service used.
- `node .omo/evidence/canvas-library/task-6-readonly-qa.mjs`: session20054 exit0;6 actual1280×800 states; writes explicitly rejected, storage byte-identical, carried draft preserved, Escape closes.
- `node .omo/evidence/canvas-library/final-capture-index.mjs`: exit0;52 PNG signatures/dimensions/source hashes verified. Index adds two unique current worker modal states (keyboard empty error and200%picker).
- Root directly inspected current whole scene, wooden picker, full spines, failure/shared states and readonly six states. Independent visual reviews remain required; this receipt does not self-certify them.

Final automated checks at this freeze: `npm test` session18967 exit0 (572passed,0failed); `npm run lint`27097 exit0; `npm run build`11539 exit0; `git diff --check` exit0. Logs: `final-tests.log`, `final-lint.log`, `final-build.log`.

## Adversarial coverage
- Malformed input: page0 and malformed commands rejected without mutation.
- Untrusted text: literal HTML metadata displayed as text, no execution.
- Cancel/resume: Escape/carry retention, repeated interactions and retries verified.
- Stale state: source-bound52 captures; stale-slot conflict refreshes winner;250-source shared manifest exact.
- Dirty worktree: existing work and discarded old draft deletion preserved; no reset/commit.
- Long commands: bounded browser timeouts and all final commands exited.
- Flaky tests: fixed-clock CAS/economy regression and repeated focused/full runs; final572pass.
- Misleading success: verify actual persisted local/fake DB records/reward counts, not only HTTP status. Earlier Escape/material/palette/occlusion defects were rejected and corrected before this freeze.
- Repeated interruption: real blur clears held keys; refocus does not resume movement; pending saves and response-loss retries preserve identity.

## Cleanup receipt
- Root3033 session42976 and readonly3040 session59383 stopped with exit130.
- Root final Chrome flows91448/88147/20054 exited0 and closed their contexts in cleanup.
- Root IAB tab8 closed through CUA; user tab4 and user server3000 untouched.
- Worker3038 stopped; shared worker3034/3036 stopped (see `task-6-shared-browser-cleanup.txt`).
- Root `lsof -nP -iTCP:3033 -iTCP:3034 -iTCP:3036 -iTCP:3038 -iTCP:3040 -sTCP:LISTEN` returned no listeners (exit1).
- QA scripts/PNGs/logs retained as evidence, not running resources. No production write, deployment, dependency, SQL, commit or push.
