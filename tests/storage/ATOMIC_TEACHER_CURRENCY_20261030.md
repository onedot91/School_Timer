# 교사 고마 지급·금액 설정: DB 한 번 호출로 저장

## 변경 원리

교사의 고마 지급(`teacher.currency.adjust`, 양수)과 금액 설정(`teacher.currency.set`)은
서버가 범위 조회(`storage_prepare_command`) → 계산 → 저장(`storage_commit_scoped_and_load`)으로 DB를 두 번 호출했고,
학생 저장과 겹치면 처음부터 다시 시도했다.

새 RPC `storage_teacher_currency`는 영수증 확인, 지갑 잠금, 잔액 계산, 기록 작성, 저장, 결과 조회를 한 번에 처리한다.
잠금 순서는 기존 저장과 같은 영수증 → 지갑(학생 번호 순) → 범위이다.
실제 저장은 기존 `storage_commit_scoped_mutation`을 그대로 거치므로 범위 검사, 원장 불변, 차감 대기 정산이 동일하다.

- 기록 id·사유(`manual`/`bulk_adjust`)·필드는 기존 경로와 같다. 잔액이 바뀌지 않으면 기록을 남기지 않는다.
- 금액 설정의 기대 잔액이 다르면 기존과 같은 `409 CURRENCY_BALANCE_CHANGED`로 거절한다.
- 기록 묶음이 아직 없는 학생, 차감(음수 조정)·초기화·사유 차감은 기존 경로를 쓴다.

함께 고마 클릭 묶음 대기를 700ms에서 300ms로 줄였다.

## 검증

`tests/storage/teacherCurrencyAtomic.integration.test.ts` (실제 PostgreSQL, 필수 저장 회귀에 포함):

- 지급·설정이 RPC 1회(`Server-Timing` `1 RPC`)로 끝나고 잔액·응답 값이 맞다.
- 같은 명령의 기존 경로와 기록 모양이 같다.
- 응답 유실 후 재전송은 영수증으로 응답하고 두 번 지급하지 않는다. 같은 요청 ID의 다른 내용은 409.
- 기대 잔액이 다르면 409, 최대 잔액에서는 기록을 남기지 않는다.
- 음수 조정과 기록 묶음이 없는 학생은 기존 경로로 저장된다.
- 지급이 대기 중인 교사 차감을 같은 트랜잭션에서 정산한다.
- 동시 지급 6건이 모두 저장되고 잔액·원장이 일치한다. RPC는 `service_role`만 실행할 수 있다.

로컬 합성 데이터 결과이며 운영 응답 시간 측정은 아니다.

## 운영 반영 순서

1. Supabase에 `supabase/storage_teacher_currency.sql`을 적용한다. 새 함수만 추가하며 테이블·기존 함수는 바꾸지 않는다.
2. Vercel Production 서버 환경변수 `STORAGE_ATOMIC_TEACHER_CURRENCY=1`을 설정한다. `VITE_` 접두어를 붙이지 않는다.
3. 변경된 소스를 배포한다.

변수가 없거나 `0`이면 기존 경로를 쓴다. 되돌릴 때는 변수만 `0`으로 바꿔 재배포하며 SQL 함수를 지울 필요는 없다.
