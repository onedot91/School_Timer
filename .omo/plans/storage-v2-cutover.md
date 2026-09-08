# 저장 구조 v2 개편 및 무중복 전환 계획

## TL;DR
> Summary:      `app_settings.school-timer-main` 단일 JSON/CAS 저장을 기능·학생·레코드 단위 리소스와 원자적 명령/RPC로 분해하고, 운영 쓰기를 잠시 중지한 상태에서 검증 가능한 이관·배포·재개를 수행한다.
> Deliverables:
> - 저장 v2 공통 타입, 서버 저장소, 브라우저 클라이언트와 기존 화면 호환 projection
> - 학생별 지갑, append-only 원장, 보상 claim, 멱등 command receipt와 경제·경매 원자 RPC
> - 교사 설정, 학생 기능, 메일·감정·게임·미션·도서·글쓰기·도서관의 세분화된 저장소
> - 원본 보존 백업, lossless 이관/대조, maintenance cutover, Vercel/Supabase 배포와 복구 절차
> Effort:       XL
> Risk:         High - 학생 잔액·원장과 모든 기능 writer를 같은 전환 시점에 바꾸므로 이관 대조와 구버전 차단이 필수다.

## Scope
### Must have
- 브라우저에서 지갑·원장·보상 claim·경매 예약을 직접 저장하지 않고, 관련 행을 한 DB transaction으로 커밋한다.
- `protocolVersion: 2`, 안정적인 `requestId`, actor 범위 payload hash와 저장된 receipt로 응답 유실/재시도를 exactly-once 처리한다.
- 교사 설정은 feature row, 학생 상태는 student/feature/entity row, 목록성 데이터는 개별 record row로 저장하며 전역 CAS hot row를 제거한다.
- 기존 `weekly_mission_rewards`, Classword, Today Friend의 전용 테이블/행위를 보존하면서 보상만 새 wallet/ledger transaction에 연결한다.
- 기존 원본 JSON, ID, 시각, 현재 잔액, 읽음 상태, bid/award/reservation, 과거 보상 ID를 lossless 이관한다.
- 기존 history로 잔액을 재계산하지 않고, 검증된 cutover 잔액을 opening checkpoint로 고정한 뒤 v2 ledger만 합산한다.
- 학생 1..23 및 교사 동시 세션, 응답 유실, 재시도, stale read, 다른 학생 scope, 구버전 writer 차단을 자동 검증한다.
- `mock` localStorage fallback과 `readonly` 무쓰기 동작을 유지하고, 실패한 입력 초안은 기기·학생·기능·entity 범위로 보존한다.
- maintenance 진입 → writer drain → 최종 백업 → 이관 → 대조 → 서버/클라이언트 배포 → 운영 확인 → 재개 순서를 지킨다.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- `app_settings` 전체 snapshot에 대한 신규/잔존 운영 write, client-supplied balance/history overwrite, dual-write를 허용하지 않는다.
- 운영 학생 잔액·입찰·보상·편지를 QA fixture로 사용하거나 역거래를 복구로 간주하지 않는다.
- 기존 52고마 복구 ID를 다시 지급하거나, 근거 불충분한 7월 4건을 자동 지급하지 않는다.
- ledger row를 수정/삭제하거나 보상 취소·경매 초기화를 기록 삭제로 구현하지 않는다. 반대 부호의 compensating entry를 남긴다.
- `service_role`/session secret을 브라우저 모듈·로그·오류 응답에 노출하거나 `src/server`를 브라우저 bundle에 import하지 않는다.
- transient retry를 business denial, 이미 차지한 Classword 초성, 완료된 idempotent replay에 적용하지 않는다.
- 확인되지 않은 write를 성공 처리하거나, save alert 확인을 기록 복구로 표시하지 않는다.
- 새 외부 의존성, 신규 direct Vercel handler, 데이터 삭제, history truncation을 도입하지 않는다.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node `node:test`/`tsx`, disposable PostgreSQL 18 integration tests, browser surface QA
- QA policy: every task has agent-executed scenarios
- Evidence: `<attemptDir>/task-<N>-<slug>.<ext>` — under ulw-loop, `<attemptDir>` is the `currentAttemptDir` from `omo ulw-loop status --json` (`.omo/evidence/ulw/<session>/<goalId>/a<attempt>`); outside ulw-loop use `.omo/evidence/`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: v2 protocol, resource keys, SQL core schema
- Task 2: legacy snapshot lossless split/assemble and reconciliation manifest
- Task 3: disposable PostgreSQL integration harness and fixtures
- Task 4: device-scoped draft/retry store and command client state machine
- Task 5: legacy compatibility projection codecs

Wave 2 (after Wave 1):
- Task 6: server repository and generic resource/receipt RPC access, depends [1, 3]
- Task 7: wallet, ledger, claims, economy actions, depends [1, 2, 3, 6]
- Task 8: auction cycle/bid/reservation/award commands, depends [1, 2, 3, 6, 7]
- Task 9: mail, emotion, pet/profile, games, mission and failure-story records, depends [1, 2, 3, 6]
- Task 10: weekly mission, donation, Classword and Today Friend reward integration, depends [1, 3, 6, 7]
- Task 11: books, writing and library competition records, depends [1, 2, 3, 6, 7]

Wave 3 (after Wave 2):
- Task 12: `/api/shared-settings` v2 bundle/projection and teacher resource writes, depends [5, 6]
- Task 13: student page/hooks conversion to commands and resource reads, depends [4, 6, 7, 8, 9, 10, 11, 12]
- Task 14: teacher page conversion to per-feature commands, depends [6, 7, 8, 9, 10, 11, 12]
- Task 15: maintenance gate, old-protocol rejection, save-alert classification, depends [4, 6, 12]
- Task 16: full concurrency, authorization, migration and browser regression suite, depends [7, 8, 9, 10, 11, 13, 14, 15]

Wave 4 (cutover after all implementation):
- Task 17: production backup, maintenance drain, migrate and reconcile, depends [2, 15, 16]
- Task 18: deploy server/client and verify deployment region, depends [17]
- Task 19: production read-only reconciliation, reopen or execute safe rollback/fix-forward branch, depends [18]

