# 범위 조회 버퍼 감축 (2026-10-23)

## 배경

- 2026-10-23 09:30~09:34 KST에 입찰·편지·감정 저장과 함께 receipt·metadata·snapshot 읽기도 모두 8초 제한에 걸렸다(Vercel icn1 로그).
- 같은 시각 요청은 분당 230~490건이었다. DB는 62MB, `storage_resources`는 4,175행이다. 잠금을 쓰지 않는 읽기도 함께 멈췄으므로 DB CPU 포화로 판단했다.
- 2026-08-06 이후 `pg_stat_statements` 누적 기준으로 `storage_load_scope`가 DB 실행 시간 1위였다(34,028회, 13,941초). `storage_resources`에서는 전체 스캔으로 6억 4천만 행을 읽었다.

## 원인

`storage_load_scope`와 `storage_scope_read_version`(폴링 metadata)의 조상 탐색이 다음처럼 같은 행을 키로 세 번 다시 읽었다.

1. 선택된 키마다 부모 키를 알려고 행을 다시 조회했다.
2. 재귀 단계가 자식 행마다 부모를 조회했다. 같은 부모를 자식 수만큼 반복해서 찾았다.
3. `nodes`가 결과 행을 키로 한 번 더 조회했다.

학생 화면 읽기 1회(노드 약 2,200개) 기준 버퍼 21,222개 중 약 20,000개가 이 반복 조회에서 나왔다.

## 변경

`supabase/storage_scope_read_buffers.sql`은 두 함수의 본문 지문을 확인한 뒤 해당 구간만 바꾼다. 롤백은 `storage_scope_read_buffers_rollback.sql`이다.

- 범위 스캔에서 읽은 행을 그대로 이어서 쓴다.
- 조상은 서로 다른 부모 키에서 시작해 한 번씩만 조회한다.
- `nodes`는 다시 조회하지 않는다.

| 함수 | 이전 본문 md5 | 적용 후 md5 |
| --- | --- | --- |
| `storage_load_scope(jsonb)` | `6916f9db14ee774148259dbaa7566558` (운영과 일치 확인) | `8989e478b4e372f8d47aedeac36ec4f7` |
| `storage_scope_read_version(jsonb)` | `6866cb51793ad8b48f47a681f28c89a1` (운영과 일치 확인) | `da3fc297c2f2155bd1dc9b58f1d2990e` |

## 측정

조건: 로컬 PostgreSQL 17.11, 운영 분포를 본뜬 합성 데이터(자원 2,972개, 원장 9,568건, 편지 768통 중 일부 삭제, 경매 내역 1,500건)로 `EXPLAIN (ANALYZE, BUFFERS)` 15회 중앙값을 냈다. 학생 데이터는 쓰지 않았다.

| 범위 | 시간(ms) | 버퍼 |
| --- | --- | --- |
| 학생 화면 읽기 `storage_load_scope` | 17.3 → 14.9 | 21,222 → 2,391 |
| 학생 화면 폴링 `storage_scope_read_version` | 6.3 → 3.8 | 20,297 → 1,466 |
| `student.auction.bid` 명령 범위 | 11.1 → 9.5 | 14,539 → 877 |
| `student.auction.bid` 폴링 버전 | 4.0 → 2.4 | 13,969 → 307 |
| `teacher.mail.delete` 명령 범위 | 5.9 → 5.1 | 7,531 → 607 |
| 측정한 20개 호출 합계 | 112.2 → 92.6 | 177,760 → 19,042 |

- 읽는 버퍼는 89% 줄었다. 학생 화면 읽기의 남은 시간은 대부분 약 1.5MB 응답 JSON을 만드는 데 쓴다(resources 집계 약 4.9ms, revisions 약 3.0ms).
- 운영의 공유 CPU에서 같은 비율로 줄어드는지는 배포 후 `pg_stat_statements`로 확인해야 한다.

## 검증

`tests/storage/scopeReadBuffers.integration.test.ts`(필수 저장 회귀에 포함)는 다음을 확인한다.

- 경계 범위 10개, 실제 GET 처리기가 요청한 학생 읽기 범위 3개, 명령 범위 7개에서 적용 전후 결과가 같다(순서가 계약이 아닌 배열은 정렬해서 비교).
- 모든 범위에서 `storage_scope_read_version`이 `storage_load_scope`의 `readVersion`과 같다.
- 학생 읽기와 폴링 버퍼가 4분의 1 이하로 줄었다.
- 다시 적용해도 바뀌지 않고, 롤백하면 이전 md5로 정확히 돌아간다. `SECURITY DEFINER`, `search_path`, `jit=off`, `service_role` 전용 실행 권한은 그대로다.

`tests/storage/classroomSaveBenchmark.ts`의 운영 함수 체인에도 이 마이그레이션을 추가했다.

## 운영 적용

1. 적용 전 두 함수의 `md5(prosrc)`가 위 이전 값인지 확인한다. 다르면 마이그레이션이 `STORAGE_SCOPE_READ_BUFFERS_VERSION_MISMATCH`로 중단된다.
2. `storage_scope_read_buffers.sql`을 적용한다.
3. 적용 후 md5와 Supabase 보안 권고를 확인한다.
4. 수업 시간대 이후 `storage_load_scope`·`storage_scope_read_version`의 평균·최대 시간과 Vercel의 `STORAGE_DATABASE_TIMEOUT` 건수를 비교한다.
5. 문제가 있으면 `storage_scope_read_buffers_rollback.sql`을 적용한다.

## 운영 적용 결과 (2026-10-23 09:56 KST)

- 적용 직전 md5는 이전 값과 같았다. 적용 후 `8989e478…`과 `da3fc297…`가 됐고, `SECURITY DEFINER`, `search_path`, `jit=off`, `service_role` 실행 권한은 그대로다.
- 수업 시간대를 벗어나 요청이 적을 때 같은 범위로 `EXPLAIN (ANALYZE, BUFFERS)`를 적용 전후 1회씩 실행했다. 실행 계획만 받았고 학생 데이터는 출력하지 않았다.

| 범위 | 적용 전 | 적용 후 |
| --- | --- | --- |
| 학생 화면 읽기 `storage_load_scope` | 356ms, 버퍼 29,769 | 156ms, 버퍼 6,316 |
| 학생 화면 폴링 `storage_scope_read_version` | 62ms, 버퍼 27,452 | 46ms, 버퍼 3,941 |
| 입찰 명령 범위 `storage_load_scope` | 71ms, 버퍼 16,443 | 54ms, 버퍼 3,481 |

- 적용 후 `storage_scope_read_version`과 `storage_load_scope`의 `readVersion`이 같았다.
- 적용 후 10분 동안 Vercel 오류 로그는 0건이었다. Supabase 보안 권고는 기존 INFO(`rls_enabled_no_policy`)뿐이다.
- 측정은 1회씩이라 오차가 있다. 수업 중 부하에서의 효과는 다음 수업 이후 다시 확인한다.
