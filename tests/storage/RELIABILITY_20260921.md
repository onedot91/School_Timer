# 2026-09-21 동시 접속·저장 복구 검증

기준 커밋: `f06c8ca2c7fe0608f306151ca0a4a53882ab2490` 및 현재 작업 트리 수정. 운영 학생 기록에는 시험용 저장을 하지 않았다.

## 수정 사항

- `studentStorageCommand.ts`: 명시적인 점검 거절로 중지된 요청을 자동 재전송 대상에서 제외한다. 수동 재시도는 기존 요청 ID를 유지한다. 자동 복구의 초안 확인을 학생 저장 대기열 안에서 수행해, 앞선 수동 저장이 완료된 초안을 새 요청으로 다시 만들지 않는다. 대기 중 수동 저장이 거절되면 복구 완료를 알리지 않고 미확인 상태를 유지한다.
- `shared-settings.ts`: 조회 실패 시 원문 오류 대신 단계, 허용된 오류 이름·코드, 경과 시간만 기록한다. 학생 내용·인증 정보는 기록하지 않는다. 기존 HTTP 응답 계약은 유지한다.
- `httpHarness.ts`, `concurrent25BackgroundBenchmark.ts`: 실제 weekly-missions handler와 합성 evidence를 연결해 초기 조회, 자동 보상 정산, 입금, 교사 설정 저장을 함께 검증한다. 기존 fixture의 기본 동작은 유지하며 `weeklyMissions: true`로만 활성화한다.

## 실제 브라우저 재현 및 수정 후 확인

운영과 분리된 localhost 앱, PostgreSQL 17 합성 DB에서 수행했다.

1. 편지 작성 → 새로고침 → 초안 복원 → 보내기 → 새로고침 후 한 건 유지.
2. 수정 전: 점검 HTTP 503으로 편지 저장을 거절한 뒤 점검 해제·수동 재시도에서 동일 편지 두 건 발생. DB에도 서로 다른 요청 ID의 영수증 두 건이 있었다.
3. 수정 후: 같은 503에서 제목·내용 유지. 점검 해제 후 새로고침해도 초안 유지, 수동 전송 전 DB 영수증 0건. 보내기를 누르면 화면과 DB 모두 한 건. 브라우저 error 로그 없음.
4. 중지된 요청 자동 전송 방지 및 수동 저장 뒤 대기 중인 자동 복구의 새 ID 생성 방지 회귀 테스트 포함: 관련 20개 통과.

## 격리 동시성 검증

- 합성 학생 23명 + 교사 2세션. 매 회차 shared-settings 조회 후 학생별 weekly-missions와 deposit을 병렬 실행하고 교사 두 세션은 다른 설정을 저장한다. RPC 앞뒤에 각각 100ms 지연을 주었다.
- 30분(1,800,000ms), 60회차 완료. 인증 조회 25건, 공유 기록 조회 1,500건, 교사 설정 저장 120건, 보상 요청 1,380건, 입금 1,380건 모두 성공. 총 4,405건. 공유 조회 p95 273ms/최대 333ms, 교사 저장 p95 855ms/최대 874ms, 보상 p95 677ms/최대 1,058ms, 입금 p95 908ms/최대 1,823ms. 모든 회차에서 정합성 오류·중복 보상 0. 장기 시험은 처음 시작한 25세션 버전으로 실행했고, 이후 추가한 40세션·응답 유실 옵션은 별도 실행했다.
- 과거 낱말 3일 및 개인 질문 보상을 학생마다 준비했다. 총 보상 92건, 매 회차 지갑 예상 잔액·원장 정합성·중복 보상 여부를 검사한다.
- 40세션 순간 부하(학생 1~15 중복 세션 추가), 2회차 통과. 입금 76건 p95 2,348ms / 최대 2,369ms, 보상 요청 76건 최대 1,091ms. 잔액 불일치·중복 보상 0.
- 보상 저장 후 첫 HTTP 응답 유실을 주입하고 재요청: 복구 1건, 총 보상 92건 유지, 잔액 불일치·중복 보상 0.
- 별도 HTTP/경제 통합 시험: 25 동시 작성, 동일 지갑 경합, 영수증 재조회, 응답 유실, 오래된 교사 설정, 조회 범위 보호 통과.
- 보상 SQL 시험: 24 동시 세션의 퀴즈·기부 재전송과 교사 계획, 지갑·원장·우편 합계 및 today-friend 통과.
- 도서관: 두 API 프로세스에서 46 동시 배치 모두 성공, 재전송·같은 칸·응답 유실·권한·월 전환 보존 통과.

