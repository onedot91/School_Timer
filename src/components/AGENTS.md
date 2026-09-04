# COMPONENT LAYER KNOWLEDGE

## OVERVIEW

Reusable and feature-sized React UI below the two operational pages. Components render classroom state; ownership of remote mutations stays explicit in props or in the few feature controllers noted below.

## STRUCTURE

```text
components/
├── AuctionRoom.tsx       # Shared auction workspace, page and compact variants
├── AuctionItemCard.tsx   # Controlled auction item selection
├── NetworkStatusBanner.tsx # Root-level connectivity status
├── student/              # Student portal pages, cards, guards, dialogs
└── teacher/              # Timer-console panels and presentation dialogs
```

## WHERE TO LOOK

| Concern | Primary files | Caller / source of truth |
|---------|---------------|--------------------------|
| Auction rendering | `AuctionRoom.tsx`, `AuctionItemCard.tsx` | `pages/AuctionPage.tsx`, `lib/currency.ts` |
| App-wide guards/status | `NetworkStatusBanner.tsx`, `student/StudentRapidClickGuard.tsx`, `student/StudentProfanityGuard.tsx` | `RootApp.tsx` |
| Student portal composition | `student/StudentOverviewPage.tsx`, `StudentMissionsPage.tsx`, `StudentStorePage.tsx` | `pages/AuctionPage.tsx` |
| Teacher utility surfaces | `teacher/TeacherClasswordPanel.tsx`, `TeacherWritingSettings.tsx`, `TeacherTodayFriendPanel.tsx` | `pages/TimerPage.tsx` |
| Shared modal behavior | `student/StudentConfirmDialog.tsx`, `student/FailureComposerDialog.tsx` | `lib/useModalFocus.ts` |
| Component styling | namespaced classes throughout this tree | `index.css`; Tailwind utilities are inline in auction components |
| Presentation regression checks | exported helpers and rendered source | matching `lib/*.test.ts` files |

## BOUNDARIES

- Top-level files are genuinely shared or mounted by `RootApp`; do not move student-only chrome into them.
- `student/` owns student interactions and local presentation state. Live balances, economy actions, mail, mission rewards, and navigation normally arrive as controlled props/callbacks from `AuctionPage`.
- `StudentClasswordPage` and `StudentTodayFriendPage` are intentional feature controllers: they call their dedicated `*Client` modules and report balance/mission effects upward.
- `teacher/` is mounted inside `TimerPage`. `TeacherWritingSettings` is callback-controlled; `TeacherClasswordPanel` and `TeacherTodayFriendPanel` intentionally load/update through their dedicated clients.
- Small leaf cards receive domain-shaped props and emit intent. Do not duplicate normalization or Supabase payload assembly here.

## CONTROLLED CALLBACKS

- Preserve existing callback result contracts: `Promise<boolean>` means the parent confirms success; only close/reset/celebrate after `true`.
- Thread `isLoading` / `isSaving` / `isPending` through interactive children and disable repeated submissions while pending.
- Navigation callbacks (`onBack`, `onOpen*`, `onSelect*`) remain synchronous intent signals; do not reach into page hash/view state from a leaf.
- Keep prop interfaces narrow and `readonly`; reuse domain types from `lib/` instead of rebuilding parallel component types.
- Pure presentation helpers exported from component files are test seams. Keep their output deterministic and browser-independent.

## STYLE AND LAYOUT

- Most student/teacher visuals use semantic `student-*`, `teacher-*`, `classword-*`, and feature-prefixed selectors defined in global `index.css`.
- `AuctionRoom` and `AuctionItemCard` deliberately mix those hooks with inline Tailwind utilities; preserve this hybrid when editing that pair.
- Add a component-specific global selector beside its existing feature block. Do not introduce one-off component CSS files.
- Keep state modifiers (`is-*`, `stage-*`, `data-*`) stable; `index.css` uses them for visibility, animation, and layout.

## MODALS AND FOCUS

- Prefer `useModalFocus` for focus trap, Escape dismissal, initial focus, and return-focus behavior.
- Dialogs require `role="dialog"`, `aria-modal="true"`, labelled IDs, and an explicit trigger/`returnFocusRef` when opened from a control.
- Pending stages are non-dismissible; backdrop, close button, and Escape must agree with the same pending flag.
- Use portals only where the owning surface can clip overlays; teacher calendar and classword confirmation already establish that pattern.
- Multi-stage dialogs may move focus deliberately after transitions, but must still honor reduced motion and restore the opener on close.

## ANTI-PATTERNS

- Do not mutate auction bids, awards, balances, or reward history directly from a presentational component.
- Do not replace the shared confirmation/focus pattern with ad hoc Escape listeners unless the interaction is not a modal.
- Do not remove ARIA live regions from loading, save, or network states; they are the non-visual status channel.
- Do not collapse teacher and student versions merely because their markup looks similar; their data ownership and permissions differ.
