# 2026-10-01 학생 동시 접속 오류 조사

## 운영에서 확인한 사실

대상은 `school-timer-five.vercel.app`과 Supabase `School_Timer` 서울 프로젝트다.
초기 조사에서는 운영 조회와 실행 계획만 확인했으며 학생 기록, 오류 확인 상태, 배포와 DB 함수는 변경하지 않았다.
학생 작성 내용과 잔액은 조사 자료로 내보내지 않았다.

2026-10-01 12:15–13:25 KST의 PostgreSQL 로그에서 `57014` 116건을 확인했다.
모두 `statement timeout`이며, 해당 Data API 역할의 제한은 8초다.

| 작업 | 시간 초과 |
| --- | ---: |
| `storage_load_scope` | 71 |
| `storage_load_snapshot` | 26 |
| `storage_reward_audit_source` | 9 |
| `storage_load_scope_metadata` | 7 |
| `storage_commit_scoped_mutation` | 1 |
| 작업 식별 불가 | 2 |

조사 당시 확인하지 않은 오류 알림은 35건이었다. 이 중 경매 18건,
경제 16건, 설정 1건이며 경제 오류에는 주간 미션 확인 실패 14건이 포함됐다.
알림 개수는 실패한 저장의 확정 개수가 아니다. 응답 유실 뒤 저장되었을 수도 있고,
예전 빌드의 지연 전송도 포함되므로 재지급이나 재차감을 근거로 삼으면 안 된다.

DB 조회 시간 초과는 확인했지만 당시 CPU·메모리·I/O 중 무엇이 지연을 유발했는지는
현재 자료로 확정하지 않았다. 현재 건강 상태나 아래의 로컬 시험은 운영 장애 해소 증거가 아니다.

## 수정

- `storageCommandHandler`: receipt 조회, 범위 조회, commit, commit 후 조회에서 발생한
  `STORAGE_SERIALIZATION_RETRY`만 기존 최대 5회 안에서 재시도한다.
  다음 시도는 receipt 확인부터 시작하므로 저장 후 조회 실패가 지급을 중복시키지 않는다.
  DB 시간 초과 등 다른 오류를 성공으로 바꾸지 않는다.
- `weeklyMissionClient`: 일시적인 연결 오류 또는 HTTP 502/503/504를 한 번 재시도한다.
  기존 대기 정책과 `Retry-After`, 오프라인 및 호출 병합을 유지한다.
  복구된 요청은 저장 실패 알림을 만들지 않고 최종 실패만 보고한다.
- `storage_load_scope`: 거래 내역을 요청한 학생별로 읽는다.
  기존 `wallet_ledger_student_order` 인덱스를 활용하고 중복 학생 번호는 제거한다.
  응답의 범위, 버전, 저장 충돌 검사, 지급 규칙과 실행 권한을 유지한다.

운영 함수의 읽기 전용 실행 계획에서 기존 조회는 전체 ledger 4,887행을 순차 조회했다.
후보는 요청한 학생의 308행만 인덱스로 조회했으며, 전체 응답 필드와 내역이 동일했다.
따뜻한 캐시에서 교대로 측정한 전체 SQL 시간은 기존 57.308/53.756ms,
후보 52.694/51.696ms였다. 내역 순서는 resource identity와 저장 sort_order로 비교했다.
처음 측정한 580.539/58.296ms는 캐시 조건을 통제하지 못했으므로 개선율에 사용하지 않았다.

## 검증

임시 PostgreSQL 17, 합성 resource 1,383개와 ledger 4,885개를 사용했다.
학생 23명과 교사 2개 세션의 실제 HTTP 요청을 3회씩 실행한 뒤 기존/후보를 되돌려 반복했다.
변경 전후 300개 요청 모두 성공했다.

최종 단독 실행의 p95는 기존 191/187ms, 후보 184/185ms였다.
별도 단독 실행들은 약 6–7%, 최종 실행은 약 2% 개선으로,
전체 응답 속도 개선은 작고 실행 간 편차가 있다.
빌드·전체 테스트와 겹친 실행은 CPU 경합으로 조건이 달라져 성능 근거에서 제외했다.
운영의 8초 지연을 이 수정 하나로 해결했다고 보장하지 않는다.

- 거래 내역 실행 계획: 전체 4,885행 순차 조회 → 213행 인덱스 조회.
- 학생 23개 범위, 빈 범위·중복 학생·중첩 selector·편지 방향·전체 학급 등 경계 7개 응답 동일.
- scoped metadata와 snapshot의 `readVersion`, 전체 시각과 변경 표식 일치.
- SQL 반복 적용, 이전 함수로 복원 후 재적용, 전체 polling SQL과 단독 SQL의 함수 본문 일치.
- 범위 위반 거절, anon/authenticated 실행 불가, service_role 실행 가능.
- 실제 HTTP + PostgreSQL 동시 저장 검사: 25개 요청 성공, 경쟁 차감·중복 요청·응답 유실 복구·개인정보 범위 등 9개 시나리오 통과.
- 앞선 합성 브라우저 검사: 23개 미션 요청의 첫 응답을 503으로 주고 실제 대기 후 모두 복구, 오류 알림 0건.
  한 브라우저에서 23개 요청을 발생시킨 검사이며 실제 학생 23대나 학교 네트워크 검증은 아니다.
