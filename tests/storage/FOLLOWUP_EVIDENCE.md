# Storage v2 후속 개선 검증

기준 커밋: 87fb3f3. 운영 데이터는 QA에 사용하지 않는다. 현재 아래 결과는 로컬 구현 검증이며 운영 배포 완료를 뜻하지 않는다.

## 1. 보상 점검

- 완료 원본, 지급 표식, 실제 원장 순액을 대조한다. +6 표식만 남고 원장이 없는 합성 17번 학생을 1건으로 탐지했다. 승인 전 친구 제출과 당일 미확정 낱말은 제외한다. 복구 ID와 연결 불가 원본은 검사 범위를 명시한다. 자동 지급은 없다.
- 한 SQL stable RPC로 DB 근거를 동일 snapshot에서 읽는다. 교사 전용 HTTP 조회, 학생 403 / 미인증 401, 감사 전후 snapshot hash/원장/receipt 수 동일, 지급과 동시 조회에서 오탐 없음.
- 10분 간격의 교사 화면 활성 중 점검, 숨김 중 요청 중단, 복귀 재조회, 학생 필터, 수동 재검사, 이전 결과와 조회 실패 구별. 24시간 서버 스케줄러는 아니다.
- `TZ=UTC node --import tsx --test src/lib/rewardAudit*.test.ts tests/api/rewardAudit*.test.ts`: 18 통과. 한국 자정 경계 포함.
- `npm test`: 1,014 통과. 기존 StudentActionProgress 테스트는 무작위 타입을 비행 타입으로 가정하므로 random 입력을 0으로 고정했다. 원래 SVG/접근성 단언은 그대로 유지했다.
- `npm run lint` 및 Vite production build 통과.
- 실제 PostgreSQL/HTTP 2개 테스트 파일 통과. 24 동시 세션 모두 200, 9 거래 시나리오, 원장 불일치 0. 감사는 누락 +6 탐지, 읽기 전용, 지급 중 오탐 0.
- 실제 in-app browser: 기존 배포 artifact의 1280×650 기준 화면을 먼저 확인했다. 신규 artifact에서 1280×650 / 600 / 800 확인. 600에서 문서 크기 1280×600, dialog top 16 / bottom 584, 내부 overflow로 범위 안내 접근 가능. 필터 5번은 해당 학생 결과 없음, 17번은 +6/0 표시. 재검사 성공. Escape 후 보상 점검 버튼으로 focus 복귀, modal owner 0개.
- 읽기 전용 code review의 날짜 TZ와 visibilitychange 대상 2건을 수정하고 UTC 회귀 테스트와 document event target 테스트를 통과했다.

## 2. 점검·업데이트 안내와 초안

- 정확한 운영 코드와 HTTP 조합만 분류한다. 점검/업데이트 응답은 추가 영수증 조회와 저장 실패 알림에서 제외한다. 임의 503·네트워크·손상된 성공 응답은 미확정으로 유지하고 영수증만 조회한다. 영수증 조회의 점검 응답으로 원 요청의 미확정을 거절로 바꾸지 않는다.
- 학생/교사 초안에 확실한 중단 상태를 별도로 보관한다. 동일 입력의 수동 재시도는 기존 ID, 수정 입력은 확실히 미실행인 경우에만 새 ID를 만든다. 미확정 상태는 이전 입력을 고정한다. reconnect/visibility/reload가 거래를 자동 전송하지 않는다.
- 업데이트 버튼은 메모리 초안이 실제 기기 저장소와 같은지 검사한다. 저장 공간 오류·변조 시 새로고침을 막고 복사 안내를 표시한다. 해당 학생의 초안만 검사한다.
- 교사 설정 창 안으로 공통 안내를 이동하여 포커스 격리 안에서 사용한다. modal owner 1개, 안내는 inert 아님, 새로고침·닫기 버튼 44px. 설정 내 중복 오류 안내는 공통 안내를 닫기 전까지 숨긴다.
- 전체 `npm test` 1,021 통과. 최종 focused 상태/초안 10개 통과, draft 전체 포함 14개 통과. 클라이언트 별도 관련 28개와 saveFailure/library 회귀 74개 통과. lint/build 통과.
- 실제 localhost:3030 + 합성 PostgreSQL 학급: 학생 편지 입력→점검 거절(POST 1)→reload→동일 제목/내용 복원→수동 전송 구버전 거절(POST 2)→화면 새로고침 버튼→복원→수동 전송 성공(POST 3). 그 사이 자동 POST 없음. 운영 학급/학생 데이터 사용 없음.
- 교사 과목 편집→구버전 거절→reload→과목 초안 복원→직접 재확인, 최종 정상 저장. 1280×650 / 600 / 800에서 안내/내부 스크롤 확인. 600 문서 크기 1280×600, 조작 버튼 44px, 키보드 Enter로 업데이트 가능.

## 3. 기능·학생 범위 조회

