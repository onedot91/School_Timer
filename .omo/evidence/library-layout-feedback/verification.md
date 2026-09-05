# Library feedback verification

## Implemented scope

- Two five-row, ten-column bookcases retain100 stable slot IDs0–99. Dense world spines use1–3 logical-pixel gaps; enlarged shelf buttons remain at least44×44 CSS pixels.
- Registration desk is one logical pixel from the spawn interaction point. A separate right-side physical board opens existing failure stories inside the game; old library routes enter the same game with this board open.
- Existing create/stamp callbacks, records, movement pause, single active modal, Escape isolation and carried-book state are retained.
- Source-backed rendering uses existing Canvas/DOM and palette. No generated images, dependencies, schema changes, production writes, commits or deployment.

## Actual browser proof

`node --import tsx .omo/evidence/library-layout-feedback/qa.mjs` exited0. `qa.json` enumerates21 actual1280×800 PNGs, verifies their PNG signatures/dimensions and no document overflow, and binds them to current source SHA256 hashes. Local mock browser blocks all external and API requests.

Observed: entrance registration; walking to board; create/stamp/cancel; one modal owner; no movement while board open; carrying preserved after close; placing at slot99; previous slot0 record retained; reload and book details; synthetic100-book scene; both50-button shelf pickers; legacy route embedded board; text200 single-column internal scrolling with no overlapping cards. Console page errors:0. Chrome context closed in finally.

Supplemental false/pending callback observations and cleanup are in `board-states.md`. No real student data was used.

## Findings fixed during QA

- A2025 synthetic story seed was correctly hidden by the existing retention filter. QA now uses current dates; production retention behavior was not changed.
- Actual local create bug: writing an older pet snapshot immediately after storing the new failure story dropped that story. The final combined write now includes `result.studentLife`; full-route saved-state and reload assertions pass.
- HMR reloaded a test page while evidence/build files were generated. Root restarted its dedicated3042 server with `DISABLE_HMR=true`; final captures use stable source hashes.
- Text200 originally squeezed three columns, then exposed height overlap. Scoped container styling now uses internally scrollable block-flow cards; source and fresh captures verified.
- A visual review inferred root scrolling at200%. A fresh unchanged-product run directly measured window/root/body scroll0, board inner scroll1805, identical before/after header bounds(100,136,1080,128), and visible close bounds(1120,144,44,88). `board-text-200-lower-card.png` shows the fourth card and fixed header together; the close button is clicked without any restorative scroll. Both independent final reviewers confirmed the fixed-header behavior; the original allegation was not reproduced.

## Automated checks

- `npm test`:576 passed,0 failed.
- `npm run lint`: exit0.
- `npm run build`: exit0, final build2.78s.
- `world.md`:22 focused world tests, collision/path/density/ID checks.

## Visual comparison

`diff.json` compares old layout (`before.png`) to requested new layout (`entered.png`). This is a deliberate redesign, not a clone target. The diff locates furniture/decor changes; it is not a quality verdict. Independent reviewers judge the full current21-capture set.

## Cleanup

- Every root isolated Playwright Chrome context closed by script finally.
- Root-created in-app tab9 closed; original user tab4 retained; viewport override reset.
- Worker fixture3043/tab/temp files cleaned; receipt in `board-states.md`.
- Dedicated3042 server PID39638 terminated after final surface QA. `lsof` confirms no listener on3042 or3043. User development server/tab was not stopped or closed.

## Final visual verdict: GOOD

- Design-system/live implementation: PASS (`review-integrity.md`, refreshed21-capture addendum).
- Functional integrity and data preservation: PASS (same report + source-bound actual full-route QA).
- Layout/resize/text zoom: PASS; root scroll0, internal scroll, fixed header directly measured.
- Alpha/transparency: PASS (diff.json and both reviewers).
- Visual fidelity to requested redesign: PASS (`review-visual-final.md`).
- CJK text: PASS (all21 current captures opened by both final reviewers).
- Final blockers: none. Every scoped plan step and temporary resource cleanup completed. No commit, deploy or production-state change made.