- `npm test`: 1,418건 중 1,417건 통과, 실패 0건, 기존 PGlite 설정이 없는 신문 PostgreSQL 검사 1건 skip.
- `npm run lint`, `npm run build`, `git diff --check` 통과.

재현 명령:

```sh
STORAGE_TEST_PG_MODULE=/path/to/pg/lib/index.js \
STORAGE_TEST_PG_PORT=55439 \
node --import tsx tests/storage/concurrent25ReadBenchmark.ts --bounded-history-plan
```

외부 호출은 localhost 합성 gateway로 제한된다. 테스트 DB 이름은 `storage_http_test_`로 시작한다.
검증 후 임시 PostgreSQL 서버는 종료했고 합성 DB는 삭제하지 않았다.

## 운영 반영

단독 적용 SQL은 `supabase/storage_scope_history_read_performance.sql`이다.
조회 함수 `storage_load_scope(jsonb)` 하나만 교체하며 테이블·학생 데이터는 변경하지 않는다.
현재 확인한 함수 본문 MD5 `387312973223c8924ed37f3527732082` 또는
검증한 새 본문 `38354d2d883a82b765412b3515d1c31a`일 때만 실행하도록 검사한다.
다른 본문이면 `STORAGE_HISTORY_READ_VERSION_MISMATCH`로 중단한다.

사용자 승인 후 2026-10-01 20:15:07 KST에
`20261001111507_storage_scope_bounded_history_read_20261001` 마이그레이션을 운영 Supabase에 적용했다.
적용 직전에 기존 함수 본문 해시가 위의 기존 해시와 일치하는지 확인하고,
함수 정의를 `/private/tmp/school-timer-storage-load-scope-before-20261001.sql`에 보관했다.

- 적용 후 함수 본문 해시는 `38354d2d883a82b765412b3515d1c31a`로 일치했다.
- 저장·보상 관련 함수 25개의 해시·설정·권한을 전후 비교했으며 `storage_load_scope(jsonb)` 하나만 바뀌었다.
- `SECURITY DEFINER`, 고정 `search_path`, `jit=off`, service_role 전용 실행 권한을 확인했다.
- 기존 SQL과 실제 새 함수를 동일한 읽기 전용 트랜잭션에서 비교했다.
  학생 범위·빈 범위·중복 학생 지정 범위의 33개 필드가 동등했다.
  리소스·내역 배열의 물리적 반환 순서는 달라질 수 있어 저장된 order/sort_order를 포함한 전체 요소로 정렬 비교했다.
- 실제 운영 실행 계획에서 `wallet_ledger_student_order` 인덱스로 308행만 읽었다.
- `service_role`로 함수 실행을 확인했으며 scoped 응답과 유효한 readVersion을 반환했다.

학생 기록과 오류 확인 상태는 수정하지 않았다.
운영 적용 후 실제 수업 시간의 동시 접속 부하와 오류 감소는 아직 측정하지 않았다.
재시도 소스 수정의 앱 배포는 프로젝트 지침에 따라 사용자가 직접 수행한다.
반영 후 실제 수업 동시 접속 구간의 `57014`, API 502, 새 빌드 오류 알림과 p95를 다시 비교한다.
오류 알림 확인 처리는 저장 복구와 다르며 기존 알림을 자동으로 지우지 않는다.

## 앱 배포 시도

사용자의 직접 배포 재요청 후 기존 Vercel CLI 인증과 `school-timer` 프로젝트 연결을 완료했다.
기존 운영 주소는 `school-timer-five.vercel.app`이며 이전 배포는
`https://school-timer-iea27r6dr-onedot9191s-projects.vercel.app`이다.
CLI dry-run에서 수정한 클라이언트·서버 소스 포함과 `.env.local`, 인증 파일 제외를 확인했다.
현재 작업 폴더의 기존 실패 전시 공개 변경도 배포 대상에 포함된다.
연결 과정에서 CLI가 `.vercel` 설정과 `.env.local`의 기기 인증 정보를 갱신했으며,
`.gitignore`에 `.vercel` 제외를 추가했다. 비밀값은 배포하거나 기록하지 않았다.

운영 배포 명령은 실행 전에 자동 승인 검토에서 거절됐다.
사유는 운영 서비스 변경·중단 위험과 AGENTS.md의 직접 운영 배포 금지이며,
사용자 재요청만으로는 허용되지 않는다는 판단이었다.
배포 명령은 실행되지 않았고 앱 재시도 수정은 운영에 반영되지 않았다.
DB 조회 함수 최적화는 앞서 승인받아 적용한 상태를 유지한다.
이번 Vercel 배포만 허용하는 지침 예외에 대해 사용자 확인을 요청했다.

확인 근거: [Supabase 로그](https://supabase.com/dashboard/project/dxibhawclfhoabfgwria/logs/explorer),
[DB 지표](https://supabase.com/dashboard/project/dxibhawclfhoabfgwria/observability/database),
[함수 실행 계획 확인 공식 문서](https://supabase.com/docs/guides/troubleshooting/running-explain-analyze-on-functions).
