# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-01
**Commit:** 0082717
**Branch:** main

## OVERVIEW

School Timer is a Vite + React 19 + TypeScript classroom app. It is a single frontend app with Supabase-backed shared settings when env vars are present, and localStorage fallback when they are not.

## STRUCTURE

```text
School_Timer/
├── src/
│   ├── RootApp.tsx       # entry-number based screen switch, no URL router
│   ├── pages/            # user-facing screens and large operational surfaces
│   ├── lib/              # shared normalization, persistence, audio, auction logic
│   └── components/       # currently AuctionRoom only
├── public/               # runtime assets served from /
├── supabase/             # SQL for app_settings and announcement_notes
├── tmp/                  # QA screenshots and temporary backups, not source
├── dist/                 # build output, not source
└── vercel.json           # CSP and Vercel headers
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App boot and screen choice | `src/main.tsx`, `src/App.tsx`, `src/RootApp.tsx` | `App.tsx` only re-exports `RootApp`. |
| Entry number behavior | `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx` | `0` opens admin timer; `1..23` opens student auction. |
| Timer/admin console | `src/pages/TimerPage.tsx` | Largest file; schedule, subjects, draw, auction settings, memo, YouTube. |
| Student auction flow | `src/pages/AuctionPage.tsx`, `src/components/AuctionRoom.tsx` | Polls shared settings and writes bids. |
| Random draw logic | `src/lib/randomDraw.ts`, `src/pages/RandomDrawPage.tsx` | Some logic is duplicated by the standalone page. |
| Shared Supabase state | `src/lib/supabaseSettings.ts`, `supabase/app_settings.sql` | Env-gated; no env means local-only behavior. |
| Visual rules | `src/index.css`, `DESIGN.md` | Current app uses warm classroom/bear palette, not pure Starbucks clone. |
| Deployment headers | `vercel.json` | CSP must be updated when adding external media/API/frame sources. |
| Public metadata | `index.html`, `public/privacy.html` | Vercel domain and policy text are user-visible. |

## CODE MAP

LSP/codegraph tools were not available during generation; centrality below is from file reads, exports, imports, and file size.

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `RootApp` | component | `src/RootApp.tsx` | central | Selects entry screen, handles reset shortcut and runtime fallback. |
| `TimerPage` | component | `src/pages/TimerPage.tsx` | central | Main admin surface and shared settings writer. |
| `AuctionPage` | component | `src/pages/AuctionPage.tsx` | central | Student auction state loader/writer. |
| `AuctionRoom` | component | `src/components/AuctionRoom.tsx` | high | Shared auction UI renderer. |
| `RandomDrawPage` | component | `src/pages/RandomDrawPage.tsx` | standalone | Independent random draw surface. |
| `loadSharedSettingsRow` | function | `src/lib/supabaseSettings.ts` | high | Reads Supabase `app_settings`. |
| `updateSharedSettings` | function | `src/lib/supabaseSettings.ts` | high | Mutates shared settings row. |
| `normalizeSavedRandomDrawState` | function | `src/lib/randomDraw.ts` | high | Guards persisted draw state shape. |
| `normalizeAuctionItems` | function | `src/lib/currency.ts` | high | Guards auction item state shape. |
| `prepareAuctionAudio` | function | `src/lib/auctionAudio.ts` | medium | Browser Web Audio warmup for auction feedback. |

## CONVENTIONS

- Use `npm run lint` for TypeScript validation; it is `tsc --noEmit`, not ESLint.
- Use `@/*` only when a root-relative import improves clarity. Existing feature files mostly use relative imports.
- `vite.config.ts` intentionally gates HMR with `DISABLE_HMR`; keep that behavior for AI Studio.
- Browser-only APIs are common. Check SSR guards before moving code outside React effects or event handlers.
- Shared settings normalize unknown Supabase/localStorage payloads before use. Preserve that defensive boundary.
- User-facing copy is mostly Korean. Keep new classroom UI text Korean unless matching an existing English API/error.
- Treat classroom currency (`고마`) and auction state as live user data. Code changes and QA must not leave balances, bids, awards, or currency history changed; if testing requires mutation, take a targeted backup first and restore the affected Supabase/localStorage fields before finishing.

## ANTI-PATTERNS (THIS PROJECT)

- Do not edit `dist/`, `tmp/`, or `node_modules/` as source.
- Do not commit secrets from `.env.local`; public Vite env names are still client-exposed.
- Do not add new external API/frame/media domains without updating `vercel.json` CSP.
- Do not change deployment domains in only one place; check `vercel.json` CORS and `index.html` OG metadata together.
- Do not remove Supabase fallback behavior; the app must run without Supabase env vars.
- Do not replace `vite.config.ts` HMR logic; the file explicitly warns it prevents flicker during agent edits.
- Avoid `as any`, `@ts-ignore`, and type suppression. Use narrowed browser API types instead.
- Do not use real student currency balances as disposable QA data. Prefer isolated fake IDs/state; if real data is touched, explicitly revert balances, bids, awards, and history to the pre-test values.

## UNIQUE STYLES

- The active visual language is warm cream, green, paper, and classroom character assets from `src/index.css`.
- UI uses Tailwind utility classes directly in TSX, with large page-local sections rather than a broad component library.
- Many persisted states have legacy migration paths. Treat storage keys as compatibility contracts.
- Audio failures are intentionally swallowed for browser autoplay compatibility.
- Static assets are referenced by literal `/...` paths from `public/`; keep filenames stable unless all callers change.

## COMMANDS

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
npm run clean
```

## NOTES

- Required Supabase env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Optional YouTube search env var: `VITE_YOUTUBE_API_KEY`.
- Supabase setup SQL is `supabase/app_settings.sql`.
- `SUPABASE_SETUP.md` mentions `.env.example`, but none was present during generation.
- There are no committed automated tests or CI workflows. Existing QA evidence is mostly screenshots and backups under `tmp/`.
