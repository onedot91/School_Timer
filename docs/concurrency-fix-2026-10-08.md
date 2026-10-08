# 24명 동시 사용 오류: 로컬 수정과 적용 절차

2026-10-08. 사용자 요청으로 운영 Supabase SQL 두 건을 적용했다. Vercel 배포·운영 부하 테스트는 수행하지 않았다. 아래 성능 수치는 로컬 PostgreSQL 17.11과 합성 데이터의 결과이며 Supabase Free 성능 보장이 아니다.

## 운영 SQL 적용 기록

대상: 현재 프로젝트 설정과 일치하는 `School_Timer`, Seoul. Supabase `apply_migration`으로 아래 두 건이 성공했고 migration history에도 등록됐다.

| 적용 시각(KST) | Migration | Version |
|---|---|---|
| 2026-10-08 21:24:42 | `storage_snapshot_execution` | `20261008122442` |
| 2026-10-08 21:24:57 | `storage_ancestor_locks` | `20261008122457` |

적용 전 세 함수 본문 MD5가 검증한 원본과 일치했다. 적용 후 아래 표의 기대 MD5와 일치하며, `search_path`, `SECURITY DEFINER`, 읽기 함수 `STABLE`, `anon`/`authenticated` 실행 금지와 `service_role` 실행 권한이 유지됨을 확인했다. 관리 도구의 migration transaction을 사용하고 세션 한정 `lock_timeout=2s`, `statement_timeout=8s`를 적용했다.

읽기 전용 transaction에서 `service_role`로 `storage_reward_audit_source()`를 한 번 호출했다. 내부 snapshot, resources, wallets, history, revisions의 응답 형식이 정상이고 wallet/ledger 불일치는 0건이었다. 학생 데이터 본문은 출력하지 않았다. 저장 함수는 운영 데이터로 시험 호출하지 않았으며, 적용 후 본문 해시 및 앞선 로컬 동시성 테스트로 검증했다. 테이블·기존 데이터·RLS를 변경하는 SQL은 실행하지 않았다.

