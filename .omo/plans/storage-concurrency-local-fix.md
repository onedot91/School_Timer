# 저장 읽기 부하와 불필요한 직렬화의 로컬 수정

## TL;DR
> Summary:      Classword 반복 읽기, 전체 snapshot 비용, 구조 조상 잠금, metadata follower 지연을 각각 격리해서 줄인다. 저장·권한 계약은 유지하며 개선 수치는 로컬 전후 측정으로만 제시한다.
> For whom:     낱말 활동을 하는 학생, 수업 현황을 보는 교사, 저장 API를 호출하는 프로그램.
> Deliverables:
> - 폴링·진행 중 GET 공유·SQL 읽기·잠금·metadata 수정과 회귀 테스트
> - 합성 데이터 전후 측정 및 사용자 실행용 SQL 적용 순서
> Effort:       Large
> Risk:         High - 잠금 변경이 부모 교체 및 지갑 무결성에 영향을 줄 수 있음

## Scope
### Affected user and ideal state
**Affected user:** 학생은 낱말과 퀴즈를 보고 저장하고, 교사는 원격 상태를 확인한다. 수정 후에도 같은 정보와 저장 결과를 얻되 불필요한 읽기와 관련 없는 작업의 대기를 줄인다. 운영 반영은 사용자가 직접 수행한다.

| Row | Statement | Reason |
|-----|-----------|--------|
| IS-1 | 보이는 낱말 화면이 제한된 주기로 갱신되고 저장 직후·복귀·날짜 변경을 놓치지 않는다 | 불필요한 읽기를 줄여도 학습 진행을 유지해야 함 |
| GAP-1 | 현재 refresh와 refreshQuiz가 3초마다 함께 실행된다 | 학생 수만큼 요청이 증폭됨 (`StudentClasswordPage.tsx:181`) |
| IS-2 | 동일 사용자·동일 요청의 동시 GET은 한 번만 전송되며 다음 읽기는 최신 정보를 얻는다 | 중복 조회와 오래된 결과 재사용을 함께 막음 |
| GAP-2 | Classword 공통 요청이 바로 fetch를 호출한다 | 겹친 호출이 공유되지 않음 (`classwordClient.ts:94`) |
| IS-3 | 교사 전체 snapshot 결과와 권한은 같고 측정된 SQL 비용은 감소한다 | 전체 상태 확인과 호환성 유지 |
| GAP-3 | 전체 snapshot은 전체 테이블 JSON 집계와 별도 revision 집계를 수행한다 | 큰 합성 데이터에서 실행 비용 검증 필요 (`storage_v2.sql:172`) |
| IS-4 | 다른 scope의 자식 쓰기는 공통 구조 조상 때문에 막히지 않고 부모 교체·동일 자원 충돌은 보호된다 | 처리량과 저장 무결성을 함께 유지 |
| GAP-4 | 조상이 p_expected에 포함되고 모든 resource expected가 배타 잠금을 얻는다 | 빈 root 조상도 공통 대기점 (`storageV2Repository.ts:395`, `storage_v2.sql:225`) |
| IS-5 | metadata follower는 느린 다른 scope leader를 제한된 시간만 기다리고 자기 scope 결과만 받는다 | 불필요한 순차 timeout과 정보 혼합을 방지 |
| GAP-5 | follower가 leader 완료 후 자기 metadata를 읽는다 | leader 지연에 own read 지연이 더해짐 (`storageV2Repository.ts:282`) |
| IS-6 | 변경의 효과·실패·미반영 범위를 재현 가능한 증거로 확인한다 | 운영 수리와 로컬 준비 완료를 혼동하지 않음 |
| GAP-6 | 이 변경 조합의 전후·동시성·브라우저 증거가 아직 없다 | 개별 성공만으로 조합 회귀를 판단할 수 없음 |

