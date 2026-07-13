# Todo 3 DoneClaim

```json
{
  "todo": 3,
  "status": "COMPLETE_CORRECTED_AFTER_VERIFIER_NEEDS_FIX",
  "scope": [
    "src/pages/EntrySelectPage.tsx",
    "src/RootApp.tsx",
    "src/index.css: APPLE THEME / ENTRY_ROOT only"
  ],
  "redEvidence": {
    "hiddenAdminTarget": "32x32 CSS px at all six baseline viewports",
    "mobileDensity": "baseline 390x844 showed only entries 1-18 before scroll",
    "zoomDefectFoundDuringGreenQA": "first 200% implementation clipped number glyphs inside four-column horizontal controls"
  },
  "greenEvidence": {
    "hiddenAdminClicks": "clicks 1-4 hidden; click 5 reveals entry 0",
    "entries": "1-23 individually selected and exact storage value observed in isolated contexts",
    "invalidStorage": "999 silently returns to selection",
    "shortcuts": ["Alt+Meta+Enter PASS", "Alt+Control+Enter PASS"],
    "runtimeFallback": "evidence-only Vite entry mounts RootApp, throws a real asynchronous window error, renders the existing fallback, then the real reload action navigates and recovers to entry selection",
    "targets": "number and hidden controls >=44 CSS px at 320/390/768/1024/1280/1440",
    "press": "active=true, opacity=0.86, scale=0.98",
    "focus": "solid focus-visible outline at every target viewport",
    "reducedMotion": "transition duration 0.00001s",
    "zoom200": "no horizontal overflow and no internal text clipping after vertical mobile control repair"
  },
  "exactTextOracle": {
    "success": true,
    "states": 51,
    "records": "357/357",
    "entryRootStatesComparedToBaseline": 5,
    "entryRootRecordsComparedToBaseline": "35/35",
    "exactVisibleTextByteMatches": 35,
    "exactVisibleTextByteMismatches": 0,
    "horizontalOverflowRecords": 0,
    "liveSupabaseRequests": 0,
    "externalQuestionRequests": 0,
    "unexpectedConsoleErrors": 0
  },
  "manualVisualQA": {
    "viewports": ["320x568", "390x844", "768x1024", "1024x768", "1280x720", "1440x900", "390x844 at 200%"],
    "result": "PASS after repairing the 200% internal clipping found during inspection",
    "screenshots": ".omo/evidence/task-3-apple-ui-refresh-plan/screenshots/"
  },
  "adversarial": {
    "realClassroomMutations": 0,
    "liveDataRequests": 0,
    "externalAssets": "Google Fonts requests were blocked by the isolated browser route",
    "faultInjectionInProductSource": false,
    "faultInjectionMarkerProductMatches": 0,
    "faultInjectionMarkerScopedDiffMatches": 0,
    "productSourceSha256": "c59b10caff9e0143722fe2f5e6ed032c231c245a48da8c3f0f0796fdfdf4d39a",
    "scopedDiffSha256": "45cfbd6a98f54c4a7823a5b79582a5fe857b8f0565f87a7ae4fec0f114144058",
    "ownedPortsAfterRun": "4175, 4176, and 54329 free"
  },
  "validation": {
    "npmRunLint": "PASS",
    "npmRunBuild": "PASS with pre-existing chunk-size advisory",
    "gitDiffCheck": "PASS"
  },
  "evidence": [
    ".omo/evidence/task-3-apple-ui-refresh-plan/post-change-oracle.json",
    ".omo/evidence/task-3-apple-ui-refresh-plan/manual-qa.json",
    ".omo/evidence/fixtures/task-3-entry-oracle.mjs",
    ".omo/evidence/fixtures/task-3-entry-qa.mjs",
    ".omo/evidence/fixtures/task-3-runtime.html",
    ".omo/evidence/fixtures/task-3-runtime-entry.tsx"
  ]
}
```

The initial Todo 3 completion claim is superseded. It used a synthetic `ErrorEvent` and described the 35-record text comparison without embedding the byte comparison in the canonical result. This corrected claim is authoritative: `manual-qa.json` records the real thrown error and reload recovery, while `post-change-oracle.json` records all 35 UTF-8 serialized array comparisons and zero mismatches.
