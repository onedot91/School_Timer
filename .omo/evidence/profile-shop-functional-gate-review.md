# Profile shop functional gate review

## recommendation

REJECT

## originalIntent

Remove date-based profile rotation, persist one selected animal profile per student, expose all 50 profiles in the shop, prevent choosing another student's profile, render occupied profiles in grayscale, and preserve a usable full-color current selection.

## desiredOutcome

The same selected profile survives reloads and dates. Every profile is visible/reachable in the item shop. Occupied profiles are visibly disabled and cannot be claimed, including when two students attempt to claim the same profile concurrently.

## userOutcomeReview

The supplied 1280x800, 1024x800, and 1366x800 renders show a scrollable profile grid, a full-color `내 프로필` selection, and grayscale `사용 중` entries. Production code maps all 50 profile options into buttons and disables occupied/current buttons. The profile lookup no longer accepts or derives a date, and assignments are normalized into persisted `studentLife` state.

The Supabase path re-evaluates the selection inside an optimistic compare-and-swap retry, so a losing concurrent claimant is rejected. The supported localStorage fallback, however, performs an unguarded read-modify-write. Two student tabs can both validate the same formerly-free profile from the same snapshot and both receive a successful local result; the later write merely overwrites the earlier claim. This fails the requested concurrency-safe duplicate-prevention outcome in a supported runtime mode.

## blockers

1. **violatedCriterion: CONCURRENCY_SAFE_DUPLICATE_PREVENTION**
   - Observation: the local fallback reads at `AuctionPage.tsx:567`, computes the claim independently, and writes at `AuctionPage.tsx:568`; `storeStudentLifeState` is a plain `localStorage.setItem` at `studentLife.ts:211-213`, with no lock, version, retry, or post-conflict rejection. Separate tabs can therefore both report `selected` for one free profile.
   - evidencePointer: `src/pages/AuctionPage.tsx:555-569,607-635`; `src/lib/studentLife.ts:201-213`; compare the concurrency-safe Supabase CAS at `src/lib/supabaseSettings.ts:89-127`.

## checkedArtifacts

- `/private/tmp/profile-shop-1280x800.png`
- `/private/tmp/profile-shop-1024x800.png`
- `/private/tmp/profile-shop-1366x800.png`
- `src/lib/failureExhibition.ts:70-145`
- `src/lib/studentLife.ts:117-124,201-213`
- `src/components/student/StudentShopPage.tsx:54-107`
- `src/index.css:20028-20140`
- `src/pages/AuctionPage.tsx:552-635,1572-1731`
- `src/lib/supabaseSettings.ts:89-127`
- `src/lib/failureExhibition.test.ts:27-56`
- `.omo/evidence/profile-shop-clone-fidelity.md`

## verification

- `npm test -- --test-name-pattern='프로필'`: PASS, 149 tests reported passing.
- `npm run lint` (`tsc --noEmit`): PASS.
- 50 profile paths are declared and all 50 referenced thumbnail files exist.
- No residual date/day rotation symbol or date argument was found in the profile implementation/callers.

## exactEvidenceGaps

- There is no regression/integration test that exercises simultaneous claims through either persistence path. Existing tests validate only sequential pure-function selection.
- The available `.omo/evidence/profile-shop-clone-fidelity.md` verifies visual fidelity but does not explicitly cover `omo:remove-ai-slops`, test-overfit criteria, or the persistence race. Direct review found the profile tests behavior-oriented and non-tautological, but insufficient for the concurrency criterion.
- A fresh production build was not run in this read-only review because it writes `dist`; typecheck and tests were reproduced instead.

## removeAiSlopsAndProgrammingNotes

- The added profile tests assert observable selection and uniqueness behavior rather than requested prose or implementation details; no deletion-only or tautological test was found.
- `src/lib/failureExhibition.ts` measures 264 pure LOC and `src/pages/AuctionPage.tsx` is already very large. These are maintenance notes, not blockers for the stated user-visible criteria.
- No new dependency, type suppression, or screenshot-backed fake UI was introduced for this feature.
