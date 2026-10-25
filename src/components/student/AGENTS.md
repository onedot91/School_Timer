# STUDENT COMPONENT KNOWLEDGE BASE

## OVERVIEW

Student-facing screens and interaction primitives. `src/pages/AuctionPage.tsx` owns orchestration; this directory renders feature UI and keeps only view-local drafts, selections, and dialog state.

## FEATURE MAP

| Area | Components | Boundary |
|------|------------|----------|
| Home/profile | `StudentOverviewPage`, `StudentPetStage`, `StudentPetCard`, `StudentCharacterGacha` | Pet, character, house actions arrive as callbacks. |
| Missions | `StudentMissionsPage`, `StudentMissionCard` | Receives normalized completion/status data. |
| Emotions | `StudentEmotionPage`, `StudentEmotionOrb`, `StudentEmotionSummary` | Owns picker/history presentation; parent saves entries and rewards. |
| Store/economy | `StudentStorePage`, `StudentPlaza`, bank/shop/stock/donation components | Routes typed `StudentEconomyAction` values upward. |
| Mail/library | `StudentMailboxPage`, `StudentLibraryPage`, failure-exhibition components | Parent owns letters, books, stories, stamps, and persistence. |
| Games | `StudentSudokuPage` family, `StudentNumberBaseballPage` family, classword components | Local play state; parent callbacks persist progress/rewards. |
| Safety/shared UI | `StudentConfirmDialog`, `StudentProfanityGuard`, `StudentRapidClickGuard`, `StudentHeader` | Reused across student surfaces. |

## STATE AND PERSISTENCE

- Keep shared balances, history, auctions, missions, pets, economy, student life, and reward state in `AuctionPage`.
- Components receive normalized snapshots plus typed `on*` callbacks; do not import Supabase writers or storage helpers here.
- Async mutation callbacks normally return `Promise<boolean>` or a typed outcome. Respect false/failure and existing `isSaving`/`isPending` guards.
- Supabase/localStorage branching, atomic `updateSharedSettings` mutations, optimistic overlays, and snapshot refresh belong to the page or `src/lib`.
- View-local state is appropriate for form drafts, selected tabs/stocks, open dialogs, animation state, and focus-return refs.
- Never derive spendable balance from displayed balance alone; the parent supplies `availableBalance` after auction reservations.

## NAVIGATION

- `AuctionPage` maps `StudentView` values to `#student-*` hashes and listens to `hashchange` plus `popstate`.
- Feature components navigate only through `onBack`, `onOpen*`, and `onOpenSection`; do not write `window.location.hash` here.
- Preserve nested return paths: mission activities return to missions; store subpages return to plaza or their parent section.
- Unreleased destinations are resolved by the page's feature-release fallback and notice dialog.

## DIALOGS AND GUARDS

- Use `useModalFocus` for focus trapping, Escape handling, initial focus, and focus restoration.
- Dialogs need `role="dialog"` or `alertdialog`, `aria-modal`, labelled headings, and `aria-busy` while saving.
- Pending operations disable backdrop/Escape/close actions; retain the trigger ref so focus returns after dismissal.
- Reuse `StudentConfirmDialog` for standard confirmations instead of duplicating backdrop and focus behavior.
- `RootApp` wraps student mode with `StudentProfanityGuard` and `StudentRapidClickGuard`; keep event-capture behavior compatible.
- Only add `data-rapid-click-ignore="true"` to controls that intentionally bypass repeated-pointer detection.
- The rapid-click warning is one short line ("천천히 눌러 주세요") with no close button: it can't be dismissed and closes itself after `STUDENT_RAPID_CLICK_WARNING_MS` (3s), with a shrinking bar showing the time left. Keep it that short; third graders skip longer text.
- Free-text inputs must remain ordinary input/textarea events so the profanity guard can restore the last accepted value.

## PETS

