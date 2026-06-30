# mission-feature - Work Plan

## TL;DR (For humans)
**What you'll get:** 교사가 설정 창의 경매 탭에서 미션을 추가, 수정, 삭제할 수 있고, 학생 경매 화면에는 미션 내용과 보상 고마가 함께 보입니다.

**Why this approach:** 기존 앱은 학급 설정을 Supabase의 한 JSON 값으로 공유하므로, 미션도 같은 공유 설정에 넣는 방식이 가장 작고 안전합니다. 학생 화면은 이미 경매 요약을 보여주는 영역이 있어서 그 아래에 미션을 배치합니다.

**What it will NOT do:** 미션 완료 체크, 학생별 완료 기록, 학생 확인 버튼, 자동 보상 지급은 만들지 않습니다. Supabase 테이블이나 SQL 정책도 바꾸지 않습니다.

**Effort:** Medium
**Risk:** Medium - 대형 `TimerPage.tsx`의 공유 설정 저장/복원 흐름과 학생 경매 UI를 함께 건드립니다.
**Decisions to sanity-check:** 미션은 학급 공통 목록이며 모든 학생에게 동일하게 보입니다. “확인”은 완료 처리 없이 화면에서 볼 수 있다는 뜻으로 계획합니다. 보상은 표시용 고마 금액이며 자동 지급되지 않습니다.

Your next move: `$start-work` already authorized execution. Full execution detail follows below.

---

> TL;DR (machine): Medium-risk cross-surface feature: shared mission model + teacher CRUD + student display + browser QA.

## Scope
### Must have
- Add a mission data model with `id`, `content`, and `rewardAmount`.
- Normalize unknown persisted mission data so stale or malformed saved settings cannot break the app.
- Store missions in existing shared settings JSON, using a field named `auctionMissions`.
- Persist missions locally with a dedicated localStorage fallback key so no-Supabase mode can still show teacher-configured missions in the same browser.
- Add teacher CRUD UI inside the existing `설정 > 경매` panel.
- Display configured missions on each numbered student auction page with reward formatted in `고마`.
- Preserve current auction bidding, award, item, and balance behavior.
- Preserve no-env fallback behavior. The app must still run without Supabase env vars.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No automatic reward payout to `currencyBalances`.
- No mission completion state, per-student checklist, history, or status.
- No student “confirm/complete” button; student pages view mission information only.
- No new Supabase table, SQL migration, or RLS policy change.
- No URL routing changes.
- No new runtime dependency.
- Do not edit `dist/`, `tmp/` screenshots, or generated assets except temporary QA artifacts under `.omo/evidence/`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD where a seam exists. Use a temporary `npx tsx` proof script for mission normalization before production changes; remove or leave only under `.omo/evidence/`, not source.
- Automated evidence:
  - `npx tsx .omo/evidence/mission-feature/mission-normalization-proof.ts`
  - `npm run lint`
  - `npm run build`
- Browser evidence:
  - Start app with `npm run dev -- --host=127.0.0.1 --port=3000`.
  - Browser action sequence: open `http://127.0.0.1:3000`, choose teacher entry `0`, open settings, open `경매`, add mission content `책상 정리하기`, set reward `25`, confirm it appears in settings; then switch/reset to student entry `1` and confirm `책상 정리하기` and `25 고마` appear on the auction page.
  - Browser negative sequence: delete the mission in `설정 > 경매`, switch/reset to student entry `1`, confirm the mission text no longer appears and no blank mission card remains.
  - Evidence paths:
    - `.omo/evidence/mission-feature/teacher-mission-settings.png`
    - `.omo/evidence/mission-feature/student-mission-display.png`
    - `.omo/evidence/mission-feature/browser-action-log.md`

