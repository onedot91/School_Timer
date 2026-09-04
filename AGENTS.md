# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-05
**Commit:** 90cb48f
**Branch:** main

## OVERVIEW

School Timer is a Vite + React 19 + TypeScript classroom operations app. The same repository contains the browser UI, Vercel serverless handlers, Node-only server helpers, Supabase SQL, and Node test suites.

Development defaults to isolated mock data. Read-only shared data and production writes are explicit modes; localStorage remains the fallback when shared Supabase settings are unavailable.

## STRUCTURE

```text
School_Timer/
├── src/
│   ├── RootApp.tsx              # entry/session switch; no URL router
│   ├── pages/                   # four large stateful application surfaces
│   ├── components/
│   │   ├── student/             # student feature views
│   │   └── teacher/             # extracted teacher panels/dialogs
│   ├── lib/                     # domain logic, normalization, clients, colocated tests
│   └── server/                  # Node/Vercel-only auth, request, repository helpers
├── api/                         # nine Vercel function entry points
├── tests/api/                   # handler and server-boundary tests
├── supabase/                    # idempotent schema/RPC SQL
├── public/                      # runtime assets served from /
├── DESIGN.md                    # visual and interaction contract
└── vercel.json                  # rewrites, CSP, CORS, security headers
```

`dist/`, `tmp/`, and `.omo/` are build or QA artifacts, not source.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Boot, entry selection, device registration | `src/main.tsx`, `src/RootApp.tsx`, `src/pages/EntrySelectPage.tsx` | `App.tsx` only re-exports `RootApp`; entries `1..23` are students and `0` is teacher. |
| Teacher timer and settings | `src/pages/TimerPage.tsx`, `src/components/teacher/` | 12k-line operational hub; search panel, state setter, handler, and storage key together. |
| Student application | `src/pages/AuctionPage.tsx`, `src/components/student/` | Owns student feature routing, shared state, refresh, and mutations. |
| Auction and currency | `src/components/AuctionRoom.tsx`, `src/lib/currency.ts`, `src/lib/studentEconomy.ts` | Check teacher setup, student validation, reserved balance, awards, and history together. |
| Shared browser state | `src/lib/supabaseSettings.ts`, `src/lib/dataMode.ts`, `src/lib/supabaseConfig.ts` | Normalize remote/local payloads; mock, readonly, and production have different write permissions. |
| API contracts | `api/`, `src/server/`, `tests/api/` | Cookie auth, student scoping, cross-site checks, rate limits, and PostgREST contracts. |
| Classword and Today Friend | `src/lib/classword*.ts`, `src/lib/todayFriend*.ts`, matching server/API files | Domain, codec, client, repository, and reward paths are separate layers. |
| Missions and games | `src/lib/weeklyMission.ts`, `src/lib/randomDraw.ts`, `src/lib/sudoku.ts`, `src/lib/numberBaseball.ts` | Tests are colocated in `src/lib/*.test.ts`. |
| Database changes | `supabase/app_settings.sql`, `supabase/classword.sql` | RLS/revokes and service-role-only security-definer RPCs are part of the contract. |
| Visual behavior | `src/index.css`, `src/classword.css`, `DESIGN.md` | Global feature classes and Tailwind utilities coexist. |
| Deployment policy | `vite.config.ts`, `vercel.json`, `index.html` | Proxy targets, CSP, CORS, and public metadata share domain assumptions. |

## CODE MAP

LSP/codegraph and ast-grep were unavailable at generation time. Reference counts below are file-level text/import search, not semantic references.

| Symbol | Type | Location | Referencing files | Role |
|--------|------|----------|------------------:|------|
| `RootApp` | component | `src/RootApp.tsx` | 3 | Runtime boundary, entry persistence, device session, lazy page selection. |
| `TimerPage` | component | `src/pages/TimerPage.tsx` | 14 | Teacher state owner and shared-settings producer. |
| `AuctionPage` | component | `src/pages/AuctionPage.tsx` | 9 | Student state owner, feature switch, sync and mutation orchestrator. |
| `studentEconomy` domain | module group | `src/lib/studentEconomy.ts` | 31 | Wallet, bank, loan, shop, stock, tax, profile rules. |
| `getDeviceSession` | function | `src/server/deviceSession.ts` | 11 | Signed teacher/student cookie authorization boundary. |
| `updateSharedSettings` | function | `src/lib/supabaseSettings.ts` | 6 | Normalized shared-setting mutation with conflict handling. |
| `consumeRequestRateLimit` | function | `src/server/requestRateLimit.ts` | 6 | Route/client/student write throttling. |
| `normalizeAuctionItems` | function | `src/lib/currency.ts` | 5 | Saved auction shape and compatibility boundary. |

