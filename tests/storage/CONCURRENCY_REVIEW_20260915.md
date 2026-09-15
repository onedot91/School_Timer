# 2026-09-15 동시 접속 재검토

기준 HEAD: `3d8b30184f316a7e59122d702d689704790766dd`와 미커밋 변경. 커밋은 생성하지 않았다. 아래 판정은 명시된 변경 묶음에만 적용하며 운영 무장애 인증이 아니다.

## 검토 기록

| 검토 | HEAD | 변경 식별 | 판정 | 근거 |
| --- | --- | --- | --- | --- |
| Goal | 3d8b30184f316a7e59122d702d689704790766dd | binary diff SHA256 5b634949bfaea2205f4892b29e798a74478d25ceb74d65e6ca7f2e597a160724 | PASS (소스 개선 범위) | /private/tmp/concurrency-goal-review.md |
| Security | 3d8b30184f316a7e59122d702d689704790766dd | diff SHA256 d04aac93aacf202b3f3dedc0be6b503e468acdfdaf62efd0bd8f88768f67af48 | PASS | /private/tmp/concurrency-security-review.md |
| Context | 3d8b30184f316a7e59122d702d689704790766dd | diff SHA256 d04aac93aacf202b3f3dedc0be6b503e468acdfdaf62efd0bd8f88768f67af48 | FAIL (운영 해결 완료 근거 부족) | concurrency_context_review 최종 응답 |

Context 검토에서 지적한 미확인 사항: 실제 배포 후 인증된 학생 접속·저장, 여러 Netlify 인스턴스에 걸친 부하, 같은 시간대 DB CPU/연결 지표. 프로세스 로컬 조회 공유를 전체 서비스 1회 조회로 해석할 수 없다. 지역 차이만으로 장애 원인을 확정할 수 없다.

## 부모 작업의 실행 근거

- 같은 IP의 합성 23개/46개 기기로 각 2회 요청 제한 검사: 46/92회 허용, 차단 0. 첫 학급 접속을 무조건 차단하는 제한은 재현되지 않았다. 지속 사용 시 한도와 플랫폼 분산 동작 전체를 검증한 것은 아니다.
- `studentInitialLoading`, `studentSettingsSync`, `weeklyMissionClient` 20개 테스트 통과. 23/46개 클라이언트의 자동 재시도 대기, 오류 후 복구, 서버 Retry-After 및 현재 화면 보존을 재확인했다.

| 추가 검토 | HEAD | 변경 식별 | 판정 | 근거 |
| --- | --- | --- | --- | --- |
| Code | 3d8b30184f316a7e59122d702d689704790766dd | diff SHA256 d04aac93aacf202b3f3dedc0be6b503e468acdfdaf62efd0bd8f88768f67af48 | PASS / APPROVE, 기존 검증 실패 WATCH | /private/tmp/concurrency-code-review.md |

Code 검토의 비차단 참고 사항: 월 경계 검사와 실제 commit 사이 자정이 지나가는 시간 경계는 기존에도 존재한다. 정확한 자정 기준 원자성을 현재 패치로 보장하지 않는다.

정식 PostgreSQL 포함 release 검증의 사전 검사 결과: `RELEASE_FIXTURE_REQUIRED: set STORAGE_TEST_PG_MODULE and STORAGE_TEST_DATABASE_URL`. 격리 DB fixture가 없어 실 PostgreSQL 동시성 검증은 수행하지 못했다.

## 차단 사항: 독립적인 책장 등록의 동시 충돌

**종합 판정 FAIL. 동시 접속 안전성 검토를 통과한 상태가 아니다.** 코드·보안 검토의 비차단 판정은 아래 실행 결과를 대체하지 않는다.

- QA lane HEAD `3d8b30184f316a7e59122d702d689704790766dd`, diff SHA256 `d04aac93aacf202b3f3dedc0be6b503e468acdfdaf62efd0bd8f88768f67af48`, **FAIL**. 근거 `/private/tmp/concurrency-qa-review.md`.
- 실제 로컬 HTTP API + 합성 저장소에서 23명이 서로 다른 빈 칸에 동시 등록했다. 첫 23개 조회를 같은 revision에 맞추고 각 RPC 처리 전/후 80ms씩 지연했다.
- 검토자 실행: HTTP 200 **5건**, 409 **18건**. commit 시도 105회, 최대 2,043ms.
- 부모 직접 재실행: HTTP 200 **7건**, 409 **16건**. commit 시도 104회, 최대 2,216ms. 무작위 재시도 지연으로 성공 건수는 달랐지만 독립 저장 실패는 반복됐다.
- 성공 건수와 저장된 책·영수증·보상 건수는 일치했다. 실패한 학생에게 성공을 표시하거나 중복 지급하지 않았다. 이는 저장 무결성 통과, 동시 저장 가용성 실패다.
- 나머지 실제 HTTP 시나리오 24개는 통과했다. 동일 요청 23회 재전송, 같은 칸 23명 경쟁, 응답 유실 후 재확인, DB 실패/확인 조회 실패, 23/46명 오늘의 친구 GET, 계획 조회 실패 후 복구, 학생별 제출 오류 분리, 인증/날짜/자격 분리를 포함한다.

### 원인 경로