## Execution strategy
### Parallel execution waves
- Wave 1: one implementation worker owns all product files because the change shares `TimerPage.tsx`, `AuctionPage.tsx`, `AuctionRoom.tsx`, and the mission model.
- Wave 2: independent verifier/reviewer agents inspect the implementation, run commands, and drive browser QA.
- Wave 3: final verification wave checks plan compliance, code quality, real manual QA, and scope fidelity.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4 | none |
| 2 | 1 | 3, 4 | none |
| 3 | 2 | 4 | none |
| 4 | 3 | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Add mission model and shared-settings persistence
  What to do / Must NOT do: Add strict mission types and normalization helpers, then wire `auctionMissions` through `SharedSchoolTimerSettings`, `normalizeSharedSchoolTimerSettings`, `buildSharedSettingsSnapshot`, `applySharedSettingsSnapshot`, the shared-save dependency list, and a no-Supabase localStorage fallback. Must not add a SQL migration or new dependency.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3, 4
  References (executor has NO interview context - be exhaustive): `src/lib/currency.ts:1`, `src/lib/currency.ts:34`, `src/lib/currency.ts:36`, `src/lib/currency.ts:111`, `src/lib/currency.ts:128`, `src/pages/TimerPage.tsx:119`, `src/pages/TimerPage.tsx:1283`, `src/pages/TimerPage.tsx:3197`, `src/pages/TimerPage.tsx:3524`, `src/pages/TimerPage.tsx:3552`, `src/pages/TimerPage.tsx:3750`, `src/pages/AuctionPage.tsx:74`, `src/lib/supabaseSettings.ts:31`, `supabase/app_settings.sql:1`.
  Acceptance criteria (agent-executable): RED first: create `.omo/evidence/mission-feature/mission-normalization-proof.ts` importing the not-yet-implemented helper and run `npx tsx .omo/evidence/mission-feature/mission-normalization-proof.ts`; capture failure due missing mission normalization. GREEN: after implementation, the same command exits 0 and proves malformed missions are dropped/clamped, valid content is trimmed to the chosen limit, reward is an integer clamped to `0..CURRENCY_BALANCE_MAX`, missing/duplicate ids are replaced with stable unique `mission-*` ids, and output order is preserved for valid entries.
  QA scenarios (name the exact tool + invocation): Auxiliary CLI proof: `npx tsx .omo/evidence/mission-feature/mission-normalization-proof.ts`; PASS if stdout includes `mission normalization proof passed`. Failure probe: feed empty content, negative reward, huge reward, duplicate/missing ids, non-array payload; PASS if invalid content is omitted, rewards are clamped, ids are unique, and non-array returns an empty list. Evidence `.omo/evidence/mission-feature/mission-normalization-proof.log`.
  Commit: N | `feat(missions): add shared mission model`

- [x] 2. Add teacher mission CRUD to the auction settings panel
  What to do / Must NOT do: In `src/pages/TimerPage.tsx`, add mission state handlers and a `미션` section inside the existing `auctionSettingsPanel`, between `물품 설정 및 현황` and `경매 관리`. Support add, edit content, edit reward amount, delete. Preserve missions when `물품 초기화`, `입찰가 초기화`, or `보유 화폐 초기화` are used. Keep UI consistent with existing rounded classroom auction settings cards. Must not create a fifth settings tab.
  Parallelization: Wave 1, after Todo 1 | Blocked by: 1 | Blocks: 3, 4
  References (executor has NO interview context - be exhaustive): `src/pages/TimerPage.tsx:2` for icons, `src/pages/TimerPage.tsx:3197`, `src/pages/TimerPage.tsx:3331`, `src/pages/TimerPage.tsx:5428`, `src/pages/TimerPage.tsx:7215`, `src/pages/TimerPage.tsx:7441`, `src/pages/TimerPage.tsx:8595`, `src/pages/AGENTS.md`, `DESIGN.md`, `src/index.css:1`.
  Acceptance criteria (agent-executable): `npm run lint` exits 0 after teacher UI changes. Static check confirms settings tab labels remain `시간표`, `과목`, `추첨`, `경매` and there is no new `SettingsPanel` variant. Reset buttons do not clear `auctionMissions`.
  QA scenarios (name the exact tool + invocation): Browser use via worker-controlled Playwright or in-app browser: open `http://127.0.0.1:3000`, click entry `0`, click settings button, click `경매`, click `미션 추가`, type `책상 정리하기`, set reward `25`; PASS if the settings panel visibly shows one mission with content `책상 정리하기` and `25 고마`. Failure probe: create a blank mission then leave the field empty; PASS if blank content is not displayed as a student mission. Evidence `.omo/evidence/mission-feature/teacher-mission-settings.png` and `.omo/evidence/mission-feature/browser-action-log.md`.
  Commit: N | `feat(missions): add teacher mission settings`

