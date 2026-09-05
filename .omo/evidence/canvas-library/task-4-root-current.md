# Task 4 current root surface proof

Root independently ran the actual Chrome keyboard/pointer flows. Root opened all38 initial-pass PNGs, then reran both complete flows after the final CSS change and inspected the changed full/small pickers plus all8 final worker picker PNGs. The independent reviewers receive all46 final images. No browser player teleport/state mutation was used. Offline BFS only planned input directions through the pure collision function.

- Full room: root-full-room-qa.json, generated2026-09-05T06:58:58.440Z,22PNG states, passedtrue. All1280×800. Zero document overflow and every visible button>=44px in each capture. Registration/carry/slot100/place/read completed. Fully occupied five shelves each expose20 buttons; ArrowRight/Down reaches their last slot, full caption matches accessible title, Enter reads it. Total100 selectable positions. No pageerrors or external/API requests.
- Small-room regression after final shared picker change: task-4-small-play-qa.json, generated2026-09-05T06:59:03.409Z,16PNG states, passedtrue. Invalid pagecount/modalfreeze, forwardTab containment, two real book loops, pointer range, literal HTML text,200%text scrollable actions, real held-key other-tab blur and no refocus auto-resume, reduced motion all pass. Old task3 captures/receipt were preserved under their original names.
- Evidence correction: first small rerun timed out on stale visible textContent=='빈자리1'. New compact buttons preserve aria-label rather than identical concatenated visibletext. Corrected only the harness to compare the exact accessible label; no product change. Failed receipt retained in task-4-small-stale-selector.json.
- Root reran world-driver.ts:32790 reachable states, all100 interaction points/all5 full pickers, direct-book access outside centerband,101st placement rejects and retains100. Exit0.
- Root npm test session63821:537pass,0fail; npm run lint27764 exit0; npm run build75731 exit0; git diff --check exit0. Existing API failure-path tests emit expected error logs but runner status is0; not hidden as production errors. Build still intentionally contains old route until task6 cutover, so this is not a full-route completion claim.
- Source hashes in both current receipts match World5110911b…, Game762c1c0c…, Renderer9979f210…, CSSecc0dd6b…. Final reviewers must independently rehash exact files.
- Final CSS-only correction uses fixed heading/caption and independently scrollable slot grid, with6px inset for full focus rings. Worker task-4-picker-qa.json8PNG passes at06:58:23.390Z; full200% reverse keyboard traversal keeps caption/activebutton/close usable. Root final lint67078 and build56247 exited0. Worker final full npm test537/537 passed; root prior full537/537 remains unchanged in tested world/Game code.
- Red→current picker diff task-4-picker-diff.json: dimensions match1280×800, alpha intact, diffRatio0.3222. This is an intentional readability repair, not a clone similarity target. Central42 hotspots reflect reduced picker height, numbered cells and full title caption.

## Cleanup

Root final Chrome26825 and98901 exited0/closed; stableVite5069 terminated130. Earlier Chrome55224/47126 passed and closed;82260/28619 failed and closed; oldVite17743 terminated130. CUAtemporarytab5 closed, no viewportoverride applied; usertab4 untouched. Workers3026/3028 closed; root lsof3026/3027/3028 independently returned no listeners.

## Gate

Task4 confirmed: task-4-final-integrity.md and task-4-final-visual.md bothPASS, each directly opened46/46 currentimages and independently matchedsourcehashes. Cleanup is complete. Shared backend/route remain pending and are not represented by fixture data. The controlled onPlace catch requires typed handling before task6 integration, as already scoped in that adapter work.
