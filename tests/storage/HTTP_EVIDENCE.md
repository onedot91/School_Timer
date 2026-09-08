# 격리 HTTP / PostgreSQL 검증

2026-09-08 실행. 운영 Supabase 및 실제 학생 데이터는 사용하지 않았다.

## 실행

```sh
node --import tsx --test tests/storage/httpHarness.test.ts
node --import tsx --test tests/api/student-economy.test.ts src/lib/studentEconomyClient.test.ts
STORAGE_HTTP_DIST=/tmp/school-storage-release/dist node --import tsx tests/storage/httpHarness.ts --serve
```

로컬 PostgreSQL: `127.0.0.1:55439`. 기본 드라이버 위치는 `/tmp/school-storage-runtime/node_modules/pg/lib/index.js`이며 `STORAGE_TEST_PG_MODULE`로 지정할 수 있다. 서버는 독립된 `storage_http_test` 데이터베이스를 생성하고 SQL 파일을 적용한다. 테스트는 매번 이름이 다른 `storage_http_test_<pid>_<time>` 데이터베이스를 사용한다. 이미 생성한 데이터베이스나 원장을 삭제하지 않는다.

실제 API 핸들러 → 로컬 HTTP RPC 게이트웨이 → PostgreSQL 함수가 전체 요청을 처리한다. 게이트웨이는 테스트용 서비스 키와 허용된 RPC만 받으며 임의 SQL HTTP 경로가 없다. 모든 세션은 테스트 비밀키로 서명한 가짜 기기 세션이다.

## 확인 결과

- 독립된 학생 23명 편지와 교사 설정 저장을 동시에 요청: 24건 모두 HTTP 200, 최종 실행 166ms.
- 같은 지갑의 80고마 차감 두 건: 한 건만 확정, 잔액 20, 원장 한 건.
- 예금·펫 먹이·경매 입찰 경쟁: 잔액이 예약액 아래로 내려가지 않음.
- 동일 요청 재전송은 같은 결과, 다른 내용으로 ID 재사용은 409.
- 실제 HTTP 성공 응답을 끊은 뒤 영수증 확인 및 같은 요청 재전송: 원장 한 건.
- 17번 가짜 학생 +6 뒤 이전에 읽은 교사 설정 저장: 106 유지. 구형 전체 PUT 거절.
- 학생별 편지·지갑·거래 이력 비공개 범위 및 영수증 소유권 확인.
- 저장 중지 뒤 새 거래 503, 잔액 유지.
- `storage_reconcile_wallets()` 결과 `[]`.
- 경제 API/클라이언트 단위 및 경계 테스트 19/19 통과. 과거에 넓은 범위로 저장된 영수증도 조회 시 재필터링하는 회귀 검증 포함.

초기 실제 HTTP 검증은 교사 명령의 `p_result: null`이 SQL NULL로 전달되어 거절되는 결함을 검출했다. `storage_v2.sql`의 JSON null 정규화 수정 후 동일 24세션 시나리오가 통과했다.

## 브라우저 진입

- 교사: `http://127.0.0.1:3018/__fixture/session?student=0`
- 학생: `http://127.0.0.1:3018/__fixture/session?student=17`

브라우저의 정적 파일은 `STORAGE_HTTP_DIST` 경로에서 제공한다. 공유 설정·경제·기기 세션 API가 연결되어 있으며 다른 기능 API는 `FIXTURE_FEATURE_NOT_CONFIGURED`로 응답한다. 실제 브라우저 조작 검증 결과는 이 문서에 포함하지 않는다.
