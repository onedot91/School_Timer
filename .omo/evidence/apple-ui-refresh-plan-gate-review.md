# apple-ui-refresh-plan Todo 1 gate review

- recommendation: REJECT
- adversarialVerdict: false-positive
- reviewedAt: 2026-07-11 Asia/Seoul

## originalIntent

Todo 1 was intended to establish a trustworthy, pre-implementation baseline without touching production/live data: capture entry, admin, runtime fallback, auction loading/empty/selected/confirmation/local-error states at 1440x900 and 390x844; lock the listed behavior/data contracts; prove every Supabase REST request stayed on the local fixture; preserve a clean `src` diff; and cleanly stop Chromium, Vite, and fake Supabase.

## desiredOutcome

A reproducible, internally consistent evidence bundle whose canonical runner exits 0 only when its DOM assertions, non-empty screenshots, request-host boundary, behavior contracts, source-diff guard, and cleanup checks all pass.

## userOutcomeReview

The bundle contains real, non-empty PNGs for the requested 16-state/viewport matrix, and an independent current check confirms both staged and unstaged `src` diffs are empty and ports 4175/54329 are free. However, the claimed successful canonical run is not trustworthy: `baseline-results.json` records 29 console events including five `error` events, while the current runner appends every console event to `results.errors` and sets `process.exitCode = 1` whenever that array is non-empty. Therefore the run log's `exit 0` claim cannot be reproduced from the referenced runner and artifact. The later selective recovery run does not reconcile or replace the canonical run in `manual-qa.json` or `run-log.md`.

Direct pixel inspection also found large black rendering blocks in `screenshots/auction-selected-390x844.png`. The later recovery screenshot is visually intact, but the manual QA artifact still references the original baseline screenshot set and does not disclose or supersede the corrupt image.

## blockers

1. Misleading success output: `.omo/evidence/task-1-apple-ui-refresh-plan/run-log.md` claims exit 0, but `.omo/evidence/fixtures/task-1-baseline.mjs:41,161` and `.omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json` imply exit 1 (`errors.length == 29`). Five entries are console level `error`; the rest are debug/info that are also incorrectly classified as errors.
2. The canonical baseline runner does not stat-check its 16 PNG outputs and does not assert the computed request audit. It records `localSupabaseBoundary` as PASS before computing the audit. Thus its stated success condition does not actually reject empty screenshots or escaped REST hosts. The selective recovery runner adds these assertions for only selected/confirmation states.
3. `manual-qa.json` marks `misleading_success_output` PASS and says success requires 16 non-empty PNGs and JSON validation, but the canonical runner contains no 16-file size check. This is unsupported.
4. The original mobile selected screenshot has large black blocks. Recovery evidence is not integrated into the canonical manual-QA references or run log, leaving two conflicting artifact sets.
5. Behavior-contract coverage is incomplete. The baseline verifies only `Alt+Meta+Enter`; it does not verify the ChromeOS/other-platform `Alt+Ctrl+Enter` branch. It also does not enumerate/lock the full plan-level contract list, including Supabase-disabled/localStorage fallback, visible Korean copy preservation, and character assets.
6. `stale_state` is only asserted in prose for the main run. The artifact does not record HEAD/revision, fixture/script hash, or app bundle hash. Current HEAD predates the run and `src` is clean, which reduces but does not eliminate the evidence gap.
7. `hung_commands` is overstated for the canonical runner: it has no whole-run deadline and does not own/start/stop either server. Only the later four-case recovery runner has a 15-second deadline. Current free ports prove current cleanup, not the historical process termination claimed by the receipt.
8. No Todo 1/apple-ui-refresh code-review report exists. Therefore the required independent `programming` and `remove-ai-slops` perspective coverage in the report is absent.
9. No task-specific notepad path is supplied or referenced. The available `.omo/ulw-loop/notepad.md` belongs to a different task.

## remove-ai-slops / programming direct pass

