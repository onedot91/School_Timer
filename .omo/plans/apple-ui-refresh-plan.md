# apple-ui-refresh-plan - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 관리자 타이머, 학생 경매, 진입 화면, 독립 추첨 화면을 포함한 모든 유지보수 대상 UI가 하나의 차분하고 유동적인 Apple식 인터페이스로 정리됩니다. 기존 캐릭터와 따뜻한 녹색 정체성은 유지됩니다.

**Why this approach:** 기능 밀도가 높은 교실 운영 도구이므로 장식을 덜고 정보 우선순위, 시스템 타이포그래피, 즉각적인 조작 피드백, 명확한 표면 계층에 집중합니다. 1만 줄 이상의 기존 스타일은 전면 재작성하지 않고 실제 사용 영역만 안전하게 정리합니다.

**What it will NOT do:** 기능·데이터·저장 형식은 바꾸지 않습니다. 새 설명 문구, 새 라이브러리, 다크 모드, URL 라우팅은 포함하지 않습니다.

**Effort:** Large
**Risk:** Medium - 다수의 화면이 하나의 대형 TSX와 중첩된 CSS 캐스케이드에 연결되어 있습니다.
**Decisions I made for you:** 모든 유지보수 대상 화면을 포함하고, 기존 따뜻한 녹색 브랜드를 유지하며, light-only Apple식 생산성 UI로 정리합니다. 전면 CSS 재작성 대신 의미 토큰과 실제 사용 selector를 수정하고, 공통 모달·포커스·재질 동작은 재사용 가능한 primitive로 추출합니다. 자동 테스트 프레임워크 추가 없이 정적 검사와 격리된 실제 브라우저 QA를 사용합니다.

Your next move: high-accuracy review 통과 후 실행을 시작합니다. Full execution detail follows below.

---

> TL;DR (machine): Large/medium-risk full-surface Apple Design refresh across shared CSS, entry/root, auction, TimerPage, and standalone RandomDrawPage, preserving all data, behavior, and visible-copy contracts.

## Scope
### Approved product paths
- `DESIGN.md`, `src/index.css`, `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx`, `src/pages/TimerPage.tsx`, `src/pages/AuctionPage.tsx`, `src/pages/RandomDrawPage.tsx`, `src/components/AuctionRoom.tsx`, and a narrow new `src/lib/useModalFocus.ts` behavior hook.

