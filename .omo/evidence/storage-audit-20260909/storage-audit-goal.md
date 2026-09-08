# Storage redesign goal audit

- Verdict: **PASS**
- Reviewed HEAD: `6aff30b3aff7de9c2c66494b24832b929a2d267d`
- Worktree: `/tmp/school-storage-audit-20260909`
- Review mode: read-only; no production or live-data writes

## Scope

- `src/lib/storageResponseOrder.ts`
- `src/lib/storageProjectionPatch.ts`
- `src/lib/storageCommandClient.ts`
- `src/lib/supabaseSettings.ts`
- Direct tests and server projection producer paths needed to validate those contracts

## Result

No additional reproducible defect was found in the requested classes: response ordering, partial snapshot retention, or false save success/failure.

### Response ordering

- `src/lib/storageResponseOrder.ts:57-76` rejects completions captured for an earlier actor generation, retains the highest accepted global timestamp, and delegates patch ordering to per-resource revisions.
- `src/lib/storageProjectionPatch.ts:102-127` rejects lower revisions and older equal-revision responses, preserves newer partial resources when an older complete snapshot arrives, and retains deletion tombstones against delayed responses.
- PostgreSQL sub-millisecond ordering is preserved by `src/lib/storageResponseOrder.ts:19-28`; the existing timezone/microsecond test reproduced successfully.

### Partial snapshot retention

- `src/lib/storageProjectionPatch.ts:111-127` merges only the resources, wallets, and student histories represented by a partial patch. Absent values are removed only for `complete` patches.
- `src/lib/storageResponseOrder.ts:63-71` seeds patch state from a legacy projection and returns the assembled cache rather than the partial response `value`.
- `src/lib/supabaseSettings.ts:208-222` orders a read before updating the writable cache and uses cache generation plus timestamp checks to prevent a read started before a save from replacing the newer cache.
- Server patch construction was cross-checked at `src/server/storageProjection.ts:8-29`: partial scoped patches carry revisioned visible resources and explicit deletion keys; complete defaults only for non-scoped snapshots.

### Save success/failure classification

- `src/lib/storageCommandClient.ts:38-46` rejects malformed success envelopes and malformed patches as uncertain writes.
- `src/lib/storageCommandClient.ts:92-107` confirms non-business/network or malformed-success outcomes through the request receipt without replaying the mutation; an unknown receipt ends as `STORAGE_CONFIRMATION_REQUIRED`, not success.
- `src/lib/storageCommandClient.ts:93-95` treats actor changes and explicit storage maintenance/protocol responses as definitive rejections. The availability classifier excludes uncertain writes (`src/lib/storageAvailability.ts:12-19`).
- `src/lib/supabaseSettings.ts:339-365` confirms uncertain legacy PUTs by a fresh authoritative read, requiring both a timestamp change and equality of the intended full or student-scoped update.

## Verification

Executed:

```text
node --import tsx --test --test-name-pattern='storage|projection|response ordering|partial|older command|actor changes|unknown actors|timestamp ordering|손상 patch|늦은 full|resource와 wallet' src/lib/storageResponseOrder.test.ts src/lib/storageProjectionPatch.test.ts tests/api/libraryScopedProjection.test.ts tests/api/storageCommands.test.ts
```

Result: 13 tests passed, 0 failed, duration 1.146 s. This reproduced out-of-order command/read responses, actor switching, microsecond timestamps, late complete snapshots, revision ordering, tombstones, corrupt patches, partial mail projection, and scoped library projection retention.

## Slop and programming pass

Applied the `omo:remove-ai-slops` overfit/slop criteria and `omo:programming` maintenance criteria directly to production code and tests. The tests assert observable merged state, rejection class, request count, actor isolation, and response metadata. They are not deletion-only, tautological, prose-pinning, or implementation-mirroring tests. The new patch cache is a necessary stateful seam for independently ordered partial projections rather than an unused extraction. No criterion-blocking maintenance burden or scope drift was found.

## Evidence gaps / limits

- No separate original success-criteria artifact, executor report, code-review report, manual-QA matrix, or notepad path was supplied to this bounded sub-review. The assigned invariants and named files were therefore the operative criteria.
- No live Supabase write was performed, as required. Server projection behavior was checked through repository tests and source contracts.
- PASS means no additional defect was reproduced in this bounded scope; it does not certify unrelated storage clients or API handlers.

## Findings

No actionable `file:line` defect findings.
