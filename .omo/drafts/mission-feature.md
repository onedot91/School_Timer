---
slug: mission-feature
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/mission-feature.md
approach: Add a class-wide auction mission list to the existing shared settings JSON, editable in the teacher auction settings panel and visible on every numbered student auction page.
---

# Draft: mission-feature

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| M1 | Mission data model normalizes persisted mission content and reward safely. | active | `.omo/notes/mission-feature-plan.md` |
| M2 | Teacher auction settings panel can create, edit, and delete missions. | active | `.omo/notes/mission-feature-plan.md` |
| M3 | Student auction page displays missions with reward in goma for each numbered student entry. | active | `.omo/notes/mission-feature-plan.md` |
| M4 | Shared settings sync persists missions through Supabase JSON and no-env fallback without a DB migration. | active | `.omo/notes/mission-feature-plan.md` |
| M5 | Browser QA proves the teacher and student surfaces. | active | `.omo/notes/mission-feature-plan.md` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
| Mission targeting | Class-wide missions visible to every student number. | User asked students can confirm missions on each numbered auction page, without specifying per-student differences. | yes |
| Mission fields | `id`, `content`, `rewardAmount`. | User required mission content and reward in goma. | yes |
| Mission lifecycle | CRUD only: create/edit/delete and display. No complete/check/payment state. | User did not ask for completion tracking or automatic currency payout. | yes |
| Persistence | Add a JSON field such as `auctionMissions` to `app_settings.value`. | Existing shared settings are stored as one JSONB value; no SQL schema change needed. | yes |
| Teacher UI location | Add a `미션` section inside the existing `경매` settings tab. | Existing auction settings already owns class currency and auction configuration. | yes |
| Student UI location | Render `오늘의 미션` between `AuctionRoom` header and weekday item grid. | Explorer found this is the most natural non-item-specific insertion point. | yes |

## Findings (cited - path:lines)
- `src/pages/TimerPage.tsx:81` defines `SettingsPanel = 'schedule' | 'subjects' | 'draw' | 'auction'`; plan should reuse `auction` rather than add a fifth tab.
- `src/pages/TimerPage.tsx:119` defines `SharedSchoolTimerSettings`; auction fields currently include `currencyBalances`, `auctionItems`, `auctionBids`, `auctionBidHistory`, and `auctionAwards`.
- `src/pages/TimerPage.tsx:1283` normalizes the shared settings object; unknown fields are ignored unless added there.
- `src/pages/TimerPage.tsx:3197` through `src/pages/TimerPage.tsx:3201` hold auction/currency state; mission state belongs near this cluster.
- `src/pages/TimerPage.tsx:3524` builds the Supabase shared settings snapshot; mission data must be included there.
- `src/pages/TimerPage.tsx:3552` applies remote shared settings; mission data must be applied there.
- `src/pages/TimerPage.tsx:3750` debounces `saveSharedSettings(buildSharedSettingsSnapshot())`; mission state must be in the dependency list.
- `src/pages/TimerPage.tsx:7215` defines `auctionSettingsPanel`; mission CRUD should be a separate section inside this panel.
- `src/pages/AuctionPage.tsx:74` loads student auction state from `app_settings.value`; mission data must be loaded with the existing auction fields.
- `src/pages/AuctionPage.tsx:318` passes props into `AuctionRoom`; mission data should flow through this boundary.
- `src/components/AuctionRoom.tsx:14` defines `AuctionRoomProps`; add a mission prop here or an explicit mission section prop.
- `src/components/AuctionRoom.tsx:60` starts the header and balance summary; mission display fits after the header and before the item grid.
- `src/lib/currency.ts:34` defines valid student numbers and `CURRENCY_UNIT_LABEL = '고마'`; reward display should use existing currency formatting.
- `supabase/app_settings.sql:1` stores shared settings in `value jsonb`; adding mission data does not require a table migration.
- `package.json` has `lint` and `build` but no committed test runner; the plan must include a focused failing-first proof plus browser QA.

## Decisions (with rationale)
- Use a new shared type in `src/lib/currency.ts` or a small new mission helper module only if needed; keep the mission model close to auction/currency to avoid a new layer.
- Store missions as an array on the shared settings JSON, likely `auctionMissions`, normalized from `unknown`.
- Reward amount is clamped to non-negative goma and displayed with `formatCurrency`.
- Empty mission content should not show as a student mission; teacher UI should either prevent empty additions or normalize them out.
- Do not add external dependencies.

## Scope IN
- Teacher can add, edit, and delete missions in the existing `경매` settings tab.
- Each mission has visible content text and reward amount in goma.
- Student auction pages for numbered entries display configured missions.
- Missions persist through existing Supabase shared settings and survive missing/old saved values.
- Agent-executed verification includes RED/GREEN proof, `npm run lint`, `npm run build`, and browser screenshots/action logs.

## Scope OUT (Must NOT have)
- No automatic reward payment to `currencyBalances`.
- No mission completion checkbox/history/status per student.
- No new Supabase table, SQL migration, or RLS policy change.
- No URL routing changes.
- No changes to auction bidding/award mechanics except reading/displaying mission data.

## Open questions
- None blocking. User may veto the defaults above before plan generation.

## Approval gate
status: awaiting-approval
pending action: write detailed todos to `.omo/plans/mission-feature.md`
approval needed: confirm the adopted defaults or specify changes
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
