# Code review: third-grade stock simplification

## Verdict

- `codeQualityStatus`: WATCH
- `recommendation`: APPROVE
- `blockers`: none

## Scope and evidence checked

- Goal audited: third-grade stock simplification, including next-day settlement idempotency, date-specific `+/-` configuration, removal of selling, persistence, and regressions.
- Inspected the complete uncommitted diff and the relevant production/test files: `src/lib/studentEconomy.ts`, `src/lib/studentEconomy.test.ts`, `src/pages/AuctionPage.tsx`, `src/pages/TimerPage.tsx`, `src/components/student/StudentSecuritiesPage.tsx`, and `src/components/student/StudentStorePage.tsx`.
- `omo ulw-loop status --json` could not run because `omo` is not on `PATH`; this fallback report therefore uses `.omo/evidence/` as required.
- Verification run: `npm test` passed (71/71); `npm run lint` (`tsc --noEmit`) passed; `git diff --check` passed.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. Settlement idempotency is implemented but not regression-tested at the relevant boundary.
   - Evidence: [`settleMaturedStudentStocks`](../../src/lib/studentEconomy.ts#L351) removes `stockPurchases` and holdings, and the shared-save path additionally writes a date-scoped request ID at [`AuctionPage.tsx:1379`](../../src/pages/AuctionPage.tsx#L1379) and [`AuctionPage.tsx:1389`](../../src/pages/AuctionPage.tsx#L1389). Those are sound idempotency mechanisms.
   - Gap: the new settlement test only checks one settlement pass at [`studentEconomy.test.ts:105`](../../src/lib/studentEconomy.test.ts#L105); it never reruns settlement with its resulting state, and it does not exercise the local or shared persistence paths at [`AuctionPage.tsx:1369`](../../src/pages/AuctionPage.tsx#L1369). A future regression that stops clearing the purchase record or bypasses the request-ID guard can double-credit balances while this suite remains green.

### LOW

1. Obsolete sell-only error handling remains after the sell action was removed.
   - Evidence: the `StudentEconomyAction` union now permits only `buy_stock` at [`studentEconomy.ts:113`](../../src/lib/studentEconomy.ts#L113), and the student UI exposes only a buy button at [`StudentSecuritiesPage.tsx:50`](../../src/components/student/StudentSecuritiesPage.tsx#L50), but the unreachable `NO_STOCK_HOLDING` message branch remains at [`AuctionPage.tsx:1349`](../../src/pages/AuctionPage.tsx#L1349). This is harmless dead code, but it is stale vocabulary from the removed sell path.

## Requirement trace

- Next-day settlement: purchase records include `dateKey`, and settlement selects purchases strictly before the current date ([`studentEconomy.ts:368`](../../src/lib/studentEconomy.ts#L368)). It applies the configured date-specific delta and clears the pending position ([`studentEconomy.ts:369`](../../src/lib/studentEconomy.ts#L369)-[`studentEconomy.ts:375`](../../src/lib/studentEconomy.ts#L375)).
- Date-specific `+/-`: teacher entries are keyed by date and stock ([`TimerPage.tsx:8673`](../../src/pages/TimerPage.tsx#L8673)-[`TimerPage.tsx:8681`](../../src/pages/TimerPage.tsx#L8681)), normalized/persisted, then displayed to students as amounts rather than percentages ([`StudentSecuritiesPage.tsx:46`](../../src/components/student/StudentSecuritiesPage.tsx#L46)).
- No sell path: removed from the action union and student UI; repository search found no `sell_stock` consumer.
- Persistence: local mode uses the dedicated normalized localStorage market; shared mode includes `studentStockMarket` in the shared settings snapshot and updater flow ([`TimerPage.tsx:4220`](../../src/pages/TimerPage.tsx#L4220), [`TimerPage.tsx:4426`](../../src/pages/TimerPage.tsx#L4426)).

## Skill-perspective check

- Ran: `programming` TypeScript guidance and `remove-ai-slops` review criteria were explicitly consulted before judging tests and maintainability.
- `programming`: no newly introduced `any`, type-suppression directive, brittle prompt test, or implementation-mirroring test found. The missing repeated-settlement regression is a coverage gap, not a violation.
- `remove-ai-slops`: no deletion-only or tautological tests found, and the data normalization is at the persisted-data boundary rather than needless production parsing. The stale `NO_STOCK_HOLDING` branch is the only identified dead-code/slop remnant.
