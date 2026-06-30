# PAGES KNOWLEDGE BASE

## OVERVIEW

`src/pages` owns the visible application surfaces. These files are large stateful screens, not thin route wrappers.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Initial number picker | `EntrySelectPage.tsx` | Selects `0..23`; `0` is the admin/timer entry. |
| Admin timer and settings | `TimerPage.tsx` | Schedule, subjects, announcements, memo, draw, auction admin, YouTube. |
| Student auction | `AuctionPage.tsx` | Student-facing bidding screen for entries `1..23`. |
| Standalone draw | `RandomDrawPage.tsx` | Self-contained draw UI with its own local state and audio. |

## CONVENTIONS

- `RootApp` chooses pages by stored entry number; do not introduce URL routing for a small page change.
- `TimerPage.tsx` is the operational hub. Before editing it, search the file for the relevant storage key, panel name, and Supabase field.
- Keep page state resilient to missing Supabase. `isSupabaseSettingsEnabled` is a behavior gate, not just a loading hint.
- `AuctionPage.tsx` refreshes shared state on an interval. Preserve conflict-tolerant reads and normalized writes.
- Korean UI labels are expected. Match existing classroom tone and avoid mixing untranslated copy into user surfaces.
- Page-level UI relies heavily on Tailwind class strings. Keep layout constraints explicit to avoid text overlap on classroom displays.

## ANTI-PATTERNS

- Do not update only `AuctionPage.tsx` when changing auction data shape; check `TimerPage.tsx` admin settings and `src/lib/currency.ts`.
- Do not update only page-local draw code when changing draw behavior; check `src/lib/randomDraw.ts` and the standalone `RandomDrawPage.tsx`.
- Do not remove runtime fallback in `RootApp` when touching screen selection behavior.
- Do not assume `localStorage` data is current-shape JSON; legacy keys and migration paths exist in `TimerPage.tsx`.

## VERIFICATION

- For page behavior, run `npm run lint` and `npm run build`.
- For visual changes, run `npm run dev` and capture/check the affected screen. Existing screenshot references are under `tmp/`.
