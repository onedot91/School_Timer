# Reward audit code review

Scope reviewed: `src/lib/rewardAudit*`, `src/server/rewardAudit*`,
`supabase/storage_audit_v2.sql`, `src/components/teacher/TeacherRewardAudit.tsx`,
`api/save-alerts.ts`, and the associated tests. This was a read-only review; no
production data was queried.

## Skill perspective

I consulted `omo:remove-ai-slops` and `omo:programming`. The production code has
no `as any`, unchecked persistence cast, prompt test, or production parsing that
is outside an input boundary. The tests cover observable audit outcomes rather
than requesting a removal or mirroring internal constants. I found no slop-skill
violation that warrants a separate finding. The small source modules are below
the size threshold.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. **The automatic refresh lifecycle is wired to the wrong event target.**
   `src/components/teacher/TeacherRewardAudit.tsx:35-36` passes `window` as the
   event target, while `src/lib/rewardAuditPolling.ts:23` registers
   `visibilitychange` there. In the DOM typings used by this project,
   `visibilitychange` belongs to `DocumentEventMap` (`node_modules/typescript/lib/lib.dom.d.ts:7351`),
   not `WindowEventMap`; browsers dispatch it from `document`. As a result, a
   hidden page need not abort an in-flight audit or start its requested
   immediately-on-return refresh. The focus listener does not cover every
   visibility transition. `src/lib/rewardAuditPolling.test.ts:5-14` dispatches
   the event directly into a generic `EventTarget`, so it cannot exercise the
   browser routing that fails. Use `document` for visibility events and retain a
   separate `window` focus listener, then add a DOM-level regression test.

2. **The server classifies the Korean current date using its host timezone.**
   `src/server/rewardAuditRepository.ts:33` calls
   `getKoreanLocalDateKey(new Date(checkedAt))`, but that helper reads local
   `Date` fields (`src/lib/studentEmotion.ts:132-136`). In a UTC Node process,
   `TZ=UTC node --import tsx … getKoreanLocalDateKey(new Date('2026-09-07T15:30:00Z'))`
   returns `2026-09-07`, although this is 2026-09-08 00:30 in Korea. The
   `wordEntries` guard at `rewardAuditRepository.ts:43-47` then treats the
   previous Korean day's finalized entry as current and skips it until the UTC
   date changes. This creates a recurring up-to-nine-hour false negative for
   the exact missing-payment audit. Convert the checked timestamp to a Korean
   calendar date at this server boundary, and test a KST-midnight boundary.

### LOW

None.

## Evidence and verification

- `git diff --check`: passed.
- `npm run lint -- --pretty false`: passed.
- Focused unit/API tests passed: 17 tests across reward comparison, activity
  collection, response parsing, and polling.
- The isolated HTTP/DB test could not run in this review sandbox because its
  local PostgreSQL connection was denied (`connect EPERM 127.0.0.1:55439`).
  This is an environment restriction, not a claimed product failure; its earlier
  successful run must be retained as separate evidence.

## Result

`codeQualityStatus: WATCH`  
`recommendation: REQUEST_CHANGES`  
`blockers: Fix the two MEDIUM findings before treating the automatic audit as reliable; rerun browser lifecycle QA and the KST-midnight audit test.`