- Production diff: no changed production code under `src`, so no production extraction/normalization scope drift was introduced by Todo 1.
- Test/evidence slop found: unused `sleep` helper; all console events conflated with failures; a PASS string assigned before host audit; claimed PNG validation absent from the canonical runner; and a duplicated selective recovery runner that leaves the canonical evidence unreconciled. These create maintenance burden and false confidence.
- The browser assertions mostly target observable behavior rather than implementation details, but missing failure wiring makes the canonical script an unreliable gate.
- Report coverage: absent; no apple-ui-refresh Todo 1 code-review report was found.

## checked artifact paths

- `.omo/plans/apple-ui-refresh-plan.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/selected-confirmation-recovery-results.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/manual-qa.json`
- `.omo/evidence/task-1-apple-ui-refresh-plan/run-log.md`
- `.omo/evidence/task-1-apple-ui-refresh-plan/cleanup-receipt.md`
- all 16 files under `.omo/evidence/task-1-apple-ui-refresh-plan/screenshots/`
- all 4 files under `.omo/evidence/task-1-apple-ui-refresh-plan/recovery-screenshots/`
- `.omo/evidence/fixtures/fake-supabase.mjs`
- `.omo/evidence/fixtures/task-1-baseline.mjs`
- `.omo/evidence/fixtures/task-1-selected-confirmation-recovery.mjs`
- `.omo/boulder.json`
- `.omo/start-work/ledger.jsonl`
- `.omo/ulw-loop/notepad.md` and `.omo/ulw-loop/bootstrap-notepad.md` (confirmed unrelated)
- relevant source contracts in `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx`, `src/pages/AuctionPage.tsx`, `src/components/AuctionRoom.tsx`, and `src/lib/supabaseSettings.ts`

## exact evidence gaps

- No reproducible exit-0 transcript for the current canonical baseline runner.
- No canonical assertion that all 16 PNG files exist and are non-empty.
- No canonical assertion that every observed REST request is local and that at least one REST request was observed.
- No canonical reconciliation/supersession record for the recovery artifacts.
- No `Alt+Ctrl+Enter` platform-branch result.
- No Supabase-disabled/localStorage fallback result.
- No explicit full behavior-contract inventory/freeze artifact for Korean copy and character assets.
- No revision/hash binding between source, fixture scripts, and captures.
- No historical server PIDs or termination output in the cleanup receipt.
- No task-specific code-review report or notepad.

## reproduction commands

```sh
jq -e '.errors | length == 0' .omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json
jq -e '[.errors[] | select(.type == "runner")] | length == 0' .omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json
jq -e '[.errors[] | select(.type == "console" and .level == "error")] | length == 0' .omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json
jq -e '(.cases|length)==16 and ([.cases[].screenshot]|unique|length)==16 and ([.cases[].overflow.horizontal]|all(.==false)) and .requestAudit.liveSupabaseRequestCount==0 and .requestAudit.allSupabaseRequestsLocal==true' .omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json
jq -e '(.cases|length)==4 and (.errors|length)==0 and .requestAudit.allSupabaseRequestsLocal==true and .requestAudit.writesBefore==0 and .requestAudit.writesAtConfirmation==0' .omo/evidence/task-1-apple-ui-refresh-plan/selected-confirmation-recovery-results.json
node --check .omo/evidence/fixtures/task-1-baseline.mjs
node --check .omo/evidence/fixtures/task-1-selected-confirmation-recovery.mjs
git diff -- src
git diff --cached -- src
git status --short -- src
lsof -nP -iTCP:4175 -sTCP:LISTEN
lsof -nP -iTCP:54329 -sTCP:LISTEN
find .omo -type f | sort | rg 'apple-ui-refresh-plan.*(review|notepad)|(review|notepad).*apple-ui-refresh-plan'
```

Observed exits/results: all-errors-zero = 1; runner-errors-zero = 0; console-errors-zero = 1; 16-case matrix/request-audit predicate = 0; recovery predicate = 0; both syntax checks = 0; staged and unstaged `src` diff byte counts = 0; no `src` status; no listeners on 4175/54329; no task-specific review/notepad candidate.

## recommendation

REJECT