### Must have
- Entry, root fallback, timer/admin, auction, overlays/settings, embedded draw, and standalone RandomDraw surfaces share semantic color, typography, material, spacing, radius, shadow, focus, and press tokens.
- Apple criteria: immediate press feedback, no stacked translucent surfaces, critically damped transitions, source-consistent overlay paths, and reduced motion/transparency/contrast alternatives.
- Changed interactive transitions start from the current presentation value, accept new input during motion, retarget without jumps or velocity hard-cuts, and reverse along the same path. Non-interactive draw/award choreography may remain timed but must be cancellable at safe boundaries and fully reduced under motion preferences.
- Translucent modal/sheet material arrives and leaves as one layer using synchronized compositor-only opacity/scale/filter changes; child cards stay solid to avoid stacked glass.
- Dialogs and sheets provide initial focus, trapped focus, Escape dismissal where safe, trigger focus return, and background isolation; interactive targets remain at least 44 CSS px.
- 200% text zoom, long Korean labels, low-height classroom displays, `prefers-reduced-transparency`, `prefers-contrast`, and `forced-colors` remain usable.
- Preserve five-click admin reveal, reset shortcuts, 3-second auction polling, bid confirmation, localStorage/Supabase fallback, `school-random-draw-v1`, every visible string, and all character assets.
- Responsive output at 320x568, 390x844, 768x1024, 1024x768, 1280x720, and 1440x900 without horizontal overflow, clipping, overlap, or unnatural CJK orphan lines.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No new dependency, visible explanatory copy, routing, dark mode, business/data/storage changes, or real-classroom mutation.
- Do not rewrite all of `index.css`, remove unrelated legacy rules, edit `dist/`, `tmp/`, `node_modules/`, or overwrite user-owned `.agents/` and `skills-lock.json` changes.
- Do not extract broad React Card/Button/Modal component families; only a narrow shared modal-focus behavior hook may be introduced.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none; repository has no test framework. Use `npm run lint`, `npm run build`, and browser-driven deterministic state/viewport QA.
- Evidence: .omo/evidence/task-<N>-apple-ui-refresh-plan.<ext>
- Visible-copy contract: for each fixed state and viewport, freeze date/time/randomness/network fixtures, walk visible DOM text nodes in document order, and inspect every text node's complete ancestor chain. Exclude a text node when it is under `script`, `style`, `[aria-hidden="true"]`, `.sr-only`, or any ancestor whose computed `display:none`, `visibility:hidden`, or `opacity:0`; serialize each remaining node as its exact UTF-8 `textContent` with CRLF converted to LF and no trimming/collapse. Compare the resulting JSON array byte-for-byte before/after within the same state+viewport. Zero additions, deletions, substitutions, or whitespace changes are allowed. ARIA/title changes are permitted only when they do not render.
- Isolated QA runtime: use bundled Playwright from `/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules` via `NODE_PATH`, without changing `package.json`. Generate `.omo/evidence/fixtures/fake-supabase.mjs` using existing Node/Express. It binds `127.0.0.1:54329`, handles CORS preflight, and implements the PostgREST GET/PATCH/POST shapes for `app_settings` plus GET/POST/PATCH for `announcement_notes`, with deterministic local JSON rows, method-specific delay/error switches, request logs, and no proxy/network code. Intercept `/api/question-submission-status` with a deterministic Playwright route that returns fixture-controlled loading/delay, error, empty, and submitted payloads without contacting the Vite production proxy or external question service. Start Vite with `VITE_SUPABASE_URL='http://127.0.0.1:54329' VITE_SUPABASE_ANON_KEY='qa-only-fake-key' npm run dev -- --port 4175 --host 127.0.0.1`. Launch a new Playwright Chromium context with empty storage and `page.clock.setFixedTime(...)`: use a fixed weekday for normal/locked auction paths and a fixed weekend for empty-auction behavior. Select loading/empty/locked/selected/submitting/success/error through the fixture control endpoint. Assert all requests whose path matches Supabase REST contracts target `127.0.0.1:54329`, live Supabase REST requests are zero, and external question-service requests are zero; unrelated Google Fonts/YouTube assets are outside this assertion. Close context and stop both servers. Harness files remain under `.omo/evidence` only.
- Standalone draw QA runtime: create an evidence-only Vite entry under `.omo/evidence/fixtures/` that imports `RandomDrawPage` without touching RootApp or product routing. Run it in a fresh context with deterministic localStorage and no Supabase environment. Assert it never requests a Supabase host and remove/stop the evidence runtime after capture.

