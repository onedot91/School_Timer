# Todo 5 standalone RandomDraw visible-text repair

## Result

- Baseline: detached local clone at `f5a90d8d0e94bc43c3338a47aea5bb14cb0e19d9`.
- Current: active School_Timer worktree.
- Entry: evidence-only `random-draw.html`; `TimerPage` was never imported or visited.
- Fixture in both runs: empty localStorage before application code, fixed `2026-07-06T10:00:00.000Z` clock, identical LCG sequence seeded with `0x5c11d00d`, same default roster/case state, and all non-local requests aborted.
- States: `default`, `settings`, `after-settings`, `winner`.
- Viewports: 320x568, 390x844, 768x1024, 1024x768, 1280x720, 1440x900, and 390x844 at 200% zoom.
- Exact UTF-8 ordered visible-text result: **28/28 match**, zero mismatches.

## Supersession

The prior Todo 1 standalone oracle is invalid and superseded for these 28 records only. It was not an independent baseline because the complete runner visited TimerPage first and allowed shared `school-random-draw-v1` state to be rewritten before standalone initialization. The remaining 329 complete-oracle records are unchanged.

## Safety and cleanup

- No live Supabase, production origin, balances, bids, or classroom history were read or written.
- The sole external request in each run was the same Google Fonts stylesheet and was aborted before delivery.
- Baseline and current each created only isolated `school-random-draw-v1` state inside an ephemeral browser context.
- Vite processes on 4176 and 4177 stopped; both ports were confirmed free.
- Product source was not edited by this repair.

## Related focus evidence

The current computed evidence remains unchanged: the top announcement textarea has `outline-width: 0px`, transparent `border`, and `box-shadow: none` in normal mode. Forced-colors mode intentionally retains the operating-system focus indicator.