- [x] 3. Display missions on numbered student auction pages
  What to do / Must NOT do: Load `auctionMissions` in `AuctionPage` from Supabase when enabled and from the no-Supabase localStorage fallback otherwise, pass it to `AuctionRoom` through a new explicit prop/slot, and render a `오늘의 미션` section between the header/balance summary and weekday auction grid. Empty mission list should not crowd the auction page; render no mission section when there are no valid missions. Must not change bidding or reserved-balance logic.
  Parallelization: Wave 1, after Todo 2 | Blocked by: 2 | Blocks: 4
  References (executor has NO interview context - be exhaustive): `src/pages/AuctionPage.tsx:37`, `src/pages/AuctionPage.tsx:74`, `src/pages/AuctionPage.tsx:318`, `src/components/AuctionRoom.tsx:14`, `src/components/AuctionRoom.tsx:60`, `src/components/AuctionRoom.tsx:152`, `src/lib/currency.ts:111`, `src/pages/AGENTS.md`, `AGENTS.md`.
  Acceptance criteria (agent-executable): `npm run lint` exits 0 and `npm run build` exits 0. Static/DOM check confirms the mission section displays content and formatted reward when `auctionMissions` exists, and is absent when the list is empty.
  QA scenarios (name the exact tool + invocation): Browser use via worker-controlled Playwright or in-app browser: after Todo 2 creates `책상 정리하기 / 25 고마`, reset entry selection using the app shortcut or localStorage, select student `1`; PASS if auction page contains `오늘의 미션`, `책상 정리하기`, and `25 고마`, with no student completion button. Failure probe: with `auctionMissions: []`, PASS if no broken blank mission card appears. Evidence `.omo/evidence/mission-feature/student-mission-display.png`.
  Commit: N | `feat(missions): show missions on student auction`

- [x] 4. Run integrated verification and cleanup
  What to do / Must NOT do: Run the full command set and browser QA, capture evidence, clean up dev server/browser processes and temporary proof artifacts that should not remain in source. Must not claim success from logs without screenshots/action logs.
  Parallelization: Wave 2, after Todo 3 | Blocked by: 3 | Blocks: final verification
  References (executor has NO interview context - be exhaustive): `.omo/plans/mission-feature.md`, `package.json`, `AGENTS.md`, `src/pages/AGENTS.md`, `src/lib/AGENTS.md`.
  Acceptance criteria (agent-executable): `npx tsx .omo/evidence/mission-feature/mission-normalization-proof.ts`, `npm run lint`, and `npm run build` all exit 0; browser QA screenshots exist; cleanup receipt names stopped process ids or confirms no dev server remains.
  QA scenarios (name the exact tool + invocation): Command sequence: `npm run dev -- --host=127.0.0.1 --port=3000` in a controlled background process, browser open `http://127.0.0.1:3000`, perform teacher/student mission scenario above at desktop width and one mobile width; PASS if both screenshots contain expected text and no visible text overlap. Cleanup: stop the dev server PID and record `lsof -iTCP:3000 -sTCP:LISTEN` result. Evidence `.omo/evidence/mission-feature/final-command-log.txt`, `.omo/evidence/mission-feature/cleanup.md`.
  Commit: N | `test(missions): verify mission feature`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Scope fidelity

## Commit strategy
- Do not commit unless the user explicitly asks.
- Suggested final commit if requested: `feat(missions): add classroom auction missions`.
- Keep `.omo/` evidence and plan state separate from product changes unless the user wants those committed.

## Success criteria
- Teacher can create, edit, and delete mission content and reward from `설정 > 경매`.
- Student entry `1..23` auction page displays configured missions with reward in `고마`.
- No student completion or reward-claim action exists.
- Existing auction bid, award, item, balance, and no-Supabase fallback behavior remains intact.
- `npx tsx .omo/evidence/mission-feature/mission-normalization-proof.ts`, `npm run lint`, and `npm run build` pass.
- Browser evidence captures both teacher settings and student auction mission display.