Critical path: Task 1 -> Task 6 -> Task 7 -> Task 8 -> Task 13 -> Task 16 -> Task 17 -> Task 18 -> Task 19

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1 | none | 6, 7, 8, 9, 10, 11 | 2, 3, 4, 5 |
| 2 | none | 7, 8, 9, 11, 17 | 1, 3, 4, 5 |
| 3 | none | 6-11 | 1, 2, 4, 5 |
| 4 | none | 13, 15 | 1, 2, 3, 5 |
| 5 | none | 12 | 1, 2, 3, 4 |
| 6 | 1, 3 | 7-12, 15 | none after start |
| 7 | 1, 2, 3, 6 | 8, 10, 11, 13, 14, 16 | 9 |
| 8 | 1, 2, 3, 6, 7 | 13, 14, 16 | 9, 10, 11 |
| 9 | 1, 2, 3, 6 | 13, 14, 16 | 7, 8, 10, 11 |
| 10 | 1, 3, 6, 7 | 13, 14, 16 | 8, 9, 11 |
| 11 | 1, 2, 3, 6, 7 | 13, 14, 16 | 8, 9, 10 |
| 12 | 5, 6 | 13, 14, 15 | 7-11 |
| 13 | 4, 6-12 | 16 | 14, 15 |
| 14 | 6-12 | 16 | 13, 15 |
| 15 | 4, 6, 12 | 16, 17 | 13, 14 |
| 16 | 7-15 | 17 | none |
| 17 | 2, 15, 16 | 18 | none |
| 18 | 17 | 19 | none |
| 19 | 18 | final verification | none |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. 저장 v2 공통 계약과 core schema 확정

  What to do: `ResourceKey`, `ResourceSnapshot`, `CommandEnvelope`, `CommandReceipt`를 `src/lib/storageV2.ts`에 정의하고, `supabase/storage_v2.sql`에 `storage_meta`, `teacher_resources`, `student_resources`, `command_receipts`, `wallet_accounts`, `wallet_ledger`, `reward_claims`를 만든다. `actor_key + request_id`를 receipt PK로, canonical payload SHA-256을 mismatch 검출에 사용한다. wallet은 1..23/0..999999, ledger는 append-only trigger, 모든 RPC는 `SECURITY DEFINER SET search_path=''`, schema-qualified name과 service-role-only execute를 쓴다.
  Must NOT do: generic resource RPC로 wallet/ledger/claim을 변경하거나 JSON array에 복수 학생/전체 목록을 다시 묶지 않는다.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7, 8, 9, 10, 11] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `supabase/app_settings.sql:79` - 기존 reward natural key와 보안 grant 패턴
  - Pattern:  `supabase/app_settings.sql:129` - 기존 atomic reward RPC 및 `search_path` 패턴
  - API/Type: `src/lib/currency.ts:11` - 잔액/원장 타입과 reason 호환 계약
  - External: `https://postgrest.org/en/stable/references/transactions.html` - RPC 요청의 transaction 경계
  - External: `https://supabase.com/docs/guides/database/functions` - 함수 권한과 security-definer 안전 설정

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/lib/storageV2.test.ts tests/integration/storageV2Schema.test.ts`가 타입 파싱, key scope, RLS/grant, ledger update/delete 차단, requestId payload mismatch를 모두 통과한다.
  - [ ] `rg -n "app_settings|currencyBalances|currencyHistory" supabase/storage_v2.sql` 결과에 compatibility read 외 신규 write가 없다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 같은 actor/requestId/payload가 같은 receipt를 재생한다
    Tool:     bash
    Steps:    `SCHOOL_STORAGE_TEST_DATABASE_URL="$SCHOOL_STORAGE_TEST_DATABASE_URL" node --import tsx --test tests/integration/storageV2Schema.test.ts --test-name-pattern="same receipt"`
    Expected: 두 호출의 receipt와 ledger row 수가 동일하고 ledger는 한 번만 증가한다.
    Evidence: <attemptDir>/task-1-storage-v2-schema.txt

  Scenario: 같은 requestId에 다른 payload를 보낸다
    Tool:     bash
    Steps:    위 테스트를 `--test-name-pattern="payload mismatch"`로 실행한다.
    Expected: `IDEMPOTENCY_PAYLOAD_MISMATCH`이며 wallet/ledger/resource revision이 바뀌지 않는다.
    Evidence: <attemptDir>/task-1-storage-v2-schema-error.txt
  ```

  Commit: YES | Message: `feat(storage): define v2 resource and command contracts` | Files: [src/lib/storageV2.ts, src/lib/storageV2.test.ts, supabase/storage_v2.sql, tests/integration/storageV2Schema.test.ts]

