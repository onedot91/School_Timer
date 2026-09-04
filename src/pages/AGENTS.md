# PAGES KNOWLEDGE BASE

## OVERVIEW

교사 운영 화면, 학생 허브, 입장 선택, 독립 추첨 화면을 보유한다. 실제 파일은 4개이며 다섯 번째 페이지 수준 상태 경계는 상위 `src/RootApp.tsx`이다.

## STRUCTURE

| Surface | File | State ownership |
|---------|------|-----------------|
| App/session shell | `../RootApp.tsx` | Entry number, device session, runtime fallback, lazy page selection |
| Entry selection | `EntrySelectPage.tsx` | Teacher-entry reveal, registration dialog, focus trap |
| Teacher console | `TimerPage.tsx` | Timer, schedule, settings, notices, draw, auction/economy administration |
| Student hub | `AuctionPage.tsx` | Hash-based student views, auction, missions, emotions, mailbox, store/economy |
| Standalone draw | `RandomDrawPage.tsx` | Local draw cases, history, roster, hidden queue, animation/audio lifecycle |

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Entry routing or registration | `../RootApp.tsx`, `EntrySelectPage.tsx` | `0` is teacher; `1..23` are students; RootApp persists selection |
| Teacher settings navigation | `TimerPage.tsx` `SETTINGS_NAVIGATION_GROUPS` | Ordering has source-inspection tests in `src/lib` |
| Shared classroom snapshot | `TimerPage.tsx` `buildSharedSettingsSnapshot`, `applySharedSettingsSnapshot` | Hydration, debounced save, polling, pending-save guards are coupled |
| Student refresh | `AuctionPage.tsx` `applySharedSettingsValue`, `refreshAuctionState` | Uses `updated_at`, per-student cached snapshot, view-dependent polling |
| Auction rendering | `AuctionPage.tsx`, `../components/AuctionRoom.tsx` | Page owns persistence and validation; component owns room presentation |
| Draw behavior | `TimerPage.tsx`, `../lib/randomDraw.ts` | Active teacher draw uses shared library helpers |
| Legacy standalone draw | `RandomDrawPage.tsx` | Duplicates draw state logic and is not mounted by `RootApp` |

## SHARED STATE COUPLING

- `TimerPage` and `AuctionPage` both read and mutate the single shared settings value through `supabaseSettings.ts`.
- Preserve unrelated fields inside every `updateSharedSettings(currentValue => nextValue)` callback; replacing the whole value can erase concurrent domains.
- Keep `updated_at` comparisons, cache invalidation, in-flight guards, and pending-save refs aligned when changing refresh behavior.
- Supabase-disabled behavior still depends on local snapshots from `studentPet`, `studentLife`, `studentEconomy`, and feature-specific storage helpers.
- Normalize persisted or remote values at the existing library boundary before applying them to page state.
- `TimerPage` is a cross-domain integration hotspot; move pure business rules into an existing `src/lib` module only when the same rule is shared or independently testable.

## PAGE CONVENTIONS

- `RootApp` statically imports the small entry page and lazy-loads `TimerPage` and `AuctionPage`; preserve this split.
- Student navigation is hash-based, not React Router. Add a `StudentView`, hash mapping, section mapping, render branch, and refresh policy together.
- Browser listeners, intervals, timeouts, animation frames, and audio objects must retain symmetric cleanup in effects.
- Dialog changes must preserve focus capture, Escape handling, focus return, and `inert` behavior already used by these pages.
- User-facing text stays Korean; storage keys and legacy migrations are compatibility contracts.

## SAFE PAGE QA

- For layout-affecting edits, observe the latest code at exactly `1280x800`; check clipping, overlap, unintended scroll, first-screen fit, keyboard focus, and text zoom safety.
- Treat bids, balances, awards, donations, rewards, stock actions, letters, and shared settings as live data. Do not click their mutation controls against the real profile.
- Exercise mutation flows only with mocks, isolated fake state, or a disposable local-only browser profile; reversing a live action is not restoration.
- Entry registration can alter the device session. Use an existing disposable session or code-level checks for registration behavior.
- Standalone draw actions mutate `school-random-draw-v1`; isolate browser storage before testing draw, reset, delete, or hidden-queue controls.
- Start with the matching source-contract test, such as `entrySelectPresentation.test.ts`, `routeCodeSplitting.test.ts`, `auctionRefreshResilience.test.ts`, `settingsNavigationOrder.test.ts`, or `randomDrawShortcut.test.ts`.

## ANTI-PATTERNS

- Do not add a second shared-settings writer that bypasses `updateSharedSettings` merge semantics.
- Do not derive student balances or bid eligibility from stale React state after an async refresh; use the latest normalized snapshot.
- Do not make `RandomDrawPage.tsx` the active draw implementation without reconciling its duplicated state model with `TimerPage` and `src/lib/randomDraw.ts`.
- Do not validate page changes by mutating classroom production data.
