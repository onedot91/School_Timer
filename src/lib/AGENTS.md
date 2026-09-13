# LIBRARY KNOWLEDGE BASE

## OVERVIEW

Shared domain rules, persistence codecs, browser clients, and small React hooks.
Several modules are imported by both the Vite client and Node serverless code; browser access is not safe by default here.

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
- `supabaseSettings.ts`는 교사 전체 스냅샷 또는 학생 범위 스냅샷을 캐시하고 compare-and-set 충돌을 재시도한다. 학생 GET은 전체 학급 데이터가 아니며, 누락된 학생은 기본값으로 저장할 대상이 아니다.

## PERSISTENCE CONTRACTS

- Treat Supabase JSON, API JSON, and `localStorage` JSON as `unknown` until the domain parser/normalizer accepts it.
- Store helpers serialize normalized state. Load helpers return defaults on absent, malformed, or legacy values where the existing contract does so.
- Storage keys and legacy migration branches are compatibility contracts; changing or removing either can strand classroom data.
- Economy, currency history, weekly rewards, and profile/life updates are coupled state transitions. Preserve request IDs and claim markers so retries stay idempotent.
- Keep mutations routed through `updateSharedSettings`, feature API clients, or the existing atomic domain transition; direct object patches can lose concurrent updates.
- 공유 설정 저장은 같은 브라우저의 공통 대기열을 거친다. 앞선 저장의 성공·실패가 끝난 뒤 최신 캐시로 다음 updater를 실행하고, 저장 중 무효화된 캐시를 늦은 응답으로 복원하지 않는다.

## 학생 저장 범위와 회귀 검증

- 학생 화면·훅의 일반 설정 변경은 `updateStudentSharedSettings(studentNumber, updater)`를 사용한다. 전체 스냅샷 저장 함수 `updateSharedSettings`/`saveSharedSettings`는 교사 경로에만 사용한다. 경제·기부 등 기존 전용 API/RPC는 그대로 사용한다.
- `createStudentSettingsUpdate`가 학생별 map에서 본인 항목만 전송하고, 교사 필드·서버 경제 상태를 제외한다. 캐시에는 읽어 둔 설정을 보존한다. 기능별로 같은 필터를 복제하거나 서버 권한 검사를 완화하지 않는다.
- `normalizeCurrencyBalances`/`normalizeCurrencyHistory`/펫·게임 정규화는 계산·표시에 필요하지만, 기본값 생성·정렬·과거 필드 제거가 발생할 수 있다. 다른 학생의 원본을 정규화 결과로 덮어쓰지 않는다.
- 진행 map은 GET에서 공유되고 PUT에서 전체 교체되므로 다른 학생의 원본 항목을 유지해야 한다. 학생별 map의 병합과 혼동하지 않는다.
- 학생 저장 변경은 실제 학생 범위 GET 응답으로 시작하는 클라이언트 → API 회귀 테스트를 포함한다. 다른 학생의 비기본 잔액·비어 있지 않은 기록, 누락 필드의 `null`, 연속 저장, `409` 재조회·재시도, 보상 중복 방지를 검증한다. 로컬 mock 저장 성공만으로 서버 저장을 검증했다고 판단하지 않는다.
- 공통 허용 필드를 바꾸면 API 권한 계약과 `studentSettingsUpdate.test.ts`, `tests/api/shared-settings.test.ts`를 함께 확인한다. 학생 코드의 전체 저장 함수 직접 import는 회귀 테스트가 차단한다.

## CLIENT / SERVER BOUNDARY

- `classword.ts`, `classwordQuiz.ts`, `todayFriend.ts`, `todayFriendState.ts`, `todayFriendCodec.ts`, `weeklyMission.ts`, `currency.ts`, and economy domain modules have Node serverless consumers.
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
