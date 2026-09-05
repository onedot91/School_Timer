# Task 2 independent interim verification

Date: 2026-09-05. Verdict: needs-fix, not a task-completion claim.

Previous goal turn answered a prompt question without product progress. Current state was revalidated from the plan, ledger, source, live agents and root-owned Vite PID77952/port3023 before continuing.

## Observed functional evidence

- Root independently reran 13 world tests and the Node movement/placement driver: exit0, all18 current slot targets reachable, occupied placement rejected without input mutation.
- Root opened the real isolated component in IAB. Read-only DOM measurement returned1280×800 and zero document overflow; IAB screenshot compositor cropped the image after viewport override. This capture is not authoritative visual evidence.
- Bundled Chrome independently drove actual held keyboard movement, desk registration, invalid page0 rejection, carry, slot cancellation/reopen, placement, details and Escape return. `root-play-qa.mjs` exit0; `root-play-qa.json` contains observed coordinates and source hashes.
- Real second-tab focus with focus emulation disabled stopped a held movement key and did not resume it after returning. No synthetic blur event or position setter was used.
- Seven actual1280×800 PNGs have valid signatures and were personally inspected: root-empty, root-registration, root-invalid, root-carry, root-slots, root-details, root-placed.
- No browser page errors or attempted nonlocal/API requests in that run. Isolated Chrome closed in finally.

## Blocking visual findings

- Initial renderer preview was too flat: near-solid floor, oversized plain furniture faces, weak architectural depth.
- Updated live capture still shows window on the apparent floor plane. World and renderer owners are coordinating a real rear-wall band and matching movement boundary.
- Initial navigation banner persisted, and contextual E captions duplicated across Canvas and top HUD. UI owner is reducing these and adding pointer access to desk interaction.
- Rendering/UI edits overlapped this interim run; captures prove the observed interaction path only and are not a final same-source visual approval. Recapture all states after owners finish.

No checkbox is marked complete. Capacity expansion and backend integration remain gated on small-room quality.

## Stable-source follow-up

- Revised world tests14/14 and driver independently pass, including floorStartY104 and blocked wall/window interiors.
- Full `npm test` rerun after the geometry fix:531pass/0fail, exit0. The previous530/531 result was the intentionally failing rear-wall test before implementation.
- Root expanded browser check found a real focus escape: slot1 → ArrowDown → slot7 → Tab leaves the dialog. It reproduced twice, including explicit initial-focus readiness. `root-play-qa.json` records `Tab 0 escaped slot dialog` and script line91. The shared helper includes tabindex=-1 buttons when calculating tab boundaries. UI owner is fixing and verifying ordinary-dialog regression coverage.
- Combined root-carry.png revealed the pointer action button overlapping the renderer's redundant inventory badge at top-right. Renderer owner is removing only the duplicate Canvas badge; the carried sprite and semantic carry status remain.
- These are product failures, not waived by the531passing automated tests. Final same-source captures remain pending.

## Cleanup registry

- Root isolated Chrome browser/context: closed by script finally.
- Root Vite PID77952/port3023: active solely for ongoing QA, teardown pending before gate.
- Root IAB tab3 and viewport override: viewport reset and owned tab closed through CUA after interim inspection.
- Renderer/UI worker resources remain their responsibility; root does not terminate them.
