# 2026-09-09 반복 데이터 로딩 장애

## 확인한 원인과 한계

- 운영 Vercel 로그: 09:06:50 KST `/api/shared-settings?metadata=1` 요청이 `storage_load_scope` 호출 중 8초 제한에 도달해 502를 반환했다. 같은 시간대 Classword 조회에도 TimeoutError가 발생했다. 실행 리전은 `icn1`이었다.
- v2의 변경 시각 조회는 빈 scope로 범용 조회 RPC를 호출했다. 저장소 v1의 metadata 요청 병합 경로도 우회했다.
- 상점 화면은 2초마다 확인한다. 학생 23명이 상점을 열면 변경 여부 확인만 초당 11.5건이며 변경이 감지되면 전체 snapshot을 추가 조회한다. 조회 RPC의 공유가 없어 동시 초기 접속도 요청 수만큼 전체 snapshot을 읽었다.
- 운영 DB read-only EXPLAIN에서 빈 scope 조회가 137.126ms였다. 같은 조회에 트랜잭션 로컬 `jit=off`를 적용하면 18.361ms였다. JIT 컴파일 비용이 짧은 반복 조회 비용을 크게 늘렸다. 이 측정은 롤백됐고 운영 함수 설정은 변경하지 않았다.
- pg_stat_statements에 scope 조회 최대 7606.7ms, 전체 snapshot 조회 최대 7614.6ms가 기록됐다. 이 통계는 누적값이므로 모든 값이 당일 장애에 속한다고 단정할 수 없다.
- 위 구조는 재현 가능한 부하 증폭 요인이다. 당시 모든 DB/네트워크 지연의 단일 원인을 입증한 것은 아니며 외부 서비스 장애까지 방지하지는 않는다.

## 변경

- `storage_load_updated_at()`은 인덱스로 변경 시각만 읽는다. 기존 RPC와 동일하게 resources의 최대 시각, wallets의 최대 시각, control 시각 중 최댓값을 반환한다. 삭제된 resource의 시각도 포함한다.
- 해당 함수 실행 권한은 기존 server-only RPC와 동일하게 service_role에만 부여한다.
- 기존 `storage_load_scope(jsonb)`에만 `jit=off`를 지정한다. DB 전체 설정이나 데이터는 바꾸지 않는다.
- metadata와 GET snapshot은 같은 URL/credential의 진행 중 요청만 공유한다. 완료 값 TTL 캐시를 만들지 않고 성공/실패 시 즉시 제거한다.
- PUT/POST 저장과 충돌 재조회는 기존 fresh snapshot 경로를 유지한다. GET의 결과는 계속 인증된 학생별로 투영한다. 타 학생 데이터 반환을 허용하지 않는다.

## 최종 검증

- 타입 검사, production build, 전체 기본 테스트 1081개 통과.
- 실제 로컬 PostgreSQL + HTTP의 교사 1명/학생 23명 동시 조회 및 저장 검증 통과.
- 잔액 경쟁, 중복 요청 영수증, 미확인 응답 재시도, 타 학생 데이터 차단, 잔액/장부 대조 0건 불일치 확인.
- `tests/storage/metadataReadBenchmark.ts`: 합성 resource 5000개, 24명 동시 조회 3회.

| 측정 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| metadata DB 조회 p50 | 67ms | 1ms 미만 |
| metadata DB 조회 p95 | 177ms | 1ms |
| metadata DB 조회 최대 | 184ms | 1ms |

- 실제 HTTP metadata 24건 모두 200, 전체 완료 19ms, DB 요청 5건으로 병합.
- 실제 HTTP 초기 전체 조회 24건을 DB snapshot 요청 1건으로 병합했고 학생별 지갑 키 격리를 검증했다.
- resources / wallets / control 각각의 시각 변경 뒤 기존 RPC와 새 RPC의 시각 및 JSON 문자열 형식이 일치함을 확인했다.
- 익명 metadata 요청 401, SQL anon/authenticated 실행 불가, service_role 실행 가능을 확인했다.
- 수치는 격리된 로컬 PostgreSQL의 비교 결과이며 운영 네트워크 지연을 포함하지 않는다. 프로세스별 요청 병합이므로 서로 다른 Vercel 인스턴스 간 병합을 보장하지 않는다.

## 운영 적용 순서

사용자의 운영 반영 승인 후 아래 순서로 적용 완료했다.

1. `supabase/storage_read_performance.sql` 적용. 데이터 이동/삭제 없이 읽기 함수 추가와 기존 조회 함수의 JIT 설정만 변경한다.
2. 새 함수와 기존 조회 함수의 변경 시각 일치, service_role 실행 권한을 확인한다.
3. 이 변경을 포함한 서버 코드를 배포한다. 새 RPC가 먼저 존재해야 하므로 코드부터 배포하지 않는다.
4. 운영 metadata 및 전체 조회 200, 학생/교사 화면, `icn1`, 오류/지연을 확인한다. 실제 학생 데이터를 쓰는 부하 테스트는 하지 않는다.

기존 서버 코드는 새 SQL과 호환된다. 서버 코드 롤백도 가능하다. 재발 시 Vercel의 시간 초과 로그와 DB RPC 실행 시간/호출 수를 같은 시간대로 비교한다.

## 운영 반영 결과

- 2026-09-09 09:30 KST 운영 도메인 전환 완료.
- Supabase migration `storage_read_performance` 적용 성공. 기존/새 RPC의 JSON 변경 시각 일치, anon/authenticated 차단, service_role 허용, scoped RPC의 `jit=off` 확인.
- 운영 DB에서 새 변경 시각 조회 EXPLAIN 실행 시간 6.232ms.
- 배포 ID: `dpl_5m8f9r25ysJejv3KdAEJLeXGQ21K`.
- 배포 소스 SHA-256: `a88c760dfcfc870cbbf22db4e657f25438282865d4bc2311d3037b80a61e12c6` (반영 결과 문서를 추가하기 전 검증 소스).
- 도메인 전환 전 교사/학생 조회 및 권한 검증 통과 후 승격했다.
- 운영 도메인에서 변경 확인 6회 모두 200, 57~126ms. 전체 조회 교사 709ms/학생 355ms, 모두 200. 학생 지갑 데이터의 본인 범위 유지 확인. 학생 작성 내용이나 잔액 값은 증거에 저장하지 않았다.
- 응답의 실행 리전 `icn1` 확인. 실제 브라우저 학생 화면 로딩 완료 및 콘솔 error/warn 0건 확인.
- 09:31 KST 새 배포 최신 로그 50건: 200 48건, 의도한 미인증 검사 401 1건, 상태 미확정 1건. 관측된 5xx는 0건. 이 짧은 점검 구간을 장기 무장애 보장으로 해석하지 않는다.
- Vercel production target이 위 배포 ID와 일치함을 별도로 검증했다.
