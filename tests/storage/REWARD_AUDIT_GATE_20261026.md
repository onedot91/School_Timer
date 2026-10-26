# 보상 점검 단일 실행 제한 (2026-10-26)

## 문제

- 2026-10-26 09:25, 10:25(KST) 수업 중 학생·교사 저장이 `STORAGE_DATABASE_TIMEOUT`(502)으로 끝났다(경매 입찰, 학급 설정, 고마 거래, 펫).
- 같은 시각에는 무관한 가벼운 RPC까지 함께 느려졌다(`gugudan_profile` 8.7초, `storage_get_receipt` 7.8초). 특정 행의 잠금 대기가 아니라 DB 전체가 포화된 상태였다. 요청 수는 오히려 직전 5분(1,136건)보다 적었다(582건, 833건).
- 10:25~10:28 사이 교사 화면의 보상 점검(`storage_reward_audit_source`)이 2분 30초 동안 7번 실행됐다. 같은 초에 두 번 실행된 경우도 있었다. 7번 모두 8초 `statement_timeout`까지 돌다가 취소됐다. 09:22에도 보상 점검 1건이 8초 시간 초과로 끝났다.
- 보상 점검은 학급 전체 스냅샷과 지갑 대조를 한 번에 만든다. 운영 DB 유휴 측정값(한 번씩): `storage_load_snapshot` 937ms(공유 버퍼 적중 2,277, 디스크 읽기 0 → CPU 작업), `storage_reconcile_wallets` 270ms. 평소 응답은 1.8~4초였다(Supabase edge 로그).
- 점검은 10분 주기 외에도 창에 다시 포커스가 올 때마다(마지막 점검 후 60초가 지났으면) 실행됐다. 교사 기기 여러 대가 같은 화면을 열어 두면 각각 따로 실행됐다.

## 변경

- `supabase/storage_reward_audit_gate.sql`: `storage_reward_audit_source_gated()`를 추가한다. 학급 전체에서 하나뿐인 슬롯(`pg_try_advisory_xact_lock(726316, 1)`)을 기다리지 않고 잡는다. 슬롯이 이미 잡혀 있으면 `REWARD_AUDIT_BUSY`로 바로 끝나므로 DB 연결을 붙잡지 않는다. 기존 함수를 그대로 감싸므로 한 번의 MVCC 스냅샷으로 조회하는 성질은 유지된다.
- 서버(`STORAGE_REWARD_AUDIT_GATE=1`)는 래퍼를 호출한다. 바쁨 응답은 `503 REWARD_AUDIT_BUSY` + `Retry-After: 60`으로 답하고 오류 로그를 남기지 않는다.
- 클라이언트 자동 점검은 창 포커스만으로는 실행되지 않는다. 화면 복귀와 주기 실행 모두 10분 간격을 지킨다. 간격은 점검 시작 시각부터 계산하므로 점검이 느려도 다음 주기를 건너뛰지 않는다. 자동 점검이 바쁨 응답을 받으면 경고를 띄우지 않는다. 교사가 점검 창을 열어 직접 다시 검사했을 때만 "잠시 후 다시 검사해 주세요."를 보여 준다.

## 검증

- `tests/storage/rewardAuditGate.integration.test.ts`(필수 저장 회귀): 권한(`anon` 불가, `service_role` 가능), 래퍼 결과가 기존 함수와 같은지, 슬롯이 잡혀 있을 때 1초 안에 `REWARD_AUDIT_BUSY`로 끝나는지, 슬롯이 풀리면 다시 성공하는지, SQL을 다시 적용해도 문제없는지 확인한다.
- `tests/api/save-alerts.test.ts`: 바쁨 응답은 503 + 허용된 코드로만 답하고 오류 로그를 남기지 않으며, 래퍼만 호출한다.
- `src/lib/rewardAuditPolling.test.ts`: 1분 뒤 화면 복귀는 점검을 다시 시작하지 않는다. 8초 걸린 점검 뒤에도 10분 주기 실행은 그대로 일어난다.

## 배포 순서

1. 운영 Supabase에 `storage_reward_audit_gate.sql`을 적용하고 래퍼 함수와 권한을 확인한다.
2. Vercel Production 환경변수에 `STORAGE_REWARD_AUDIT_GATE=1`을 추가한다.
3. 이 코드를 운영에 배포하고 응답 지역(icn1)을 확인한다.
4. 다음 수업 시간에 Supabase edge/postgrest 로그에서 다음을 확인한다: `storage_reward_audit_source*` 호출 수와 시간, `REWARD_AUDIT_BUSY` 건수, `canceling statement due to statement timeout` 건수, `STORAGE_DATABASE_TIMEOUT` 저장 오류 알림 수.

## 되돌리기

1. 환경변수를 끄고 재배포한다.
2. `storage_reward_audit_gate_rollback.sql`을 적용한다.

## 남은 위험

- 보상 점검을 막아도 학급 전체 스냅샷을 만드는 교사 읽기(`storage_load_scope` 교사 범위, `storage_load_snapshot`)는 수업 중 여전히 무겁다. 09:25 정체는 보상 점검 실행과 정확히 겹치지 않았다. 이번 변경 뒤에도 시간 초과가 이어지면 DB 컴퓨트 크기(현재 `max_connections` 60, `shared_buffers` 224MB)와 교사 읽기 비용을 다음 대상으로 측정한다.
