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
- Free-text inputs must remain ordinary input/textarea events so the profanity guard can restore the last accepted value.

## STYLING

- Student styles are global `.student-*` rules in `src/index.css`; component class names are a cross-file contract.
- Reuse existing shell, header, card, action, dialog, and state classes before adding variants.
- `AuctionPage` imports `src/classword.css`; keep classword-specific exceptions there rather than mixing selectors arbitrarily.
- Layout work is Chromebook-first. Validate exact `1280x800` after the final layout-affecting edit.
- Maintain keyboard focus visibility, reduced-motion behavior, text zoom safety, and bounded internal scrolling.

## QA AND ANTI-PATTERNS

- Never exercise live balances, bids, awards, donations, rewards, purchases, letters, or mission writes as disposable QA.
- Use isolated fake state, mocks, or a disposable local-only profile; code-level checks are preferred for mutation paths.
- Clicking an inverse action is not restoration: clamping, history records, request IDs, and concurrent writes remain observable.
- For read-only UI QA, cover hash back/forward behavior, disabled/pending states, modal focus return, Escape, and overflow at `1280x800`.
- Do not move persistence into leaf components, duplicate normalizers, bypass request guards, or silently swallow typed failure outcomes.