## Execution strategy
### Parallel execution waves
- Wave 0: Todo 1 baseline/contracts.
- Wave 1: Todo 2 shared foundation.
- Wave 2: Todo 3 entry/root, then Todo 4 auction.
- Wave 3: Todo 5 timer home, then Todo 6 timer overlays/settings/draw. Todo 5 depends on Todo 4; same-file Timer work is strictly sequential.
- CSS ownership: Todo 2 creates one EOF block delimited by `/* APPLE THEME START */` / `/* APPLE THEME END */` with ordered subsections `FOUNDATION`, `ENTRY_ROOT`, `AUCTION`, `TIMER_HOME`, `TIMER_OVERLAYS`, `RANDOM_DRAW`, `PREFERENCES`. Todo 2 owns FOUNDATION/PREFERENCES; Todos 3-7 may edit only their named subsection, in that fixed cascade order, and must not append Apple overrides elsewhere.
- Wave 4: Todo 7 standalone RandomDraw and shared modal/focus primitive integration.
- Wave 5: Todo 8 full verification and repairs.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2-8 | none |
| 2 | 1 | 3-8 | none |
| 3 | 2 | 8 | none; owns its scoped CSS merge before Todo 4 |
| 4 | 2, 3 | 8 | none; owns its scoped CSS merge before Todo 5 |
| 5 | 2, 4 | 6-8 | none; owns TIMER_HOME after AUCTION merge |
| 6 | 5 | 7-8 | none |
| 7 | 2, 6 | 8 | none |
| 8 | 3, 4, 6, 7 | final wave | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Capture baseline and lock behavior/data contracts
  What to do / Must NOT do: Record `git status --short`, explicitly record that plan artifacts are modified while `git diff -- src` is empty, build the temporary local fake-Supabase and question-status harness described in Verification strategy, start it on 127.0.0.1:54329 and Vite on 127.0.0.1:4175, then open new ephemeral contexts with fixed clock and empty storage. Before any product edit, capture the complete state ledger enumerated in Todos 3-7 at every final viewport (320x568, 390x844, 768x1024, 1024x768, 1280x720, 1440x900) and at 200% zoom, including preference variants whenever they change rendered text. Launch the evidence-only standalone draw entry for its complete ledger. Persist the exact ordered visible-text JSON oracle per state+viewport, plus focus order/lifecycle, 44px target measurements, reflow, computed overflow, and request hosts. A missing baseline combination blocks implementation. Close contexts and stop all servers afterward. Do not open/read/write the production origin, live Supabase, external question service, or real balances/bids/history.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 2-8
  References: `AGENTS.md:66`, `src/RootApp.tsx:96`, `src/RootApp.tsx:116`, `src/pages/EntrySelectPage.tsx:15`, `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:497`, `src/pages/RandomDrawPage.tsx:76`, `src/pages/RandomDrawPage.tsx:1840`, `src/pages/RandomDrawPage.tsx:2195`.
  Acceptance criteria: evidence lists all behavior contracts and pre-change viewport captures including standalone draw; ordered visible-text snapshots exist per state; `git diff -- src` is empty before implementation; current `.omo` plan/draft modifications are recorded as allowed planning artifacts.
  QA scenarios: Browser skill across the full final viewport/state matrix; happy = every maintained surface and exact-text oracle captured, failure = missing/error state intentionally rendered through isolated local fixtures and captured. Evidence `.omo/evidence/task-1-apple-ui-refresh-plan/`.
  Commit: N

- [x] 2. Establish scoped Apple visual and accessibility foundation
  What to do / Must NOT do: In `src/index.css`, replace the stale Starbucks contract in `DESIGN.md` with the app-specific Apple contract, then add one final semantic theme layer for light surfaces/text/accent/separator/shadows, platform system font with optical sizing, regular/thick materials, restrained radii, instant `:active` transform/opacity feedback, global `:focus-visible`, and reduced motion/transparency/contrast/forced-colors fallbacks. Add a narrow `src/lib/useModalFocus.ts` hook for initial focus, Tab/Shift+Tab containment, safe Escape dismissal, exact trigger focus return, and background isolation; it must replace the lifecycle behavior in Auction, Timer, and RandomDraw dialogs without owning their visuals or visible copy. Do not rewrite all legacy CSS, use `transition: all`, stack translucent child cards, or extract broad UI component families.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3-8
  References: `src/index.css:4`, `src/index.css:304`, `src/index.css:5592`, `src/index.css:7626`, `src/index.css:7788`, `src/pages/AuctionPage.tsx:497`, `src/pages/TimerPage.tsx:9467`, `src/pages/RandomDrawPage.tsx:2195`, `.agents/skills/apple-design/SKILL.md` sections 1, 3, 4, 12, 14, 15.
  Acceptance criteria: `npm run lint` exits 0; `DESIGN.md` describes the actual School Timer Apple system rather than Starbucks; computed styles expose the semantic tokens; buttons respond on pointer-down; focus rings meet 3:1 visibility; changed interactive transitions remain enabled and reversible during motion, read current presentation values on retarget, and never use input lockout; material arrival synchronizes opacity/scale/filter on one layer; reduced preferences remove transform-heavy motion and replace glass with solid surfaces; forced colors preserve control boundaries; body text remains selectable; the shared hook has no rendered output and leaves status announcements non-focus-stealing.
  QA scenarios: Browser computed-style/evaluate checks under default and emulated media preferences; happy = tokens/feedback active, failure = transparency disabled still yields legible opaque surfaces. Evidence `.omo/evidence/task-2-apple-ui-refresh-plan.json`.
  Commit: N

