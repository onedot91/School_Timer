# Mission Feature Planning Notepad

## Bootstrap
- Tier: HEAVY - new mission domain model crosses src/lib, teacher settings UI, student auction UI, and shared Supabase settings.
- Intent: clear - user requested a specific feature: teacher-configured missions visible on each student's auction page with mission content and reward in goma.
- review_required: false - user did not request high-accuracy/deep review.
- Skills:
  - omo:ulw-plan: named by user; planner only, no product-code edits.
  - omo:frontend: feature changes visible React UI and settings modal layout.
  - omo:programming: plan will cover TypeScript/TSX changes and strict typing constraints.
- Planning constraint: do not implement in this turn; stop at approval brief unless user approves plan-writing gate.

## Success Criteria Draft
1. Teacher can create/edit/delete missions from the existing settings modal, near auction/class currency controls.
2. Every student auction page can see the configured missions with content and reward amount in goma.
3. Shared settings persist missions via the existing Supabase/localStorage fallback path without breaking old saved settings.
4. Verification includes failing-first proof plus browser evidence for teacher settings and student auction surfaces.

## Open Decisions
- Explored facts:
  - `src/pages/TimerPage.tsx` has `SettingsPanel = 'schedule' | 'subjects' | 'draw' | 'auction'`; mission settings should be added inside the existing auction tab rather than creating a fifth tab.
  - `SharedSchoolTimerSettings` is a versioned JSON snapshot stored in `app_settings.value`; adding an `auctionMissions` field requires no SQL schema change.
  - Shared snapshot build/apply/save dependencies live around `buildSharedSettingsSnapshot`, `applySharedSettingsSnapshot`, and the debounced `saveSharedSettings` effect in `TimerPage.tsx`.
  - Student pages poll `loadSharedSettingsRow()` in `AuctionPage.tsx` and currently pull `currencyBalances`, `auctionItems`, `auctionBids`, `auctionBidHistory`, `auctionAwards`.
  - `AuctionRoom` owns the visible student auction layout and can receive mission content as a prop or render adjacent to its footer.
  - No committed test runner exists; verification must add a focused failing-first proof or use a real-surface RED where no seam exists, then browser QA.
- Adopted defaults unless user changes scope:
  - Missions are class-wide/global and visible on every numbered student auction page.
  - Mission fields: stable id, content text, reward amount in goma.
  - No completion tracking or automatic reward payout in this feature; it only configures and displays mission/reward.
  - Keep data in existing `app_settings.value` JSON; no Supabase SQL migration.
  - Use existing auction tab in the teacher settings modal and add a mission section below/near auction management.
