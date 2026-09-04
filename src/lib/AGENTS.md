# LIBRARY KNOWLEDGE BASE

## OVERVIEW

Shared domain rules, persistence codecs, browser clients, and small React hooks.
Several modules are imported by both the Vite client and Node/Vercel code; browser access is not safe by default here.

## WHERE TO LOOK

| Domain | Files | Boundary |
|--------|-------|----------|
| Shared settings | `supabaseConfig.ts`, `supabaseSettings.ts`, `dataMode.ts` | Selects local/shared behavior; API proxy owns deployed reads and writes. |
| Currency and auction | `currency.ts`, `classDonation.ts`, `auctionAudio.ts` | Balances, history, awards, donation parsing, browser audio. |
| Student economy | `studentEconomy.ts`, `studentEconomySettings.ts`, `studentEconomyClient.ts` | Pure transitions and normalization separated from `/api/student-economy` transport. |
| Student life | `studentLife.ts`, `studentPet.ts`, `studentEmotion.ts`, `failureExhibition.ts` | Books, mail, pet/profile, emotion, and failure-story state. |
| Weekly missions | `weeklyMission.ts`, `classwordWeeklyMission.ts`, `bookStackMission.ts`, `failureExhibitionMission.ts` | Mission definitions, completion, and reward claiming. |
| Classword | `classword*.ts` | Rules/codecs, local stores, browser client, quiz, and reward settlement. |
| Today Friend | `todayFriend*.ts` | Domain state and codecs shared with server; client/local-store files are browser-only. |
| Student games | `sudoku.ts`, `numberBaseball.ts`, matching `useStudent*State.ts` | Seeded game rules, persisted progress, reward orchestration. |
| Draw and writing | `randomDraw.ts`, `dailyWriting.ts`, `dailyWritingPrompts.ts` | Large normalized feature states with storage compatibility. |

## DATA MODES

- `mock`: development default; use local state and never read the shared backend.
- `readonly`: read the shared backend through the proxy; reject or no-op writes as each public API specifies.
- `production`: forced for production builds; shared reads and writes enabled when credentials and proxy are available.
- Use `appDataMode`, `canReadSharedBackend`, and `canWriteSharedBackend`; do not duplicate environment checks in features.
- `supabaseSettings.ts` caches a writable full settings row and retries compare-and-set conflicts. A student-scoped projection must never become the base for a write.

## PERSISTENCE CONTRACTS

- Treat Supabase JSON, API JSON, and `localStorage` JSON as `unknown` until the domain parser/normalizer accepts it.
- Store helpers serialize normalized state. Load helpers return defaults on absent, malformed, or legacy values where the existing contract does so.
- Storage keys and legacy migration branches are compatibility contracts; changing or removing either can strand classroom data.
- Economy, currency history, weekly rewards, and profile/life updates are coupled state transitions. Preserve request IDs and claim markers so retries stay idempotent.
- Keep mutations routed through `updateSharedSettings`, feature API clients, or the existing atomic domain transition; direct object patches can lose concurrent updates.

## CLIENT / SERVER BOUNDARY

- `classword.ts`, `classwordQuiz.ts`, `todayFriend.ts`, `todayFriendState.ts`, `todayFriendCodec.ts`, `weeklyMission.ts`, `currency.ts`, and economy domain modules have Node/Vercel consumers.
- Shared domain modules must not read `window`, `document`, `localStorage`, audio APIs, or React state during module initialization.
- Browser-only effects belong in `*Client.ts`, `*LocalStore.ts`, audio modules, hooks, or explicitly guarded store helpers.
- `.js` relative specifiers in server-shared TypeScript are intentional for ESM execution. Do not mass-normalize `.js`, `.ts`, and extensionless imports.
- `currency.ts` has a runtime dependency on `studentEconomy.ts`; the reverse currency reference in `studentEconomy.ts` must remain type-only to avoid a runtime cycle.

## TEST CONVENTIONS

- Tests are colocated as `*.test.ts` and run with Node's `node:test` via `tsx`.
- Domain tests exercise pure transitions and malformed persisted input; browser code uses small fake `Storage`, `window`, `fetch`, or event targets.
- Presentation, CSP, SQL, and import-boundary tests intentionally inspect source files or schema text. Update those assertions when the protected contract changes.
- API integration coverage lives under `tests/api`; keep server behavior tests there rather than duplicating them in browser-client tests.

## ANTI-PATTERNS

- Do not bypass normalizers with casts at persistence or response boundaries.
- Do not use live student balances, bids, rewards, or histories as test fixtures.
- Do not let `readonly` fall through to local mutation as if it were `mock`.
- Do not split a coupled reward/economy/life update into independent shared-settings writes.
- Do not move browser-only helpers into modules imported by `api/` or `src/server/` without isolating the side effects.