- command/receipt의 full snapshot을 기능·학생 범위 RPC로 교체했다. 송금·집 제작자 보상·책 등록은 필요한 양쪽 지갑과 원장을 동일 transaction으로 저장한다. 일반 페이지 진입 전체 조회는 유지하고 metadata 조회는 빈 scope만 사용한다.
- 서버가 읽기/쓰기 selector를 결정하고 SQL에서도 범위 밖 변경·삭제를 거절한다. partial normalizer의 다른 학생 기본값을 저장하지 않는다. 삭제 tombstone, 배열 전체 순서 경계, history의 wallet revision을 보존한다.
- 클라이언트는 resource별 revision과 삭제 기록으로 병합한다. 역순 partial, 늦은 full, 학생 변경, 빈 원장, 손상 응답을 검증했다. library/economy 부분 응답 뒤 편지·책·프로필 등 기존 상태 보존을 별도로 검증했다.
- 동일 합성 460편지, 24세션×3회=72명령: 전체 snapshot 조회 216→0, 조회 행 130,149→5,133, DB 조회 응답 152,731,391→6,354,160 bytes(95.8% 감소). p50 392→337ms, p95 465→460ms. 기기 로컬 fixture 측정으로 운영 네트워크 속도를 보장하는 수치는 아니다. SQL의 category/owner 선택과 updated_at 인덱스를 적용한 최종 결과다.
- 실제 PostgreSQL/HTTP: 24 동시 쓰기 모두200, 지갑 경합·응답 유실·receipt·구버전 거절 9시나리오, 감사 +6 탐지와 읽기전용, 원장 불일치0. 추가 economy scope 실제HTTP테스트 full read/commit0, 송금·creator보상·profile·receipt 확인. library scope 테스트와23개서명세션 검증 통과.
- 읽기 전용 액션 의존성 감사 결과 blocking finding 없음: `.omo/evidence/storage-scope-code-review.md`.
- 실제 localhost3031 합성17번: 감정 기록 확정, 홈 잔액100→105, 감정·다른 메뉴 유지 확인.
- 최종 3단계 전체 unit/API 1,039개 통과. 실제 브라우저에서 이어서 편지 저장→reload→잔액105·감정·보낸 편지1개 유지. 1280×600/800 문서 overflow 없음, 브라우저 viewport 복원.

## 4. 배포 검증 게이트

- `npm run verify:release`: 타입→unit/API→서버/dev→SQL→보상/ㄱㄴㄷ 동시성→HTTP→emitted Node→production build를 하나로 실행한다. DB/driver 없는 경우와 외부 DB 입력은 nonzero다. SQL 훈련은 새 DB를 만들고 기존 fixture를 truncate하지 않는다.
- 실제 10개 API와91개 모듈을 `.js`로 emit하여 loader 없이 Node가 import했다. HTTP/PG11시나리오, command full조회0, 원장0. 확장자 누락·export 누락·driver/DB 없음의 실패 주입 포함6개 테스트.
- 검증 도중 파일 변경을 감지한 첫 실행은 모든 검사 성공이어도 `unchanged:false`로 실패했다. 안정된 소스 재실행은 모든9단계 통과, `passed:true`, `unchanged:true`.
- 해당 체크포인트 hash `43e4d8f5f3ba66dd17361da08e72f38b2a9de28941e51dec2d85d32fe4d3f1b6`, evidence `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/school-release-efE0vb`. 이 후 구형 화면 보호용 `X-Storage-Projection:1` 협상을 추가했으므로 최종 배포 전에 새 hash로 전체 게이트를 다시 실행한다.
- 구형 v2 화면은 부분 응답을 전체로 오해할 수 있어 새 지원 헤더가 없는 scoped GET/쓰기 요청을 RPC 전에426으로 거절한다. 새 화면은 헤더를 전송하며 SQL protocol2 계약은 유지한다. 이전 응답 유실의 영수증은 새 화면에서 재확인할 수 있다.

## 운영 SQL 추가 적용

- 최종 추가 화면 검증: mock 도서관에서 제목·글쓴이·감상 입력→새로고침→등록대 재진입 시 세 필드 복원, 책 받기→새로고침 후 운반 중 책 복원, 책장 배치 성공 후 다시 열면 초안이 비워짐을 실제 브라우저로 확인했다. 1280×650 문서 overflow 없음, modal owner 1개. 등록대 재진입에서 초안을 지우던 핸들러를 수정했다.
- 백업 훈련은 21개 테이블의 단일 MVCC snapshot을 두 개의 새로운 로컬 DB에 각각 복원했다. 모든 테이블 hash 일치, 각 복원본 재전송 추가 지급0 / 신규 거래1 / 원장 불일치0. 변조·외부 DB·기존 DB·복원 실패 rollback 검증 포함. 상세는 `RESTORE_EVIDENCE.md`.
- 최종 release gate에는 복원 훈련을 포함한 10단계를 연결했다. 최종 배포 hash와 운영 확인 결과는 `.omo/evidence/storage-followup-deployment.json`에 별도 기록한다.

- Supabase `dxibhawclfhoabfgwria`에 `storage_reward_audit_v2`, `storage_scoped_reads_v2` additive migration 적용 성공. 기존 active=true/maintenance=false 유지, bootstrap 미실행.
- 적용 전후 동일 MD5: wallets `5e4ca2c2d668a7feb2eba3c07cae7421`, ledger `193696c2064aad75041610474f962432`, resources `24223c520cf54bfceeb2687c6ce2ee4f`. 원장 불일치0. 읽기 RPC 동작과 anon/authenticated 실행권한 차단 확인.
- 운영 frontend/API alias는 이 시점 아직 기존 사용자 커밋87fb3f344d827d6ad9f0bf11af8486a15eb73639의 `dpl_4bkQoALYfMvX23bMrh9ZxQMR8pro`. 최종 release gate 이후 갱신한다.