재현 예:

```sh
STORAGE_TEST_PG_MODULE=<pg module path> STORAGE_TEST_PG_PORT=<isolated port> SOAK_MINUTES=30 node --import tsx tests/storage/concurrent25BackgroundBenchmark.ts
STORAGE_TEST_PG_MODULE=<pg module path> STORAGE_TEST_PG_PORT=<isolated port> node --import tsx tests/storage/concurrent25BackgroundBenchmark.ts --40-sessions
STORAGE_TEST_PG_MODULE=<pg module path> STORAGE_TEST_PG_PORT=<isolated port> node --import tsx tests/storage/concurrent25BackgroundBenchmark.ts --lose-first-mission-response
```

시험마다 생성한 `storage_http_test_background_*` DB는 조사 증거로 보존한다. `stop()`은 연결·서버를 닫으며 DB를 삭제하지 않는다. 반복 실행 시 디스크 사용량을 확인하고, 정리는 별도 승인 범위에서 수행한다. 실제 학교 기기 25대의 브라우저/Wi-Fi 시험을 대체하는 결과는 아니다.

## 운영 재검사: 아직 완료 판정 불가

앞선 운영 150건 성공 기록은 `INCIDENT_20260921.md`에 있다. 이번 재검사에서는 다음 결과가 나왔다. 학생 번호 1~23 및 1·2번 중복 세션으로 인증하고 공유 기록 GET만 수행했다.

| KST | 성공/전체 | p95 | 최대 | 비고 |
|---|---:|---:|---:|---|
| 10:31:52 | 24/25 | 6,245ms | 12,002ms | 1건 TimeoutError, 반복 중단 |
| 10:33:19 | 25/25 | 6,826ms | 6,828ms | 재검사 1회차 |
| 10:33:23 | 25/25 | 2,032ms | 2,035ms | 재검사 2회차 |
| 10:33:26 | 25/25 | 1,494ms | 1,497ms | 재검사 3회차 |

재검사 성공으로 앞선 시간 초과를 해결 처리하지 않는다. 오류 1건은 HTTP 헤더 수신 전 클라이언트 제한에 도달했으며 Vercel 함수·통신·DB 중 어느 구간인지 확정하지 못했다. DB 활동 확인 순간 잠금 대기는 관찰되지 않았으나 과거 지연을 배제하는 증거가 아니다. pg_stat_statements는 수정 전부터 누적된 통계이므로 현재 성능 수치로 해석하지 않는다.

운영 조회 SQL 본문 MD5는 앞서 적용한 `a436ec1bcefdba20ae6f1951fcf77287`과 일치했다. 운영 JS 번들은 이번 확인 시 `/assets/index-CPuhVvwL.js`였으며 등록·해제 요청 제한 수정이 미배포 상태였다. Vercel 관리 화면은 인증서 오류로 접근 불가였고 검증을 우회하지 않았다.

## 정적·자동 검증과 반영 절차

