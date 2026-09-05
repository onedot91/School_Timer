# Profile synchronization verification · 2026-09-05

## Change
- Student views share metadata polling: existing store interval2s, default10s on other visible screens.
- Full snapshots older than the latest accepted server version or committed profile receipt are rejected before state/cache updates.
- Profile receipts immediately update the reentry cache's studentLife while retaining its old full-sync version, then queue a full refresh.
- Existing profile renderers already consume shared assignments directly; no image URL busting, persistence schema change, or balance rules changed.

## Browser
Actual AuctionPage mounted with fake API and in-memory Storage on localhost3003. All API fetches intercepted. Dummy Supabase config, readonly data mode; profile request uses fake domain purchase only. No backend or persistent user data writes.
- Held a shared-settings GET at bear profile, purchased cat through actual shop confirmation. Released old GET after purchase: one save, one stale response, current and cached profile remain cat.
- Navigated to actual classword board: existing student1 word shows cat.
- Simulated remote change while staying in classword: polling updates existing word to fox without remount/navigation.
- Auction QA simulates a weekday through fixture-only getDay override. Existing bidder1 card and header change together from bear to fox.
- Remounted student page: bidder and header retain fox; navigation back to classword retains fox.
- Final browser error log empty. Screenshots inspected inline.
- Quiz mock was initially incomplete; fixture corrected before final run. No production quiz code changed.

## Checks
- npm test: final run756 passed,0 failed.
- npm run build: passed.
- npm run lint: passed during implementation; final recheck recorded in tool output.
- Existing library route source assertion updated to require version-aware accepted snapshot before cache advancement; local branch assertions retained.
