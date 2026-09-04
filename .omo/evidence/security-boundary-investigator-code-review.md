# Shared-settings security-boundary investigation

## Scope and method

- Read-only investigation of `739de87` in `/Users/ibyeonghyeon/Documents/GitHub/School_Timer`.
- Reviewed `api/AGENTS.md`, `src/lib/AGENTS.md`, `src/pages/AGENTS.md`, and `src/server/AGENTS.md`.
- Skill-perspective check: **ran**. Consulted `omo:remove-ai-slops` and `omo:programming` before assessing tests and maintainability. The code violates both perspectives in its current test coverage: the affected tests are implementation/source-text assertions that protect an unsafe implementation detail rather than observable authorization or race behavior. No new parsing/normalization is recommended merely to satisfy the patch.
- Commands run (all green):
  `node --import tsx --test tests/api/shared-settings.test.ts src/lib/supabaseSettings.test.ts src/lib/auctionRefreshResilience.test.ts src/lib/teacherSettingsSync.test.ts` (30/30).

## Facts

### CRITICAL

1. **Any authenticated student can read the complete shared-settings JSON with `?full=1`.**
   `api/shared-settings.ts:266-270` sets `shouldLoadFullRow` for `session.role === 'teacher' || request.query?.full === '1'`; it then calls `loadRow`, whose Supabase select includes `value` (`api/shared-settings.ts:173-181`), and returns it with `scope: 'full'`. No server-side authorization distinguishes a student-provided `full` query from a teacher request.

   Source to sink: signed student cookie -> `getDeviceSession` (`api/shared-settings.ts:254`) -> GET branch -> query `full=1` -> `loadRow` -> service-role PostgREST `select=id,value,updated_at` -> JSON HTTP response. An attacker needs only their own normal student device cookie and can issue this same-origin request from browser DevTools; no UI route or cross-site bypass is needed.

   The current handler test positively encodes the vulnerability: `tests/api/shared-settings.test.ts:137-168` calls the handler with `studentHeaders(7), query: { full: '1' }` and asserts full-row output. The client uses the same route in every proxy-mode `updateSharedSettings` cache miss (`src/lib/supabaseSettings.ts:88-97`, invoked at `:157-160`).

   This exposes teacher-owned settings and every student-keyed value stored in the one JSON row, violating the requested invariant.

### HIGH

1. **The ordinary student projection also returns private `studentLife` content for every student.** `STUDENT_SHARED_FIELDS` includes `studentLife` (`api/shared-settings.ts:29-44`). `loadStudentRow` selects and returns every such field without filtering (`:183-215`), so `studentLife` is included verbatim in any normal student GET. `StudentLifeState` contains all `letters`, including `recipient`, `content`, and `readAt` (`src/lib/studentLife.ts:11-43`); the client filters only after receipt (`getStudentLetters`, `:262-280`). Thus the client may render only the signed-in student's letters while the browser still receives other students' and teacher messages.

   The current API test `tests/api/shared-settings.test.ts:96-135` verifies selected map entries but does not assert the absence of `studentLife`'s foreign letters/books. This is an independent violation even after `?full=1` is denied.

2. **An in-flight metadata GET can overwrite the cache after a successful PUT.** `loadUpdatedAt` records its promise in `updatedAtRequest` (`api/shared-settings.ts:222-236`) and, when it resolves, unconditionally writes `updatedAtCache` (`:238-241`). A successful PUT writes the newer cache entry at `:332-336` but neither invalidates nor versions the older in-flight request. Timeline: (a) metadata GET starts and upstream snapshots `v1`, (b) PUT commits `v2` and caches `v2`, (c) GET resolves `v1` and overwrites cache with `v1` for one second. A following metadata GET returns `v1` from `:219-220`.

   This is directly reachable with concurrent normal requests to the same warm serverless instance. The only concurrency test (`tests/api/shared-settings.test.ts:66-94`) coalesces two GETs; it does not place a PUT between GET start and resolution. The stated stale-cache invariant is therefore not met.

### MEDIUM

1. **The client cache API has no role-safe base-row model.** `cachedWritableSharedSettingsRow` is module-global (`src/lib/supabaseSettings.ts:23-27`) and `updateSharedSettings` requires a complete writable row (`:152-183`). Its proxy helper deliberately fetches `?full=1` (`:88-97`). Simply changing the GET condition to teacher-only will make normal student writes receive a projection, then fail the current complete-document comparison in `canStudentUpdate` (`api/shared-settings.ts:137-158`) or erase sibling data if that comparison is weakened naively. This is a compatibility constraint, not a justification for retaining the disclosure.

2. **Relevant tests are brittle implementation-mirroring tests.** `src/lib/supabaseSettings.test.ts:94-102` requires the literal `?full=1`; `src/lib/auctionRefreshResilience.test.ts:16-22` checks source text, not that a student API response is safe; `src/lib/teacherSettingsSync.test.ts:5-19` likewise checks ordering in source. Under the `remove-ai-slops` and `programming` perspectives, these give false confidence and will fight the correct boundary fix. Replace only the tests protecting the changed behavior with handler-level observable authorization/projection/race tests; retain source-inspection tests only where they protect a non-observable packaging contract.

