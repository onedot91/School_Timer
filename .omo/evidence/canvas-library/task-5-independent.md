# Task 5 independent adversarial verification

## Verdict

**CONFIRMED** for the Task 5 pure placement deliverable at the exact source hashes below. HTTP/auth/CAS/1MB enforcement, handler activation, client cutover, and route behavior are explicitly Task 6 and were not used as Task 5 blockers.

## Original intent and desired outcome

Task 5 must add an additive `StudentBook.librarySlot?: number` placement model without destructive history truncation, strictly parse the pure placement command, enforce student ownership and 100-slot capacity, make new-book identity/reward retry-safe, preserve existing-book identity without new reward, and ensure generic/teacher reconciliation cannot overwrite authoritative books or slots. Existing mailbox/failure-story behavior must remain intact. `onAdd` and HTTP/CAS activation remain deferred to Task 6.

## Exact verified artifacts

- `src/lib/studentLife.ts` — `3af9cb7d792bb8fa8869b5a29cda9493685a079931c56e2f6aa212f278506031`
- `src/lib/studentLife.test.ts` — `c49abeb96b0db0aa2d997cbd3b62baa135160529047b93bd70c871ea922a9505`
- `src/lib/canvasLibraryPlacement.ts` — `799b7523f750f2a95f2f3b325235e8326d2a5a777ca03628b43d80ad0d1f9d20`
- `src/lib/canvasLibraryPlacement.test.ts` — `e3925a5be597e5e5af385b6d030ccbcc636d33e5af16153f9412130af4cac740`
- `src/lib/weeklyMission.ts` — `6b767a02ee3f50273f98bfd66b15ac9b185cf5a4085c00769ef2874c35b83a6d`
- `src/lib/bookStackMission.ts` — `ee556db6593d100542f5fecbefc41fd05b4884fa266e47acd03282ca4fa7500f`
- `src/lib/bookStackMission.test.ts` — `3b8816a3c0dcb652137f95765261edf59266b87e4ab4689e35d8fe79e589f8a2`
- `.omo/evidence/canvas-library/task-5-root-driver.mjs` — `8b7d580ec6db1049c681818e839f29b8000683cba5f7821447c6a452d535c022`

The driver itself re-hashed the four production sources at start and finish and asserted they did not change during execution. Its emitted receipt is `.omo/evidence/canvas-library/task-5-root-driver.json` generated at `2026-09-05T07:16:47.061Z`.

## Reproduced commands

1. `node --import tsx .omo/evidence/canvas-library/task-5-root-driver.mjs` — PASS, exit 0. Nine scenario groups passed: 701 records after adding to 700 legacy records; cross-week replay reward delta 0; malformed/forged fields rejected; own existing placement kept 700 records and reward delta 0; 100 actual placements kept 700 records and a 101st failed without mutation; generic stale replacement; duplicate/invalid slots; duplicate cross-owner ID; both teacher reconciliation branches including economy-active preservation.
2. `node --import tsx --test src/lib/canvasLibraryPlacement.test.ts src/lib/studentLife.test.ts src/lib/bookStackMission.test.ts` — PASS, 35/35, 0 failed.
3. `npm run lint` — PASS, `tsc --noEmit`, exit 0.
4. `git diff --check` — PASS, exit 0.

## Criterion review