- `npm run lint`, `npm run build`, `git diff --check` 통과.
- 전체 테스트 1,340 통과, 실패 0, skip 1. skip은 별도 PostgreSQL 환경이 필요한 newspaper 통합 시험이며 전체 npm test에서 실행되지 않았다.
- 현재 앱 수정은 미커밋·미배포다. 이번 단계에서 운영 DB 추가 변경은 하지 않았다.
- 사용자 앱 배포 후 인증 등록·해제 응답 제한, 중복 편지 수정, 안전한 조회 진단 반영을 확인한다. 운영 25세션 읽기 시험과 Vercel의 해당 시각 함수 로그를 대조해 지연 구간을 확정한다. 12초 제한을 늘려 성공으로 계산하지 않는다.
- 운영 쓰기 부하는 학생 기록에 주입하지 않는다. 별도 시험 학급/환경이 준비되면 동일 배포 구성에서 25세션 혼합 저장을 검증하고, 실제 학교 25대 동시 접속·작성·새로고침 흐름으로 최종 확인한다.

## 원시 증거 위치

- `/private/tmp/school-background-30min.log`
- `/private/tmp/school-background-40.log`
- `/private/tmp/school-background-recovery.log`
- `/private/tmp/school-reliability-http.log`
- `/private/tmp/school-reward-sql.log`
- `/private/tmp/school-library-concurrency.log`
- `/private/tmp/school-final-production25-read.log`
- `/private/tmp/school-final-production25-recheck.log`
- `/private/tmp/school-final-tests.log`, `/private/tmp/school-final-lint.log`, `/private/tmp/school-final-build.log`

## 11시대 장애 재신고 확인

사용자는 일부 학생의 여러 활동 접속이 `처리 중`에서 멈추고 교사 최신 현황도 갱신되지 않는다고 보고했다. 진행 중인 학급에 부하를 추가하지 않도록 운영 25세션 시험은 하지 않았다.

- GitHub `main`을 `git ls-remote`로 직접 확인: `187e3600140ba969f1de87d5bdc8b52d11e67771` (저장 복구 및 조회 진단 수정).
- 운영 루트 HTML은 여전히 `/assets/index-CPuhVvwL.js`를 참조했다. 해당 공개 JS에서 device-session GET 제한만 존재하고 POST/DELETE는 제한 helper를 사용하지 않는 이전 구현을 확인했다. 최신 등록·해제 제한이 운영 프론트엔드에 반영되지 않은 증거다. 백엔드 배포 커밋까지 이 정보만으로 확정하지 않는다.
- 운영 SQL `storage_load_scope` MD5는 `a436ec1bcefdba20ae6f1951fcf77287`로 최적화본 유지.
- 읽기 전용 DB 활동 확인 순간 일부 쿼리는 1~4초 실행 중이었고 조회한 세션의 `pg_blocking_pids`는 모두 빈 배열이었다. 잠금 대기 없음은 해당 순간에 한정하며 CPU 병목이나 현장 장애의 원인을 확정한 결과가 아니다.
- 인증 없는 device-session GET: HTTP 401, 총 319ms, 응답 지역 `icn1::icn1`.
- 운영 진단 세션 생성은 처음 자동 승인 검토에서 거절됐다. `api/device-session.ts`가 기존 학생 세션/DB를 변경하지 않고 요청자에게 서명 쿠키만 반환함을 코드로 확인해 재심사 후 허용됐다. 별도 프로세스의 학생 1번 쿠키로 인증 114ms, metadata GET 93ms, 학생 범위 GET 210ms, 모두 HTTP 200. 쿠키/학생 응답 본문은 출력·저장하지 않았고 업무 저장 API는 호출하지 않았다.
- 위 단일 조회 성공으로 학생·교사 전체 복구를 판정하지 않는다. 이번 진단에서는 현장 멈춤을 직접 재현하지 못했다.
- Vercel dashboard 재접속도 `ERR_CERT_COMMON_NAME_INVALID`로 차단됐다. 배포/로그 확인 및 인증서 경고 우회는 수행하지 않았다. 사용자가 최신 커밋의 실제 Production 배포 상태를 확인해야 한다.
- IndexedDB transaction 완료 이벤트에 시간 제한이 없는 코드 경로는 발견했지만, 현재 여러 학생·교사 증상과의 인과 증거가 없어 변경하지 않았다. 추가 앱 코드 수정 및 테스트 실행 없음.