- [x] 3. Refresh entry selection and root fallback
  What to do / Must NOT do: Update `EntrySelectPage.tsx`, `RootApp.tsx`, and their scoped CSS so number selection, the hidden button that reveals admin entry 0, invalid-storage recovery, and runtime fallback use the shared hierarchy and controls without adding visible copy. Preserve the hidden-button five-click reveal and platform reset shortcuts exactly.
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 8
  References: `src/pages/EntrySelectPage.tsx:5`, `src/pages/EntrySelectPage.tsx:15`, `src/pages/EntrySelectPage.tsx:31`, `src/RootApp.tsx:96`, `src/RootApp.tsx:116`, `src/RootApp.tsx:136`.
  Acceptance criteria: hidden button clicks 1-4 do not reveal entry 0 and click 5 does; entries 1-23 work; an invalid stored entry silently returns to selection; macOS/non-macOS reset shortcuts retain existing behavior; runtime fallback retains existing text/action; no horizontal overflow at target viewports.
  QA scenarios: In the ephemeral context, separately record (a) hidden button click counts 1-5, (b) `Alt+Meta+Enter` for Windows/macOS user agents and `Alt+Ctrl+Enter` for ChromeOS/other user agents, (c) invalid `school-timer-entry-number-v1` storage before first navigation returning silently to selection, and (d) runtime error fallback through an evidence-only Vite harness entry that throws without modifying product source. Confirm source diff contains no fault-injection code and ordered visible-text snapshots match baseline. Evidence `.omo/evidence/task-3-apple-ui-refresh-plan/`.
  Commit: N

- [x] 4. Refresh student auction across all asynchronous states
  What to do / Must NOT do: Update `AuctionPage.tsx`, `AuctionRoom.tsx`, and scoped auction CSS to flatten nested cards, make current state and primary bid action dominant, provide anchored confirmation material, immediate press feedback, and restrained award motion. Preserve polling, bid validation, confirmation, submission, success/error behavior and every visible string exactly; add `aria-pressed` or equivalent semantic selection state and complete modal initial-focus/trap/Escape/return lifecycle without altering workflow.
  Parallelization: Wave 2 | Blocked by: 2, 3 | Blocks: 8
  References: `src/pages/AuctionPage.tsx:94`, `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:392`, `src/pages/AuctionPage.tsx:497`, `src/pages/AuctionPage.tsx:518`, `src/components/AuctionRoom.tsx:31`, `src/index.css:211`.
  Acceptance criteria: loading/error/empty/locked/selected/confirmation/submitting/success states render distinctly; 3-second polling remains; confirm and status dialogs have unique accessible names, initial focus, Tab/Shift+Tab containment, safe Escape handling, exact trigger focus return, and inert background; status announcements do not steal focus; ordered visible-text snapshots match baseline; no real shared writes occur during QA.
  QA scenarios: Use the local fixture control endpoint to set deterministic synthetic rows and method-specific delays/errors, then use a synthetic student entry at 390x844 and 1440x900. With Playwright fixed to a weekday capture loading (delayed GET), locked, selected, confirmation, submitting (delayed PATCH), success, insufficient balance, and server error; with time fixed to a weekend capture empty behavior. Assert every Supabase REST request targets 127.0.0.1:54329 and live Supabase REST requests are zero, close the context, and stop both servers. Evidence `.omo/evidence/task-4-apple-ui-refresh-plan/`.
  Commit: N

