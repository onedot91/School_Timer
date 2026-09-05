# Task 5 independent scenario design

Source: read-only `/root/canvas_placement_attack_design`, independently corroborated by root reading current files. This is scenario design, NOT passing evidence.

- `studentLife.ts` normalizer and add both truncate books at600; preserve601+ while retaining letter/failure rules.
- `weeklyMission.ts` teacher reconciliation selects stale next.studentLife when no verified economy activity; slot preservation needs regression in both branches. Worker ownership expanded to this pure function if regression proves change necessary; no handler activation.
- `api/shared-settings.ts` currently trusts generic studentLife and skips teacher row load with known version. Task6 must activate authoritative-book replacement and route cutover together.
- Existing book mission grants10 once/week; new placement calls it only at commit, existing/replayed placement never grants again.

## Pure state scenarios
1. Valid new placement produces deterministic session-scoped ID and slot, one reward at most.
2. Identical retry returns existing receipt with unchanged records and reward ledger.
3. Same UUID with changed title/author/pages/slot rejects, unchanged input.
4. Slot -1,100,fraction,string,null/NaN rejects400 even when full.
5. Malformed UUID and invalid student0/24/string reject.
6. Empty/overlength title/author, noninteger/out-of-range pages reject without trimming invalid input into success.
7. Foreign existing book rejects403, no mutation.
8. Own legacy book placement changes only slot, preserves metadata and reward state.
9. Own placed same slot succeeds; relocation rejects409.
10. Occupied slot rejects without reward or record mutation.
11. Exactly100 unique occupied positions rejects new valid-slot claim as full;600 unplaced history retained.
12. Generic forged/removal snapshot preserves authoritative books and incoming unrelated fields; normalization retains first slot claimant and leaves duplicates unplaced.

Root driver invocation: `node --import tsx .omo/evidence/canvas-library/task-5-root-driver.mjs` after typed exports exist. Independent input/state assertions required, not response-only assertions.

## Deferred task6 HTTP boundaries
Local fake signed sessions + fake PostgREST only:401 no session;403 cross-site; same/different-slot CAS races; monotonic timestamps; insert-only race; timeout-after-commit replay;1MB reject without truncation;readonly explicit refusal; configured backend failure not local success; returned authoritative snapshot/cache consistency.

Task5 does not claim HTTP enforcement. UI modality/movement/blur remain task4 evidence and task7 integrated validation. Cleanup: no resources created by read-only reviewer.