- [ ] 2. Legacy snapshot lossless 이관 codec과 대조 manifest 구현

  What to do: raw `app_settings.value`를 teacher/student/record/economy/auction/library rows로 split하고 다시 legacy projection으로 assemble하는 순수 codec을 만든다. 정규화 전에 원본 JSON을 보관하고, ID/count/timestamp/current balance/read state/reservation/award/reward ID manifest를 생성한다. history 합으로 wallet을 재계산하지 말고 current balance를 opening checkpoint로 기록한다.
  Must NOT do: normalizer의 최대 개수 제한으로 원본 history/letters/books를 truncate하거나, 근거 불충분한 7월 reward를 생성하지 않는다.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [7, 8, 9, 11, 17] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/pages/TimerPage.tsx:403` - 현재 전체 snapshot shape
  - Pattern:  `src/lib/studentLife.ts:40` - letters/books/failureStories/profile assignments 복합 shape
  - Pattern:  `src/lib/studentEmotion.ts:101` - 학생/날짜별 감정 record
  - Pattern:  `src/lib/sudoku.ts:119` - student/date/difficulty game key
  - Pattern:  `src/lib/numberBaseball.ts:72` - student/date game key
  - Test:     `src/lib/weeklyMission.test.ts:875` - 30건 이후에도 reward ID를 보존하는 계약

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/server/storageV2Migration.test.ts`에서 malformed/legacy fixture를 `split -> assemble`했을 때 모든 원본 record ID/count/time와 현재 balance/reservation/award가 일치한다.
  - [ ] fixture에 이미 복구된 reward ID를 넣었을 때 manifest가 중복 claim을 만들지 않는다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 23명 복합 fixture를 lossless 분할·재조립한다
    Tool:     bash
    Steps:    `node --import tsx --test src/server/storageV2Migration.test.ts --test-name-pattern="lossless manifest"`
    Expected: manifest mismatch 배열이 비어 있고 opening checkpoint는 fixture current balance와 같다.
    Evidence: <attemptDir>/task-2-storage-migration-codec.txt

  Scenario: 잘못된 학생 번호와 중복 ID가 포함된다
    Tool:     bash
    Steps:    같은 파일을 `--test-name-pattern="invalid legacy"`로 실행한다.
    Expected: 이관을 중단하고 `STORAGE_MIGRATION_SOURCE_INVALID`를 반환하며 일부 row를 만들지 않는다.
    Evidence: <attemptDir>/task-2-storage-migration-codec-error.txt
  ```

  Commit: YES | Message: `feat(storage): add lossless legacy migration codec` | Files: [src/server/storageV2Migration.ts, src/server/storageV2Migration.test.ts, tests/fixtures/storage-v2-legacy.json]

- [ ] 3. Disposable PostgreSQL 통합 테스트 harness 구축

  What to do: 임시 PostgreSQL에 현재 SQL과 v2 SQL을 순서대로 적용하고 transaction마다 schema를 초기화하는 test helper를 추가한다. 23학생+교사 signed session fixture와 concurrent barrier를 제공한다. `pg`는 `/tmp/school-storage-runtime`의 테스트 runtime에서만 사용하고 repo dependency로 추가하지 않는다.
  Must NOT do: Supabase 운영 프로젝트 또는 실학생 데이터를 integration fixture로 연결하지 않는다.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7, 8, 9, 10, 11] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Test:     `tests/api/student-economy.test.ts:89` - signed handler fixture와 경제 assertion 패턴
  - Test:     `tests/api/shared-settings.test.ts:946` - 실제 race/barrier 기대 결과
  - Pattern:  `package.json:13` - Node test runner 계약

  Acceptance criteria (agent-executable only):
  - [ ] `NODE_PATH=/tmp/school-storage-runtime/node_modules npm test -- --test-name-pattern="storage v2 integration harness"`가 disposable DB만 사용하고 통과한다.
  - [ ] 환경변수 미지정 시 테스트가 운영 fallback 없이 명시적으로 skip 또는 `TEST_DATABASE_REQUIRED`로 종료한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 빈 임시 DB에 schema를 두 번 적용한다
    Tool:     bash
    Steps:    `SCHOOL_STORAGE_TEST_DATABASE_URL="$SCHOOL_STORAGE_TEST_DATABASE_URL" NODE_PATH=/tmp/school-storage-runtime/node_modules node --import tsx --test tests/integration/storageV2Harness.test.ts`
    Expected: 두 번째 적용도 성공하고 fixture row 수가 정확히 23 wallet+1 meta다.
    Evidence: <attemptDir>/task-3-postgres-harness.txt

  Scenario: 운영 Supabase URL을 test DB로 전달한다
    Tool:     bash
    Steps:    URL guard unit test의 `reject remote host` case를 실행한다.
    Expected: 연결 전에 `LIVE_DATABASE_FORBIDDEN`으로 거절한다.
    Evidence: <attemptDir>/task-3-postgres-harness-error.txt
  ```

  Commit: YES | Message: `test(storage): add disposable postgres integration harness` | Files: [tests/integration/storageV2TestDb.ts, tests/integration/storageV2Harness.test.ts]

- [ ] 4. 기기·학생·기능별 초안과 command retry 상태 구현

  What to do: 초안 key를 `deviceSession identity/student/feature/entity`로 scope하고, requestId는 최초 action 시 한 번 생성해 확인될 때까지 유지한다. transient error 최대 5회 exponential+jitter, uncertain response는 receipt lookup 후 사용자가 직접 재시도하도록 한다. 성공 receipt에서만 draft를 지운다.
  Must NOT do: offline 자동 replay, 재시도 때 새 requestId 생성, 다른 학생 초안 로드, business denial 재시도를 하지 않는다.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [13, 15] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/lib/studentEconomyClient.ts:105` - 동일 requestId 네트워크 재시도
  - Pattern:  `src/lib/supabaseSettings.ts:107` - transient 판정과 retry-after 처리
  - Pattern:  `src/components/student/TodayFriendMissionForm.tsx:44` - 기존 device-local draft
  - Test:     `src/lib/studentEconomyClient.test.ts:124` - 응답 본문 유실 복구

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/lib/studentSaveDraft.test.ts src/lib/storageCommandClient.test.ts`가 scope 격리, stable ID, receipt 확인, 성공 후 삭제를 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 응답 유실 후 receipt가 committed다
    Tool:     bash
    Steps:    `node --import tsx --test src/lib/storageCommandClient.test.ts --test-name-pattern="lost response"`
    Expected: 동일 requestId를 사용하고 mutation 재전송 없이 committed 결과를 반환하며 draft가 삭제된다.
    Evidence: <attemptDir>/task-4-command-draft.txt

  Scenario: 학생 9의 초안을 학생 4 세션에서 연다
    Tool:     bash
    Steps:    draft test의 `student scope` case를 실행한다.
    Expected: 빈 초안이며 학생 9 저장 항목은 유지된다.
    Evidence: <attemptDir>/task-4-command-draft-error.txt
  ```

  Commit: YES | Message: `feat(storage): preserve scoped drafts across retries` | Files: [src/lib/studentSaveDraft.ts, src/lib/studentSaveDraft.test.ts, src/lib/storageCommandClient.ts, src/lib/storageCommandClient.test.ts]

- [ ] 5. v2 resource bundle의 legacy read projection 정의

  What to do: v2 rows를 기존 `SharedSchoolTimerSettings` shape로 조립하되 read-only compatibility projection으로 한정한다. teacher full/student scoped projection을 분리하고, student projection은 본인 row와 공용 teacher resource만 포함한다. resource revision map을 응답에 추가해 늦은 read가 최신 row를 덮지 못하게 한다.
  Must NOT do: projection을 DB source of truth 또는 writable snapshot으로 사용하지 않는다.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [12] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `api/shared-settings.ts:45` - 현재 학생 projection/allowlist
  - API/Type: `src/lib/supabaseSettings.ts:18` - 기존 SettingsRow 응답
  - Pattern:  `src/pages/TimerPage.tsx:4567` - 화면 snapshot 적용 지점
  - Test:     `tests/api/shared-settings.test.ts:297` - large map student scope 보호

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/lib/storageV2Projection.test.ts`가 teacher full, student own scope, legacy default를 검증한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 교사 bundle을 legacy shape로 조립한다
    Tool:     bash
    Steps:    projection test의 `teacher full` case를 실행한다.
    Expected: 모든 feature/record가 기존 normalizer 입력 shape와 동일하고 revisions가 resource별로 존재한다.
    Evidence: <attemptDir>/task-5-legacy-projection.txt

  Scenario: 학생 7 projection에 학생 8 private row를 주입한다
    Tool:     bash
    Steps:    projection test의 `student isolation` case를 실행한다.
    Expected: 학생 8 emotion/pet/game/mail/economy가 응답에 없다.
    Evidence: <attemptDir>/task-5-legacy-projection-error.txt
  ```

  Commit: YES | Message: `feat(storage): project v2 rows into scoped legacy reads` | Files: [src/lib/storageV2Projection.ts, src/lib/storageV2Projection.test.ts]

- [ ] 6. 서버 resource repository와 generic command receipt 경계 구현

  What to do: `src/server/storageV2Rows.ts`에서 unknown DB row parser, `storageV2Repository.ts`에서 `loadResource`, `loadResourceBundle`, `putTeacherResource`, `executeStudentCommand`, `getCommandReceipt`를 구현한다. 모든 write는 RPC 한 번으로 호출하고 repository error를 안정된 status/code로 변환한다.
  Must NOT do: HTTP/session 검사를 repository에 숨기거나 browser fallback을 넣거나 PostgREST 응답을 unchecked cast하지 않는다.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [7, 8, 9, 10, 11, 12, 15] | Blocked by: [1, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/server/todayFriendRows.ts:1` - DB snake_case row validation
  - Pattern:  `src/server/classwordRepository.ts:1` - PostgREST timeout/error mapping
  - Pattern:  `src/server/AGENTS.md:27` - select/parser 동시 변경과 `.js` import 규칙
  - External: `https://postgrest.org/en/stable/references/api/functions.html` - RPC 호출 계약

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/server/storageV2Rows.test.ts tests/api/storageV2Repository.test.ts`가 malformed/204/409/502/receipt replay를 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: resource bundle과 receipt를 읽는다
    Tool:     bash
    Steps:    `node --import tsx --test tests/api/storageV2Repository.test.ts --test-name-pattern="bundle and receipt"`
    Expected: typed snapshot/receipt가 반환되고 resource revision이 보존된다.
    Evidence: <attemptDir>/task-6-storage-repository.txt

  Scenario: DB row에 누락 필드가 있다
    Tool:     bash
    Steps:    rows test의 `invalid response` case를 실행한다.
    Expected: `STORAGE_DATABASE_INVALID_RESPONSE`, status 502이며 원문 body를 노출하지 않는다.
    Evidence: <attemptDir>/task-6-storage-repository-error.txt
  ```

  Commit: YES | Message: `feat(storage): add v2 server repository boundary` | Files: [src/server/storageV2Rows.ts, src/server/storageV2Rows.test.ts, src/server/storageV2Repository.ts, tests/api/storageV2Repository.test.ts]

