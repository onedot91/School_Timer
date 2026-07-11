# apple-ui-refresh-plan - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 현재 앱에서 실제로 접근 가능한 관리자 타이머, 학생 경매, 진입 화면 전체가 하나의 차분하고 유동적인 Apple식 인터페이스로 정리됩니다. 기존 캐릭터와 따뜻한 녹색 정체성은 유지됩니다.

**Why this approach:** 기능 밀도가 높은 교실 운영 도구이므로 장식을 덜고 정보 우선순위, 시스템 타이포그래피, 즉각적인 조작 피드백, 명확한 표면 계층에 집중합니다. 1만 줄 이상의 기존 스타일은 전면 재작성하지 않고 실제 사용 영역만 안전하게 정리합니다.

**What it will NOT do:** 기능·데이터·저장 형식은 바꾸지 않습니다. 새 설명 문구, 새 라이브러리, 다크 모드, 연결되지 않은 독립 추첨 화면 리디자인은 포함하지 않습니다.

**Effort:** Large
**Risk:** Medium - 다수의 화면이 하나의 대형 TSX와 중첩된 CSS 캐스케이드에 연결되어 있습니다.
**Decisions I made for you:** 현재 진입 가능한 화면만 대상으로 삼고, 기존 따뜻한 녹색 브랜드를 유지하며, light-only Apple식 생산성 UI로 정리합니다. 전면 CSS 재작성 대신 의미 토큰과 실제 사용 selector만 수정하고, 자동 테스트 프레임워크 추가 없이 정적 검사와 실제 브라우저 QA를 사용합니다.

Your next move: high-accuracy review 통과 후 실행을 시작합니다. Full execution detail follows below.

---

> TL;DR (machine): Large/medium-risk reachable-screen Apple Design refresh across shared CSS, entry/root, auction, and TimerPage, preserving all data and behavior contracts.

## Scope
### Must have
- Reachable entry, root fallback, timer/admin, auction, overlays/settings, and embedded draw surfaces share semantic color, typography, material, spacing, radius, shadow, focus, and press tokens.
- Apple criteria: immediate press feedback, no stacked translucent surfaces, critically damped transitions, source-consistent overlay paths, and reduced motion/transparency/contrast alternatives.
- Preserve five-click admin reveal, reset shortcuts, 3-second auction polling, bid confirmation, localStorage/Supabase fallback, all Korean visible copy, and all character assets.
- Responsive output at 390x844, 768x1024, 1024x768, and 1440x900 without horizontal overflow, clipping, overlap, or unnatural CJK orphan lines.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- No new dependency, visible explanatory copy, routing, dark mode, business/data/storage changes, real-classroom mutation, or redesign of unreachable `RandomDrawPage.tsx`.
- Do not rewrite all of `index.css`, remove unrelated legacy rules, edit `dist/`, `tmp/`, `node_modules/`, or overwrite user-owned `.agents/` and `skills-lock.json` changes.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none; repository has no test framework. Use `npm run lint`, `npm run build`, and browser-driven deterministic state/viewport QA.
- Evidence: .omo/evidence/task-<N>-apple-ui-refresh-plan.<ext>
- Isolated QA runtime: use bundled Playwright from `/Users/ibyeonghyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules` via `NODE_PATH`, without changing `package.json`. Generate `.omo/evidence/fixtures/fake-supabase.mjs` using existing Node/Express. It binds `127.0.0.1:54329`, handles CORS preflight, and implements the PostgREST GET/PATCH/POST shapes for `app_settings` plus GET/POST/PATCH for `announcement_notes`, with deterministic local JSON rows, method-specific delay/error switches, request logs, and no proxy/network code. Start Vite with `VITE_SUPABASE_URL='http://127.0.0.1:54329' VITE_SUPABASE_ANON_KEY='qa-only-fake-key' npm run dev -- --port 4175 --host 127.0.0.1`. Launch a new Playwright Chromium context with empty storage and `page.clock.setFixedTime(...)`: use a fixed weekday for normal/locked auction paths and a fixed weekend for empty-auction behavior. Select loading/empty/locked/selected/submitting/success/error through the fixture control endpoint. Assert all requests whose path matches Supabase REST contracts target `127.0.0.1:54329` and live Supabase REST requests are zero; unrelated Google Fonts/YouTube assets are outside this assertion. Close context and stop both servers. Harness files remain under `.omo/evidence` only.

