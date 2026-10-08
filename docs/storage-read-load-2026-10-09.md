# Storage 조회 부하 진단과 적용 절차 — 2026-10-09

## 운영 적용 완료

사용자가 적용을 승인한 뒤 **2026-10-09 00:36:37 KST**, `storage_scoped_read_execution` migration(version `20261008153637`)을 운영 프로젝트 `dxibhawclfhoabfgwria`에 적용했다. 적용 직전 두 함수의 원본 해시를 다시 확인하고 [정의 백업](../tests/storage/READ_EXECUTION_20261009_PRODUCTION_BEFORE.sql)을 저장했다.

적용 후 두 함수 본문 해시는 아래 기대값과 일치했다. signature·STABLE·SECURITY DEFINER·search_path·jit·ACL이 모두 유지됐으며 anon/authenticated 실행 금지·service_role 허용도 확인했다. storage 및 gugudan 함수 총 66개의 전후 메타데이터를 비교해 대상 두 개 외 64개 본문과 모든 함수 속성·권한이 그대로임을 확인했다.

읽기 전용 transaction에서 service_role로 빈 조회 scope를 1회 호출해 배열·orderingBounds 형식, readVersion 및 metadata와 snapshot의 일치, readMarker 형식을 확인했다. 학생 데이터 본문은 출력하지 않았다. 운영 데이터 쓰기·부하 테스트·통계 초기화·앱 배포는 하지 않았다. 이번 SQL은 현재 앱과 호환되어 앱 재배포 없이 동작한다. 수업 목표 달성 여부는 다음 실제 수업 로그 확인 전까지 미검증이다.

