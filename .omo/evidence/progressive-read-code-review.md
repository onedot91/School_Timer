# Progressive read review

Date: 2026-10-10 Asia/Seoul
codeQualityStatus: CLEAR
recommendation: APPROVE
blockers: []

## Scope

Read-only follow-up requested by parent: working-tree changes in `api/shared-settings.ts`, `src/lib/supabaseSettings.ts`, `src/lib/storageReadManifest.ts`, `src/server/storageProgressiveRead.ts`, `supabase/storage_progressive_reads.sql`, `src/pages/AuctionPage.tsx`, `src/pages/TimerPage.tsx`. Consulted projection/order helpers, student polling constants and the integration test/log. No production source edits made. Same programming/remove-ai-slops skill perspective as the combined-command review.

## CRITICAL

None.

## HIGH

None.

## MEDIUM

None remaining. The initially reported feature-navigation race was fixed during review. The latest `src/pages/AuctionPage.tsx:1354` records pending full data when a non-overview view refresh overlaps an outstanding overview GET, and the overview completion branch continues with forceFull instead of stopping. This removes the identified avoidable 10-12 second poll wait. Verified by re-reading the final diff; runtime regression remains the implementer's integration check.

## LOW

None in the scoped production changes.

## Assessment

- Overview responses use `complete=false` and `readScope=overview`; they are excluded from writable settings cache, full-ready state and full local snapshot persistence. The non-overview rendering gate requires a complete load.
- Compact transport is emitted only for complete patches; the client rejects compact responses lacking a complete validated patch. Existing projection merging reconstructs the value.
- Manifest server endpoint requires a teacher session; student queries cannot select the teacher path. SQL execution is restricted to service_role. Student overview preserves the existing participant-mail and student-map scopes and omits currency history.
- Teacher manifests use resource revisions including tombstones, plus wallet revisions. Stable SQL reads manifest and selected payload in one snapshot. Existing per-resource revision ordering merges changes even when wall-clock timestamps are old. The inspected integration test covers an old timestamp update, tombstone deletion and student isolation; its log reports one test passed.
- Actor changes and explicit cache invalidations clear the manifest. A stale-generation fetch cannot install its manifest. Concurrent older manifests can cause redundant subsequent category reads but do not independently delete newer accepted resource revisions.
- Re-reviewed the added `teacherChangesSupported` capability separately from the manifest. Actor-generation changes reset it, normal save invalidation retains it to request a fresh baseline, and an accepted server response without a manifest disables it. This prevents initial teacher saves from permanently reverting unchanged polling to the metadata-only path.
- Unknown category format falls back to a complete snapshot. Physical removal of categories/wallets is outside the normal tombstone protocol; that administrative case is not covered here.
- Runtime boundary parsing and the shared manifest parser have a concrete purpose. No new production untyped escape hatch or speculative abstraction identified. A nearby modified source-regex assertion in `supabaseSettings.test.ts` remains implementation-coupled; it is not runtime coverage and was not used as correctness evidence.

## Verification limits

Inspected `tests/storage/progressiveReads.integration.test.ts` and `.omo/evidence/read-loading/postgres-test.log`; did not rerun DB or browser tests in this bounded audit. Parent is running the full suite. Real deployed PostgREST, production feature flags and latency remain unverified. `omo-agent-toolkit` was unavailable in the prior status attempt, so report uses `.omo/evidence/` fallback. No separate notepad supplied.