보안 advisor에는 적용 전 `rls_enabled_no_policy` INFO 28건, 적용 후 29건이 표시됐다. 추가 항목은 이번 SQL이 다루지 않는 `gugudan_vertical_fact_kinds`이며, 같은 시간 `gugudan_classroom_concurrency` migration이 별도로 등록됐다. 이번 세 함수 해시는 재확인해 모두 일치했다. 다른 작업의 SQL이나 정책은 변경하지 않았다. [Supabase RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 확인한 원인과 이번 수정

앞선 운영 읽기 전용 조사에서 09:30–09:41 KST에 PostgreSQL `57014` statement timeout 52건을 확인했다. 전체 snapshot 22건, scoped read 16건, poll 6건, metadata 5건, audit 2건, 미분류 1건이었다. 같은 시간 저장 알림 7건은 조사 시점에 대응하는 committed receipt가 존재했다. 따라서 알림을 곧바로 데이터 소실로 해석할 수 없다. Vercel 실시간 로그·배포 버전·당시 CPU/메모리 그래프는 직접 확인하지 못했다.

| 우선순위 | 수정 파일 | 변경·효과 | 남는 한계 |
|---|---|---|---|
| 1 | `supabase/storage_v2.sql`, `storage_audit_v2.sql`, `storage_snapshot_execution.sql` | 전체 조회·감사의 동일 SELECT를 PL/pgSQL `STABLE` 함수에서 실행. 큰 단일 JSON 결과의 불필요한 임시 파일 쓰기를 제거 | 전체 기록 집계와 전송량은 그대로. scoped 조회 비용을 모두 해결하지는 않음 |
| 2 | `src/components/student/StudentClasswordPage.tsx`, `src/server/classwordRepository.ts` | 낱말판 성공 폴링 3초→5–6초 분산. 실패 시 5/10/20/40/60초 기반 지터 및 Retry-After 적용. 서버에서 동일한 진행 중 GET 공유 | 다른 학생 변경 반영이 최대 약 2–3초 늦어질 수 있음. 공유는 같은 Vercel 인스턴스 안에서만 유효 |
| 3 | `supabase/storage_v2.sql`, `storage_ancestor_locks.sql` | 변경하지 않는 실제 구조 조상만 shared advisory lock 사용. 공통 루트 때문에 다른 기능까지 직렬화되던 대기 제거 | 같은 category의 scope counter와 같은 학생 wallet은 계속 직렬화. 동일 경제 기능 집중 시 p95 개선은 미확인 |
| 보완 | `src/server/storageV2Repository.ts` | 다른 scope의 poll leader 대기를 250ms로 제한하고 이후 자신의 metadata 조회. 8초+8초 순차 대기를 방지 | leader가 느리면 개별 metadata 요청 수가 증가. 서버 응답 자체의 8초 제한은 유지 |

폴링은 hidden/offline 중 정지, 복귀·날짜 변경·저장 알림 처리, 늦은 응답 무시를 유지한다. mock의 정상 주기는 3초다. 성공·실패 GET은 완료 즉시 공유 맵에서 제거한다. 쓰기 전후의 세대 구분으로 저장 후 조회가 이전 GET에 붙지 않게 했다. POST는 공유하거나 자동 재전송하지 않는다.

잠금 순서는 receipt→wallet→scope→resource를 유지한다. 실제 변경 키, 일반 값, 없거나 삭제된 키, 변경 대상의 조상이 아닌 읽기 의존성은 배타 잠금을 유지한다. 조상 revision 검사도 제거하지 않았다. 동일 키의 shared→exclusive 승격을 만들지 않도록 변경 목록을 먼저 확인한다.

## 로컬 검증 결과

| 검증 | 결과 |
|---|---|
| 전체 Node 테스트 | 1,448 통과, 0 실패, 1 skip. skip은 `NEWSPAPER_PGLITE_MODULE`이 필요한 기존 신문 PostgreSQL 테스트 |
| 타입 검사·프로덕션 빌드 | `npm run lint`, `npm run build` 통과 |
| 새 SQL 통합 테스트 | 전체 snapshot/audit 데이터 동일, 과거 기록·revision 보존, `STABLE`·service-role 권한 보존, 반복 적용·롤백 통과 |
| 실제 두 연결 잠금 검사 | 기존 버전의 공통 root 대기 재현. 수정 후 다른 category 저장 진행. 부모/자식 양방향 및 동일 leaf의 오래된 저장 거절. 일반 값·미존재·삭제 키 등의 배타 잠금 확인 |
| 기존 DB 통합 테스트 | 23명 scoped 저장, 사적 우편 범위, tombstone, 보상 원자성, receipt, 감사 read-only 및 동시 보상 오탐 방지 통과 |
| Classword 및 metadata 단위 테스트 | 23개 동일 진행 중 GET→실제 GET 1회, 실패 후 재조회, URL/키/날짜 격리, 쓰기 후 freshness, backoff·Retry-After·소수점 타이머, 늦은 leader 후 중복 호출 방지 통과 |
| 실제 브라우저 | 환경파일 없는 정적 mock 빌드에서 낱말판·퀴즈 진입, 반복 폴링 중 입력 초안 유지, 1280×650/600/800 화면 확인. 운영 네트워크 장애는 브라우저에서 재현하지 않았고 단위 테스트로 검증 |

`npm test`는 `src/server/*.test.ts`와 `tests/storage/*`를 자동 포함하지 않으므로 해당 파일들은 별도 실행했다. 첫 전체 실행의 기존 “3초 고정” 소스 검사 실패는 새 폴링 계약으로 갱신한 뒤 통과했다. 기존 DB 테스트의 고정 포트 55439는 `STORAGE_TEST_PG_PORT`를 지원하도록 바꿔 격리 포트 55459에서 재실행했다.

인앱 브라우저의 Vite 개발 서버에서는 module startup 오류로 진입하지 못해 별도의 정적 mock 빌드로 화면을 검증했다. 개발 모드 초기화 오류의 원인은 이번 범위에서 확정하지 않았다. 화면 구조나 스타일은 수정하지 않았다.

### 임시 디스크 및 SQL 실행 시간

합성 과거 원장 4,830건, `work_mem=2184kB`, 같은 데이터와 권한, 함수별 5회 측정. 시간은 첫 비교의 중앙값이다.

| 함수 | 기존 임시 쓰기/호출 | 수정 임시 쓰기/호출 | 기존 실행 중앙값 | 수정 실행 중앙값 |
|---|---:|---:|---:|---:|
| `storage_load_snapshot` | 460블록(약 3.6MiB) | 0 | 26.265ms | 24.117ms |
| `storage_reward_audit_source` | 920블록(약 7.2MiB) | 0 | 34.015ms | 29.155ms |

재실행에서도 임시 쓰기 0과 결과 동일성을 확인했다. HTTP 전체 지연과 DB 단일 실행 시간은 구분해야 한다.

### 24명 혼합 시나리오 A/B

학생 23명+교사 1명, 각 5회 조회, 학생 각 5회 예금 저장, RPC 왕복 200ms 가상 지연. 기존/수정 버전을 번갈아 각 3회 실행했다. 운영 서비스에는 요청하지 않았다.

| 항목 | 기존 3회 | 수정 3회 |
|---|---|---|
| 조회 p95(ms) | 513 / 493 / 539 | 525 / 542 / 530 |
| 저장 p95(ms) | 1130 / 1066 / 1079 | 1190 / 1150 / 1090 |
| 저장 receipt 총수 | 345/345 | 345/345 |
| HTTP 오류·잔액/원장 불일치 | 0 | 0 |

이 시나리오의 p95 개선은 확인하지 못했고 수정 결과가 일부 더 느렸다. 같은 경제 category의 scope 잠금과 조회·응답 전송이 남아 있다. 다른 category의 병렬 진행과 임시 디스크 제거를 이 결과만으로 전체 처리량 향상으로 확대 해석하지 않는다.

## 운영 적용 순서와 남은 배포

SQL 1·2단계는 이번 요청으로 적용 완료했다. 현재 저장소의 운영 배포 지침에 따라 Vercel 배포는 사용자가 직접 한다. 새 의존성, 환경변수, 테이블·데이터·RLS 변경은 필요 없다.

1. **완료:** `supabase/storage_snapshot_execution.sql`. 두 읽기 함수 교체.
2. **완료:** `supabase/storage_ancestor_locks.sql`. 저장 함수의 조상 잠금 분기 변경.
3. 사용 중인 Vercel 배포 절차로 현재 소스를 반영한다. `icn1` 설정이 실제 응답 리전에 반영됐는지 확인한다.
4. 일반 수업 사용 중 읽기·저장 p95, 57014/502, 새 저장 알림과 receipt 확인, DB CPU/메모리·I/O·연결 대기를 비교한다. 응답 미확인 저장을 새 요청으로 무조건 다시 실행하지 않는다.

각 SQL은 트랜잭션과 함수 본문 MD5 버전 가드를 포함하며 재실행 가능하다. `STORAGE_CONCURRENCY_VERSION_MISMATCH` 발생 시 가드를 제거하지 말고 현재 함수 정의와 비교한다. 파일 전체 적용에 실패하면 SQL Editor 세션에 열린 transaction이 남지 않도록 `ROLLBACK;` 후 확인한다. 초기 설치용 `storage_v2.sql` 전체를 이번 운영 수정 용도로 재실행하지 않는다.

현재 함수 본문 MD5의 적용 후 기대값:

```sql
select proname, md5(prosrc), provolatile, prosecdef
from pg_proc
where pronamespace='public'::regnamespace
  and proname in ('storage_load_snapshot','storage_reward_audit_source','storage_commit_mutation');
```

| 함수 | 적용 후 MD5 |
|---|---|
| storage_load_snapshot | f1160d473fe2a05eccf1845e075e0f71 |
| storage_reward_audit_source | b58bc05acb8dbca0b9e7b883d8f7f3af |
| storage_commit_mutation | 87b5af4e04b5a40080ea697fc540ccbe |

복구가 필요하면 `supabase/storage_concurrency_rollback.sql` 전체를 실행한다. 세 함수 정의만 기존 버전으로 되돌리고 저장 데이터·영수증을 삭제하거나 되감지 않는다. 앱은 기존 Vercel 배포로 복구할 수 있다. 운영 복구는 실행하지 않았다.

## 무료 플랜 판단

24명이라는 숫자만으로 유료 전환이 필요하다는 근거는 없다. 이번 수정 후 정상 수업 구간의 오류율과 자원 지표를 먼저 확인해야 한다. 비용이 큰 기록 집계·scoped read 비용 및 같은 category 집중 저장은 남아 있으므로 안정성을 보장하지 않는다.

일반 사용 중 DB 리소스 포화·I/O 대기·57014가 지속되고, 요청량과 쿼리 비용 최적화 후에도 수업에 필요한 지연 기준을 만족하지 못할 때 증설을 판단한다. 요청 수가 줄었는데도 502가 남으면 Vercel 로그의 원인 코드, 응답 리전, Supabase 당시 지표를 같은 시간대로 비교해야 한다. 저장 알림은 receipt로 실제 반영 여부를 확인해야 하며, 오류 알림 확인 처리가 데이터 복구를 뜻하지 않는다.

재현 경로: `tests/storage/concurrencyFix.integration.test.ts`, `tests/storage/concurrent24MixedBenchmark.ts` (`--baseline-concurrency` 옵션), `src/lib/classwordPolling.test.ts`, `src/server/storageV2Repository.test.ts`, `tests/api/classwordRepository.test.ts`.