적용 후 Security Advisor는 ERROR/WARN 없이 기존 10/8 기록과 같은 유형·개수의 INFO 29건(`rls_enabled_no_policy`)을 반환했다. 이번 변경에서 정책을 수정하지 않았다. [해당 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 결론과 범위

누적 DB 시간의 최상위는 여전히 `storage_load_scope`다. 10/8 두 수업 구간의 PostgreSQL SQLSTATE `57014` 취소는 52건·134건이며, scope와 전체 snapshot에 집중됐다. 수업 뒤 적용된 변경까지 포함한 **현재 배포의 수업 시간 성능은 아직 측정하지 못했다.** 한밤중 통계 두 시점의 호출 증가가 0이므로 최근 비용 순위를 새로 확정할 수 없다.

이번에는 `storage_load_scope(jsonb)`, `storage_scope_read_version(jsonb)` 두 조회 함수의 실행 계획을 최적화했다. 최종 로컬 A/B 2회에서 25개 동시 scope SQL p95는 89/82→39/37ms, HTTP 조회 p95는 466/462→418/425ms였다. 저장 혼합 시나리오의 p95 개선은 입증하지 못했다. 무료 플랜에서 수업 중 timeout 0건·저장/조회 p95 1초 목표 달성은 운영 적용 뒤 실제 수업 로그로 판단해야 한다.

초기 진단에서는 운영 메타데이터·집계·관리 화면만 읽었으며, 이후 승인된 조회 함수 migration만 위 기록대로 적용했다. 학생 작성 내용·잔액·인증값은 증거 파일에 담지 않았다. 구구단 코드·테이블·함수는 변경하지 않았다.

측정 원본: [READ_EXECUTION_20261009.json](../tests/storage/READ_EXECUTION_20261009.json). 최종 보강 테스트 결과는 `finalStrictValidation`, 앞선 A/B와 혼합 결과도 함께 보관했다.

## 작업 인계와 운영 일치 확인

- 시작 시 `main`, HEAD `acdca907e2444c7b6f811f1c4f55dbb05093ca4e`, 미커밋 변경 0건. 10/8 21:01–21:02 변경은 21:29 커밋에 포함됐고, 사용자가 이 HEAD를 기준으로 진행하도록 승인했다.
- 기존 변경: snapshot/audit 실행 방식 개선, 구조 조상 shared lock, poll follower 대기 250ms 상한, classword 5–6초 폴링·실패 backoff·진행 중 GET 공유.
- 운영 `pg_proc.prosrc`의 MD5와 저장소 SQL을 비교했다. **public storage_* 함수 25개 모두 저장소의 해당 정의와 일치**했다. 단일 파일이 최신 전체 스키마라는 의미는 아니며 마이그레이션을 순서대로 합친 상태와 비교했다.
- migration history에 9/30 read marker(`20260930054636`), 10/1 history read(`20261001111507`), 10/6 combined poll(`20261006011503`), 10/8 snapshot(`20261008122442`)·ancestor locks(`20261008122457`)가 있다.
- 수업 시간 `storage_poll_scope` 837회로 combined poll 경로의 실제 사용을 확인했다. read marker가 SQL만 적용되고 완전히 꺼진 상황은 아니다. 모든 요청의 설정·클라이언트 버전이 같다는 뜻은 아니다.
- Vercel Production 화면에서 HEAD `acdca907`가 Ready인 것을 확인했다. 인증 없는 API 1회 요청은 401, 응답 지역은 `icn1::icn1`이었다. 인증된 저장/조회 성공을 이 요청으로 검증한 것은 아니다.
- 10/8 저녁의 SQL·앱 변경은 장애가 난 오전 수업 **이후** 배포다. 아래 수업 로그는 그 변경의 적용 후 성능으로 해석하면 안 된다.

## 운영 기준선

### 수업 시간 집계

Supabase unified logs의 정확한 UTC 범위를 지정했다. REST p95는 `response.origin_time`의 `quantileExact(0.95)`, 단위 ms다. Vercel API 전체 왕복 지연이나 DB 순수 실행 시간과는 다르다.

| 경로 | 09:30–09:40 KST 호출 | p95(ms) | 10:10–10:30 KST 호출 | p95(ms) |
|---|---:|---:|---:|---:|
| storage_load_scope | 209 | 6,607 | 271 | 4,248 |
| storage_get_receipt | 287 | 6,418 | 437 | 5,216 |
| storage_poll_scope | 351 | 5,311 | 383 | 4,250 |
| GET app_settings | 135 | 5,901 | 412 | 5,815 |
| GET classword_entries | 333 | 4,751 | 196 | 5,705 |
| storage_load_scope_metadata | 47 | 6,725 | 22 | 6,413 |

09:30 구간에서 완료된 scope 요청의 origin 시간 합은 291.3초, receipt 281.6초, poll 271.7초였다. 10:10 구간에서는 app_settings 415.8초, receipt 379.2초, scope 248.8초였다. 이는 동시에 진행한 요청의 벽시계 시간 합이며 DB 시간 점유율이 아니다.

| PostgreSQL 취소가 기록된 작업 | 09:30–09:40 | 10:10–10:30 |
|---|---:|---:|
| storage_load_scope | 16 | 65 |
| storage_load_snapshot | 22 | 46 |
| storage_poll_scope | 6 | 6 |
| storage_load_scope_metadata | 5 | 6 |
| storage_reward_audit_source | 2 | 6 |
| 기타·미분류 | 1 | 5 |
| 합계 | **52** | **134** |

SQLSTATE `57014`는 query cancellation이다. 제공된 statement timeout 장애와 일치하는 집계지만, 이번 쿼리는 원문 메시지로 모든 취소 사유를 재분류하지 않았으므로 186건 전부를 statement timeout으로 단정하지 않는다. 함수명은 query/context에서 추출했고 중첩 호출의 인과관계나 사용자별 실패 건수와 같지 않다.

70분 범위(UTC 00:25–01:35) 완료 REST 로그에는 5xx가 0건이지만 PostgreSQL 취소는 존재한다. 중단되어 REST 완료 로그에 남지 않은 요청을 성공으로 세면 안 된다. 범위별 집계 원본과 취소 집계는 증거 JSON에 있다.

### 누적 통계와 최근 차이

| 작업 | 누적 실행 시간 | 호출 | 평균 | 누적 임시 쓰기 |
|---|---:|---:|---:|---:|
| storage_load_scope | 12,242초 | 27,741 | 441ms | 원본 참조 |
| storage_load_snapshot | 3,782초 | 5,764 | 656ms | 2,847,881블록, 약 21.7GiB |
| storage_load_scope_metadata | 2,336초 | 9,231 | 253ms | 원본 참조 |
| storage_reward_audit_source | 1,521초 | 2,509 | 606ms | 2,726,881블록, 약 20.8GiB |

임시 쓰기는 8KiB 블록 기준의 통계 기간 누적량이며 디스크 현재 사용량이나 10/8 수업의 쓰기량이 아니다. 8/6 이후 통계에는 9/30·10/8 변경 전 비용이 섞여 있다. snapshot/audit의 큰 임시 쓰기 원인은 기존 [10/8 진단](concurrency-fix-2026-10-08.md)에서 로컬로 재현하고 이미 수정·운영 적용했다.

UTC 10/8 15:13:46.993616와 15:27:20.143552, 약 13분 33초 간격으로 주요 statement 통계를 읽었다. 위 주요 함수의 calls·total_exec_time·temp_blks_written 증가가 모두 0이었다. 이는 KST 10/9 00:13–00:27의 유휴 구간이며 수업 부하 기준선으로 사용할 수 없다. `pg_stat_statements_reset()`은 실행하지 않았다.

### CPU·메모리·Disk IO

로그인된 Supabase 관리 화면에서 Free/Nano, Seoul을 확인했다.

- 10/8 인프라 **일별 요약**: CPU 36%, 메모리 51%, Disk IO 1%. 수업 10분·20분의 최대값이 아니다.
- 수업 시간 범위를 지정한 Database 관측 화면에서 메모리 그래프에 swap이 크게 표시됐다(눈금상 약 600–900MB). 그래프 관찰치이며 swap 발생 원인·IO wait·수업 지연의 인과관계는 확정하지 못했다.
- 같은 범위의 Disk IOPS/throughput은 `Unable to load data`. 수업 중 Disk IO budget 소진율과 최대값은 **확인 불가**다.
- 일별 Disk IO 1%만으로 순간 budget 소진을 입증하거나 배제할 수 없다. 현재 Disk 16%는 저장 용량 사용률이며 IO budget이 아니다.

추가 권한 부족이라는 근거는 없고, 현재 관리 화면의 데이터 로드·시간 해상도 한계다. 무료 플랜 IO 소진은 계속 가설로 남긴다. [Supabase compute and disk 설명](https://supabase.com/docs/guides/platform/compute-and-disk).

## 우선순위와 수정 내용

| 순위 | 조치 | 근거·예상 효과 | 상태 |
|---|---|---|---|
| 1 | scoped SELECT와 readVersion 실행 계획 개선 | 가장 큰 누적 함수. 로컬 단독 scope 중앙값 11→6ms, 동시 p95 89→39ms. 실행 계획의 resource 행 방문 17,471→11,898(약 32% 감소) | 이번 구현 |
| 2 | 이미 배포한 snapshot/audit 임시 쓰기 제거·classword backoff 효과 확인 | 수업 취소의 snapshot 68건, audit 8건. 이전 로컬 테스트는 임시 쓰기 0을 확인. 다음 수업의 비용 감소율은 미확인 | HEAD·운영 반영 확인 |
| 3 | app_settings·updated_at·classword 호출 주체별 중복 추적 | 여전히 호출이 많다. hidden/offline 정지·진행 중 GET 공유는 기존 코드에 있음. 호출당·기기당 빈도 비교 뒤 추가 간격 조정 판단 | 후속 측정안 |
| 4 | 교사 전체 snapshot과 audit의 필요 범위 축소 | 일반 학생은 scoped, 교사·테스트 학생의 전체 GET은 snapshot. audit는 열린 교사 패널에서 10분 간격, focus/복귀는 완료 후 1분 제한으로 재조회 가능 | 이번엔 계약 변경 없이 유지 |
| 5 | 인덱스 추가 검토 | parentKey·key prefix·category/owner·mail sender/recipient·updated_at·wallet updated_at·app_settings PK가 이미 있음. 작은 테이블의 높은 seq_scan 누적 횟수만으로 인덱스 부족을 판단할 수 없음 | 중복 인덱스 추가 안 함 |

새 SQL은 selector를 바깥으로 옮겨 범위 인덱스를 활용하고, 활성 우편과 tombstone을 분리한다. 키의 하위 경로는 bytewise 범위 `path+'/' <= key < path+'0'`로 찾는다. [%·_·한글 경로도 literal로 비교](https://www.postgresql.org/docs/17/indexes-opclass.html)하며 테스트했다. closure/노드는 PK 조회, ordering bounds는 parentKey 인덱스를 이용하는 부모별 집계로 바꿨다.

전역 max(updated_at), readMarker 집계, 전체 revision 응답, wallet/history 구성은 그대로다. 최대 시각만 캐시하면 늦게 커밋된 변경을 놓칠 수 있으므로 제거하지 않았다. 호출 수·전체 snapshot·전송량·같은 경제 category의 저장 잠금은 이번 수정으로 줄어들지 않는다.

기존 `storage_selector_reads.sql` 실험 파일을 이번 변경 뒤에 실행하지 않는다. 이번 후보는 당시 selector만 바꾼 후보와 달리 closure/bounds까지 다루며, 운영과 일치하는 정확한 두 함수 버전만 허용한다.

## 로컬 검증

PostgreSQL 17.11, 전용 포트 55469, `work_mem=2184kB`, 합성 학생 23명·우편 2,800건·원장 4,830건. 교사 2세션을 추가해 25명 조회를 측정했다. 운영 서비스에는 요청하지 않았다. 동일 fixture에서 baseline→후보→rollback→baseline→후보 순서로 비교했다.

| 측정 | 변경 전 2회 | 변경 후 2회 |
|---|---|---|
| scope 단독 p50/p95(ms) | 11/12, 10/12 | 6/7, 6/7 |
| readVersion 단독 p50/p95(ms) | 5/6, 5/6 | 2/3, 3/4 |
| scope 25동시 SQL p95(ms) | 89 / 82 | 39 / 37 |
| readVersion 25동시 SQL p95(ms) | 22 / 24 | 12 / 13 |
| HTTP 25동시 전체 조회 p95(ms) | 466 / 462 | 418 / 425 |
| HTTP 학생 조회 p95(ms) | 257 / 269 | 220 / 227 |
| HTTP 교사 조회 p95(ms) | 531 / 527 | 483 / 490 |

단독은 함수당 15회, 동시는 25개×3회=75회. HTTP도 75회이며 69 scope+3 snapshot RPC로 호출 수가 같았다. 교사 2개의 같은 GET은 진행 중 snapshot을 공유한다. 모든 HTTP 오류 0건. 위 시간은 같은 로컬 기기의 벽시계 측정이며 무료 Nano 성능 보장이 아니다.

기존 `concurrent24MixedBenchmark.ts`에 `--read-execution`만 추가했다. 합성 우편 1,300건·학생별 과거 원장 143건, 학생 23명과 교사 1/2명, 각 5회 조회와 학생 각 5회 예금, RPC 왕복 200ms 가상 지연이다.

| 혼합 시나리오 | 조회 p95 전→후(ms) | 저장 p95 전→후(ms) | receipt | 오류·원장 불일치 |
|---|---:|---:|---:|---:|
| 24세션 | 282→282 | 919→912 | 각 115/115 | 0 |
| 25세션 | 306→307 | 924→916 | 각 115/115 | 0 |

혼합 테스트의 차이는 작아 저장 p95 개선으로 주장하지 않는다. 왕복과 같은 category의 저장 직렬화 비용이 남는다.

동등성 테스트는 23학생+9경계 scope의 SQL 응답, 학생 23명의 HTTP projection, revision/readVersion/readMarker, ordering bounds, 우편 범위, 중첩 selector, tombstone, avatar 키, 늦은 timestamp 변경, 다른 학생 버전 격리, 권한·STABLE·signature 보존을 확인했다. 반복 적용·정확한 rollback·알 수 없는 함수 버전의 원자적 거절도 통과했다.

정렬 순서가 명시되지 않은 SQL/projection의 키 기반 레코드 집합(resources/wallets/history/deletedKeys)만 비교 시 정규화한다. 사용자 데이터 배열·우편 표시 순서·원장 표시 순서는 그대로 비교한다. 마지막 검토에서 전역 필드명 기반 정규화를 이 범위로 좁혔다. 이 과정의 첫 엄격 비교는 projection 레코드 나열 순서 차이로 실패했고, 정확한 레코드 집합만 정규화한 최종 테스트는 통과했다. SQL 의미 차이를 숨기기 위해 사용자 배열을 정렬하지 않는다.

| 검증 | 결과 |
|---|---|
| `npm test` | 1,448 pass, 0 fail, 1 기존 skip(신문 PostgreSQL 선택 의존성 미설정) |
| `npm run lint` | 통과 |
| `npm run build` | 통과 |
| `src/server/storageV2Repository.test.ts` 별도 실행 | 10 pass |
| `tests/storage/readExecution.integration.test.ts` 실제 PostgreSQL 별도 실행 | 최종 pass, A/B 2회 포함 |
| 24/25명 기존 혼합 벤치마크 전·후 | 모두 pass |

새 DB 통합 테스트는 기본 `npm test`에 자동 포함되지 않는다. 기존 pg 드라이버 경로를 사용했으며 새 패키지는 설치하지 않았다.

```bash
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55469 node --import tsx --test tests/storage/readExecution.integration.test.ts
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55469 node --import tsx tests/storage/concurrent24MixedBenchmark.ts --scoped-polling
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js STORAGE_TEST_PG_PORT=55469 node --import tsx tests/storage/concurrent24MixedBenchmark.ts --read-execution
# 25명 비교는 두 벤치마크 명령에 --25-sessions 추가
```

전용 로컬 PostgreSQL이 먼저 필요하다. `STORAGE_TEST_PG_MODULE`은 설치된 pg 모듈 위치이며 운영 연결 정보를 넣지 않는다.

## 운영 적용 절차 — 승인 후 적용 완료

변경 파일:

- [적용 SQL](../supabase/storage_scoped_read_execution.sql)
- [복구 SQL](../supabase/storage_scoped_read_execution_rollback.sql)
- [동등성·성능 테스트](../tests/storage/readExecution.integration.test.ts)

1. 수업 밖에 운영 프로젝트 ref를 확인한다. 두 함수의 `pg_get_functiondef`를 승인된 보안 위치에 백업하고 아래 본문 해시를 읽기 전용 확인한다. 기존 SQL 전체를 재실행하지 않는다.
2. **완료:** 사용자 명시적 승인 뒤 `storage_scoped_read_execution.sql` 전체를 하나의 migration으로 적용했다. 두 함수만 교체하며 데이터·테이블·인덱스·권한·구구단은 수정하지 않는다. 세션 한정 lock timeout 2초, statement timeout 8초, 한 transaction과 버전 검사를 사용한다. 예상 버전이 아니면 전체 거절하므로 강제로 검사를 제거하지 않는다. 수동 SQL Editor에서 실패하면 `ROLLBACK;` 후 원인을 확인한다.
3. 적용 후 본문 MD5·signature·STABLE·SECURITY DEFINER·search_path·service_role 실행권한을 다시 비교한다. `NOTIFY pgrst`는 SQL에 포함돼 있다. 운영 합성 저장·반복 호출 테스트는 하지 않는다.
4. 그 다음 필요하면 사용자가 직접 앱을 배포한다. **이번 변경은 SQL과 테스트·문서만이므로 현재 운영 HEAD 앱과 즉시 호환되며 앱 배포가 성능 적용의 필수 조건은 아니다.** 기존·새 앱 양쪽 모두 같은 함수 signature/응답을 쓴다. 새 환경변수·의존성은 없다. 기존 protocol/scoped polling 설정은 변경하지 않는다. Codex는 운영 앱 배포를 실행하지 않는다.
5. 다음 실제 수업의 정상 사용 로그를 아래 기준으로 확인한다. 목표 미달 시 같은 테스트를 운영에서 반복하지 않고 로그와 통계 차이를 진단한다.

읽기 전용 확인 SQL:

```sql
select proname, md5(prosrc) body_md5, provolatile, prosecdef, proconfig,
  has_function_privilege('anon',oid,'execute') anon,
  has_function_privilege('authenticated',oid,'execute') authenticated,
  has_function_privilege('service_role',oid,'execute') service_role
from pg_proc
where oid in ('public.storage_load_scope(jsonb)'::regprocedure,
              'public.storage_scope_read_version(jsonb)'::regprocedure);
```

| 함수 | 적용 전·복구 후 MD5 | 적용 후 MD5 |
|---|---|---|
| storage_load_scope | 38354d2d883a82b765412b3515d1c31a | 6916f9db14ee774148259dbaa7566558 |
| storage_scope_read_version | 732b1b947e71c6da596af2316950056d | 6866cb51793ad8b48f47a681f28c89a1 |

**복구:** 별도 승인 뒤 `storage_scoped_read_execution_rollback.sql`을 전체 실행한다. 정확한 원본 본문을 복원하며 저장 데이터는 건드리지 않는다. 로컬에서 `pg_get_functiondef` 전체가 원본과 같아짐을 확인했다. 앱은 하위 호환이라 복구에 앱 재배포가 필요하지 않다. 적용/복구 모두 알 수 없는 중간 버전에서는 중지한다.

## 다음 수업 확인 항목

정상 동시 사용 24–25명으로, 수업 시작·끝 KST를 UTC로 변환하여 동일 구간을 집계한다. 이번 비교 구간은 UTC 00:30–00:40, 01:10–01:30이다.

- PostgreSQL: `statement timeout` 문구 건수 **0 목표**. SQLSTATE 57014 전체와 원문 문구 일치 건수를 분리 집계하고 함수별 분포를 확인한다. 원문·학생 내용은 출력하지 않는다.
- REST: 메서드+경로별 calls/분, p50/p95/p99·5xx·취소를 집계한다. scope/poll/metadata/updated_at/snapshot/audit/receipt/app_settings/classword/wallet/reward를 포함한다. p95 **1,000ms 이하 목표**이며 완료 로그 누락 가능성도 함께 본다.
- Vercel: 실제 저장 API·조회 API 전체 p95와 응답 지역 `icn1::icn1`를 별도로 확인한다. Supabase origin p95만으로 저장 API 목표 달성을 선언하지 않는다. 조회와 저장 결과 확인을 분리하고 미확인 저장을 성공으로 처리하지 않는다.
- 통계: 수업 전후 주요 `pg_stat_statements`의 calls·total_exec_time·shared/temp blocks 차이를 계산한다. reset 없이 수집하고 queryid가 사라지거나 초기화되면 그 구간의 차이를 유효 비교로 쓰지 않는다. 중첩 함수 시간을 합쳐 전체 DB 시간을 이중 계산하지 않는다.
- 자원: 동일 수업 범위의 CPU·메모리·swap·IO wait·Disk IOPS/throughput·IO budget을 확인한다. 로드 불가 지표는 확인 불가로 남긴다.
- 호출/정확성: 학생 1명 저장이 다른 학생의 불필요한 전체 GET을 유발하는지, snapshot/audit의 횟수, hidden 탭 요청, 실패 backoff, 저장 오류 알림과 receipt 확인 여부를 본다. 운영 학생 기록을 QA 목적으로 변경하지 않는다.

수업 로그에서 timeout 0과 저장/조회 API p95 1초 이내가 모두 확인되기 전까지 목표는 미검증 상태다.
