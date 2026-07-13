# Corrected DoneClaim JSON

```json
{
  "todo": 1,
  "status": "COMPLETE_CORRECTED_AFTER_ADVERSARIAL_NEEDS_FIX",
  "head": "f5a90d8d0e94bc43c3338a47aea5bb14cb0e19d9",
  "runnerSha256": "8ca57d302a85a4e065a505ea6fdff4f6737aac5b7ed29636d4cc6dc1c35cf270",
  "requiredStateCount": 51,
  "viewportsPerState": 7,
  "expectedRecordCount": 357,
  "actualRecordCount": 357,
  "repeatRuns": [
    { "file": "complete-visible-text-oracle-run-1.json", "success": true, "records": 357 },
    { "file": "complete-visible-text-oracle-run-2.json", "success": true, "records": 357 }
  ],
  "repeatEquality": {
    "orderedVisibleText": true,
    "focusOrder": true,
    "overflow": true,
    "focusLifecycle": true
  },
  "hardAssertions": [
    "required state ID set equality",
    "no duplicate or unexpected state IDs",
    "exactly seven viewport records per state",
    "nonempty visible-text array with at least one nonempty node",
    "zero page-level horizontal overflow",
    "exact expected record count",
    "zero live Supabase REST requests",
    "zero external question requests",
    "zero unexpected console/page errors"
  ],
  "focusLifecycle": {
    "surfaces": [
      "timer memo",
      "timer settings",
      "timer award confirmation",
      "timer reset confirmation",
      "auction bid confirmation",
      "standalone draw settings"
    ],
    "physicalActions": ["Tab", "Shift+Tab", "Escape"],
    "recorded": ["activeElement", "inside active surface", "surface count after Escape", "body inert", "aria-hidden", "pointer-events", "trigger return"],
    "baselineDefectsPreserved": true
  },
  "unreachable": [
    {
      "id": "timer/embedded-draw-empty",
      "reason": "normalized inclusive bounds always create rollingPool.length >= 1",
      "exactPayloadSelectorAndTiming": "state-viewport-manifest.md"
    }
  ],
  "isolation": {
    "liveSupabaseRestRequests": [0, 0],
    "externalQuestionRequests": [0, 0],
    "unexpectedConsoleOrPageErrors": [0, 0],
    "realClassroomMutations": 0
  },
  "cleanup": {
    "contextsAndChromiumClosed": true,
    "ownedServersStopped": true,
    "ports4175And54329Free": true,
    "productSrcDiffEmpty": true
  },
  "baselineFindings": {
    "sub44TargetMeasurements": 2424,
    "horizontalOverflowRecords": 0,
    "focusLifecycleDefects": "recorded verbatim; not misrepresented as passing accessibility"
  },
  "ultraqa": {
    "stale_state": "PASS: two same-HEAD, same-runner repeats",
    "dirty_worktree": "PASS: planning/evidence dirt recorded; product src clean",
    "hung_commands": "PASS: owned processes have cleanup receipts and ports are free",
    "flaky_tests": "PASS: 357-record oracle and focus lifecycle repeat exactly",
    "misleading_output": "PASS: former 28-state claim superseded; only one code-proven unreachable state deferred",
    "repeated_interruptions": "PASS: each run uses fresh processes/contexts and atomic result replacement",
    "host_isolation": "PASS: zero live Supabase/external question requests",
    "data_mutation": "PASS: synthetic in-memory fixture only"
  },
  "evidence": [
    ".omo/evidence/fixtures/task-1-complete-oracle.mjs",
    ".omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle.json",
    ".omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle-run-1.json",
    ".omo/evidence/task-1-apple-ui-refresh-plan/complete-visible-text-oracle-run-2.json",
    ".omo/evidence/task-1-apple-ui-refresh-plan/state-viewport-manifest.md"
  ]
}
```