### Must have
- 기존 브랜치·사용자 변경 보존. 최초 조사 시 main/clean이었으므로 실행 전 다시 확인한다.
- 작업별 수정 전 기준 측정; 같은 데이터량·버전·동시성·지연 조건으로 수정 후 비교.
- 실제 PostgreSQL 다중 연결의 barrier 기반 lock 테스트; 순차 실행을 동시성 증거로 쓰지 않는다.
- receipt 재실행·revision·부모 교체·wallet/ledger·scope 권한·local/mock/readonly 계약 보존.
- 로컬 SQL만 적용하고 운영용 스크립트는 검토 가능한 상태로 준비.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 운영 데이터·학생 정보 읽기/쓰기, 원격 DB 적용, 배포, commit/push/PR, 새 의존성 설치.
- expected 조상 제거, 낙관적 성공 처리, write timeout 축소, 데이터 캐시 TTL 도입, 권한 완화.
- 교사 저장 orchestration·전체 저장 구조 리팩터링; TimerPage는 읽기 소비자 검증 범위이다.
- scope 카운터의 필요한 직렬화까지 제거하거나 모든 쓰기가 병렬화됐다고 주장하지 않는다.
- 속도 측정이 좋지 않은 SQL 후보를 근거 없이 유지하지 않는다.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node test runner/tsx 및 기존 PostgreSQL HTTP harness. 현재 npm test는 src/server와 tests/storage 전체를 포함하지 않으므로 명시적 실행 필요 (`package.json:12`).
- QA policy: every task has agent-executed scenarios.
- Evidence: `<attemptDir>/task-<N>-<slug>.<ext>` — under ulw-loop, `<attemptDir>` is the `currentAttemptDir` from `omo-agent-toolkit ulw-loop status --json` (`.omo/evidence/ulw/<session>/<goalId>/a<attempt>`); outside ulw-loop use `.omo/evidence/`.
- 공통 실행 환경: `STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js`, PostgreSQL은 `127.0.0.1:55439`의 disposable fixture만 사용. 기존 서버가 없으면 `/opt/homebrew/bin/initdb -D "$fixtureDir/pg" -U postgres -A trust` 후 `/opt/homebrew/bin/pg_ctl -D "$fixtureDir/pg" -o "-h 127.0.0.1 -p 55439" -l "$fixtureDir/postgres.log" start`; fixtureDir은 이 작업에서 새로 만든 임시 디렉터리. 타 서버 중지 금지. harness의 합성 fixture 외 데이터 사용 금지.
- 테스트 로그는 `node --import tsx ... > <attemptDir>/... 2>&1`로 보관하고 exit code 확인. 기존/신규 테스트의 skip는 통과로 취급하지 않는다.
- 성능: warm-up 후 3회 이상, 23학생+2교사, p50/p95/max, RPC 개수·바이트·오류·temp block을 같은 조건으로 기록. 노이즈가 개선보다 크면 개선 미확인으로 보고하고 후보를 재검토한다.

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Classword 폴링 스케줄
- Task 2: Classword 진행 중 GET 공유
- Task 3: 전체 snapshot SQL 비용
- Task 4: 구조 조상 잠금 모드
- Task 5: metadata follower 대기 상한

Wave 2 (after Wave 1):
- Task 6: 통합 성능·저장·브라우저 검증, depends [1, 2, 3, 4, 5]

Critical path: Task 4 -> Task 6

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1 | none | 6 | 2,3,4,5 |
| 2 | none | 6 | 1,3,4,5 |
| 3 | none | 6 | 1,2,4*,5 |
| 4 | none | 6 | 1,2,3*,5 |
| 5 | none | 6 | 1,2,3,4 |
| 6 | 1,2,3,4,5 | F1-F4 | none |