## Execution strategy
### Parallel execution waves
- Wave 0: Todo 1 baseline/contracts.
- Wave 1: Todo 2 shared foundation, then Todo 3 entry/root.
- Wave 2: Todo 4 auction.
- Wave 3: Todo 5 timer home, then Todo 6 timer overlays/settings/draw. Same-file Timer work is strictly sequential.
- Wave 4: Todo 7 full verification and repairs.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2-7 | none |
| 2 | 1 | 3-7 | none |
| 3 | 2 | 7 | 4 after Todo 2 |
| 4 | 2 | 7 | 3 |
| 5 | 2 | 6-7 | 3, 4 |
| 6 | 5 | 7 | 3, 4 |
| 7 | 3, 4, 6 | final wave | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Capture baseline and lock behavior/data contracts
  What to do / Must NOT do: Record `git status --short`, build the temporary local fake-Supabase harness described in Verification strategy, start it on 127.0.0.1:54329 and Vite on 127.0.0.1:4175, then open a new ephemeral Playwright context with fixed clock and empty storage. Load synthetic settings/balances/auction rows through the fixture control endpoint and capture entry, admin home, auction loading/empty/selected/confirmation states; record visible text counts, computed overflow, and request hosts. Close the context and stop both servers afterward. Do not open/read/write the production origin, live Supabase, or real balances/bids/history.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 2-7
  References: `AGENTS.md:66`, `src/RootApp.tsx:96`, `src/RootApp.tsx:116`, `src/pages/EntrySelectPage.tsx:15`, `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:497`.
  Acceptance criteria: evidence lists all behavior contracts and pre-change viewport captures; `git diff -- src` is empty before implementation.
  QA scenarios: Browser skill at 1440x900 and 390x844; happy = each reachable surface captured, failure = missing/error state intentionally rendered through isolated local fixture and captured. Evidence `.omo/evidence/task-1-apple-ui-refresh-plan/`.
  Commit: N

- [ ] 2. Establish scoped Apple visual and accessibility foundation
  What to do / Must NOT do: In `src/index.css`, add semantic light-surface/text/accent/separator/shadow tokens, platform system font stack, consistent 8px-or-less card radii where practical, instant `:active` transform/opacity feedback, `:focus-visible`, and reduced motion/transparency/contrast fallbacks. Restrict edits to active shared selectors and a final scoped theme layer; do not globally rewrite legacy animation logic or stack translucent child cards.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3-7
  References: `src/index.css:4`, `src/index.css:304`, `src/index.css:5592`, `src/index.css:7626`, `src/index.css:7788`, `.agents/skills/apple-design/SKILL.md` sections 1, 3, 4, 12, 14, 15.
  Acceptance criteria: `npm run lint` exits 0; computed styles expose the semantic tokens; buttons respond on pointer-down; focus rings are visible; reduced preferences remove transform-heavy motion and replace glass with solid surfaces.
  QA scenarios: Browser computed-style/evaluate checks under default and emulated media preferences; happy = tokens/feedback active, failure = transparency disabled still yields legible opaque surfaces. Evidence `.omo/evidence/task-2-apple-ui-refresh-plan.json`.
  Commit: N

- [ ] 3. Refresh entry selection and root fallback
  What to do / Must NOT do: Update `EntrySelectPage.tsx`, `RootApp.tsx`, and their scoped CSS so number selection, the hidden button that reveals admin entry 0, invalid-storage recovery, and runtime fallback use the shared hierarchy and controls without adding visible copy. Preserve the hidden-button five-click reveal and platform reset shortcuts exactly.
  Parallelization: Wave 1 | Blocked by: 2 | Blocks: 7
  References: `src/pages/EntrySelectPage.tsx:5`, `src/pages/EntrySelectPage.tsx:15`, `src/pages/EntrySelectPage.tsx:31`, `src/RootApp.tsx:96`, `src/RootApp.tsx:116`, `src/RootApp.tsx:136`.
  Acceptance criteria: hidden button clicks 1-4 do not reveal entry 0 and click 5 does; entries 1-23 work; an invalid stored entry silently returns to selection; macOS/non-macOS reset shortcuts retain existing behavior; runtime fallback retains existing text/action; no horizontal overflow at target viewports.
  QA scenarios: In the ephemeral context, separately record (a) hidden button click counts 1-5, (b) `Alt+Meta+Enter` for Windows/macOS user agents and `Alt+Ctrl+Enter` for ChromeOS/other user agents, (c) invalid `school-timer-entry-number-v1` storage before first navigation returning silently to selection, and (d) runtime error fallback by enabling a temporary QA-only component substitution, capturing the active fault screen, then removing the substitution and confirming the normal screen before final diff. Confirm source diff contains no fault-injection code. Evidence `.omo/evidence/task-3-apple-ui-refresh-plan/`.
  Commit: N

