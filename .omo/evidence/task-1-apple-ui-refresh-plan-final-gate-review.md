# Todo 1 final gate review

## recommendation

REJECT

## blockers

1. The low-timeout receipt is stale relative to the current runner. `deadline-path-results.json` records runner SHA-256 `7cf647bb53e12c7477780ea801b40990459ff6bb2dbb79cca2f449b3bfed8dad`, while the current runner and `baseline-results.json` both identify `49d36642ded43a418e958e97806c082f00c5517f54c19c5dd15161f2fb20def1`. The deadline run started at `2026-07-11T13:33:15.336Z`; the current runner file was modified at `2026-07-11 22:33:38 +0900`, after that run. The receipt therefore does not prove nonzero exit and free ports for the current deadline/module/shortcut revision.
2. There is no two-repeat or equivalent flakiness proof for the current 11-case revision. `repeat-run-1-results.json` and `repeat-run-2-results.json` bind older runner hash `2133f0e6f9d3c45ff44af03e4cb44d2d0f11587ceb3e6cea2f38c4b660ba32b2`, contain only 10 cases/20 PNGs, omit `shortcut-alt-meta-enter`, and have no current whole-run deadline fields. `supersession.md:5` explicitly says they are historical and must not be combined with the current matrix. Fixed clocks and fresh contexts improve determinism but are not an observed repeat of the corrected runner.
3. The timeout implementation does not cancel or await timed-out work. `task-1-baseline-runtime.mjs:18-23` uses `Promise.race([work(), timeout])` without an `AbortSignal`; `task-1-baseline.mjs:54` begins cleanup immediately after the race rejects. The losing `runMatrix` promise can continue concurrently with browser/server cleanup. Thus the artifact does not establish that one real whole-run deadline cleanly encloses execution and cleanup.
4. Direct `omo:remove-ai-slops` / `omo:programming` review found unresolved maintenance slop that the task review marks PASS. `task-1-baseline.mjs` has a 1,016-character maximum line and compresses the full 11-scenario matrix into dense one-line callbacks; runtime and image helpers reach 574 and 522 characters per line. Literal pure LOC counts are below 250 (89, 62, 62, 51, 132), but the compression defeats the maintainability purpose of that limit and triggers the excessive-complexity/overly-clever-one-liner criterion. The superseded recovery fixture remains in the active fixture directory and duplicates baseline data/flows. `task-1-code-review.md:14-23` does not cover obvious comments, over-defense, excessive complexity, needless abstraction, boundary violations, dead code, duplication, performance equivalence, or missing deadline regression coverage, and its deletion-only statement answers whether a test was removed rather than whether a test merely verifies a requested removal.
5. The nonzero exit claim is prose-only. `run-log.md:25` says exit `1`, but `deadline-path-results.json` has no captured process exit-code field or shell receipt. `success: false` is consistent with a nonzero exit policy but does not independently prove the shell-observed exit code, especially because the recorded runner hash is stale.

## originalIntent

Todo 1 was intended to create a trustworthy pre-implementation baseline without changing production or live classroom data: run an isolated local fake Supabase and Vite instance, exercise the entry/admin/runtime-fallback/auction/localStorage contracts in fresh fixed-clock browser contexts at 1440x900 and 390x844, preserve reset shortcuts and confirmation-before-write behavior, capture valid screenshots and request/console evidence, and cleanly stop all owned processes.

## desiredOutcome

A current-revision canonical matrix and current-revision low-timeout run should jointly prove that success cannot be overstated, the complete execution and cleanup are bounded, timeout exits nonzero with ports free, both shortcut branches and localStorage fallback are covered, every Supabase REST request is local, all PNGs decode and pass the named pixel regression, source/fixture hashes match, the corrected matrix is repeatable, `src` remains untouched, and the fixture/review layer introduces no maintenance slop or false confidence.

## userOutcomeReview

The current successful canonical artifact is internally consistent for 11 cases, 22 captures, both shortcuts, six REST audits, zero unexpected console/page errors, current source/fixture hashes, and free final ports. Independent checks decoded all 22 PNGs with `sips`, matched every current file byte count and dimension to JSON, and measured the selected-mobile largest opaque-black component as 0 pixels against the 8,000-pixel limit. The current worktree has zero staged or unstaged `src` diff and zero `src` status entries; ports 4175 and 54329 are currently free. These passing parts do not close the stale timeout receipt, corrected-revision repeat, uncancelled timeout work, or review/slop gaps, so the user cannot safely treat Todo 1 as independently verified.