## CONVENTIONS

- `npm run lint` is `tsc --noEmit`, not ESLint. `npm test` uses Node's test runner through `tsx`.
- Domain and presentation tests live beside helpers in `src/lib/*.test.ts`; Vercel handler tests live in `tests/api/*.test.ts`.
- Relative imports from `api/` into `src/server/` keep explicit `.js` specifiers for Vercel ESM.
- `VITE_DATA_MODE=mock` forbids shared-backend reads/writes; `readonly` reads but does not write; production may write.
- Treat localStorage, API, and Supabase payloads as `unknown` until a domain normalizer accepts them.
- Storage keys, item/profile identifiers, JSONB keys, RPC signatures, and literal public-asset URL paths are compatibility contracts.
- User-facing text is Korean. Preserve the warm cream/green/paper classroom identity and existing character assets.
- Student UI is Chromebook-first. For layout work, observe `window.innerWidth === 1280` and `window.innerHeight === 800` before the change and again after the final layout edit.
- At the final 1280×800 check, reject clipping, overlap, unintended document scrolling, or first-screen overflow. Additional width checks are not required unless requested; preserve keyboard access, text zoom, and overflow safety.
- Optional audio failures stay non-fatal; autoplay/device restrictions must not block core actions.

## ANTI-PATTERNS

- Do not edit `dist/`, `tmp/`, `.omo/`, or `node_modules/` as source.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_REGISTRATION_KEY`, or `DEVICE_SESSION_SECRET` through a `VITE_` variable or browser import.
- Do not import `src/server/` into browser bundles; it uses Node APIs and service credentials.
- Do not remove no-Supabase/local fallback behavior or bypass `dataMode` write gates.
- Do not bypass server/RPC mutation paths for currency, rewards, donations, or other concurrency-sensitive state.
- Do not change shared-setting shape only in one layer; update normalizer, snapshot builder/apply path, API scope validation, SQL, and tests as applicable.
- Do not rename numbered/Korean asset files or persisted ids without finding every literal reference and planning stored-data compatibility.
- Do not add an external API, frame, font, image, or media origin without updating and testing `vercel.json` CSP.
- Do not change the deployment domain in only one place; inspect `vercel.json`, `index.html`, and development proxies together.
- Do not use `as any`, `@ts-ignore`, or unchecked persistence casts; narrow or normalize instead.
- Never use live student balances, bids, awards, rewards, donations, or history as QA data. Reverse actions are not restoration; use mock/fake/disposable local state.

## UNIQUE STYLES

- `src/index.css` is an intentionally broad token-driven theme layer with `.student-*` and `.teacher-*` feature contracts.
- UI combines Tailwind utilities with global semantic classes; check both before introducing a new local style.
- Modal work follows one active `aria-modal` owner, focus containment/return, top-layer Escape behavior, and reduced-motion alternatives.
- Interactive motion lists explicit properties; `transition: all` is prohibited. State cannot rely on color alone.

## COMMANDS

```bash
npm install
npm run dev
npm run dev:readonly
npm run dev:stable
npm run lint
npm test
npm run build
npm run preview
```

## NOTES

- Browser Supabase variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Server-only variables: `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_REGISTRATION_KEY`, `DEVICE_SESSION_SECRET`.
- Optional YouTube search variable: `VITE_YOUTUBE_API_KEY`.
- Vercel deploys each direct `api/*.ts` handler; a test currently enforces the Hobby-plan direct-function cap.
- There is no committed CI workflow or browser E2E suite. Browser-visible changes require manual surface QA in addition to lint, tests, and build.
