# Todo 1 canonical bounded baseline

`baseline-results.json` is the canonical record. It was created by this real Playwright invocation:

```sh
NODE_PATH='/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node .omo/evidence/fixtures/task-1-baseline.mjs
```

It exited `0`, started `2026-07-11T13:33:46.579Z`, completed `2026-07-11T13:34:07.190Z`, and recorded 11 scenarios, 22 non-empty dimension-valid PNGs, zero unexpected console/page errors, six request audits, and free TCP 4175/54329 after cleanup.

## Enforced deadline behavior

The runner reserves 10,000 ms of its 110,000 ms total for cleanup. Matrix work is rejected once it reaches the reserved cleanup boundary; every owned-process shutdown, Chromium close, and final port check is then bounded by the remaining total time. A timeout therefore yields nonzero status, records the runner error, and still runs cleanup. The result write is the final evidence flush after that bounded lifecycle.

The deadline path was executed separately and did not overwrite canonical success:

```sh
set +e
NODE_PATH='/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
TASK_1_EVIDENCE_WHOLE_RUN_DEADLINE_MS=6000 \
TASK_1_EVIDENCE_OUTPUT='.omo/evidence/task-1-apple-ui-refresh-plan/deadline-path-results.json' \
node .omo/evidence/fixtures/task-1-baseline.mjs
```

That run exited `1`; `deadline-path-results.json` records `canonical matrix exceeded whole-run work deadline`, stopped fake Supabase PID 37411 and Vite PID 37426, and records both final ports as free.

## Binding and predicates

Canonical HEAD is `a527c4acc22b3c7f33f11520ccd04896af4ebfad`. The canonical JSON binds source hashes plus the runner, image-helper, runtime-helper, and fake-Supabase fixture hashes.

```sh
jq -e '.success == true and .errors == [] and (.cases|length)==11 and (.pngAudit|length)==22 and (.console.unexpectedErrors|length)==0 and ([.requestAudit.runs[] | (.liveSupabaseRequestCount == 0 and .allSupabaseRequestsLocal == true)] | all) and ([.processCleanup.finalPortChecks[] | .free] | all) and .deadline.completedWithinTotalMs == true and ([.cases[] | select(.id == "shortcut-alt-meta-enter") | .assertions.altMetaEnter] | any(. == "PASS")) and ([.cases[] | select(.id == "shortcut-alt-ctrl-enter") | .assertions.altCtrlEnter] | any(. == "PASS"))' .omo/evidence/task-1-apple-ui-refresh-plan/baseline-results.json
jq -e '.success == false and (.errors | any(.message | contains("whole-run work deadline"))) and ([.processCleanup.finalPortChecks[] | .free] | all)' .omo/evidence/task-1-apple-ui-refresh-plan/deadline-path-results.json
git diff -- src
git diff --cached -- src
git status --short -- src
lsof -nP -iTCP:4175 -sTCP:LISTEN
lsof -nP -iTCP:54329 -sTCP:LISTEN
```

The two `jq` predicates exited `0`; all three `src` diff/status commands produced no output; both `lsof` commands produced no output (exit 1 means no listener).