*Task 3/4는 storage_v2.sql의 서로 다른 함수만 소유한다. 같은 SQL fixture DB를 공유하지 않고, 적용 스크립트는 별도 파일로 관리한다. Task 4는 repository payload 계약을 바꾸지 않으므로 Task 5의 repository 코드와 겹치지 않는다.

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Classword 읽기 주기와 오류 backoff를 명시한다

  What to do: StudentClasswordPage의 polling에 작은 순수 정책 helper를 적용한다. 초기·focus·online·local-change는 즉시 읽기, 성공 주기는 10초, 연속 실패는 20/40/60초 상한으로 한다. 실패 여부를 refresh 함수가 삼키지 않도록 명시적 결과를 반환한다. 성공하면 backoff를 초기화한다. hidden/offline 정지·자정 전환·세대와 sequence 검사를 보존한다. 저장 중 발생한 local-change는 pending 완료 뒤 한 번 재조회한다. mock 동작도 확인한다.
  Must NOT do: 전체 UI 재설계, 퀴즈/board 중 하나를 영구 갱신 제외, 실패를 성공으로 반환.
  Closes: GAP-1

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern: `src/components/student/StudentClasswordPage.tsx:121` - stale-response guard와 refresh 결과.
  - API/Type: `src/components/student/StudentClasswordPage.tsx:156` - 현재 lifecycle 및 pending 병합.
  - Test: `src/lib/classwordClient.test.ts:1` - Node/tsx와 mock Classword fixture.
  - External: 해당 없음; 내부 polling 계약만 변경.

  Acceptance criteria (agent-executable only):
  - [ ] 신규 `src/lib/classwordPolling.test.ts`에서 10/20/40/60초, 성공 복귀, pending local-change 병합을 가상 clock으로 검증; `node --import tsx --test src/lib/classwordPolling.test.ts` 성공.
  - [ ] 60초 idle의 요청 횟수가 기존 3초 정책보다 작으며 저장 후 재조회는 10초를 기다리지 않는다.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: idle and immediate refresh
    Tool: bash
    Steps: node --import tsx --test src/lib/classwordPolling.test.ts
    Expected: 60초 가상 시계에 새 10초 주기 횟수, 초기·복귀 즉시 읽기, pending 중 local-change 후 정확히 한 번 후속 읽기 assertion 통과.
    Evidence: <attemptDir>/task-1-polling.txt
  Scenario: offline failure rollover
    Tool: bash
    Steps: node --import tsx --test --test-name-pattern='failure|offline|rollover|hidden' src/lib/classwordPolling.test.ts
    Expected: 실패 backoff 상한 60초; hidden/offline 요청 0; 날짜 전환 뒤 이전 응답 미반영; unmount 후 요청 0.
    Evidence: <attemptDir>/task-1-polling-error.txt
  ```

  Commit: NO | Message: `fix(classword): bound background polling load` | Files: [src/components/student/StudentClasswordPage.tsx, src/lib/classwordPolling.ts, src/lib/classwordPolling.test.ts]

- [ ] 2. 동일 Classword GET의 진행 중 요청만 공유한다

  What to do: GET-only in-flight map을 classwordClient에 추가한다. key는 path+captureStorageResponseContext의 actor 및 세션 generation을 포함한다. 이전 저장이 완료된 뒤의 GET이 이전 진행 중 GET에 붙지 않도록 local-change/저장 성공에 read generation을 갱신한다. 완료·실패 시 identity 확인 후 map에서 제거한다. caller AbortSignal이 있는 요청은 공유하지 않는다. 쓰기·receipt 읽기의 기존 복구 의미를 유지한다.
  Must NOT do: 완료 응답 TTL cache, 학생 간 공유, mutation 병합, 응답 객체 공유로 파서 변경.
  Closes: GAP-2

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern: `src/server/storageV2Repository.ts:253` - 진행 중 읽기 map cleanup pattern.
  - API/Type: `src/lib/classwordClient.ts:94` - response context 및 timeout; `src/lib/classwordClient.ts:239` - board GET, `:265` - student quiz GET.
  - Test: `src/lib/classwordClient.test.ts:1` - 기존 mock 및 오류 보고 테스트.
  - External: 해당 없음; 기존 fetch 계약 유지.

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/lib/classwordClient.test.ts` 성공: 동일 context/path 동시 호출 fetch=1; 다음 호출 fetch=2.
  - [ ] 다른 학생·날짜·세대는 공유하지 않으며 실패 뒤 즉시 재시도 가능.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: concurrent duplicate GET
    Tool: bash
    Steps: node --import tsx --test --test-name-pattern='in-flight|concurrent|deduplicat' src/lib/classwordClient.test.ts
    Expected: Promise barrier로 동시에 시작한 동일 GET 20개가 fetch 1개; settle 후 다음 요청은 새 fetch.
    Evidence: <attemptDir>/task-2-reads.txt
  Scenario: actor switch and rejected GET
    Tool: bash
    Steps: node --import tsx --test src/lib/classwordClient.test.ts
    Expected: 학생 전환의 기존 StorageResponseActorChangedError 유지; rejected entry 제거; save 이후 GET은 이전 응답 미재사용; mutation 호출 횟수 보존.
    Evidence: <attemptDir>/task-2-reads-error.txt
  ```

  Commit: NO | Message: `fix(classword): share only current in-flight reads` | Files: [src/lib/classwordClient.ts, src/lib/classwordClient.test.ts]

- [ ] 3. 전체 snapshot SQL을 같은 결과로 저비용 실행한다

  What to do: 변경 전 함수 정의를 fixture 내 별도 이름으로 저장하고 baseline을 측정한다. 우선 SQL 함수의 한 statement 내부 집계가 temp materialization을 만드는지 EXPLAIN과 temp block/DB temp_bytes로 확인한다. 후보 A는 기존 SELECT를 유지한 PL/pgSQL 단일 RETURN SELECT wrapper, 후보 B는 기존 SQL에 jit=off만 적용한다. 같은 statement snapshot 의미를 보존하며 가장 작은 유효 후보를 선택한다. resources/wallets/history의 모든 row field, tombstone revision, scope revision, updated_at 계약을 보존한다. storage_v2.sql 정의와 단독 재적용 가능한 `supabase/storage_snapshot_performance.sql`을 일치시킨다. 권한과 search_path 유지.
  Must NOT do: 반환 필드 삭제, table/column migration, work_mem 전역 변경, 여러 SELECT로 찢어 MVCC snapshot 의미 변경.
  Closes: GAP-3

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern: `supabase/storage_read_performance.sql:1` - transaction과 권한을 가진 독립 patch.
  - API/Type: `supabase/storage_v2.sql:172` - 전체 응답 계약; `src/server/storageV2Repository.ts:74` - parser.
  - Test: `tests/storage/metadataReadBenchmark.ts:1`, `tests/storage/combinedPollingBenchmark.ts:9` - 합성 대형 fixture와 계측.
  - External: https://www.postgresql.org/docs/current/functions-admin.html - 세션 설정 및 통계 함수 문서.

  Acceptance criteria (agent-executable only):
  - [ ] 신규 `tests/storage/snapshotReadBenchmark.ts`를 `node --import tsx tests/storage/snapshotReadBenchmark.ts`로 실행; baseline/candidate full raw JSON은 배열을 stable key로 정렬해 깊은 동등성 비교, 재구성 snapshot도 동일.
  - [ ] 동일 fixture와 연결 수에서 temp write 감소 또는 p95 감소를 반복 측정. 개선이 없으면 성공 선언하지 않고 다음 후보 평가.
  - [ ] SQL 두 번 적용 성공, anon/authenticated EXECUTE=false, service_role=true.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: snapshot equivalence and measured cost
    Tool: bash
    Steps: node --import tsx tests/storage/snapshotReadBenchmark.ts
    Expected: 같은 데이터 모든 필드·revision·updated_at 동등; 1/25 concurrent p50/p95와 temp block·byte 전후 기록; 선택 후보 개선 확인.
    Evidence: <attemptDir>/task-3-snapshot.json
  Scenario: empty and tombstoned state
    Tool: bash
    Steps: node --import tsx tests/storage/snapshotReadBenchmark.ts --edge-cases
    Expected: resources 비활성 행 제외, revisions에는 tombstone 포함; 빈 배열/객체 계약 동일; 중복 적용과 권한 검사 성공.
    Evidence: <attemptDir>/task-3-snapshot-error.json
  ```

  Commit: NO | Message: `perf(storage): reduce full snapshot execution overhead` | Files: [supabase/storage_v2.sql (snapshot function only), supabase/storage_snapshot_performance.sql, tests/storage/snapshotReadBenchmark.ts]