- [x] 5. Refresh timer home and persistent utility chrome
  What to do / Must NOT do: Update the main `TimerPage` render and active CSS for the timer/watch face, schedule/control pane, status row, top actions, and bottom utility toolbar. Keep the timer as first visual priority, characters unobstructed, schedule scannable, and utilities predictable. Do not modify timer, schedule, audio, character, persistence, or Supabase logic.
  Parallelization: Wave 3 | Blocked by: 2, 4 | Blocks: 6-8
  References: the `TimerPage` render and the stable `displayTimeLeft`, `manualTimer`, and `isSettingsOpen` state symbols in `src/pages/TimerPage.tsx`; the `.timer-main-shell`, `.timer-watch`, `.editorial-schedule-board`, `.editorial-utility-button`, and `.announcement-launch-button` selectors in `src/index.css`.
  Acceptance criteria: timer digits, active schedule, empty schedule, manual timer entry, sound toggle, character artwork, and utility buttons retain behavior; controls stay 44px minimum; no overlap/clipping at target viewports or 200% zoom; existing visible copy is byte-for-byte unchanged.
  QA scenarios: Browser default and empty-schedule states, manual timer open/close, keyboard focus traversal; happy = utilities work and timer remains dominant, failure = unavailable audio/empty schedule states stay clear. Evidence `.omo/evidence/task-5-apple-ui-refresh-plan/`.
  Commit: N

- [x] 6. Refresh TimerPage overlays, settings, and embedded draw sequentially
  What to do / Must NOT do: In the same file, sequentially align every surface in this canonical ledger with one material/motion system while preserving its interaction class. **True modal stack and current reachability:** the settings dialog is the parent modal; `pendingAwardItemId` award confirmation and `pendingAuctionAction` reset/management confirmation are child modals reached only inside settings; `awardPresentation` renders inside settings when settings remains open and in its existing standalone outside-settings layer only when settings is closed. Only the top modal gets `aria-modal`, focus trap, and background isolation; opening a child saves the parent's active element, makes the parent inert/aria-hidden, Escape closes only the top safe layer, and child close restores parent isolation/focus before the parent can close. Escape is disabled only during an in-flight destructive/async commit. **Inline confirmation:** `showCopyConfirm` remains the existing inline `.confirm-box` within schedule settings and never gains modal semantics, focus trap, or background isolation. **Full-screen task overlays:** announcement notebook and memo each own one modal-like focus scope; announcement history is a non-modal child drawer, never traps or inerts its parent, Escape closes the drawer first and returns focus to its trigger. **Non-modal utility panes:** YouTube playlist/search, library, question status, and currency remain anchored parallel panes with `aria-expanded`, no focus trap/inert, Escape close where present, and trigger focus return. **Transient non-interactive layers:** notification, draw result/repeat/reset effects, and status feedback never take focus. Use symmetric source-consistent paths and preserve every field, shortcut, save action, and visible Korean label exactly. Do not create new modal/reachability combinations, modalize inline confirmation or utility panes, refactor business logic, or add explanatory text.
  Parallelization: Wave 3 | Blocked by: 5 | Blocks: 7-8
  References: `AnnouncementNotebookOverlay`, `MemoNotebookOverlay`, `isHistoryOpen`, `isAnnouncementOpen`, `isMemoOpen`, `isYoutubePanelOpen`, `isLibraryOpen`, `isCurrencyPanelOpen`, `isQuestionSubmissionPanelOpen`, `isSettingsOpen`, `pendingAuctionAction`, and `awardPresentation` in `src/pages/TimerPage.tsx`; stable CSS anchors `.settings-backdrop`, `.question-submission-panel`, `.announcement-history-overlay`, `.announcement-history-panel` in `src/index.css`.
  Acceptance criteria: every ledger surface opens/closes from its existing trigger and preserves its modal/non-modal/transient class; each true modal/full-screen task has a unique accessible name and exactly one active trapped layer; nested child close restores the parent inert/aria-hidden state and exact prior focus; non-modal panes and history drawer never trap or inert; Escape order matches the ledger and is suppressed only during in-flight destructive/async commit; settings fields remain saveable in isolated local state; embedded draw maintains all states; exact serialized visible-text arrays equal baseline.
  QA scenarios: Browser state matrix on isolated port 4175 for (a) announcement notebook default/edit/history drawer, (b) memo, (c) YouTube playlist/search/empty/error, (d) library loading/unavailable, (e) question status loading/error/empty/submitted variants, (f) currency personal/all/invalid-number/read-only result feedback without live data, (g) settings shell and subjects/auction/schedule/draw tabs, (h) inline copy confirmation without modal behavior, (i) award confirmation and reset/management confirmation inside settings, plus award presentation progress/result in its existing inside-settings and outside-settings render paths, and (j) embedded draw idle/rolling/winner/repeat/reset/empty notification layers. At 390x844 and 1440x900, test Tab/Shift+Tab, Escape layer order, exact focus return, background interaction, empty/disabled/validation states, and visible-copy equality. Do not manufacture unreachable state combinations. Use only synthetic entries, then close/finalize the QA tab and stop port 4175. Evidence `.omo/evidence/task-6-apple-ui-refresh-plan/`.
  Commit: N

