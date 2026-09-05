# Task 5 — Pure non-destructive library placement rules

## DoneClaim

Task 5 pure transforms are implemented and verified. `StudentBook.librarySlot` is additive; normalization keeps every valid book in input order, gives a duplicated slot to the first valid array claimant, and leaves later duplicate/invalid claims unplaced. The book-only 600-record truncation is removed while letter/failure behavior remains under the existing normalizers. No handler, client, route, SQL, dependency, production data, or deployment path was changed.

Stable Task 6 exports from `src/lib/canvasLibraryPlacement.ts`:

- `LibraryPlacementCommand`, `LibraryPlacementErrorCode`, `LibraryPlacementError`, `LibraryCommandParseResult`, `LibraryPlacementResult`
- `parseLibraryPlacementCommand(raw)`
- `applyLibraryPlacementCommand(value, trustedStudentNumber, rawCommand, serverTimestamp)`
- `replaceSnapshotBooksWithAuthoritative(incoming, authoritative)`

The smallest teacher-merge fix is in `weeklyMission.ts`: each existing branch still chooses/merges non-book student-life collections exactly as before, then replaces only `books` from the current authoritative snapshot. This avoids a dependency cycle and protects slots in both ordinary and verified-economy merge paths.

## PIN

- Scenario: existing mailbox, student-life normalization, book mission reward and retry behavior before product edits.
- Invocation: `node --import tsx --test src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts`
- Binary observable: exit `0`; `23` tests, `23` pass, `0` fail.
- Captured artifact: this report; terminal receipt captured before source edits in task transcript.

## RED

- Scenario: new placement boundary tests exist before the product module.
- Invocation: `node --import tsx --test src/lib/canvasLibraryPlacement.test.ts`
- Binary observable: exit `1`; Node `ERR_MODULE_NOT_FOUND` for `src/lib/canvasLibraryPlacement.js`.
- Captured artifact: this report; exact missing-module receipt captured in task transcript.
- Adversarial RED discovered by the independent driver: duplicate legacy ID across owners initially allowed both records to be mapped, dropping the foreign owner's slot. The final rule rejects ambiguous existing IDs with `403 LIBRARY_BOOK_FORBIDDEN`; the strengthened driver and regression pass.

## GREEN

- Scenario: strict malformed-command parsing; oldest duplicate claim; invalid slots; 600+ history; immutable transitions; 100/101 capacity; ownership; duplicate cross-owner ID; replay/reuse mismatch; existing-book no reward; stale generic snapshots; ordinary and economy-active teacher merges; existing mailbox/book mission regressions.
- Invocation: `node --import tsx --test src/lib/canvasLibraryPlacement.test.ts src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts`
- Binary observable: exit `0`; `35` tests, `35` pass, `0` fail, `0` skipped. Repeated after the final source edit.
- Invocation: `npm run lint`
- Binary observable: exit `0`; `tsc --noEmit` emitted no diagnostics.
- Invocation: `npm test`
- Binary observable: exit `0`; `549` tests, `549` pass, `0` fail, `0` skipped.
- Invocation: `npm run build`
- Binary observable: exit `0`; Vite transformed `2234` modules and completed the production build.
- Invocation: `git diff --check`
- Binary observable: exit `0`; no whitespace errors.
- Captured artifact: this report and `.omo/evidence/canvas-library/task-5-root-driver.json`.

## SURFACE

- Scenario: a synchronous non-test library consumer feeds 700 synthetic legacy records, places a new book, retries one week later, attacks ownership and duplicate IDs, performs 100 real existing-book placements, attempts the 101st, applies stale generic/teacher snapshots, and verifies input/source immutability.
- Invocation: `node --import tsx .omo/evidence/canvas-library/task-5-rules-driver.mjs`
- Binary observable: exit `0`; JSON `passed:true`; 9 scenario groups passed; `700` records preserved at full capacity, the new path produced `701`, the first reward delta was `10`, replay reward delta was `0`, and exactly `100` slots were placed.
- Captured artifacts: `.omo/evidence/canvas-library/task-5-rules-driver.mjs`, `.omo/evidence/canvas-library/task-5-root-driver.json`.
- Cleanup receipt: zero owned browsers, servers, ports, or long-running processes; the driver is synchronous and exited normally.

## Applicability matrix

| Check | Result | Evidence |
| --- | --- | --- |
| Literal untrusted text | PASS | `<b>그대로 표시</b>` remains inert data in the driver; parser rejects forged keys and script action text. |
| Malformed types/ranges | PASS | UUID, student, slot, title, author, page-count and timestamp assertions. |
| Duplicate/invalid slots | PASS | First array claimant retains the slot; all records and metadata remain. |
| Cancel/resume/uncertain retry | PASS | Identical pure-input replay returns the same book/value without reward; changed slot/metadata rejects. |
| Ownership/duplicate IDs | PASS | Foreign and ambiguous IDs reject without state mutation. |
| Stale snapshots | PASS | Generic, ordinary teacher, and economy-active teacher paths keep authoritative books/slots. |
| Capacity/history | PASS | 100 transforms fill the room; 101st rejects without eviction; 700 records remain. |
| HTTP auth/CAS/1 MB guard | DEFERRED | No handler activation in Task 5; required coordinated Task 6 boundary work. |
| HTTP/manual browser/network | N/A | Pure library phase has no HTTP or UI surface and created no server/browser. |
| Long-command interruption | N/A | No long-running process or retry loop is part of these synchronous transforms. |

## Exact file hashes (SHA-256)

```text
3af9cb7d792bb8fa8869b5a29cda9493685a079931c56e2f6aa212f278506031  src/lib/studentLife.ts
c49abeb96b0db0aa2d997cbd3b62baa135160529047b93bd70c871ea922a9505  src/lib/studentLife.test.ts
799b7523f750f2a95f2f3b325235e8326d2a5a777ca03628b43d80ad0d1f9d20  src/lib/canvasLibraryPlacement.ts
e3925a5be597e5e5af385b6d030ccbcc636d33e5af16153f9412130af4cac740  src/lib/canvasLibraryPlacement.test.ts
ee556db6593d100542f5fecbefc41fd05b4884fa266e47acd03282ca4fa7500f  src/lib/bookStackMission.ts
6b767a02ee3f50273f98bfd66b15ac9b185cf5a4085c00769ef2874c35b83a6d  src/lib/weeklyMission.ts
4cffe8fdcfe4e393d805bff6d101955ebf74685011f10717107ed91e88a352b9  .omo/evidence/canvas-library/task-5-rules-driver.mjs
4d883872c4d53ad1a2e649540a084c68bb60bd3e1ed8a4127818545cdafe0a4f  .omo/evidence/canvas-library/task-5-root-driver.json
```

Independent review remains required before Task 5 is checked complete.