- [ ] 7. Wallet·ledger·economy를 atomic command로 전환

  What to do: `student_economy_states`와 wallet command RPC를 추가하고 현재 `StudentEconomyAction` 계산 규칙을 유지한다. transfer/house creator reward는 관련 wallet을 student number 오름차순으로 lock하고, debit/credit/letters/inventory/state/receipt를 한 transaction에 기록한다. 기존 processedRequestIds는 이관하되 신규 dedupe는 command receipt가 맡는다.
  Must NOT do: 최근 24개 requestId 제한, JSON CAS retry, ledger update/delete, reserved balance 무시를 유지하지 않는다.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8, 10, 11, 13, 14, 16] | Blocked by: [1, 2, 3, 6]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/lib/studentEconomy.ts:315` - 현재 action union
  - Pattern:  `api/student-economy.ts:183` - 기존 순수 domain transition 재사용 지점
  - Pattern:  `api/student-economy.ts:303` - transfer 양쪽 원장 계약
  - Pattern:  `api/student-economy.ts:318` - house creator reward/letter 결합
  - Test:     `tests/api/student-economy.test.ts:236` - retry 시 random roll 고정
  - External: `https://www.postgresql.org/docs/current/sql-select.html` - `FOR UPDATE` lock

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/lib/studentEconomy.test.ts tests/api/student-economy.test.ts tests/integration/storageV2Economy.test.ts`가 모두 통과한다.
  - [ ] 동일 requestId 10회 병렬 호출 시 wallet delta/재고/letter/receipt가 각각 1회뿐이다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 학생 3에서 4로 송금과 다른 debit를 동시에 수행한다
    Tool:     bash
    Steps:    integration test의 `concurrent transfer debit` case를 20회 반복한다.
    Expected: overspend가 없고 각 ledger before/after가 연속이며 합계와 wallet이 일치한다.
    Evidence: <attemptDir>/task-7-wallet-economy.txt

  Scenario: 동일 requestId의 다른 금액을 재전송한다
    Tool:     bash
    Steps:    economy integration test의 `payload mismatch` case를 실행한다.
    Expected: 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`, 추가 ledger/inventory/letter가 없다.
    Evidence: <attemptDir>/task-7-wallet-economy-error.txt
  ```

  Commit: YES | Message: `feat(economy): move wallet actions to atomic ledger commands` | Files: [supabase/storage_v2_economy.sql, src/server/storageV2EconomyRepository.ts, api/student-economy.ts, tests/api/student-economy.test.ts, tests/integration/storageV2Economy.test.ts]

- [ ] 8. 경매 cycle·bid·reservation·award를 독립 transaction으로 전환

  What to do: auction cycle/item/bid/event/award/reservation tables와 bid/award/cancel/reset RPC를 만든다. bid 갱신은 기존 item reservation을 원자 교체하고, award는 winner debit+award+reservation release를 한 transaction으로 수행한다. 취소/화요일 초기화는 compensating event로 기록한다.
  Must NOT do: auction 전체 map overwrite, 화면 잔액만으로 bid 허용, reset 시 bid history/ledger 삭제를 하지 않는다.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [13, 14, 16] | Blocked by: [1, 2, 3, 6, 7]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/lib/currency.ts:52` - bid/item/award shape
  - Pattern:  `src/pages/AuctionPage.tsx:1615` - 현재 학생 bid write
  - Pattern:  `src/pages/TimerPage.tsx:7295` - teacher award/reset write
  - Test:     `tests/api/shared-settings.test.ts:946` - same-slot race 계약

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test tests/integration/storageV2Auction.test.ts src/lib/auctionItemPersistence.test.ts`가 통과한다.
  - [ ] 모든 active reservation 합이 spendable balance 계산과 같고 award/cancel 뒤 stale reservation이 0이다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 같은 물품에 23학생이 동시에 입찰한다
    Tool:     bash
    Steps:    auction integration test의 `23 bidder race` case를 실행한다.
    Expected: 최고 유효 bid 1개, 학생별 reservation 정확, overspend 없음, event 23개가 보존된다.
    Evidence: <attemptDir>/task-8-auction.txt

  Scenario: 낙찰 응답 유실 후 cancel을 재시도한다
    Tool:     bash
    Steps:    `lost award response` case를 실행한다.
    Expected: receipt replay로 debit/award/cancel 각각 1회이며 history를 삭제하지 않는다.
    Evidence: <attemptDir>/task-8-auction-error.txt
  ```

  Commit: YES | Message: `feat(auction): store bids reservations and awards atomically` | Files: [supabase/storage_v2_auction.sql, src/server/storageV2AuctionRepository.ts, tests/integration/storageV2Auction.test.ts]

