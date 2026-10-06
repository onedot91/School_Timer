# 2026-10-06 동시 접속 오류 조사와 적용 준비

## 확인한 운영 증상

- 대상: School_Timer Vercel 서비스와 Seoul Supabase 프로젝트. 조사 시간은 KST 기준이다.
- 09:30–09:40 Supabase REST 요청 2,669건 중 132건이 5초를 초과했다.
- 08:00–10:00 DB 로그에서 `57014` 취소 57건을 확인했다. `storage_load_scope` 36건, `storage_load_snapshot` 13건, 나머지는 audit/commit/metadata 등이다.
- Vercel의 `/api/shared-settings`, 학생 경제 API에 `502 / STORAGE_DATABASE_TIMEOUT`이 반복됐다. 일부 조회는 약 8초, 여러 DB 단계를 거치는 저장 확인 요청은 약 20초가 걸렸다.
- DB `authenticator`의 `statement_timeout`, `lock_timeout`은 8초이며 서버 REST timeout은 8,000ms이다.
- 장애 시간대 Supabase DB 그래프에 500MB 이상 swap 사용과 I/O wait 증가가 나타났다. 자원 경합 가능성의 근거이며, 이것만으로 메모리 부족이나 특정 SQL을 단일 원인으로 확정하지 않는다.
- `save-alerts`의 403도 관찰됐다. 별도 권한 문제인지 운영 코드 버전 문제인지 확인되지 않아 인증 정책은 변경하지 않았다.

## 준비한 수정

`STORAGE_SCOPED_POLLING=2`에서 학생 metadata 조회를 새 읽기 RPC `storage_poll_scope`로 처리한다. 기존 `1` 경로와 미설정 경로는 유지한다.

- 전역 변경 marker와 학생별 readVersion을 한 SQL snapshot에서 확인한다. 전역 marker가 같으면 학생별 계산을 생략한다.
- 동일한 URL·서버 인증키·known marker의 진행 중 요청은 변경 없음 결과만 공유한다. 변경이 있거나 선행 요청이 실패하면 각 학생의 scope로 독립 조회한다. 완료 응답은 캐시하지 않는다.
- 쿠키의 학생 scope를 사용하며, 요청의 `studentNumber`로 다른 학생 데이터를 읽을 수 없다.
- 학생별 readVersion과 지연 commit 감지를 유지한다. 저장 성공 판정, write RPC, timeout은 변경하지 않는다.
- 새 RPC는 `service_role`만 실행할 수 있다. scope 검증, `STABLE`, 고정 `search_path`, `jit=off`를 적용한다.
- 단독 SQL은 기존 함수 body hash를 검사하고, 예상 버전과 다르면 transaction을 실패시킨다. 기존 함수·테이블·학생 데이터는 바꾸지 않는다.

관련 파일:

- `api/shared-settings.ts`, `src/server/storageV2Repository.ts`
- `supabase/storage_combined_polling.sql`: 기존 운영 DB에 추가할 단독 SQL
- `supabase/storage_scoped_polling.sql`: 신규 환경 설치용 SQL에도 같은 RPC 포함
- API/repository 회귀 테스트, `tests/storage/combinedPollingBenchmark.ts`

## 로컬 성능 측정

PostgreSQL 17.11과 실제 HTTP handler를 사용했다. 가짜 학생 23명과 교사 요청 2개, 합성 이력·편지만 사용했다. 실학생 자료는 사용하지 않았다. 각 조합 75회씩 두 번, 총 1,200회 요청이다. 모든 요청은 HTTP 200과 기존 응답의 일치를 검사한다.

DB RPC마다 인공 왕복 지연 40ms를 추가했다. `changed`는 과거 marker를 보내 계산 경로를 강제로 실행하는 시험이며, 실제 동시 저장이나 운영 장애 재현은 아니다. 운영 지연 시간으로 해석하지 않는다.

| 요청 조건 | 기존 DB 호출 / 75요청 | 수정 DB 호출 / 75요청 | 기존 p95 | 수정 p95 |
|---|---:|---:|---:|---:|
| 변경 확인, 75ms 간격 | 144 | 75 | 100–102ms | 56–57ms |
| 변경 확인, 동시 시작 | 75 | 72 | 113–118ms | 120–127ms |
| 변경 없음, 동시 시작 | 6 | 6 | 51–52ms | 51–54ms |

분산 변경 확인에서는 호출 약 48%, p95 약 44%가 감소했다. 완전히 동시인 변경 확인에는 선행 scope 계산을 기다리는 비용이 있어 p95가 소폭 증가했다. 유휴 요청 병합은 유지된다. 이 수정만으로 운영 오류가 해결됐다고 판단하지 않는다.

SQL 반복 적용, 기존 함수 body/config 불변, anon/authenticated 실행 차단, service_role 실행, 학생 23명 readVersion 일치, timestamp가 증가하지 않은 지연 변경 감지, 다른 학생 버전 보존을 검사한다.