- [ ] 4. 구조 조상은 shared, 실제 변경·명시적 읽기 의존성은 exclusive로 보호한다

  What to do: p_expected와 revision 검사 자체는 그대로 둔다. 실제 p_resources 변경 키는 exclusive, 그 변경의 저장된 parentKey 체인에 속한 변경되지 않는 object/array 구조 조상만 shared 후보로 삼는다. 값 자원·명시적 read dependency·분류 불명확 자원은 기존 exclusive 유지. 각 키의 strongest mode를 사전 계산하여 같은 transaction 안에서 shared→exclusive upgrade하지 않는다. receipt→wallet(숫자 정렬)→scope(문자 정렬)→resource(문자 정렬) 순서를 유지한다. scope 카운터 잠금은 수정하지 않는다. 부모 교체가 같은 resource key exclusive를 얻는지 모든 writer를 확인한다. SQL 원본 및 독립 `supabase/storage_resource_lock_performance.sql`을 일치시킨다.
  Must NOT do: p_expected 삭제, prefix 문자열만으로 parent 판정, scope/wallet 잠금 제거, 기존 conflict/receipt 결과 의미 변경.
  Closes: GAP-4

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern: `supabase/storage_v2.sql:202` - receipt; `:208` wallet; `:216` scope; `:225` resource; `:228` revision validation.
  - API/Type: `src/server/storageV2Repository.ts:395` - 실제 ancestor expected 추가; `supabase/storage_scoped_v2.sql:140` - scoped wrapper.
  - Test: `src/server/storageScope.integration.test.mjs:9` - 실 DB와 다중 Client; `src/server/storageV2Repository.test.ts:1` - payload expected invariants.
  - External: https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS - pg_advisory_xact_lock_shared는 shared holder끼리 공존하고 exclusive와 충돌한다.

  Acceptance criteria (agent-executable only):
  - [ ] 신규 `tests/storage/resourceLockConcurrency.test.ts`에서 baseline은 서로 scope도 다른 자식 mutation B가 A commit까지 대기, candidate는 A transaction 열린 상태에서 B 완료.
  - [ ] root 및 중간 object/array 교체, child update/delete/insert 양방향 interleaving에서 stale save=false 또는 serial 결과 보장; 유실·orphan·deadlock 0.
  - [ ] `node --import tsx --test tests/storage/resourceLockConcurrency.test.ts src/server/storageScope.integration.test.mjs src/server/storageV2Repository.test.ts` 성공; 기존 wallet/receipt 테스트 통과.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: disjoint resources make progress
    Tool: bash
    Steps: node --import tsx --test --test-name-pattern='disjoint|independent' tests/storage/resourceLockConcurrency.test.ts
    Expected: A BEGIN + mutation 완료 후 미commit, 서로 wallet/scope가 겹치지 않는 B가 bounded timeout 안에 완료; A rollback 후 B만 남음; pg_locks에 root shared 확인.
    Evidence: <attemptDir>/task-4-locks.txt
  Scenario: parent replacement remains protected
    Tool: bash
    Steps: node --import tsx --test tests/storage/resourceLockConcurrency.test.ts src/server/storageScope.integration.test.mjs
    Expected: 양방향 parent/child barrier 테스트에서 wait 관찰 후 revision conflict 또는 직렬 결과; 같은 key·wallet·scope 충돌은 계속 보호; receipt 재실행으로 delta 1회.
    Evidence: <attemptDir>/task-4-locks-error.txt
  ```

  Commit: NO | Message: `perf(storage): share unchanged structural ancestor locks` | Files: [supabase/storage_v2.sql (commit function only), supabase/storage_resource_lock_performance.sql, tests/storage/resourceLockConcurrency.test.ts]

- [ ] 5. metadata follower의 leader 대기를 제한한다

  What to do: 다른 scope의 shared leader를 최대 250ms 기다린다. 그 안에 unchanged면 재사용, changed/failed 또는 상한 초과면 자기 scope metadata를 읽는다. own metadata는 기존 in-flight map과 기존 timeout/오류 변환을 사용한다. leader 요청을 취소하지 않고 timer를 정리한다. 늦은 leader 성공/실패가 follower 결과를 덮어쓰거나 unhandled rejection을 만들지 않도록 한다. same-scope 요청 공유는 유지.
  Must NOT do: 타 학생 readVersion 재사용, timeout을 성공·unchanged로 변환, 무제한 재시도.
  Closes: GAP-5

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern: `src/server/storageV2Repository.ts:268` - leader/follower 선택 및 cleanup; `:303` - own metadata sharing.
  - API/Type: `src/server/storageV2Repository.ts:55` - TIMEOUT/NETWORK error mapping.
  - Test: `src/server/storageV2Repository.test.ts:179` - leader 실패와 follower 복구 기존 테스트.
  - External: 해당 없음; 기존 timeout 계약 유지.

  Acceptance criteria (agent-executable only):
  - [ ] `node --import tsx --test src/server/storageV2Repository.test.ts` 성공; leader 미완료 상태에서 250ms 경과 시 follower own read 시작.
  - [ ] 250ms 전 unchanged면 own RPC=0; 변경/실패/늦은 결과 시 scope별 readVersion 및 정상 rejection 유지.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: slow leader does not delay follower indefinitely
    Tool: bash
    Steps: node --import tsx --test --test-name-pattern='follower|combined polling' src/server/storageV2Repository.test.ts
    Expected: 제어 가능한 promise와 timer로 leader 미완료 중 own metadata 요청 1회 및 follower 완료 증명; fast unchanged는 공유.
    Evidence: <attemptDir>/task-5-followers.txt
  Scenario: late leader and own failure
    Tool: bash
    Steps: node --import tsx --test src/server/storageV2Repository.test.ts
    Expected: own timeout은 STORAGE_DATABASE_TIMEOUT, network는 STORAGE_DATABASE_NETWORK; late rejection 미처리 오류 0; 다음 요청 새 map entry 사용.
    Evidence: <attemptDir>/task-5-followers-error.txt
  ```

  Commit: NO | Message: `fix(storage): bound shared metadata follower wait` | Files: [src/server/storageV2Repository.ts (pollScopedStorageMetadata only), src/server/storageV2Repository.test.ts]

