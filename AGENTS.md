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
- 학생의 공용 설정 변경은 `updateStudentSharedSettings(studentNumber, updater)`를 사용한다. 화면 표시용 정규화 결과를 전체 저장 데이터로 취급하지 않는다. 변경 시 학생 범위 GET → 저장 API 테스트로 다른 학생 데이터 보존을 검증한다. 상세 규칙은 `src/lib/AGENTS.md`를 따른다.
- Storage keys, item/profile identifiers, JSONB keys, RPC signatures, and literal public-asset URL paths are compatibility contracts.
- User-facing text is Korean. Preserve the warm cream/green/paper classroom identity and existing character assets.
- Student UI is Chromebook-first. The device resolution `1280×800` includes Chrome tabs/address bar and the OS shelf; it is not the web content viewport. Use `window.innerWidth === 1280` and `window.innerHeight === 650` as the primary conservative browser-content QA size, before changes and after the final layout edit. Also check `1280×600` for shorter windows and `1280×800` as a fullscreen regression.
- Base layout on the actual CSS viewport (`100dvh`, container dimensions), never `screen.height`. Do not subtract browser chrome again from `100dvh`. At the final checks reject clipping, overlap, unreachable primary actions, and unintended document scrolling. Long lists/forms may scroll inside a bounded panel; preserve readable text, 44px controls, keyboard access, and text zoom. Do not shrink the whole UI with CSS zoom or transforms to force a fit.
- Optional audio failures stay non-fatal; autoplay/device restrictions must not block core actions.
- Loading fixes require before/after measurements. Keep Vercel functions near the Seoul Supabase database (`icn1`); verify the deployed response region after release. Separate read timeouts from write confirmation, and never shorten loading by treating unconfirmed saves as successful. Keep feature-only panels out of initial bundles.

## UI 문구 최소화

- 모든 화면은 핵심 정보와 행동에 필요한 문구만 남긴다. 문구 없이도 용도와 조작이 명확하면 추가하지 않는다.
- 제목·버튼·상태를 반복 설명하는 부제, 장식용 슬로건, 환영 문구, 당연한 사용법, 개발·구현 설명은 넣지 않는다. 빈 공간을 채우기 위한 문구도 금지한다.
- 버튼은 행동을 명확히 나타내는 짧은 이름을 쓴다. 안내가 꼭 필요하면 가장 짧고 구체적인 문장으로 한 번만 표시한다.
- 오류와 해결 방법, 로딩·빈 상태, 비용·조건·되돌릴 수 없는 결과처럼 판단에 필요한 정보와 접근성 레이블은 유지한다. 상황별 안내는 해당 상황에서만 표시한다.
- UI를 추가하거나 수정할 때 문구마다 “없애도 사용자가 이해하고 행동할 수 있는가?”를 확인하고, 그렇다면 삭제한다. 기존 문구 정리는 요청한 작업 범위 안에서 진행한다.

## ANTI-PATTERNS

- 기록 저장 경로를 추가·수정할 때 최종 저장 실패는 `saveFailureClient`의 공통 보고 경로에 연결한다. 재시도로 복구된 충돌과 정상적인 업무 거절은 보고하지 않는다. 학생 번호·기능·오류 코드만 전송하며 학생 답변·비밀키·원문 오류 메시지는 포함하지 않는다.
- 오류 알림은 실패한 학급 설정 저장과 독립적으로 전송하고, 전송 실패 시 재시도할 수 있도록 보관한다. 후속 저장 성공으로 이전 오류를 자동 삭제하지 않는다. 교사의 확인 처리는 기록 복구와 구분하며, 오류 조회 실패도 교사 경고로 표시한다.

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
