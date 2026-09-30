# 반복 조회 및 동시 요청 개선 검증

2026-09-30. 운영 DB 변경 없이 로컬 PostgreSQL과 합성 학급 자료로 검증했다.

## 변경

- `storage_read_marker`는 resource/wallet 행 수와 revision 합계, control 변경 시각으로 변경 표식을 만든다. 변경이 없는 학생 반복 조회는 범위별 재귀 조회를 생략한다.
- 다른 학생 변경으로 전체 표식만 달라진 경우 기존 scoped readVersion으로 판단하고 새 표식을 기억한다.
- 동일 서버 인스턴스의 진행 중인 동일 범위 GET과 전체 표식 조회를 합친다. 완료 후 캐시는 남기지 않고 저장·충돌 검증 조회는 합치지 않는다.
- 교사 조회 완료 후 최소 5초 간격을 유지한다. 기존 오류 재시도 대기 시간은 보존한다.
- 예전 SQL 응답에 표식이 없으면 기존 scoped polling을 사용한다.

## 재현

변경 전 `supabase/storage_scoped_polling.sql`을 별도 파일로 보존한다. 격리 PostgreSQL에 `anon`, `authenticated`, `service_role` 역할과 pg 드라이버가 필요하다.

```sh
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js node --import tsx tests/storage/concurrent25ReadBenchmark.ts --polling-load --baseline-sql /path/to/pre-change.sql
```

학생 23명과 교사 2개 세션, resource 1,383개와 history 3,091개의 합성 자료를 사용했다. DB는 검증 후 삭제하지 않았다.

## 결과

변경 없는 반복 조회 5회씩 총 125 HTTP 요청에서 DB RPC가 120회에서 11회로 감소했다. 학생 scoped metadata RPC는 115회에서 0회로 감소했다. 초기 전체 조회의 유의미한 개선은 확인하지 못했다.

- 학생 23개 범위 및 경계 범위 5개 응답 동등성 통과
- 전체 시각이 변하지 않는 늦은 저장도 표식 변화로 감지
- 다른 학생 scoped readVersion 보존
- 신규 함수는 anon/authenticated 실행 불가, service_role 실행 가능
- 진행 중 조회 병합, 실패 후 재조회, 학생·인증 범위 분리 및 교사 느린 조회 간격 테스트 통과
- `npm test`: 1,408개 통과, 1개 기존 skip
- `npm run lint`, `npm run build`, `git diff --check`: 통과

동시 요청 병합은 서버 인스턴스 내부에만 적용된다. 운영 지연이나 502 해소 여부는 배포 후 확인해야 한다.

## 적용 순서

사용자 승인으로 `storage_polling_read_marker_20260930` 마이그레이션을 운영 Supabase에 적용했다. 읽기 함수 2개 추가, 기존 조회 응답 표식 추가와 권한 제한이며 저장 데이터 변경은 없다. 이후 사용자가 앱을 배포해야 반복 조회 최적화가 활성화된다.