- **Non-destructive history and capacity:** confirmed. `normalizeBooks` no longer truncates books; `addStudentBook` appends without `slice(-600)`. Driver proves 700 legacy + 1 new = 701 and 100 actual placements preserve all 700 metadata/IDs. Full-room and invalid attempts leave the input snapshot byte-for-byte structurally unchanged.
- **Slot normalization:** confirmed. Only integer slots 0..99 survive; oldest array claimant retains a duplicate slot and later claimant becomes unplaced without record deletion. Invalid slots become unplaced.
- **Strict parser/boundary:** confirmed. Exact top-level and discriminated book keys are required; request UUID shape, slots, title/author trimmed lengths, and integer pages are bounded. Extra `studentNumber`, malformed types, NaN/Infinity, and script-like action are rejected. Literal HTML in a valid title remains inert data (`<b>그대로 표시</b>`) and is not executed by this pure module.
- **Ownership and duplicate-ID RED fix:** confirmed from source and execution. Existing placement filters by ID, requires exactly one match, then requires session student ownership. The former ID-wide mutation defect recorded in `task-5-root-duplicate-red.md` is no longer reachable. The strengthened case with student 1 unplaced `same-id` and student 2 slot 63 `same-id` returns 403 and leaves both records unchanged.
- **Retry identity/reward:** confirmed. New ID is deterministic `library:${studentNumber}:${requestId}`. Identical replay returns the stored record with `applied=false`, `awarded=false`; metadata or slot reuse mismatch returns 400. Cross-week identical replay produces no second reward. Existing-book placement adds no duplicate and no reward; same-slot replay succeeds and different-slot replay returns 409.
- **Authoritative replacement and teacher reconciliation:** confirmed. Generic replacement keeps unrelated incoming fields/collections but replaces books from the authoritative snapshot, including the no-row/null authoritative case as empty. `mergeConcurrentCurrencyUpdatesIntoSettings` reapplies authoritative books after both branches: no economy activity and economy-active merge. The latter adversarial scenario preserves all 700 authoritative records and remote placements while excluding stale-only books.
- **Unrelated mailbox/failure semantics:** confirmed by focused regression coverage. The 35-test run includes practice failure-only clearing with reference preservation, letter visibility/read/retry/conversation behavior, failure normalization, and the unchanged 600-letter retention limit. Book expansion did not remove these caps or alter those flows.

## PIN / RED / GREEN

- **PIN:** plan Task 5 contract and current dirty-worktree source paths were inspected; all claims in this report are bound to the hashes above, not earlier stale receipts.
- **RED:** `.omo/evidence/canvas-library/task-5-root-duplicate-red.md` records a real prior failure where duplicate IDs across owners caused the foreign slot 63 to be cleared.
- **GREEN:** direct source inspection shows unique-match ownership gating, and both the strengthened driver and named unit regression reproduce the correction at current hash.

## Direct programming and remove-ai-slops pass

- Production boundary accepts `unknown` and parses it before domain transformation; discriminated new/existing variants remain explicit and typecheck clean.
- No new dependency, network/storage side effect, catch-and-swallow, `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, debug log, relocation/removal API, or speculative HTTP abstraction was found in the scoped placement implementation.
- `canvasLibraryPlacement.ts` measures 204 nonblank/non-comment LOC: warning band but below the 250-LOC defect threshold. It has one coherent responsibility (pure placement parsing/transformation). No Task 5 criterion is violated.
- Tests assert observable state/reward/error outcomes and include hostile inputs; they do not merely grep deletions or mirror implementation calculations. The 700/100 loops are bounded domain-capacity proofs, not useless repetition. The stale merge fixtures deliberately differ from authoritative data, so they exercise precedence instead of tautologically matching fallbacks.
- No deletion-only or requested-removal-only test was found. The history regression proves positive preservation and a successful 701st record, while the duplicate-ID regression proves foreign state stability.

## Ultra-QA disposition

- Malformed input, forged identity, literal HTML data, stale-row/no-row replacement, both teacher branches, duplicate foreign ID/slot 63, repeated retry, cross-week reward once, capacity, input immutability, stale hashes, and misleading-green risk were exercised or directly inspected.
- Browser/network interruption, long-running command interruption, UI screenshot, live data, HTTP status/auth/CAS, and route activation are non-applicable to this pure Task 5 slice or explicitly deferred to Task 6.
- Dirty worktree was observed and preserved. No product source was edited by this reviewer.

## Blockers and evidence gaps

`blockers: []`

No Task 5 success-criterion gap remains at the pinned hashes. Task 6 still must prove the deferred server/client/route surfaces; that is a dependency boundary, not evidence missing from this pure deliverable.

## Cleanup receipt

No server, browser, port, subprocess session, live data, dependency, commit, or deployment was created. All verification commands exited synchronously. The only reviewer-authored artifact is this report.