- Home pets: `StudentPetStage` places the pet, `StudentPetWalker` runs it (rAF loop, grip, taps), `src/lib/petBehavior.ts` decides what it does, and `src/lib/petSprites.ts` holds the per-species tables. The egg UI is `StudentPetEgg` inside `StudentOverviewPage`; egg/pet state rules live in `src/lib/studentPet.ts`.
- Sprites are generated: `node dev/generatePetSprites.mjs` writes `public/pets/<kind>-sprite.svg`, `<kind>-portrait.svg`, and `egg-stages.svg`. Never hand-edit those SVGs; change the generator and rerun it.
- Frames are 160×128 with the feet anchored at (80, 118), 8 columns × one row per `PET_ANIMATION_IDS` entry. After any art change, every frame of every species keeps at least 2px of clear margin; tall heads, jumps, kicks, and hanging tails are the usual offenders, fixed per species in `SPECIES_POSES` (for example a lower happy hop).
- Adding a species: append it to the end of `STUDENT_PET_KINDS` (earlier positions decide existing students' egg hatch order), then add it to `SPECIES` (look plus the features that make the animal recognizable), `TRICK_FRAMES` (its signature move), `SPECIES_POSES` (walk/run in its own gait), and every `Record<StudentPetKind, …>` in `petSprites.ts` plus `PET_SPRITE_KINDS`. The generator fails until `PET_CARRY_GRIPS` matches the grip it prints; `PET_HEAD_TOPS` is the top of the first idle frame.
- Each animal moves like itself: the drawn walk/run rows and `PET_GAITS` (speed, run chance, stride, flee style) must agree. Animals that never run (turtle, elephant, koala, penguin) use `runChance: 0` and `fleeRuns: false`, so a fright ends in a brisk walk, and their run row repeats their walk. Don't give every species the shared defaults.
- Poses that don't fit an animal get replaced for that species, not shared: the turtle hides in its shell instead of sitting. The frog (`crouch: true`) never stands on four straight legs: `frogify` folds every shared standing pose into a crouch (hind thighs folded, webbed feet forward, body sloping up to the head), and it moves only by hopping. The giraffe (`liesDown: true`) never sits like a cat: `giraffeRest` turns every sit, lie-down, and sleep into lying with its legs folded under the body and the long neck upright.
- Hoppers (rabbit, frog) set `hop` in `PET_GAITS`: the hop cycle advances with time, and the pet moves forward only during the airborne part, so it never slides along the ground while crouched.
- The name tag sits on `PET_HEAD_TOPS`, not the frame top.
- Egg: `egg-stages.svg` has `STUDENT_PET_EGG_STAGE_COUNT` (21) frames; each 5-goma feed moves one stage further, and the last frame (open egg, eyes peeking out) is used only by the hatch scene. Feeding is immediate, with no confirmation dialog; the button shows the cost and disables while saving. The hatch scene and naming step cannot be dismissed.
- An egg hatches a random kind the student doesn't own yet: `pickStudentPetHatchKind` hashes the student number with the owned pet ids, so the server and the device pick the same kind and a retried save doesn't change it.
- A pet is named once, right after hatching (up to `STUDENT_PET_NAME_MAX_LENGTH`, 8 characters), and the dialog warns that the name can't be changed. Older names up to 12 characters stay as saved.
- Once every kind is owned (`hasHatchedEveryStudentPet`), the egg closes: the home egg hotspot is disabled, and feeding is refused on the client and the server (`PET_UPDATE_REJECTED`, no goma charged). Owned pets can still walk around and be switched.
- On the test server (mock data), student 1 is given one of every kind (`grantTestServerPets` in `AuctionPage`), so new species can be checked there. Use another student to test the egg.
- The pet feature is released (`petEgg: true` in `STUDENT_FEATURE_RELEASES`). The walking pet, the pet picker, the naming prompt, and the home egg hotspot still all check `isStudentFeatureOpen('petEgg')`, so setting it back to `false` hides the whole feature again, not just the egg.
- `isStudentFeatureOpen` also opens the features listed in `STUDENT_TEST_SERVER_FEATURES` on the dev server (`import.meta.env.DEV`) only; the set is empty now and is where the next unreleased feature goes.
- QA pets on the mock dev server (localStorage `school-timer-student-pets-v1`) at 1280×650. The browser pane may pause `requestAnimationFrame`, so check motion through the sprite rows and behavior tests when live movement can't be observed.

## STYLING

- Student styles are global `.student-*` rules in `src/index.css`; component class names are a cross-file contract.
- Reuse existing shell, header, card, action, dialog, and state classes before adding variants.
- `AuctionPage` imports `src/classword.css`; keep classword-specific exceptions there rather than mixing selectors arbitrarily.
- Layout work is Chromebook-first. Validate browser-content `1280x650` after the final layout-affecting edit, plus `1280x600` and fullscreen `1280x800`. Device resolution includes browser chrome; use `100dvh` without subtracting it again.
- Maintain keyboard focus visibility, reduced-motion behavior, text zoom safety, and bounded internal scrolling.

## QA AND ANTI-PATTERNS

- Never exercise live balances, bids, awards, donations, rewards, purchases, letters, or mission writes as disposable QA.
- Use isolated fake state, mocks, or a disposable local-only profile; code-level checks are preferred for mutation paths.
- Clicking an inverse action is not restoration: clamping, history records, request IDs, and concurrent writes remain observable.
- For read-only UI QA, cover hash back/forward behavior, disabled/pending states, modal focus return, Escape, and overflow at `1280x650` and the shorter `1280x600` viewport.
- Do not move persistence into leaf components, duplicate normalizers, bypass request guards, or silently swallow typed failure outcomes.