- [ ] 9. 학생 생활·감정·게임·미션을 개별 record command로 전환

  What to do: mail messages/read receipt, emotion `(student,date)`, game `(student,gameType,gameKey)`, mission `(student,type,period)`, failure story/reaction, pet/profile state를 독립 record로 저장한다. mail read는 idempotent, send ID는 retry callback 밖에서 생성한다. game completion과 reward claim은 하나의 RPC로 묶는다.
  Must NOT do: `studentLife`/emotion/game 전체 배열·map overwrite, mail read로 message 본문 수정, reward와 progress 분리 commit을 하지 않는다.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [13, 14, 16] | Blocked by: [1, 2, 3, 6]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/lib/studentLife.ts:11` - mail/book record shape
  - API/Type: `src/lib/studentEmotion.ts:101` - emotion record shape
  - API/Type: `src/lib/sudoku.ts:24` - Sudoku progress
  - API/Type: `src/lib/numberBaseball.ts:28` - Number Baseball progress
  - Pattern:  `src/lib/useStudentSudokuState.ts:120` - completion+reward 결합
  - Pattern:  `src/lib/useStudentNumberBaseballState.ts:102` - game reward 결합

  Acceptance criteria (agent-executable only):
  - [ ] 각 feature API/integration test가 다른 학생 row 불변, same command replay, record별 revision을 검증한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 편지 send/read와 감정·게임 완료를 병렬 저장한다
    Tool:     bash
    Steps:    `node --import tsx --test tests/integration/storageV2StudentRecords.test.ts --test-name-pattern="parallel records"`
    Expected: 서로 충돌하지 않고 모든 record가 1회 저장되며 game reward ledger도 1회다.
    Evidence: <attemptDir>/task-9-student-records.txt

  Scenario: 학생 4가 학생 9 mail read/progress key를 쓴다
    Tool:     bash
    Steps:    같은 파일의 `scope violation` case를 실행한다.
    Expected: 403 scope error이며 대상 record revision이 변하지 않는다.
    Evidence: <attemptDir>/task-9-student-records-error.txt
  ```

  Commit: YES | Message: `feat(student): persist life emotion games and missions by record` | Files: [supabase/storage_v2_student_records.sql, src/server/storageV2StudentRepository.ts, tests/integration/storageV2StudentRecords.test.ts]

- [ ] 10. 기존 reward RPC를 새 wallet/claim transaction에 연결

  What to do: weekly mission, personal question, Classword word/quiz, Today Friend approval, class donation이 기존 natural key/source event와 reward amount를 보존하며 새 wallet/ledger/claim RPC를 호출하게 한다. Classword save-entry/quiz completion과 claim은 한 DB RPC로 합치고 UNIQUE conflict를 `INITIAL_OCCUPIED`, own existing entry, idempotent replay로 구분한다.
  Must NOT do: quiz +6 등 실제 reward amount를 고정 5로 바꾸거나, 모든 409를 `CLASSWORD_ENTRY_CONFLICT`로 매핑하지 않는다.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [13, 14, 16] | Blocked by: [1, 3, 6, 7]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `supabase/app_settings.sql:79` - weekly claim natural key/amount
  - Pattern:  `src/server/classwordRepository.ts:413` - 현재 separate reward RPC
  - Pattern:  `src/server/todayFriendRepository.ts:200` - approval reward 경계
  - Pattern:  `api/class-donation.ts:30` - donation RPC transport
  - Test:     `tests/api/classword.test.ts:510` - quiz completion/reward behavior
  - Test:     `src/lib/weeklyMission.test.ts:39` - variable +6 reward 보존 회귀

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test tests/api/{weekly-mission,weekly-missions,classword,today-friend}.test.ts src/lib/weeklyMission.test.ts tests/integration/storageV2Rewards.test.ts`가 통과한다.
  - [ ] reward amount 1..10 각각과 stale teacher save를 병렬 실행해 실제 delta가 사라지거나 중복되지 않는다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 퀴즈 +1..+10과 교사 설정 저장을 동시에 실행한다
    Tool:     bash
    Steps:    rewards integration test의 `variable quiz rewards` case를 실행한다.
    Expected: claim/ledger 10건의 delta가 각각 입력과 같고 setting revision과 독립적으로 모두 보존된다.
    Evidence: <attemptDir>/task-10-rewards.txt

  Scenario: 같은 초성을 두 학생이 동시에 제출한다
    Tool:     bash
    Steps:    Classword API test의 `simultaneous initial` case를 실행한다.
    Expected: 1명만 commit, 다른 학생은 `INITIAL_OCCUPIED`와 보존된 draft를 받고 save alert는 생성되지 않는다.
    Evidence: <attemptDir>/task-10-rewards-error.txt
  ```

  Commit: YES | Message: `feat(rewards): connect mission and classword claims to wallets` | Files: [supabase/storage_v2_rewards.sql, src/server/classwordRepository.ts, src/server/todayFriendRepository.ts, api/weekly-mission.ts, api/weekly-missions.ts, api/class-donation.ts, api/classword.ts, tests/integration/storageV2Rewards.test.ts]

