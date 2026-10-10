# 저장·조회 속도 개선 — 2026-10-10

## 적용 범위

소스와 additive SQL을 준비하고 격리 환경에서 검증했다. 2026-10-10 사용자 승인 후 운영 Supabase에 SQL 2개를 적용하고 Vercel Production 환경변수 3개를 저장했다. 개선 소스의 운영 배포는 아직 실행하지 않았다. 요금제 변경도 하지 않았다. 운영 DB와 현재 API 실행 리전은 서울이다.

## 운영 적용 확인 (2026-10-10 18:53 KST)

- Supabase `School_Timer` (`dxibhawclfhoabfgwria`, `ap-northeast-2`, `ACTIVE_HEALTHY`)에 `20261010094950 storage_command_round_trips_20261010`, `20261010094956 storage_progressive_reads_20261010` 마이그레이션을 적용했다.
- 새 RPC 3개의 시그니처, `SECURITY DEFINER`, 제한된 `search_path`, `jit=off`를 확인했다. `anon`·`authenticated` 실행 권한은 없고 `service_role`은 실행 가능하다. 운영에서 read-only transaction으로 prepare 조회와 교사 baseline 조회가 정상적인 객체를 반환함을 확인했다. 저장 RPC를 운영 테스트로 호출하거나 학생 기록을 변경하지 않았다.
- Vercel `school-timer` Production에 `STORAGE_COMBINED_COMMANDS=1`, `STORAGE_PROGRESSIVE_READS=1`, `STORAGE_TEACHER_PRIORITY=1`을 저장하고 재조회로 세 값과 적용 환경을 확인했다. 기존 `STORAGE_PROTOCOL_VERSION=2`도 확인했다. Preview·Development는 변경하지 않았다.
- 현재 `/api/device-session`은 인증 없이 `401`을 반환하며 `x-vercel-id`가 `icn1::icn1::…`이다. 프로젝트 기본 리전 설정은 `iad1`로 조회되지만 소스 `vercel.json`의 `regions: ["icn1"]`와 현재 API 응답은 서울이다. 다음 배포에서도 응답 헤더로 실행 리전을 확인한다.
- Supabase security advisors에서 WARN·ERROR는 없었다. 기존 서버 전용 테이블 29개의 RLS 정책 없음 INFO가 있다. 이번 변경은 테이블이나 RLS 정책을 변경하지 않았다. [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 환경변수 변경은 기존 배포에 반영되지 않는다. [Vercel 환경변수 적용 방식](https://vercel.com/docs/environment-variables/managing-environment-variables). 검증된 변경 소스의 새 배포가 필요하며, 같은 기존 소스의 재배포만으로 이번 코드 개선이 반영되지는 않는다. 프로젝트 `AGENTS.md`의 운영 배포 금지 지침에 따라 Codex는 배포를 트리거하지 않았다.

### 저장 왕복

일반 학생·교사 명령과 학생 경제 거래는 `영수증 → 범위 조회 → 커밋 → 결과 범위 조회`의 네 RPC에서 두 RPC로 줄였다.

- `storage_prepare_command`: 동일 MVCC snapshot에서 영수증과 필요한 범위를 읽는다. 이미 완료된 요청이면 기존 영수증의 범위를 이용하며 경제 응답은 본인 결과 범위를 명시한다.
- `storage_commit_scoped_and_load`: 기존 범위 검증·요청 ID 잠금·revision 검사·지갑/원장 트랜잭션을 호출하고, 성공한 경우 같은 트랜잭션의 결과를 읽는다. 조회까지 실패하면 성공으로 표시하지 않는다.
- 같은 요청의 재전송은 준비 RPC 한 번으로 완료된 영수증과 현재 결과를 반환한다. `receiptOnly` 확인 경로는 그대로다.
- `STORAGE_COMBINED_COMMANDS=1`을 설정했을 때 새 경로를 사용한다. 미설정 시 기존 RPC 경로를 사용한다.

새 함수만 추가하고 기존 함수 signature·본문·권한, 테이블, 데이터는 변경하지 않는다. 새 함수는 `service_role`만 실행 가능하며 `SECURITY DEFINER`, 제한된 `search_path`, `jit=off`를 사용한다.

### 조회량과 첫 화면

- 학생 첫 홈 화면은 필요한 범위만 조회하고, 다른 기능을 열 때 전체 학생 범위를 불러온다. 전체 조회 완료 전에는 해당 기능의 로딩 화면을 유지한다. 부분 조회를 전체 저장용 snapshot이나 학생의 영구 캐시로 기록하지 않는다.
- 교사는 category·wallet revision manifest를 비교하고 변경된 category와 지갑·이력만 조회한다. timestamp가 같거나 과거인 commit, 삭제, `null`도 revision으로 구분한다. 알 수 없는 category는 전체 조회로 복구한다.
- 완전한 projection patch를 보내는 응답에서는 중복 `value`를 생략한다. 불완전한 patch를 전체 응답으로 받아들이지 않는다.
- `STORAGE_PROGRESSIVE_READS=1`로 학생 홈 범위와 교사 변경 조회를 활성화한다. 미설정 시 기존 조회를 사용한다. 저장 성공 확인·실패 알림·학생별 쓰기 범위는 유지한다.

### 교사 우선 접속

- `STORAGE_TEACHER_PRIORITY=1`에서는 인증된 학생의 공용 설정 GET을 서버 인스턴스당 최대 2개 실행한다. 인증된 교사 GET은 이 대기열을 거치지 않는다. 대기열은 최대 64개·2초로 제한하며 초과한 학생 조회만 `503 STORAGE_READ_BUSY`, `Retry-After: 5`로 재예약한다.
- POST/PUT 저장과 GET 영수증 확인은 학생·교사 모두 이 조회 대기열을 거치지 않는다. 학생이 query/header로 교사 우선권을 지정할 수 없다.
- 학생 최초 조회는 750ms 뒤부터 학생 번호와 jitter로 약 3초 이내에 분산한다. 기능 이동과 저장 복구는 기존 즉시 조회 경로를 유지한다. 교사 최초 조회는 IndexedDB 초안 준비와 동시에 시작하며, 초안 준비까지 끝나야 원격 설정을 적용하고 쓰기를 연다.
- `null`인 추첨 결과가 반복 정규화에서 `1`로 변해 초기 설정을 편집된 것으로 판정하는 문제를 수정했다. 빈 추첨 결과 때문에 교사의 변경 조회가 계속 대기하는 경로를 제거했다.
- 우선 처리는 인스턴스 내부의 학생 조회 압력을 낮추는 장치다. 여러 Vercel 인스턴스·다른 API의 요청·Supabase 전체 자원까지 전역 우선순위를 보장하지 않는다. [Vercel Fluid compute의 인스턴스 동시 실행 설명](https://vercel.com/docs/fluid-compute).

## 저장 측정

PostgreSQL 17의 별도 로컬 클러스터와 실행 중인 HTTP API를 이용했다. 양측에 기존 조회·ancestor lock 최적화를 동일하게 적용했다. RPC마다 왕복 40ms의 합성 지연을 넣었으며 운영 성능 또는 Chromebook 전체 속도 측정이 아니다.

| 시나리오 | p50 이전→이후 | p95 이전→이후 | 12회 저장 RPC 수 |
|---|---:|---:|---:|
| 편지 저장 | 197→104ms | 200→109ms | 48→24 |
| 예금 | 197→106ms | 208→113ms | 48→24 |

학생 23명 편지 저장과 교사 2명의 보상을 동시에 실행한 별도 A/B에서도 RPC 100→50회, p95 208→156ms였다. 양측 25개 영수증·23개 편지와 교사 보상 6씩을 확인했고 revision 재시도는 0회, 원장 불일치도 없었다. 저장 결과 조회가 같은 트랜잭션의 잠금을 오래 유지하는 우려를 이 시나리오에서 확인했지만, 운영의 긴 이력과 실제 부하에서 동일한 결과를 보장하지 않는다.

테스트는 저장 결과의 자체 트랜잭션 가시성, 같은 요청 8회 동시 예금·보상의 1회 반영, hash 재사용 거절, 타인 지갑·편지 비노출, scope fallback, 충돌 시 projection 미반환, 점검 모드, 원장 대조, 기존 함수 불변, 새 함수 권한을 검증한다. 합성 HTTP/API 테스트는 응답 유실과 잘못된 projection 응답에도 영수증 확인을 유지하는지 추가 검증한다.

## 조회 측정

합성 resource 130개·이력 2,300개를 사용하는 로컬 PostgreSQL/HTTP에서 학생 23명과 교사 2명의 초기 접속을 세 번씩 비교했다. 추가 네트워크 지연을 넣지 않았고, 양측에 같은 기존 조회 SQL 최적화를 적용했다.

| 항목 | 이전 | 이후 |
|---|---:|---:|
| 초기 HTTP 응답 총량 | 9,861,719B | 2,087,552B |
| 초기 DB 응답 총량 | 6,106,550B | 1,665,391B |
| 초기 RPC 수 | 24 | 24 |
| 초기 p95 범위 | 118–150ms | 48–51ms |
| 교사 변경 조회 HTTP 응답 | 1,431,286B | 3,082B |
| 교사 변경 조회 DB p50 | 17.568ms | 0.944ms |

교사 유휴 조회는 기존 metadata 48B·DB p50 0.149ms에서 manifest 2,861B·0.362ms로 소폭 증가한다. 변경이 있을 때 전체 조회와 metadata 왕복을 없애는 대신 revision 집계 비용을 지불한다. 운영 리소스 수·실제 수업 부하에 따른 비용은 배포 후 확인이 필요하다. 상세 원자료는 `.omo/evidence/read-loading/benchmark.json`에 있다.

학생 23명이 먼저 조회하고 25ms 뒤 교사 2명이 접속하는 별도 혼잡 시험에서는 교사 응답이 340–368ms에서 86–87ms로 줄었다. 학생 upstream 요청 최대치는 23→2, 마지막 학생 응답은 365–395ms→1,034–1,055ms로 늘었다. 양측 RPC는 24회이며 모든 응답이 200이었다. 로컬 PostgreSQL에 합성 upstream 6개 슬롯·RPC 왕복 80ms를 적용한 결과이고 운영의 실제 pool·지연을 측정한 것은 아니다. `.omo/evidence/teacher-priority/benchmark.json`에 원자료를 보관했다.

## 자원 증설 판단

2026-10-10 13:32 KST 운영 읽기 전용 집계에서 DB 크기 약 41.4MiB, 연결 15/60, active 1(진단 쿼리 포함), lock 대기 0, 누적 deadlock 0이었다. 최근 24시간 Supabase 완료 edge 로그 290건은 200/204이며, 200의 origin p50 92ms·p95 1,375.6ms였다. 이 수치는 DB 실행 시간이나 Vercel 전체 응답 시간이 아니다. 실제 수업 피크라는 근거도 없어 자원 부족이나 현재 변경의 개선율을 입증하지 않는다.

현재 compute/요금제와 시간대별 CPU·메모리·swap·Disk IO는 노출된 도구로 확인하지 못했다. 기존 문서의 Free/Nano를 현재 상태로 재확정하지 않았다. 증설은 하지 않으며 소프트웨어 변경 적용 후 실제 수업 피크에서 자원 포화와 지연이 함께 나타날 때 판단한다. [Supabase 성능 안내](https://supabase.com/docs/guides/platform/performance), [Compute 사용량·과금](https://supabase.com/docs/guides/platform/manage-your-usage/compute).

## 남은 배포 절차

1. [저장 RPC SQL](../supabase/storage_command_round_trips.sql)과 [조회 RPC SQL](../supabase/storage_progressive_reads.sql)은 운영 DB에 적용 완료했다. 기존 bootstrap이나 전체 schema를 재실행하지 않는다. 두 SQL은 함수 추가·권한 설정과 PostgREST schema cache 갱신만 수행한다.
2. Vercel Production 서버 환경변수 `STORAGE_COMBINED_COMMANDS=1`, `STORAGE_PROGRESSIVE_READS=1`, `STORAGE_TEACHER_PRIORITY=1`은 저장 완료했다. `VITE_` 접두사를 붙이지 않는다. 기존 `STORAGE_PROTOCOL_VERSION=2`·학생 edit revision 요구·서울 리전 설정을 유지한다.
3. 검증된 소스를 사용자가 직접 배포한다. 운영 응답 리전과 오류 집계를 확인하고 실제 학생 거래를 테스트 자료로 사용하지 않는다.
4. 문제가 있으면 해당 `STORAGE_COMBINED_COMMANDS`, `STORAGE_PROGRESSIVE_READS`, `STORAGE_TEACHER_PRIORITY`를 해제하고 사용자가 다시 배포한다. 기존 RPC가 남아 있으므로 데이터를 되돌리거나 새 함수를 삭제할 필요가 없다. 학생 최초 접속 분산과 compact 응답은 코드 변경으로 유지된다.

## 격리 검증 명령

`STORAGE_TEST_PG_MODULE`은 기존 설치된 `pg` 모듈 경로, `STORAGE_TEST_PG_PORT`는 합성 데이터 전용 로컬 PostgreSQL 포트다. 운영 연결 정보를 넣지 않는다.

```bash
node --import tsx --test tests/api/storageCombinedCommands.test.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55447 node --import tsx --test tests/storage/commandRoundTrips.integration.test.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55447 node --import tsx tests/storage/commandRoundTripsBenchmark.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55447 node --import tsx --test tests/storage/progressiveReads.integration.test.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55447 node --import tsx tests/storage/progressiveReadsBenchmark.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55447 node --import tsx tests/storage/teacherPriorityBenchmark.ts
```

기본 `npm test`에는 `tests/storage`의 PostgreSQL 통합 테스트가 자동 포함되지 않아 별도로 실행한다.

## 최종 검증

- `npm run lint`: 통과 (`tsc --noEmit`).
- `npm test`: 1,473개 중 1,472개 통과, 실패 0. 기존 Classword 실제 PostgreSQL 테스트 1개는 전용 연결 설정이 없어 조건부 skip이다.
- `npm run build`: 통과. 기능별 lazy chunk를 유지한다.
- 저장·조회 PostgreSQL 통합 테스트: 합성 데이터 전용 클러스터에서 각각 통과.
- 브라우저: 학생 홈 개선 전후 `1280×650`, `1280×600`, `1280×800`에서 viewport/document 크기 동일, 의도하지 않은 문서 스크롤 없음. 홈에서 다른 기능으로 이동해 전체 범위 로딩 후 화면이 열리는 것을 확인했다. `.omo/evidence/read-loading/`에 화면 증거를 보관했다.
- 홈 갱신 중 기능 이동의 전체 조회 지연, 교사 저장 후 cache invalidate로 변경 조회 기능이 소실되는 경로를 수정했다. 동시 이동·기능 지원 유지·actor 변경의 회귀 검증을 포함한다. 서버에서 기능을 해제하면 변경 조회 지원 상태도 해제한다. 저장·조회 변경 코드 검토에서 잔여 blocker는 없었다.
- 교사 우선 회귀: 학생 23명의 조회를 막아 둔 상태에서도 교사 조회·교사 보상 저장·학생 감정 저장이 완료됐다. 학생 동시 조회 상한·대기 만료·실패 후 다음 요청 실행을 검증했다.
- 교사 브라우저: 빈 추첨 결과의 잘못된 변경 판정을 수정한 뒤 `error=false`, `dirty=[]`이고 자동 변경 조회가 유지됐다. timestamp를 과거로 둔 합성 공지 revision 변경이 화면에 자동 반영됐다. 합성 Supabase 요청을 503으로 실패시켜 API 502 오류가 실제 발생했어도 교사 화면과 보조 타이머가 유지됐고, 타이머가 02:59→02:39→02:32로 계속 감소했다. 화면 증거는 `.omo/evidence/teacher-priority/teacher-offline.png`에 있다. 네트워크 자체를 OS에서 끈 테스트나 실제 운영 장애 검증은 아니다.
- 연결 실패 모드를 해제한 뒤 보조 타이머 일시정지 조작도 확인했다. 최종 학생 홈은 `1280×650`, `1280×600`, `1280×800`에서 document 크기가 viewport와 같았고, 고마 쓰기 진입 시 전체 조회 로딩 이후 은행·상점·경매·투자·기부 버튼이 표시됐다. `.omo/evidence/teacher-priority/student-*.png`에 증거를 보관했다.
- 기존 역할 카드 테스트는 토요일 실행 시 평일 역할을 기대해 실패했다. 테스트 날짜만 평일로 고정했으며 앱의 주말 역할 처리에는 변경이 없다.
