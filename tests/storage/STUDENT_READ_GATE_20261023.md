# 교사 우선 전역 학생 읽기 제한 (2026-10-23)

## 문제

- `STORAGE_TEACHER_PRIORITY`의 학생 읽기 대기열은 Vercel 인스턴스마다 따로 동작한다. 사고 시각에는 인스턴스 약 12개가 돌고 있어 DB에 무거운 학생 읽기가 최대 약 24개까지 동시에 몰렸다.
- DB CPU가 포화되자 교사 요청도 같은 대기열에서 기다렸다.

## 변경

- `supabase/storage_student_read_gate.sql`은 학생 읽기 전용 래퍼 세 개를 추가한다.
  - `storage_load_scope_student`
  - `storage_load_scope_metadata_student`
  - `storage_poll_scope_student`
- 각 래퍼는 학급 전체에서 공유하는 슬롯 2개 중 하나를 기다리지 않고 잡는다(`pg_try_advisory_xact_lock(726315, 1..2)`). 슬롯은 트랜잭션이 끝나면 풀린다. 빈 슬롯이 없으면 `STORAGE_READ_BUSY`로 즉시 끝나므로 DB 연결을 붙잡고 기다리지 않는다.
- 교사 읽기와 모든 쓰기(학생 명령 포함)는 기존 함수를 그대로 쓴다.
- 서버(`STORAGE_STUDENT_READ_GATE=1`)는 학생 GET 읽기와 폴링에만 래퍼를 쓴다. 슬롯이 없으면 100~300ms 간격으로 최대 2초 다시 시도하고, 그래도 없으면 기존 `503 STORAGE_READ_BUSY` + `Retry-After: 5`로 응답한다. 클라이언트는 이 응답을 일시적 실패로 처리하고 다음 동기화 때 다시 읽는다.

## 검증

- `tests/storage/studentReadGate.integration.test.ts`(필수 저장 회귀)
  - 권한: `anon` 실행 불가, `service_role`은 래퍼만 실행 가능.
  - 결과: 래퍼와 기존 함수의 결과가 같다.
  - 슬롯 2개가 모두 잡혔을 때 학생 읽기 세 종류가 즉시 `STORAGE_READ_BUSY`로 끝나고, 교사 읽기는 그대로 성공한다. 슬롯 하나가 풀리면 학생 읽기가 다시 성공한다. SQL을 다시 적용해도 문제없다.
- `tests/api/studentReadGate.test.ts`
  - 플래그를 끄면 기존 RPC를 그대로 쓴다.
  - 바쁨 응답 뒤 재시도로 성공한다.
  - 계속 바쁘면 2초 안에 `StorageReadBusyError`로 끝난다.
  - 다른 DB 오류는 그대로 전달한다.

## 배포 순서

1. 운영 Supabase에 `storage_student_read_gate.sql`을 적용하고 래퍼 함수와 권한을 확인한다.
2. Vercel Production 환경변수에 `STORAGE_STUDENT_READ_GATE=1`을 추가한다.
3. 이 코드를 운영에 배포하고 응답 지역(icn1)을 확인한다.
4. 수업 중 Vercel 로그에서 `STORAGE_READ_BUSY` 503 건수, 교사 요청 시간, `STORAGE_DATABASE_TIMEOUT` 건수를 확인한다. 학생 바쁨 응답이 지나치게 많으면 슬롯 수(현재 2)를 조정한다.

## 되돌리기

1. 환경변수를 끄고 재배포한다.
2. `storage_student_read_gate_rollback.sql`을 적용한다.

순서를 반대로 하면 학생 읽기가 실패한다.