- [ ] 11. 도서·글쓰기·도서관 competition을 record 저장으로 전환

  What to do: `student_books`, writing assignment/completion, library season/participant/placement/archive tables와 RPC를 만든다. 책 메타데이터/감상/slot을 authoritative book row로 통합하고 competition projection은 이 row를 참조한다. 글쓰기 발행은 assignment와 학생별 mail을, 보상/취소는 claim+compensating ledger와 completion을 한 transaction으로 처리한다.
  Must NOT do: library snapshot 안에 authoritative book 전체를 복제하거나 reward 취소 시 원래 ledger를 삭제하지 않는다.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [13, 14, 16] | Blocked by: [1, 2, 3, 6, 7]

  References (executor has NO interview context - be exhaustive):
  - API/Type: `src/lib/studentLife.ts:23` - book record fields/limits
  - Pattern:  `supabase/library_competition.sql:3` - archive와 보호 RPC 현 계약
  - Pattern:  `src/lib/dailyWriting.ts:223` - assignment+23 letters publish
  - Pattern:  `src/lib/dailyWriting.ts:285` - reward ID/amount contract
  - Test:     `tests/api/shared-settings.test.ts:999` - placement 응답 유실 dedupe

  Acceptance criteria (agent-executable only):
  - [ ] library/writing integration tests에서 same-slot one winner, different-slot both survive, lost response replay, publish 23 mail, reward/cancel compensating ledger를 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 서로 다른 slot 책 배치와 competition 갱신을 병렬 실행한다
    Tool:     bash
    Steps:    `node --import tsx --test tests/integration/storageV2Library.test.ts --test-name-pattern="parallel placement"`
    Expected: 두 책 모두 authoritative row에 남고 competition revision은 단조 증가한다.
    Evidence: <attemptDir>/task-11-library-writing.txt

  Scenario: 이미 지급한 글쓰기 보상을 취소 후 재취소한다
    Tool:     bash
    Steps:    같은 파일의 `compensating cancellation` case를 실행한다.
    Expected: 첫 취소만 음수 ledger를 생성하고 재취소는 receipt replay이며 원 reward row는 보존된다.
    Evidence: <attemptDir>/task-11-library-writing-error.txt
  ```

  Commit: YES | Message: `feat(library): persist books writing and competition by record` | Files: [supabase/storage_v2_library.sql, src/server/storageV2LibraryRepository.ts, src/lib/libraryCompetitionClient.ts, src/lib/canvasLibraryClient.ts, tests/integration/storageV2Library.test.ts]

- [ ] 12. `/api/shared-settings`를 v2 read/projection·teacher resource 경계로 교체

  What to do: 기존 path를 유지해 GET은 role별 v2 bundle/legacy projection, metadata GET은 revision vector를 반환한다. PUT은 teacher가 명시한 resource key/value/expectedRevision만 갱신하고, POST는 non-economy command envelope를 처리한다. protocol v1 write는 maintenance/cutover 이후 안정된 오류로 차단한다.
  Must NOT do: body의 학생 번호를 session보다 신뢰하거나 전체 settings PUT을 계속 허용하지 않는다.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [13, 14, 15] | Blocked by: [5, 6]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `api/shared-settings.ts:414` - guard 순서와 GET/PUT entry
  - Pattern:  `api/AGENTS.md:27` - configuration/session/GET/write guard contract
  - Test:     `tests/api/shared-settings.test.ts:193` - registered read requirement
  - Test:     `tests/api/shared-settings.test.ts:386` - teacher field scope

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test tests/api/shared-settings.test.ts src/lib/vercelFunctionImports.test.ts`가 v2 계약으로 통과하고 handler 수가 12 이하이다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 교사 resource PUT 후 학생 scoped GET
    Tool:     curl
    Steps:    disposable local API에 signed teacher cookie로 `PUT /api/shared-settings` resource 1개 저장 후 signed student-7 cookie로 GET한다.
    Expected: resource revision만 +1이고 학생 7 projection에 공용 값은 보이나 타 학생 private record는 없다.
    Evidence: <attemptDir>/task-12-shared-api.txt

  Scenario: 구버전 전체 snapshot PUT
    Tool:     curl
    Steps:    `{value:{currencyBalances:{...}},expectedUpdatedAt:...}` v1 body를 PUT한다.
    Expected: 409 `STORAGE_PROTOCOL_UPGRADE_REQUIRED`, 어떤 v2 row도 변경되지 않는다.
    Evidence: <attemptDir>/task-12-shared-api-error.txt
  ```

  Commit: YES | Message: `refactor(api): route shared settings through v2 resources` | Files: [api/shared-settings.ts, tests/api/shared-settings.test.ts, src/lib/vercelFunctionImports.test.ts]

- [ ] 13. 학생 화면과 hooks를 v2 command/resource client로 전환

  What to do: `AuctionPage`의 bid/life/emotion/pet/profile/house/mission/mail handlers와 Sudoku/Number Baseball hooks를 v2 command client로 바꾼다. resource별 revision을 적용해 stale late read를 억제하고, 실패 시 draft/input과 requestId를 유지한다. mock/readonly local branches는 기존 key/normalizer를 유지한다.
  Must NOT do: leaf component에서 persistence import, command 성공 전에 optimistic state를 확정, 실패 draft 삭제를 하지 않는다.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [16] | Blocked by: [4, 6, 7, 8, 9, 10, 11, 12]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/pages/AuctionPage.tsx:683` - 학생 life mutation entry
  - Pattern:  `src/pages/AuctionPage.tsx:744` - mail read/send state
  - Pattern:  `src/pages/AuctionPage.tsx:1615` - bid mutation
  - Pattern:  `src/lib/useStudentSudokuState.ts:65` - game save hook
  - Pattern:  `src/lib/useStudentNumberBaseballState.ts:56` - game save hook
  - Test:     `src/lib/studentSettingsUpdate.test.ts:59` - 학생 전체 writer import 차단

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "updateStudentSharedSettings" src/pages/AuctionPage.tsx src/lib/useStudent*State.ts` 결과가 0건이다.
  - [ ] 학생 관련 unit/API tests와 `npm run lint`가 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: mock 학생에서 편지/감정/게임 화면을 저장·새로고침한다
    Tool:     browser:control-in-app-browser
    Steps:    `npm run dev`의 `http://localhost:3000/#student-overview`를 disposable localStorage profile로 열고 각 화면에서 저장, reload, back/forward를 수행한다.
    Expected: 각 결과가 유지되고 pending/성공 상태가 정확하며 문서 전체 scroll/clipping이 없다.
    Evidence: <attemptDir>/task-13-student-ui.webm

  Scenario: command 502 뒤 사용자가 재시도한다
    Tool:     browser:control-in-app-browser
    Steps:    test server가 첫 POST 502, receipt GET not-found, 둘째 POST 200을 반환하게 하고 작성 draft를 제출한다.
    Expected: 실패 후 draft/동일 requestId가 유지되고 재시도 성공 뒤에만 삭제된다.
    Evidence: <attemptDir>/task-13-student-ui-error.webm
  ```

  Commit: YES | Message: `refactor(student): use granular storage commands` | Files: [src/pages/AuctionPage.tsx, src/lib/useStudentSudokuState.ts, src/lib/useStudentNumberBaseballState.ts, src/lib/studentSettingsSync.ts]

- [ ] 14. 교사 화면을 per-feature/resource command로 전환

  What to do: `TimerPage` hydration을 v2 bundle로 바꾸고 schedule/notice/media/draw/timer/catalog 등 teacher feature는 feature row PUT, currency/award/reset/tax/allowance/role/writing/mail은 typed command로 변경한다. 자동 저장은 변경된 feature만 debounce하고 각 resource revision을 추적한다.
  Must NOT do: `buildSharedSettingsSnapshot` 전체 저장, stale merge로 reward/transaction replay, reset에서 원장 삭제를 하지 않는다.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [16] | Blocked by: [6, 7, 8, 9, 10, 11, 12]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/pages/TimerPage.tsx:4526` - 제거할 전체 snapshot builder
  - Pattern:  `src/pages/TimerPage.tsx:4567` - bundle hydration 적용 지점
  - Pattern:  `src/pages/TimerPage.tsx:4901` - debounced 전체 save
  - Pattern:  `src/pages/TimerPage.tsx:6941` - currency command 전환 지점
  - Pattern:  `src/pages/TimerPage.tsx:9296` - writing/mail/library command 전환군

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "updateSharedSettings|buildSharedSettingsSnapshot|mergeConcurrentCurrencyUpdatesIntoSettings" src/pages/TimerPage.tsx` 결과가 compatibility hydration 외 0건이다.
  - [ ] `npm run lint`와 teacher/settings/reward test가 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 서로 다른 교사 설정을 두 탭에서 동시에 저장한다
    Tool:     browser:control-in-app-browser
    Steps:    disposable server에 교사 탭 2개를 열어 탭 A에서 공지, 탭 B에서 경매 mission을 동시에 저장하고 양쪽을 refresh한다.
    Expected: 두 resource가 모두 보존되고 각 revision만 증가하며 충돌 경고가 없다.
    Evidence: <attemptDir>/task-14-teacher-ui.webm

  Scenario: 같은 feature의 stale revision 저장
    Tool:     browser:control-in-app-browser
    Steps:    탭 A/B가 같은 notice revision을 읽고 A 저장 후 B 저장을 시도한다.
    Expected: B는 `RESOURCE_REVISION_CONFLICT`, 최신 값을 다시 보여 주며 draft를 잃지 않는다.
    Evidence: <attemptDir>/task-14-teacher-ui-error.webm
  ```

  Commit: YES | Message: `refactor(teacher): save classroom state by resource` | Files: [src/pages/TimerPage.tsx, src/lib/teacherSettingsSync.ts, src/lib/weeklyMission.ts]