## adversarial review

- `stale_state`: BLOCKED. Canonical source and four canonical fixture hashes match current files, but the deadline receipt and both repeat receipts bind older runner hashes.
- `dirty_worktree`: PASS for Todo 1 product scope. The overall worktree is dirty with evidence/user-owned entries, but staged/unstaged `src` byte counts are 0 and `git status --short -- src` has 0 lines.
- `hung_commands`: BLOCKED. A stale low-timeout run shows `success:false`, a work-deadline error, stopped PIDs 37411/37426, and both ports free, but it is not the current runner and `Promise.race` does not cancel the timed-out matrix.
- `flaky_tests`: BLOCKED. The only two repeats are explicitly superseded 10-case runs from an older runner revision.
- `misleading_success_output`: BLOCKED. Canonical run-log counts/timestamps/PIDs match canonical JSON, but the deadline exit assertion is not machine-recorded and is attached to stale code; manual QA overstates current timeout and flakiness proof.
- `maintenance_slop`: BLOCKED. Literal 250-pure-LOC counts pass, but dense 522-1,016-character lines, one-line scenario bodies, superseded fixture duplication, and incomplete task-review category coverage remain.

## directly verified passing evidence

- Current HEAD: `a527c4acc22b3c7f33f11520ccd04896af4ebfad`.
- Current canonical hashes match all six listed source files and `fake-supabase.mjs`, `task-1-baseline.mjs`, `task-1-baseline-images.mjs`, and `task-1-baseline-runtime.mjs`.
- Canonical JSON: `success:true`, 11 distinct cases, 22 captures/PNG audits, both `altMetaEnter` and `altCtrlEnter` PASS, 0 unexpected errors, all six REST audits local with live count 0, and final ports free.
- PNGs: 22/22 decoded; expected 1440x900 or 390x844 dimensions; current bytes and dimensions match JSON; selected-mobile black-component check passes.
- Fixture locality: fake Supabase binds only `127.0.0.1:54329`; runner URLs are `127.0.0.1`; fake fixture contains no proxy or outbound client code.
- Fixture syntax: `node --check` passes all five `.mjs` files.
- Literal pure LOC: `fake-supabase.mjs` 89; image helper 62; runtime helper 62; canonical runner 51; historical recovery fixture 132.

## checked artifact paths

- `.omo/plans/apple-ui-refresh-plan.md`
- `.omo/boulder.json`
- `.omo/start-work/ledger.jsonl`
- `.omo/evidence/fixtures/fake-supabase.mjs`
- `.omo/evidence/fixtures/task-1-baseline.mjs`
- `.omo/evidence/fixtures/task-1-baseline-images.mjs`
- `.omo/evidence/fixtures/task-1-baseline-runtime.mjs`
- `.omo/evidence/fixtures/task-1-selected-confirmation-recovery.mjs`
- `.omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/deadline-path-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/repeat-run-1-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/repeat-run-2-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/selected-confirmation-recovery-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/manual-qa.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/run-log.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/cleanup-receipt.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/task-1-code-review.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/notepad.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/done-claim.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/supersession.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/screenshots/*.png` (22 files; all decoded and metadata-compared; key surfaces visually inspected)
- `src/RootApp.tsx`
- `src/pages/EntrySelectPage.tsx`
- `src/pages/AuctionPage.tsx`
- `src/components/AuctionRoom.tsx`
- `src/lib/supabaseSettings.ts`
- `src/index.css`

## exact evidence gaps

- A low-timeout result generated by runner SHA-256 `49d36642...`, including a captured shell exit code and free-port checks.
- A second successful full 11-case/22-PNG run on runner SHA-256 `49d36642...`, or a demonstrably equivalent repeated execution receipt for the same corrected revision.
- Cancellation/settlement evidence showing timed-out matrix work cannot continue while cleanup runs.
- A task code-review report that explicitly applies both `omo:programming` and every applicable `omo:remove-ai-slops` category, including the requested overfit/removal-only distinctions, and resolves the direct excessive-complexity/dead-fixture findings.

Confidence: 0.99