- [ ] 4. Refresh student auction across all asynchronous states
  What to do / Must NOT do: Update `AuctionPage.tsx`, `AuctionRoom.tsx`, and scoped auction CSS to flatten nested cards, make current state and primary bid action dominant, provide anchored confirmation material, immediate press feedback, and restrained award motion. Preserve polling, bid validation, confirmation, submission, success/error behavior and all visible copy; improve modal focus/Escape/return only without altering workflow.
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 7
  References: `src/pages/AuctionPage.tsx:94`, `src/pages/AuctionPage.tsx:133`, `src/pages/AuctionPage.tsx:392`, `src/pages/AuctionPage.tsx:497`, `src/pages/AuctionPage.tsx:518`, `src/components/AuctionRoom.tsx:31`, `src/index.css:211`.
  Acceptance criteria: loading/error/empty/locked/selected/confirmation/submitting/success states render distinctly; 3-second polling remains; confirm modal traps/returns focus and closes by Escape; no real shared writes occur during QA.
  QA scenarios: Use the local fixture control endpoint to set deterministic synthetic rows and method-specific delays/errors, then use a synthetic student entry at 390x844 and 1440x900. With Playwright fixed to a weekday capture loading (delayed GET), locked, selected, confirmation, submitting (delayed PATCH), success, insufficient balance, and server error; with time fixed to a weekend capture empty behavior. Assert every Supabase REST request targets 127.0.0.1:54329 and live Supabase REST requests are zero, close the context, and stop both servers. Evidence `.omo/evidence/task-4-apple-ui-refresh-plan/`.
  Commit: N

- [ ] 5. Refresh timer home and persistent utility chrome
  What to do / Must NOT do: Update the main `TimerPage` render and active CSS for the timer/watch face, schedule/control pane, status row, top actions, and bottom utility toolbar. Keep the timer as first visual priority, characters unobstructed, schedule scannable, and utilities predictable. Do not modify timer, schedule, audio, character, persistence, or Supabase logic.
  Parallelization: Wave 3 | Blocked by: 2 | Blocks: 6-7
  References: `src/pages/TimerPage.tsx:3255`, `src/pages/TimerPage.tsx:3328`, `src/pages/TimerPage.tsx:4337`, `src/pages/TimerPage.tsx:4395`, `src/index.css:6411`, `src/index.css:6503`.
  Acceptance criteria: timer digits, active schedule, empty schedule, manual timer entry, sound toggle, character artwork, and utility buttons retain behavior; no overlap/clipping at target viewports; existing visible copy unchanged.
  QA scenarios: Browser default and empty-schedule states, manual timer open/close, keyboard focus traversal; happy = utilities work and timer remains dominant, failure = unavailable audio/empty schedule states stay clear. Evidence `.omo/evidence/task-5-apple-ui-refresh-plan/`.
  Commit: N

- [ ] 6. Refresh TimerPage overlays, settings, and embedded draw sequentially
  What to do / Must NOT do: In the same file, sequentially align announcement notebook, memo, YouTube/library/question/currency panels, settings, schedule editor, auction admin, and embedded random draw with one overlay/material system. Keep each overlay anchored to its trigger, use symmetric enter/exit paths, preserve every field, shortcut, save action, and Korean label. Do not refactor business logic or redesign standalone `RandomDrawPage.tsx`.
  Parallelization: Wave 3 | Blocked by: 5 | Blocks: 7
  References: `src/pages/TimerPage.tsx:1566`, `src/pages/TimerPage.tsx:1791`, `src/pages/TimerPage.tsx:2666`, `src/pages/TimerPage.tsx:2924`, `src/pages/TimerPage.tsx:4475`, `src/pages/TimerPage.tsx:5209`, `src/index.css:3156`, `src/index.css:3480`.
  Acceptance criteria: every reachable overlay opens/closes from its existing trigger; Escape and close controls work; settings fields remain saveable in isolated local state; embedded draw maintains all states; no new visible text appears.
  QA scenarios: Browser state matrix on isolated port 4175 for each overlay at 390x844 and 1440x900; happy = open/edit/save/close through existing controls, failure = empty/disabled/validation states remain usable and non-overlapping. Use only synthetic entries, then close/finalize the QA tab and stop port 4175. Evidence `.omo/evidence/task-6-apple-ui-refresh-plan/`.
  Commit: N

