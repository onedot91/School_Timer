# F3 Manual QA final audit

Verdict: **PASS** for the Manual QA Gate and the review-work QA execution lane.

Audited: 2026-07-13 Asia/Seoul, current-revision re-audit

## Revision and artifact binding

- Current identity manifest: `../task-8-apple-ui-refresh-plan/pending-run-manifest.json`
- Identity SHA-256: `23cf32a487d16df8c613fbaa00372ce3dc6fa081429ddba029252a7fa5c945b4`
- Exact-text SHA-256: `e7638181f0a50fb77e819a2e17107b1bb64b84619f74feb480cd344b7143d311`
- Full-browser manifest SHA-256: `2e0a2c1ff1528d8526d04afd45c575275dd864f4d13566e19c53847e95fdf4b3`
- Material-runtime SHA-256: `5fd94b8bc9a35b053ace1b9937a86e4a8539f5ff55630805a5a34e86dd1e4735`
- Motion-matrix SHA-256: `740fe6f81dd5a4cd1e4314107118087a0c3f57ce183e99ed1b138bc60bfdb1b9`
- Product source hashes independently match the identity manifest: `TimerPage.tsx` `a4b93399…`, `RandomDrawPage.tsx` `3e0147d1…`, and `AuctionPage.tsx` `e12a61f8…`.
- The last production-source modification included by this refresh was `TimerPage.tsx` / `RandomDrawPage.tsx` at 2026-07-13 12:00:27 Asia/Seoul. Material runtime completed at 12:03:12, exact text at 12:07:11, and the canonical PNG matrix at 12:21:08. No later production-source modification was present during this audit.
- `git diff --check`: PASS during this audit.

## Automated real-browser evidence

- Full matrix: `../task-6-apple-ui-refresh-plan/complete-current.json`, 57 states, 8 viewport/reflow configurations, 456/456 core PNGs and 9/9 supplemental PNGs; missing 0.
- Exact visible text: `../task-5-apple-ui-refresh-plan/complete-current-oracle.json`, 51 states and 357/357 records; errors 0.
- Runtime: errors 0, unexpected console errors 0, live Supabase requests 0, external question-service requests 0.
- Layout/actionability: horizontal overflow 0, interactive targets below 44px 0, active-surface clipping 0, including actual 200% browser zoom.
- Material runtime: `../task-8-apple-ui-refresh-plan/material-motion-runtime.json`; default same-node close/reopen continuity, mid-flight reversal, final focus return, and reduced-motion opacity-only behavior PASS. During the default mid-exit sample (`opacity 0.0711618`), focus remains inside, the background remains inert, and the connected surface retains `role="dialog"` plus `aria-modal="true"`; errors 0 and both local processes stopped.
- Motion/actionability: `../task-8-apple-ui-refresh-plan/motion-actionability-matrix.json`, five surfaces x six phases; all 120 geometry, presentation-value, actionable-control, and no-input-lockout predicates PASS.
- Cleanup: fake Supabase and Vite both recorded stopped; isolated Chromium closed.

## Direct in-app browser use

Root manually used the artifact through the in-app browser on isolated Vite `http://127.0.0.1:4190`, with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_YOUTUBE_API_KEY` empty:

1. Observed entry selection.
2. Clicked the hidden admin reveal exactly five times and observed the admin Timer surface.
3. Activated Settings and observed exactly one `[aria-modal="true"]`, focus inside the dialog, and an effectively inert background.
4. Pressed Escape; observed the modal close and focus return exactly to the Settings trigger.
5. Closed the tab, stopped Vite, and verified port cleanup.

The ambient `localhost:3000` tab was not controlled because the browser security policy disallowed it; the isolated local runtime is the authoritative manual-use surface. The direct receipt establishes real in-app use of the entry/admin/settings path; current-identity Chromium evidence replays those paths after the final source changes and additionally proves the final material transition, reversal, focus, and inert behavior.

## Data-safety boundary

- No currency `+/-`, bid, award, draw, save, or other mutation control was activated during direct manual use.
- Synthetic browser matrices used only isolated local fixtures.
- Canonical request audits record zero live Supabase and zero external question-service requests.
- Therefore no classroom currency, bid, award, draw history, or shared settings were used as disposable QA data.

## Independent visual review

- `../task-8-apple-ui-refresh-plan/reviewer-design-functional.json`: PASS, high confidence, identity `23cf32…`, source `2e0a2c…`, motion `740fe6…`, all 465 canonical PNGs inspected, blockers 0. Its current post-resolution finding explicitly confirms Timer and Random settings keep focus containment, inert ownership, and dialog semantics through complete exit.
- `../task-8-apple-ui-refresh-plan/reviewer-visual-cjk.json`: PASS, high confidence, identity `23cf32…`, source `2e0a2c…`, run `mrinhb4c`, all 465 canonical PNGs inspected, blockers 0; the prior CJK conflict is resolved in this current verdict.
- This audit also directly inspected representative current entry, Timer home, Settings, and all-currency mobile captures; no additional blocker was found.

## Gate decision

The direct in-app interaction proves the artifact is usable through its matching surface, while the same-revision isolated Chromium matrices cover the broader state, viewport, preference, motion, accessibility, error, and cleanup space that cannot safely be exercised against classroom data. The evidence is mutually consistent and sufficient for the Manual QA Gate. No live-data mutation was required or performed.

This PASS covers the QA/manual-use lane. Final review-work completion still requires the parent to combine it with its separate code-review and debugging-audit lanes.