- [x] 7. Refresh standalone RandomDraw and reconcile duplicated draw language
  What to do / Must NOT do: Update `RandomDrawPage.tsx` and its active CSS so the standalone stage, controls, history, case selector, settings modal, repeated-result states, and reset flow use the same tokens/material/motion language as TimerPage's embedded draw surface. Remove avoidable input-path delay by showing press/pending feedback immediately, keep fixed choreography cancellable where safe, replace decorative infinite or transform-heavy effects under reduced motion, and complete modal focus lifecycle. Preserve draw probability, queue/history behavior, audio semantics, every visible string, and `randomDraw.ts` contracts; do not add routing or visible copy.
  Parallelization: Wave 4 | Blocked by: 2, 6 | Blocks: 8
  References: `src/pages/RandomDrawPage.tsx:81`, `src/pages/RandomDrawPage.tsx:1004`, `src/pages/RandomDrawPage.tsx:1610`, `src/pages/RandomDrawPage.tsx:1840`, `src/pages/RandomDrawPage.tsx:2195`, `src/index.css:11419`, `.agents/skills/apple-design/SKILL.md` sections 1, 3, 4, 14, 15.
  Acceptance criteria: standalone and embedded draw share hierarchy, material, focus, and press behavior; press feedback begins on pointer-down; settings dialog has a unique accessible name, initial focus, Tab/Shift+Tab containment, safe Escape, inert background, and exact trigger focus return; repeated/reset/winner states preserve behavior; reduced motion uses static or short opacity feedback; ordered visible-text inventory matches baseline byte-for-byte; `school-random-draw-v1` shape and `src/lib/randomDraw.ts` are unchanged.
  QA scenarios: Use isolated deterministic fake roster/case state at 320x568, 390x844, 768x1024, 1024x768, 1280x720, and 1440x900; happy = normal draw, repeated result, case switch, reset, settings open/edit/close; failure = empty case, exhausted pool, invalid roster/range, reduced motion/transparency/contrast, 200% zoom. Capture rest/mid/settled motion and focus order. Evidence `.omo/evidence/task-7-apple-ui-refresh-plan/`.
  Commit: N

