# Profile shop functional gate re-review

## recommendation

APPROVE

## blockers

None.

## originalIntent

Remove daily profile rotation, persist a fixed profile per student, show all 50 profiles in the item shop, make another student's active profile unavailable and grayscale, and reject concurrent duplicate claims.

## desiredOutcome

Students retain their selected profile until changing it. The shop exposes every profile, clearly separates current/occupied/free states, and never allows two students to successfully claim the same profile from the shared state.

## userOutcomeReview

The previous local-fallback race is resolved for the Chromebook/Chrome target. `updateStoredStudentLifeState` obtains a named Web Locks exclusive lock before it reads, validates, and writes localStorage. A second tab therefore reads the first tab's committed assignment and `selectFailureProfile` returns `profile_in_use` instead of reporting a second successful claim. The Supabase path continues to re-run the same selection function inside the optimistic `updated_at` compare-and-swap retry.

All previously reviewed UI outcomes remain satisfied: 50 options are rendered, occupied options are disabled and grayscale, and the current option remains full-color and labelled `내 프로필`.

## checkedArtifacts

- `src/lib/studentLife.ts:201-224`
- `src/pages/AuctionPage.tsx:556-635`
- `src/lib/failureExhibition.ts:70-145`
- `src/lib/supabaseSettings.ts:89-127`
- `src/components/student/StudentShopPage.tsx:54-107`
- `/private/tmp/profile-shop-1280x800.png`
- `/private/tmp/profile-shop-1024x800.png`
- `/private/tmp/profile-shop-1366x800.png`
- `.omo/evidence/profile-shop-functional-gate-review.md`

## verification

- Parent-provided current gates: `npm run lint` PASS, 149 tests PASS, production build PASS, diff-check PASS.
- Direct source review confirms the Web Lock encloses the entire local read-modify-write operation and uses the default exclusive mode.
- Direct source review confirms the Supabase updater recomputes selection on every CAS retry.

## exactEvidenceGaps

- There is no dedicated automated multi-tab Web Locks integration test. This is not a blocker because the target Chrome API contract and lock placement directly establish serialization, and the pure selection rejection behavior is already tested.

## removeAiSlopsAndProgrammingNotes

- The new helper is a real persistence boundary reused by student-life changes rather than a test-only abstraction.
- Existing profile tests remain behavior-oriented and non-tautological; no requested prose is pinned.
- No new type suppression, dependency, or implementation-mirroring test was introduced by the race fix.