최종 결과: 합성 HTTP 요청 1,200회 오류 0건, 관련 API/repository 테스트 56/56 통과, `npm test` 1,442개 통과·1개 건너뜀, `npm run lint`, `npm run build`, `git diff --check` 통과. 건너뛴 기존 신문 DB 테스트는 `NEWSPAPER_PGLITE_MODULE` 미설정 때문이다. 이번 polling SQL은 별도 실제 PostgreSQL 검증을 완료했다. UI나 layout은 변경하지 않아 화면 크기별 수동 QA는 수행하지 않았다. 운영 부하에서의 효과는 아직 검증하지 않았다.

측정 명령은 다음과 같다. `pg`는 임시 검증 디렉터리에만 설치했으며 프로젝트 의존성은 추가하지 않았다.

```bash
STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js \
STORAGE_TEST_PG_PORT=55441 \
node --import tsx tests/storage/combinedPollingBenchmark.ts
```

원본 측정 로그: `/private/tmp/school-timer-concurrency-20261006/combined-final-benchmark.log`. API/repository 검증 기록: `.omo/evidence/combined-polling-20261006/`.

## 운영 적용 순서

2026-10-06 사용자 승인 후 운영 Supabase에 DB 함수 추가를 완료했다. Migration 이름은 `add_combined_scoped_polling`, version은 `20261006011503`이다. 사용자 앱 배포 후 Vercel에서 commit `4dafaa4` (`Add combined scoped metadata polling`)의 Production 상태 `Ready`를 확인했다. 하지만 10:24 KST 확인 시 Production 환경변수는 `STORAGE_PROTOCOL_VERSION=2`, `STORAGE_SCOPED_POLLING=1`이어서 새 경로는 활성화되지 않았다. 환경변수를 `2`로 변경하고 사용자가 재배포해야 한다.

배포 후 확인: 10:22:05 KST `/api/shared-settings` snapshot 조회에 `502 / STORAGE_DATABASE_TIMEOUT`, `elapsedMs:8002`가 남아 있었다. Supabase 10:18–10:24 REST 로그에는 기존 marker/metadata RPC만 있고 `storage_poll_scope` 호출은 없었다. 새 경로 활성화 전이므로 개선 효과를 평가할 수 없다.

후속 사용자 요청으로 Vercel Production의 `STORAGE_SCOPED_POLLING`을 `1`에서 `2`로 직접 변경했다. 저장 성공 메시지와 저장된 값 `2`를 확인했다. Vercel은 새 배포가 필요하다고 안내했다. 재배포 버튼 실행은 자동 승인 검토에서 프로젝트 `AGENTS.md`의 배포 트리거 금지 규칙을 이유로 거부되어 실행하지 못했다. 사용자가 직접 재배포해야 실행 중인 서비스에 새 설정이 반영된다. [변경 완료 화면](../.omo/evidence/combined-polling-20261006/vercel-setting-2.jpg)

운영 DB 검증 결과:

- 새 함수 body hash `c2730006da7dd37fdc3f72ef283ce118` 일치, `STABLE`, 고정 `search_path`, `jit=off` 확인.
- 기존 `storage_scope_read_version`, `storage_read_marker`, `storage_load_updated_at`의 body hash와 config 유지.
- `anon`, `authenticated` 실행 권한 없음, `service_role` 실행 가능.
- 읽기 전용 transaction에서 빈 scope로 실제 호출했다. 반환 형식·marker·readVersion·updatedAt 비교와 변경 없음 fast path 모두 통과했다. 학생 데이터는 조회 결과에 포함하지 않았으며 변경하지 않았다.
- Supabase security advisor는 기존 테이블의 RLS 정책 없음 `INFO` 28건만 보고했다. 새 함수 관련 경고는 없었다. 서버 전용 테이블에 정책을 임의로 추가하지 않았다. [해당 advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

1. 완료: Supabase에 `supabase/storage_combined_polling.sql`만 추가 적용했다. 학생 데이터나 기존 테이블은 변경하지 않았다.
2. 완료: 서버 환경변수 `STORAGE_PROTOCOL_VERSION=2`를 유지하고, Production `STORAGE_SCOPED_POLLING=2`를 저장했다. `VITE_` 변수는 추가하지 않았다.
3. 수정 소스 배포는 완료됐다. 환경변수 변경 후 사용자가 Vercel에서 다시 배포해야 한다. DB 함수 추가와 환경변수 저장만으로 실행 중인 앱 경로는 바뀌지 않는다.
4. 사용자 본인의 학생 세션에서 metadata GET과 화면 로딩을 확인한다. 실학생 잔액·보상·입찰을 테스트로 변경하지 않는다.
5. 실제 수업 부하에서 이전과 같은 시간 구간으로 HTTP 502, DB 57014, 5초 초과 요청, p95, swap, I/O wait를 비교한다. 배포된 함수의 응답 region도 확인한다.
6. 성능 악화나 `STORAGE_RPC_INVALID_RESPONSE`, `storage_poll_scope` 함수 미발견이 발생하면 서버 환경변수를 `STORAGE_SCOPED_POLLING=1`로 되돌려 사용자가 재배포한다. 새 RPC를 삭제할 필요는 없다.

8초 취소와 swap/I/O wait가 지속되면 DB 자원 용량 및 실행 계획을 별도로 확인해야 한다. 요금·compute 변경은 이 수정에 포함하지 않는다. timeout을 늘리거나 응답 미확인 저장을 성공 처리하는 방식은 해결책으로 사용하지 않는다.