- [x] 8. Run full static, responsive, accessibility, and runtime repair loop
  What to do / Must NOT do: Run lint/build and fresh browser captures for every enumerated surface at 320x568, 390x844, 768x1024, 1024x768, 1280x720, and 1440x900, plus 200% zoom. For every changed animation capture rest, mid-transition, settled, interrupted/repeated, and reversed states. Assert zero page-level horizontal overflow, no clipped controls, no Korean orphan syllables, exact serialized visible-text equality, no console errors, complete keyboard focus lifecycle, current-value retargeting without jumps/input lockout, and correct reduced-motion/transparency/contrast/forced-colors output. Dispatch two parallel read-only visual reviews: design-system/functional and visual-fidelity/CJK. Repair only introduced issues and re-run the complete fresh capture/reviewer matrix on the same revision until both return PASS with no blockers.
  Parallelization: Wave 5 | Blocked by: 3, 4, 6, 7 | Blocks: final wave
  References: all changed files, `AGENTS.md:60`, `AGENTS.md:66`, `AGENTS.md:74`, `src/pages/AGENTS.md:34`, `omo:visual-qa` completion gate.
  Acceptance criteria: `npm run lint` and `npm run build` exit 0; every current-build capture passes independent visual review; scripted rapid open-close-open and target reversal during each changed interactive transition show continuous geometry/velocity with controls remaining actionable; exact serialized visible-text arrays equal baseline for every state+viewport; git diff is limited to approved source and `.omo/evidence` files; live data diff is empty.
  QA scenarios: Browser screenshot/DOM/console/focus/text-inventory matrix plus visual-qa scripts; happy = full matrix passes, failure = reduced motion/transparency/contrast/forced-colors and runtime fallback remain readable without motion or glass. Evidence `.omo/evidence/task-8-apple-ui-refresh-plan/`.
  Commit: N

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit: read the final diff, this plan, and evidence from Todos 1-8; use a read-only gate reviewer to map every Must have/Must NOT have and behavior contract to source and evidence. APPROVE only with no unmapped criterion. Evidence `.omo/evidence/f1-plan-compliance.md`.
- [x] F2. Code quality review: run `npm run lint`, `npm run build`, inspect the scoped diff for type suppression, business/data changes, cascade leakage, inaccessible controls, and unrelated edits; use a read-only code reviewer. APPROVE only when both commands exit 0 and no blocking finding remains. Evidence `.omo/evidence/f2-code-quality.md`.
- [x] F3. Real manual QA: start the local fake Supabase and port-4175 Vite runtime, create a fresh ephemeral browser context, fix the clock, and personally execute every entry/admin/auction/overlay/standalone-draw flow and viewport/preference matrix from Todo 8. Capture rest/mid/settled/interrupted/repeated/reversed frames for each changed animation; rapidly retarget and open-close-open while asserting continuous presentation geometry/velocity, actionable controls, and no input lockout; inspect console and request hosts. Dispatch two parallel read-only reviewers over fresh captures of every enumerated page: (A) design-system and functional behavior, (B) visual fidelity and CJK precision. If either returns REVISE/FAIL, repair and repeat the entire fresh capture plus both-reviewer pass on the same revision. APPROVE only when both return PASS with no blockers; close the context and stop both servers. Evidence `.omo/evidence/f3-manual-qa/`.
- [x] F4. Scope fidelity: compare `git status --short` and `git diff --stat` against the approved file list; verify storage keys, Supabase payloads, currency/draw logic, `src/lib/randomDraw.ts`, visible copy, `.agents/`, and `skills-lock.json` are untouched; and confirm all QA Supabase REST requests targeted only 127.0.0.1:54329 with zero live Supabase REST requests. APPROVE only with an exact scoped diff, exact serialized visible-text equality for every baseline state, and zero live-data delta. Evidence `.omo/evidence/f4-scope-fidelity.md`.

## Commit strategy

No commit during implementation unless the user separately approves Git work. Keep one scoped working-tree diff and preserve unrelated untracked files.

## Success criteria

- All maintained screens, including standalone RandomDrawPage, visibly share the Apple-derived system while preserving existing brand assets and every visible string.
- Every listed behavior/data contract is unchanged and no live classroom state is mutated.
- Static checks, build, browser interaction, modal focus lifecycle, 200% zoom, viewport matrix, preference variants, CJK inspection, console inspection, and independent visual review all pass on the same revision.