- [ ] 6. 변경 조합을 측정하고 운영 적용 전 결과를 정리한다

  What to do: 각 독립 SQL patch를 fresh fixture와 이미 bootstrap된 fixture에 적용하고 함수 정의·권한 일치 확인. 기존 25-client read/mixed benchmarks와 통합 테스트를 실행한다. Classword 브라우저는 mock 및 격리 fixture에서 초기 로드, 60초 idle, local mutation, 오류/복귀, 날짜 경계, 학생 전환을 확인한다. harness는 현재 Classword API를 라우팅하지 않으므로 실제 서버 QA가 필요하면 기존 classword-concurrency fixture를 사용하거나 테스트 전용 gateway routing만 추가한다. 승인되지 않은 운영 적용·커밋은 하지 않는다. 사용자가 적용할 SQL 순서·검증 query·원래 함수 복구 방법을 증거 보고서에 작성한다. 기존 함수의 전체 정의를 보존하되 비밀정보는 기록하지 않는다.
  Must NOT do: 운영 성능 개선 완료로 표현, live 학생 QA, localhost fixture 밖 URL 접근, 제품 UI에 개발 설명 추가.
  Closes: GAP-6

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [F1,F2,F3,F4] | Blocked by: [1,2,3,4,5]

  References (executor has NO interview context - be exhaustive):
  - Pattern: `tests/storage/httpHarness.ts:65` - 격리 DB/schema 적용; `:146` - loopback 외 네트워크 차단.
  - API/Type: `src/pages/TimerPage.tsx:5265` - metadata 후 전체 snapshot 및 저장 도중 반영 방지.
  - Test: `tests/storage/combinedPollingBenchmark.ts:40`, `tests/storage/concurrent25ReadBenchmark.ts:1`, `tests/storage/classword-concurrency.mjs:1`, `dev/verifyRelease.mjs:31`.
  - External: 해당 없음; 운영 배포 소유권은 프로젝트 AGENTS.md 준수.

  Acceptance criteria (agent-executable only):
  - [ ] `npm run lint`, `npm test`, `node --import tsx --test src/server/*.test.ts tests/storage/resourceLockConcurrency.test.ts`, `npm run build` 성공.
  - [ ] `node --import tsx tests/storage/combinedPollingBenchmark.ts`, `node --import tsx tests/storage/concurrent25ReadBenchmark.ts`와 새 snapshot benchmark 성공; skip/실패 명시.
  - [ ] 1280×650 기본, 1280×600, 1280×800에서 기존 학생 화면 primary action 접근 가능·새 겹침/문서 스크롤 없음; 요청 수·복귀·저장 확인 evidence 확보.
  - [ ] before/after 조건 및 실제 결과, 적용되지 않은 운영 SQL·배포를 명확히 표시.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: combined classroom load
    Tool: bash
    Steps: npm run lint; npm test; node --import tsx --test src/server/*.test.ts tests/storage/resourceLockConcurrency.test.ts; node --import tsx tests/storage/combinedPollingBenchmark.ts; node --import tsx tests/storage/concurrent25ReadBenchmark.ts; npm run build
    Expected: 각 명령 exit=0 및 skip=0; 저장 개수·ledger 합·receipt uniqueness 보존; 같은 조건의 전후 수치 기록.
    Evidence: <attemptDir>/task-6-integration.txt
  Scenario: visible behavior and read failure recovery
    Tool: computer-use (Codex in-app browser via cua API)
    Steps: npm run dev -- --host 127.0.0.1 로 mock 시작. cua.createBrowserTab('iab','http://127.0.0.1:3000',{visible:true}); 해당 runtime가 반환한 API로 viewport를 1280×650으로 설정하고 학생1→낱말 활동 진입. 초기/60초 idle/저장/숨김·복귀/학생2 전환 관찰, 1280×600·800 반복. 테스트용 fetch 계측으로 GET 수·실패1회·복귀 응답을 기록하며 live URL은 쓰지 않는다.
    Expected: immediate 저장 후 refresh, 숨김 중 조회 없음, 오류 후 복귀 회복, 학생간 상태 유출 없음, 핵심 액션 접근 가능. mock은 네트워크 부하 증거로 쓰지 않고 GET count는 task1/2 및 local fixture로 입증.
    Evidence: <attemptDir>/task-6-browser-error.png
  ```

  Commit: NO | Message: `test(storage): verify local read and lock improvements` | Files: [tests/storage/관련 fixture 또는 benchmark, .omo/evidence/task-6-*]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Ideal-state fidelity - delivered behavior checked against every IS row 1:1; a shortfall becomes new task rows, never a note; nothing Must-NOT-Have introduced

검토는 에이전트가 수행한다. 이 계획 작성 자체는 구현 완료가 아니다. 사용자에게 추가 구현 승인 재요청 없이 이미 승인된 로컬 검증까지 진행하되, 최종 검토 결과와 운영 미반영 상태를 구분한다.

## Commit strategy
- 이번 작업은 commit/push 권한이 없으므로 모든 Commit=NO; Message는 향후 승인 시 사용할 제안이다.
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/storage-concurrency-local-fix.md`.
- 각 수정 rollback은 해당 함수/구간의 저장된 기존 정의만 되돌린다. git reset/checkout으로 사용자 변경을 덮어쓰지 않는다. 운영 rollback은 실행하지 않는다.

## Success criteria
| IS | Delivering task(s) | Proving QA scenario | Evidence |
|----|--------------------|---------------------|----------|
| IS-1 | 1,6 | idle and immediate refresh; visible behavior and read failure recovery | <attemptDir>/task-1-polling.txt; <attemptDir>/task-6-browser-error.png |
| IS-2 | 2 | concurrent duplicate GET; actor switch and rejected GET | <attemptDir>/task-2-reads.txt; <attemptDir>/task-2-reads-error.txt |
| IS-3 | 3 | snapshot equivalence and measured cost; empty and tombstoned state | <attemptDir>/task-3-snapshot.json; <attemptDir>/task-3-snapshot-error.json |
| IS-4 | 4 | disjoint resources make progress; parent replacement remains protected | <attemptDir>/task-4-locks.txt; <attemptDir>/task-4-locks-error.txt |
| IS-5 | 5 | slow leader does not delay follower indefinitely; late leader and own failure | <attemptDir>/task-5-followers.txt; <attemptDir>/task-5-followers-error.txt |
| IS-6 | 6 | combined classroom load; visible behavior and read failure recovery | <attemptDir>/task-6-integration.txt; <attemptDir>/task-6-browser-error.png |
- Every IS row above has a delivering task and a proving scenario; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean (no new commits without authorization).