- [ ] 7. Run full static, responsive, accessibility, and runtime repair loop
  What to do / Must NOT do: Run lint/build and fresh browser captures for every enumerated surface at 390x844, 768x1024, 1024x768, 1440x900. For every changed animation capture rest, mid-transition, and settled states. Assert zero page-level horizontal overflow, no clipped controls, no Korean orphan syllables, preserved visible text, no console errors, and correct reduced preference output. Dispatch two parallel read-only visual reviews: design-system/functional and visual-fidelity/CJK. Repair only introduced issues and re-run the complete fresh capture/reviewer matrix on the same revision until both return PASS with no blockers.
  Parallelization: Wave 4 | Blocked by: 3, 4, 6 | Blocks: final wave
  References: all changed files, `AGENTS.md:60`, `AGENTS.md:66`, `AGENTS.md:74`, `src/pages/AGENTS.md:34`, `omo:visual-qa` completion gate.
  Acceptance criteria: `npm run lint` and `npm run build` exit 0; every current-build capture passes independent visual review; git diff is limited to approved source and `.omo/evidence` files; live data diff is empty.
  QA scenarios: Browser screenshot/DOM/console matrix plus visual-qa scripts; happy = full matrix passes, failure = reduced motion/transparency/contrast and runtime fallback remain readable without motion or glass. Evidence `.omo/evidence/task-7-apple-ui-refresh-plan/`.
  Commit: N

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit: read the final diff, this plan, and evidence from Todos 1-7; use a read-only gate reviewer to map every Must have/Must NOT have and behavior contract to source and evidence. APPROVE only with no unmapped criterion. Evidence `.omo/evidence/f1-plan-compliance.md`.
- [ ] F2. Code quality review: run `npm run lint`, `npm run build`, inspect the scoped diff for type suppression, business/data changes, cascade leakage, inaccessible controls, and unrelated edits; use a read-only code reviewer. APPROVE only when both commands exit 0 and no blocking finding remains. Evidence `.omo/evidence/f2-code-quality.md`.
- [ ] F3. Real manual QA: start the local fake Supabase and port-4175 Vite runtime, create a fresh ephemeral browser context, fix the clock, and personally execute every entry/admin/auction/overlay flow and viewport/preference matrix from Todo 7. Capture rest/mid/settled frames for each changed animation and inspect console/request hosts. Dispatch two parallel read-only reviewers over fresh captures of every enumerated page: (A) design-system and functional behavior, (B) visual fidelity and CJK precision. If either returns REVISE/FAIL, repair and repeat the entire fresh capture plus both-reviewer pass on the same revision. APPROVE only when both return PASS with no blockers; close the context and stop both servers. Evidence `.omo/evidence/f3-manual-qa/`.
- [ ] F4. Scope fidelity: compare `git status --short` and `git diff --stat` against the approved file list, verify `RandomDrawPage.tsx`, storage keys, Supabase payloads, currency/draw logic, visible copy, `.agents/`, and `skills-lock.json` are untouched, and confirm all QA Supabase REST requests targeted only 127.0.0.1:54329 with zero live Supabase REST requests. APPROVE only with an exact scoped diff and zero live-data delta. Evidence `.omo/evidence/f4-scope-fidelity.md`.

## Commit strategy

No commit during implementation unless the user separately approves Git work. Keep one scoped working-tree diff and preserve unrelated untracked files.

## Success criteria

- All reachable screens visibly share the Apple-derived system while preserving existing brand assets and visible copy.
- Every listed behavior/data contract is unchanged and no live classroom state is mutated.
- Static checks, build, browser interaction, viewport matrix, preference variants, CJK inspection, console inspection, and independent visual review all pass on the same revision.