### LOW

No LOW findings.

## Direct callers and normal workflows

- Direct transport callers are only `src/lib/supabaseSettings.ts:64` (normal GET), `:91` (full GET), `:101` (metadata GET), and `:122,163` (PUT), as verified by repository-wide `rg`.
- `loadSharedSettingsRow` consumers: teacher hydration/polling (`src/pages/TimerPage.tsx:4574,4954`), student refresh (`src/pages/AuctionPage.tsx:1279`), and the library itself. Teacher reads should remain full; student refresh should remain projected.
- `updateSharedSettings` consumers: teacher settings/auction/mail/daily-writing/donation code in `TimerPage.tsx`; student life, books, failure entries, emotion, pets, auction bids, donation acknowledgement, and student economy-adjacent state in `AuctionPage.tsx`; Sudoku and number-baseball hooks (`src/lib/useStudentSudokuState.ts:61,102`, `src/lib/useStudentNumberBaseballState.ts:70,119`). All of these currently depend on a full base row when proxy cache is cold.
- `loadSharedSettingsUpdatedAt` consumers: teacher remote sync (`TimerPage.tsx:4946`) and student refresh (`AuctionPage.tsx:1274`).

## Inference and narrowest safe enforcement boundary

The narrowest authority boundary for `full` is the server GET dispatch at `api/shared-settings.ts:266`, not a UI flag or `src/lib` branch: browser JavaScript and query strings are attacker-controlled. Make full-row selection teacher-only and treat `full=1` from a student as a normal scoped GET (or return a stable 403; scoped fallback is less disruptive).

However, doing only that is not a complete patch because the student write protocol is full-document replacement. The minimal compatible design is server-side:

1. Keep teacher read/write and optimistic CAS behavior unchanged.
2. For a student PUT, load the full current row server-side (already done), accept only a student-shaped projection, validate it against a projection of `current.value` and the session student number, then merge only authorized changes into the current full value before the CAS PATCH. Do not ever return that full base row to the browser.
3. Define an explicit per-field projection/merge policy. Filter `studentLife` before return and merge only the signed-in student's allowed letter/book/failure mutation paths. Confirm product ownership for auction bid history/awards and failure-exhibition visibility; if cross-student data is meant to be public, expose only the required public representation, not the raw backing object.
4. Remove the `loadWritableSharedSettingsRow` full request for student sessions. The browser can use its normal scoped row; the API must be the merge authority. Since the browser does not currently know its role in this helper, use the returned `scope` as a capability (only a `scope: 'full'` cache is a full base), not a query parameter as authority.
5. For metadata caching, attach a monotonically changing generation/request token or invalidate `updatedAtRequest` on successful PUT and only store a GET result if it remains the current request and no later write generation occurred. Preserve single-flight coalescing.

## Focused verification required after patch

1. Handler test: student `GET ?full=1` returns `scope: 'student'` (or 403) and its upstream select never includes raw `value`; teacher GET remains `scope: 'full'` and includes the full select.
2. Handler test with a full row containing schedule, every student balance/history, and multiple `studentLife.letters`: student response contains no schedule, no foreign map keys, and no foreign/teacher letter content; teacher response retains the full row.
3. Handler test for each normal student mutation family (pet/emotion, Sudoku/number-baseball, book/failure, bid if intentionally supported): issue a scoped projection PUT; verify server merges it with unseen teacher/sibling fields, performs CAS, and rejects foreign changes. This should be table-driven only where the observable merge policy is genuinely shared; avoid tests that merely assert literal URLs or internal helper names.
4. Deferred-promise handler test: begin `GET ?metadata=1` resolving `v1`; complete a successful PUT; resolve the GET; immediately make another metadata GET. Assert it returns the PUT `updatedAt`/`v2`, not `v1`, and retain a separate two-concurrent-GET single-flight assertion.
5. Run:
   `node --import tsx --test tests/api/shared-settings.test.ts src/lib/supabaseSettings.test.ts src/lib/auctionRefreshResilience.test.ts src/lib/teacherSettingsSync.test.ts`
   then `npm run lint`, `npm test`, and `npm run build`.

## Unresolved product decisions

- Which fields of `studentLife` (especially failure-exhibition stories and books) are intentionally classroom-public versus private. Raw letters are demonstrably private by recipient semantics, so they must not remain unfiltered.
- Whether auction bids/history and winner identity are intentionally public. Existing UI uses global bid data, but that does not authorize exposing unrelated private settings or mutating arbitrary bid records.

## Review disposition

- `codeQualityStatus`: **BLOCK**
- `recommendation`: **REQUEST_CHANGES**
- `blockers`:
  1. Remove student authority to obtain a complete settings row through `?full=1` and replace the client-dependent full-document student write flow with a server-side scoped merge.
  2. Stop returning foreign/teacher `studentLife` messages in the ordinary student projection.
  3. Prevent a stale in-flight metadata read from overwriting a PUT-updated cache, with an adversarial ordering test.