- [ ] 15. Maintenance·구버전 차단·저장 오류 분류 완성

  What to do: `storage_meta.maintenance_mode/cutover_state/protocol_version`을 모든 write handler가 mutation 전에 확인한다. maintenance는 503+Retry-After, protocol v1은 upgrade-required로 차단한다. recovered replay/expected occupancy/business denial은 save alert에서 제외하고, 최종 실패만 안전한 student/feature/code/status metadata로 기록한다.
  Must NOT do: 원문 오류/request body/학생 작성 내용/secret 전송, 후속 성공 시 과거 alert 자동 삭제를 하지 않는다.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [16, 17] | Blocked by: [4, 6, 12]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/lib/saveFailureClient.ts:79` - 기능/화면 분류
  - Pattern:  `api/save-alerts.ts:12` - alert 독립 저장 경계
  - Test:     `tests/api/save-alerts.test.ts:19` - acknowledge와 보존 계약
  - Pattern:  `api/AGENTS.md:41` - stable error/status 계약

  Acceptance criteria (agent-executable only):
  - [ ] 전체 write handler test가 maintenance에서 upstream mutation 0회, 정상에서 기존 guard order를 검증한다.
  - [ ] save-failure tests가 recovered replay/INITIAL_OCCUPIED를 보고하지 않고 최종 409/502만 안전 필드로 보고한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: maintenance mode에서 24 세션이 동시에 write한다
    Tool:     bash
    Steps:    integration test의 `maintenance blocks writers` case를 실행한다.
    Expected: 모두 503 `STORAGE_MAINTENANCE`, Retry-After 존재, command/resource row 변화 0이다.
    Evidence: <attemptDir>/task-15-maintenance.txt

  Scenario: expected Classword occupancy와 recovered receipt
    Tool:     bash
    Steps:    save failure test의 `non-reportable outcomes` case를 실행한다.
    Expected: UI 결과는 표시되지만 `/api/save-alerts` POST는 0회다.
    Evidence: <attemptDir>/task-15-maintenance-error.txt
  ```

  Commit: YES | Message: `feat(storage): gate writes and classify save outcomes` | Files: [src/server/storageV2Repository.ts, api/shared-settings.ts, api/student-economy.ts, api/classword.ts, api/today-friend.ts, api/weekly-mission.ts, api/weekly-missions.ts, api/class-donation.ts, src/lib/saveFailure.ts, src/lib/saveFailureClient.ts, tests/api/save-alerts.test.ts]