1. `src/server/libraryCompetitionRepository.ts:25,54`는 모든 책 등록에 `scope:libraryCompetition:shared`와 `collection:/studentLife/books` 버전을 요구한다. 다른 칸·다른 학생이어도 공용 버전이 겹친다.
2. `supabase/storage_v2.sql:228`의 CAS 비교는 앞선 등록으로 버전이 바뀌면 `saved:false`를 반환한다. 다른 학생 기록 덮어쓰기를 막는 필수 보호다.
3. `api/shared-settings.ts:316`은 최신 조회 후 저장을 최대 5번 시도한다. 재시도 대기는 20~100ms로, 위 지연 조건에서 요청들이 다시 겹쳐 소진된다.

이 다섯 번 제한은 기존 코드에도 있었다. 지난 변경이 새로 만들었다고 단정하지 않는다. 그러나 읽기 5→3회 최적화만으로 해당 기존 병목이 해결되지 않았다는 것은 실행으로 확인했다.

### 필요한 구조 변경안 (미실행)

- 대상: 책장 등록 명령에 한정한 DB 트랜잭션 RPC, `libraryCompetitionRepository` 호출 경로, `shared-settings` 핸들러와 저장 회귀 검사.
- 한 DB 트랜잭션 안에서 최신 시즌·자리·학생 지갑을 확인하고 책/경쟁 기록/보상/장부/영수증을 함께 반영한다. 공용 버전 충돌 후 네트워크를 반복 왕복하는 경로를 제거한다.
- 잠금 순서를 기존 저장·시즌 전환과 호환되게 설계한다. 같은 칸은 한 명만 성공, 같은 requestId는 한 번만 지급, 월별 정산과 기존 책 ID·클라이언트 명령 계약을 보존한다.
- 기존 CAS 검사를 단순 삭제하거나 성공을 강제하지 않는다. 인스턴스 로컬 대기열은 분리된 Netlify 인스턴스 문제를 해결하지 못한다. 재시도 횟수/시간 제한만 늘리는 조정은 근본 해결로 취급하지 않는다.
- 실행 전 사용자 구조 변경/마이그레이션 확인이 필요하다. 새 라이브러리 도입이나 운영 데이터 삭제는 계획하지 않는다. Codex는 운영 배포를 수행하지 않는다.
- 완료 기준: 격리 PostgreSQL + 실제 HTTP에서 23/46개 독립 요청, 여러 API 프로세스, 지연/응답 유실/시즌 전환을 검증한다. 실제 운영 수용량과 무장애 여부는 별도 배포 후 관측이 필요하다.

### 증거 파일

- `/private/tmp/concurrency-qa-review.mts`: 실제 API를 호출하는 합성 HTTP 재현 스크립트.
- `/private/tmp/concurrency-review-root-http.log`: 부모의 반복 실행 결과.
- `/private/tmp/concurrency-qa-review-results.json`: 시나리오별 결과 (부모의 가장 최근 재실행).

실행 명령은 프로젝트 설치된 tsx를 사용한다:

```sh
node --import /Users/ibyeonghyeon/Documents/GitHub/School_Timer/node_modules/tsx/dist/loader.mjs /private/tmp/concurrency-qa-review.mts
```

스크립트의 프로세스 종료 코드는 시나리오 실패 판정과 별개다. 최종 출력의 `FAIL:1, PASS:24`를 판정 근거로 사용한다. HTTP 성공 자체를 시나리오 성공으로 바꾸지 않았다.

## 부모의 원인 대조 실행과 최종 검사

- 같은 합성 데이터와 RPC 왕복 지연을 유지하고 첫 조회 barrier를 제거한 뒤 23개 요청을 순차 실행했다. **23/23 HTTP 200**, 책 23권, 영수증 23개, commit 23회, 개별 요청 최대 516ms, 전체 11,559ms였다. 동시 실행에서만 충돌 재시도를 소진하는 경로를 구분했다. 스크립트의 시나리오 이름은 원본의 `simultaneous`를 유지하지만 실제 실행은 순차 `await`다.
- 대조 스크립트 `/private/tmp/concurrency-review-sequential.mts`, 결과 `/private/tmp/concurrency-review-sequential.log`.
- Debugging runtime audit: HEAD `3d8b30184f316a7e59122d702d689704790766dd`, tracked diff SHA256 `d04aac93aacf202b3f3dedc0be6b503e468acdfdaf62efd0bd8f88768f67af48`, **FAIL**. 부모의 실제 HTTP 반복/순차 대조 로그가 근거다. 이는 책장 등록의 재현된 결함이며, 모든 운영 접속 장애의 단일 원인을 확정한 것은 아니다.
- 이 검토 중 소스 코드는 수정하지 않았다. 기존 미커밋 소스 변경을 보존하고 검토 보고서만 추가했다. 구조 변경은 사용자 확인 전 미실행이다.
- 부모 `npm run build` 통과 (2.39초), `git diff --check` 통과.
- 검토자가 실행한 전체 테스트: 1,293 통과, 2 실패, 1 건너뜀. 기존 `tests/api/storageCommands.test.ts:67,73`의 편지 수량 기대값 실패. 타입 검사에는 기존 `src/lib/studentPet.test.ts:204` TS2740이 남아 있다. 관련 API 테스트 58개와 부모의 클라이언트 테스트 20개는 통과했다.
- 실제 PostgreSQL 검증은 격리 DB fixture 미설정으로 실행하지 못했다. 운영 배포와 운영 학생 데이터 변경은 하지 않았다.