- [ ] 16. 전체 동시성·권한·회귀·브라우저 검증 완성

  What to do: disposable PostgreSQL/API에서 24 signed sessions, 모든 금전 action, record updates, lost response, stale read, migration roundtrip, old client rejection을 한 suite로 실행한다. 브라우저는 1280x650, 1280x600, 1280x800에서 학생/교사 read and draft flows를 검증한다.
  Must NOT do: mock-only green을 production storage 검증으로 간주하거나 live mutation QA를 하지 않는다.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [17] | Blocked by: [7, 8, 9, 10, 11, 13, 14, 15]

  References (executor has NO interview context - be exhaustive):
  - Test:     `src/lib/sharedSettingsConcurrency.test.ts:82` - same-browser queue/stale response cases
  - Test:     `tests/api/shared-settings.test.ts:1184` - scoped GET→write preservation
  - Test:     `tests/api/student-economy.test.ts:283` - multi-resource economy idempotency
  - Pattern:  `src/pages/AGENTS.md:47` - Chromebook viewport QA contract

  Acceptance criteria (agent-executable only):
  - [ ] `npm run lint && npm test && npm run build`가 통과한다. 기존 baseline failure가 있다면 원인·SHA·비관련성을 별도 evidence에 남기고 storage suite는 100% 통과해야 한다.
  - [ ] `SCHOOL_STORAGE_TEST_DATABASE_URL="$SCHOOL_STORAGE_TEST_DATABASE_URL" NODE_PATH=/tmp/school-storage-runtime/node_modules node --import tsx --test tests/integration/storageV2*.test.ts`가 24-session race를 포함해 통과한다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 24세션 전체 workload
    Tool:     bash
    Steps:    integration suite의 `24 session workload`를 seed 1..20으로 반복한다.
    Expected: overspend/duplicate/lost record/foreign scope 0, 모든 wallet=opening+ledger sum, 모든 revision 단조 증가다.
    Evidence: <attemptDir>/task-16-full-integration.txt

  Scenario: viewport와 네트워크 실패 UI
    Tool:     browser:control-in-app-browser
    Steps:    1280x650→1280x600→1280x800에서 teacher/student 주요 화면을 열고 502/receipt-not-found를 주입해 retry UI를 관찰한다.
    Expected: clipping/overlap/unintended scroll가 없고 draft/명시적 재시도가 유지되며 접근 가능한 상태 문구가 보인다.
    Evidence: <attemptDir>/task-16-browser-qa.webm
  ```

  Commit: YES | Message: `test(storage): cover v2 concurrency and browser regressions` | Files: [tests/integration/storageV2Concurrency.test.ts, tests/integration/storageV2Authorization.test.ts, tests/integration/storageV2Migration.test.ts, src/lib/storageV2Presentation.test.ts]

- [ ] 17. 운영 백업·maintenance drain·이관·대조 실행

  What to do: deploy될 SHA와 migration 파일 checksum을 기록하고, teacher-authenticated raw snapshot 및 관련 dedicated tables를 암호화/권한 0600 backup artifact로 저장한다. maintenance를 켜고 active writer가 drain될 때까지 기다린 뒤 final backup을 다시 받아 한 transaction에서 v2 backfill한다. source/v2 manifest의 balance, IDs, counts, timestamps, read state, reservations, awards, reward claims를 대조한다.
  Must NOT do: mismatch가 하나라도 있으면 배포/재개하지 않고, 원본 `app_settings`를 삭제/수정하지 않는다.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [18] | Blocked by: [2, 15, 16]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/lib/supabaseSettings.ts:16` - source row ID
  - Pattern:  `supabase/app_settings.sql:1` - source schema
  - Pattern:  `supabase/library_competition.sql:3` - 함께 백업할 archive
  - External: `https://supabase.com/docs/guides/database/postgres/row-level-security` - production access 경계

  Acceptance criteria (agent-executable only):
  - [ ] cutover command가 backup path, SHA-256, source updated_at, row/count manifest, migration checksum을 출력하고 mismatch 0일 때만 exit 0이다.
  - [ ] source `app_settings` raw value hash가 maintenance 전/후 동일하다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: final production backup과 dry-run manifest 대조
    Tool:     bash
    Steps:    `node --env-file=.env.local --import tsx scripts/storageV2Cutover.ts backup --out /private/tmp/school-timer-storage-v2-backup.json` 후 `... reconcile --dry-run`을 실행한다.
    Expected: backup mode 0600, mismatch 0, source hash/updated_at가 evidence에 기록된다.
    Evidence: <attemptDir>/task-17-cutover-reconcile.json

  Scenario: fixture 한 row를 의도적으로 누락한 dry-run
    Tool:     bash
    Steps:    disposable DB에서 `reconcile --fixture missing-mail`을 실행한다.
    Expected: non-zero exit, 구체적 record key mismatch, maintenance 유지다.
    Evidence: <attemptDir>/task-17-cutover-reconcile-error.txt
  ```

  Commit: NO | Message: `chore(storage): execute verified production migration` | Files: []

- [ ] 18. Supabase migration과 Vercel server/client 배포

  What to do: 검증한 SQL checksum 그대로 Supabase에 적용하고, 검증된 commit SHA를 Vercel production에 배포한다. 새 서버가 먼저 maintenance 응답을 제공하고, 같은 deployment에서 v2 client가 활성화되게 한다. deployment function region이 Seoul `icn1`인지 실제 응답/metadata로 확인한다.
  Must NOT do: migration과 다른 source를 배포하거나, maintenance를 이 단계에서 해제하거나, 구버전 writer가 legacy DB에 도달하도록 두지 않는다.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [19] | Blocked by: [17]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `vercel.json:2` - `icn1` region 선언
  - Pattern:  `src/lib/vercelFunctionImports.test.ts:1` - direct function cap/import graph
  - Pattern:  `api/AGENTS.md:34` - server-only credentials

  Acceptance criteria (agent-executable only):
  - [ ] production health/read endpoints의 deployment SHA/protocolVersion이 local verified SHA/2와 일치한다.
  - [ ] response region 검사에서 `icn1`이 확인되고 production write는 계속 maintenance로 차단된다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: production deploy 후 read-only smoke
    Tool:     curl
    Steps:    signed teacher/student cookie로 production shared-settings GET, command receipt GET, health metadata를 요청한다.
    Expected: HTTP 200, protocolVersion 2, projection manifest 일치, mutation 없음, region `icn1`.
    Evidence: <attemptDir>/task-18-production-deploy.json

  Scenario: 구버전 v1 writer가 production에 요청한다
    Tool:     curl
    Steps:    v1 shared-settings PUT과 legacy economy body를 보낸다.
    Expected: maintenance/upgrade-required로 차단되고 source/v2 hashes가 변하지 않는다.
    Evidence: <attemptDir>/task-18-production-deploy-error.txt
  ```

  Commit: NO | Message: `chore(deploy): release storage v2` | Files: []

- [ ] 19. 운영 대조 후 재개 또는 안전한 rollback/fix-forward 실행

  What to do: teacher settings open, 23학생 scoped read, 최근 영향 transaction range를 read-only 대조한 뒤 mismatch가 0일 때만 maintenance를 해제한다. 해제 직후 disposable teacher-owned setting 1건만 save/read하고 학생 금전 mutation은 하지 않는다. 새 transaction 전 실패면 v2를 비활성화하고 legacy read-only backup으로 되돌릴 수 있다. 새 transaction 후 실패면 maintenance 재진입 후 ledger를 보존한 fix-forward만 수행한다.
  Must NOT do: 학생 live money로 smoke test, 새 v2 transaction 이후 old backup overwrite, mismatch 상태 재개를 하지 않는다.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [Final verification] | Blocked by: [18]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/pages/TimerPage.tsx:4650` - teacher initial read/hydration surface
  - Pattern:  `src/pages/AuctionPage.tsx:405` - student scoped hydration surface
  - Pattern:  `api/save-alerts.ts:1` - 독립 오류 조회 surface

  Acceptance criteria (agent-executable only):
  - [ ] 23학생+교사 read manifest mismatch 0, save-alert endpoint 정상, production maintenance false가 확인된다.
  - [ ] reopen evidence에 첫 v2 command 시각/ID가 기록되어 이후 rollback 가능 여부가 명확하다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: 대조 성공 후 재개
    Tool:     browser:control-in-app-browser
    Steps:    production 교사 설정을 read-only로 열고 23학생 overview를 순회한 뒤 maintenance 해제, teacher notice resource 저장/재조회만 수행한다.
    Expected: 모든 balance/read projection이 cutover manifest와 같고 notice revision만 +1, save alert 신규 오류 0이다.
    Evidence: <attemptDir>/task-19-reopen.webm

  Scenario: 대조 mismatch 주입 drill
    Tool:     bash
    Steps:    disposable cutover DB에서 학생 10 reservation mismatch를 주입하고 reopen command를 실행한다.
    Expected: reopen non-zero, maintenance true 유지, 학생/원장 row 변경 0이다.
    Evidence: <attemptDir>/task-19-reopen-error.txt
  ```

  Commit: NO | Message: `chore(storage): reopen verified v2 writes` | Files: []

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/storage-v2-cutover.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
