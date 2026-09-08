# Storage v2 후속 개선 순차 실행 계획

## 목표와 실행 경계

사용자 요청 `순차적 반영`에 따라 ① 보상·원장 감사 ② 점검/업데이트 안내 ③ 기능·학생 범위 조회 ④ 실제 배포 산출물 검증 게이트 ⑤ 격리 복원 훈련 순서로 구현한다. 각 단계의 검증이 통과한 후 다음 단계로 진행한다. 이 계획은 소스 조사에 근거하며 테스트 실행·운영 확인 결과를 대신하지 않는다.

기준은 현재 저장 구조 v2와 `STORAGE_CUTOVER.md`, `tests/storage/CUTOVER_EVIDENCE.md`다. 운영 전환 기록에는 23 지갑, 1,074 리소스, 2,761 과거 원장 항목, 원장 불일치 0건이 기록되어 있다. 이는 전환 시점의 증거이지 현재 운영 상태라는 가정이 아니다. 기존 배포는 이미 재개되었으므로 bootstrap/전환 전 동등성 검사를 운영 복구 수단으로 재실행하지 않는다.

- 구현·로컬 검증은 사용자 요청에 포함된다. Git 커밋/푸시/PR, 운영 SQL 설치·배포는 기존 대화의 명시적 승인 범위를 확인한다. 승인되지 않았다면 코드·SQL·테스트·배포 체크리스트까지 완성한 다음 구체 결과에 대해 한 번만 확인한다.
- 실제 학생 잔액, 보상, 입찰, 기부, 이력에 시험 거래를 하지 않는다. 보상 누락 감사는 읽기 전용이며 자동 보상·정정 기능을 추가하지 않는다.
- 새 의존성을 기본적으로 추가하지 않는다. Node/TypeScript와 기존 테스트 도구를 사용하고 PostgreSQL 드라이버·서버는 명시적으로 제공된 격리 테스트 환경을 사용한다. 운영 비밀키를 배포 설정에서 추출하지 않는다.
- 사용자 변경을 되돌리지 않는다. 실패 시 다음 단계만 중단하고 해당 변경을 수정한다. 커밋·삭제·강제 checkout을 자동으로 실행하지 않는다. 각 단계 종료점은 검증 체크포인트이지 자동 커밋 명령이 아니다.
- 화면 변경은 실제 콘텐츠 viewport 1280×650의 변경 전/후, 최종 1280×600 및 1280×800, 키보드·포커스·44px 조작 영역을 확인한다. 저장 상태는 색만으로 표현하지 않는다.

## 확인한 코드와 현재 위험

| 영역 | 실제 근거 | 구현에 미치는 영향 |
|---|---|---|
| 지갑/원장 | `supabase/storage_v2.sql:27`의 accounts, `:34`의 ledger, `:61`의 reward claims, `:361`의 reconcile | 잔액 합계 일치와 완료에 대한 실제 지급 여부는 별도로 감사해야 한다. historical 원장은 opening balance에 이미 반영되어 있다. |
| 전용 보상 | `supabase/storage_rewards_v2.sql:19` weekly claim, `:85` Today Friend approval; `src/server/classwordMissionSettlement.ts` finalized entries | 완료 근거, claim 표식, 지급 원장을 같은 안정적 식별자로 연결해야 한다. 기존/복구 지급 ID 호환성을 보존한다. |
| 일반 저장 | `src/server/storageCommandHandler.ts:57` | 매 시도마다 full snapshot, 성공 및 receipt 확인 후에도 full snapshot을 조회한다. |
| 변경 생성 | `src/server/storageV2Repository.ts:106` buildStorageMutation | partial snapshot을 full snapshot인 것처럼 쓰면 누락을 삭제로 오해할 수 있다. 범위와 완전성을 타입으로 분리해야 한다. |
| 클라이언트 | `src/lib/storageCommandClient.ts:75`, `studentStorageCommand.ts`, `teacherStorageClient.ts`, `studentSaveDraft.ts` | 현재 503은 receipt 확인 후 일반 확인 필요 오류로 바뀔 수 있다. 명시적 maintenance 거절과 불확실한 쓰기를 분리한다. |
| 공통 경고 | `src/lib/saveFailure.ts:84`, `saveFailureClient.ts`, `saveFailureDiagnostics.ts`, `src/components/teacher/TeacherSaveFailureWarning.tsx` | 계획된 점검·업데이트를 장애 알림으로 중복 적재하지 않되 실제 최종 저장 실패는 공통 보고를 유지한다. |
| 테스트 게이트 | `package.json`, `src/lib/vercelFunctionImports.test.ts:8` | npm test는 lib와 API만 포함한다. import 검사는 transpile+문자열 검사이며 Node 산출물 기동 검증은 아니다. |
| 격리 환경 | `tests/storage/httpHarness.ts`, `run-rewards-v2.mjs`, `src/server/storageV2.integration.test.mjs` | 실제 PostgreSQL과 HTTP 테스트를 재사용하되 localhost·신규 fixture DB·합성 데이터만 허용한다. |
| 백업 | `dev/storageCutover.ts:9`, `:175` | 현재 백업은 전환용 원본/전용 테이블이다. 운영 후 v2 resources/scopes/wallets/ledger/receipts/claims/control까지 별도 일관된 백업이 필요하다. |

## 1단계 — 완료 근거와 보상·원장 읽기 전용 감사

### S1. 감사 모델과 SQL

주요 파일: 신규 `supabase/storage_audit_v2.sql`, 신규 `src/lib/storageAudit.ts` 및 테스트, 필요 시 `supabase/storage_rewards_v2.sql`의 기존 ID 규칙 참조. 실제 작업자가 이미 정한 동등한 파일명을 우선한다.

1. 기능별 감사 범위를 명시한다. weekly personal question/Classword word/quiz, Today Friend, emotion·sudoku·baseball·failure 등 실제 보상 경로를 조사해 완료 증거 위치와 지급 ID를 표로 고정한다. 외부 완료 근거가 없는 기능은 `확인 불가`로 구분하고 누락 0건이라고 표시하지 않는다.
2. `완료 근거 존재 → 지급 근거 없음`, `claim 존재 → ledger 없음`, `ledger 존재 → claim/완료 불일치`, 중복·금액 불일치, wallet reconcile 결과를 각각 표현한다. 승인 전 Today Friend 제출, 미완료·지급 자격 전 항목은 누락이 아니다. 과거 복구/이관 기록과 보상액 랜덤 범위를 구분한다.
3. 감사는 한 SQL statement 또는 일관된 read-only transaction으로 수행한다. 조회 중 지급이 완료되는 경우의 거짓 양성을 피한다. stable finding ID, 학생 번호, 기능, 허용된 코드, 발생일·검사시각만 반환한다. 학생 답변·원문 오류·비밀키를 포함하지 않는다.
4. service-role-only RPC 및 RLS/revoke 계약을 유지한다. 보상 지급/acknowledgement 수정은 이 단계에 넣지 않는다.

검증: 정상 지급, 완료만 존재, claim만 존재, historical 정상 지급, 잘못된 금액, 중복 지급, 승인 전 제출, 데이터 부족, 23 지갑 불일치 fixture. 감사 전후 전체 상태 hash 동일. 지급/감사 동시 실행 시 완성된 동일 시점 결과만 반환. 기존 `tests/storage/rewards-v2.sql`과 보상 동시성 검증 유지.

### S2. 교사 조회와 주기적 검사

주요 파일: 신규 `src/server/storageAuditRepository.ts`, 기존 `api/save-alerts.ts` 또는 `api/shared-settings.ts`의 교사 전용 read action, 신규 교사 감사 패널, `src/pages/TimerPage.tsx` 연결. 기존 저장 실패 알림과 감사 결과는 서로 다른 데이터 모델로 유지한다.

1. 세션·same-origin·rate limit·응답 파싱을 유지한 teacher-only GET을 제공한다. 학생/미인증 요청은 SQL 실행 전 거절한다. direct API 함수 증설을 피한다.
2. 교사 화면에 검사시각, 확인 필요 건수/학생·기능, 원장 불일치, 조회 실패 상태와 `다시 검사`를 표시한다. 검사 실패를 0건으로 표시하지 않는다. 경고 확인을 보상 복구라고 쓰지 않는다.
3. 교사 화면 활성 시 첫 검사와 유한 간격 재검사를 구현한다. 숨김·unmount에서는 중단하고 요청 중복을 방지한다. 동일 finding은 중복 누적하지 않는다. 상시 검사까지 필요하면 읽기 전용 운영 CLI와 스케줄용 실행 계약을 제공하고, 실제 외부 스케줄/자동화 설치는 사용자 승인 범위에 맞춘다. 교사 페이지 polling만 구현했으면 24시간 상시 감시라고 주장하지 않는다.

검증: teacher 200, student/unauth 403/401, RPC malformed/timeout은 명확한 오류, 반복 결과 dedupe, hidden/unmount 취소, 실제 저장 실패 경고 독립성. 브라우저 3개 viewport 및 키보드 검사. 완료 증거는 SQL/HTTP 테스트 출력, fixture 발견 건수, 감사 전후 hash, 화면 캡처, 검사 범위·제약을 담은 `tests/storage/FOLLOWUP_EVIDENCE.md` 신규 절에 남긴다.

## 2단계 — 점검·업데이트와 응답 미확인 분리

### S3. 오류 상태 계약

파일: `src/lib/storageCommandClient.ts`, `saveFailure.ts`, `saveFailureDiagnostics.ts`, `saveFailureClient.ts`, 관련 전용 API clients/repositories.

서버가 쓰기 실행 전 확실하게 반환한 `STORAGE_MAINTENANCE`, `STORAGE_NOT_ACTIVE`, `STORAGE_PROTOCOL_REQUIRED`, `LEGACY_CLIENT_UPDATE_REQUIRED`를 검증된 공통 상태로 정규화한다. 임의 503/502·네트워크 단절·성공 본문 손상은 여전히 uncertain이다. maintenance 상태 조회만으로 이미 진행 중인 요청이 미저장이라고 추정하지 않는다. retry-after는 다음 read에만 사용하고 거래 POST를 예약하지 않는다. 영수증 조회는 읽기 전용으로 유지하고 기존 request ID/payload hash 검증을 보존한다.

검증: 명시적 maintenance는 점검, protocol mismatch는 업데이트, 연결 단절은 확인 필요, 잘못된 응답은 확인 필요, commit 후 응답 유실은 동일 receipt로 성공 확인. explicit status는 save-failure 누적 제외, 실제 최종 실패 보고는 유지. 한 번의 사용자 행동당 mutation POST 횟수를 검사한다.

### S4. 공통 안내와 초안 보존

파일: 신규 작은 공통 상태 안내 component/helper, `src/RootApp.tsx` 또는 페이지 공통 shell, `AuctionPage.tsx`, `TimerPage.tsx`, `studentStorageCommand.ts`, `teacherStorageClient.ts`, `studentSaveDraft.ts`. 기존 상태 소유 구조를 따른다.

점검은 `점검 중 · 작성 내용은 보관됩니다`, 업데이트는 `업데이트가 필요합니다`와 사용자 선택 새로고침, uncertain은 기존 요청의 `저장 확인`으로 구분한다. reload 전에 초안 보존을 확인하고 자동 새로고침하지 않는다. 성공으로 확인된 해당 draft만 제거한다. visibility/focus/online/타이머는 조회만 수행하며 거래 자동 재전송을 만들지 않는다.

검증: 입력→점검 응답→reload→동일 초안 복원; 구버전 응답→사용자가 업데이트→초안 복원; 응답 유실→reload→receipt 확인→1회 지급; 미확인 receipt→초안 유지; 학생 전환 시 초안/늦은 응답 혼입 없음. 학생/교사 화면을 3개 viewport로 검증한다. 완료 증거는 각 상태 캡처, 요청별 POST/GET 수, reload 전후 draft/request ID 보존(본문 비공개)이다.

## 3단계 — 기능·학생 범위 조회

### S5. 범위 snapshot 계약과 서버 RPC

파일: `src/server/storageV2Repository.ts`, 신규 범위 helper/테스트, `supabase/storage_v2.sql` 또는 별도 additive scoped-read SQL, `storageV2Codec.ts` 필요 부분.

1. S1/S2 및 기존 테스트를 통과한 상태에서 23명 동시 fixture 기준 변경 전 RPC 횟수, 요청·응답 bytes, p50/p95, 조회 row 수를 기록한다.
2. full snapshot과 scoped snapshot을 타입·응답 metadata로 구분한다. action별 필요한 categories, 학생 소유 데이터, 공용 auction/설정 의존성, 정확한 resource 및 collection revision을 명시한다. 범위 밖 resource는 변경/삭제 생성 대상이 될 수 없다. scoped assembly의 기본값을 실제 저장값으로 생성하지 않는다.
3. RPC는 server-derived selectors만 받는다. 학생 payload로 다른 학생 범위를 지정할 수 없다. parent resource, tombstone, ordering, wallet/history, read revisions의 의미를 유지한다. 서버 authorization과 browser projection 둘 다 유지한다.

검증: partial snapshot 누락→삭제 0건; 정상 범위 삭제만 허용; 타 학생/private mail 미조회·미응답; phantom insert conflict; collection order; revision 충돌; parent/tombstone 재구성; full/scoped 동일 명령 결과 동등성.

### S6. 모든 command/receipt의 범위 연결과 캐시

파일: `storageCommandHandler.ts`, `studentStorageCommands.ts`, `teacherStorageCommands.ts`, `storageCommandClient.ts`, `storageResponseOrder.ts`, `supabaseSettings.ts`, 필요 전용 API/repository, 기존 command·scope 테스트.

`storageCommandReadKeys`를 검증 가능한 action contract로 확장하고 모든 지원 command에 명시적 범위를 부여한다. 처리 전 snapshot, 재시도, 성공 response, receipt 확인 모두 범위 조회를 사용한다. receipt는 actor와 저장된 action 기반으로 범위를 결정한다. 화면 진입 full read는 유지할 수 있지만 각 command마다 full read fallback은 남기지 않는다. 부분 응답은 명시적 삭제 목록·revision과 함께 캐시에 병합하고, 오래된 응답·학생 전환으로 최신 값을 덮지 않는다. 서로 다른 범위의 timestamp만으로 전체 캐시 우열을 판정하지 않는다.

검증: 23학생+교사 동시 저장, 동일 지갑 race, 동일 요청 중복, commit 후 응답 유실, stale 교사 수정, 전체 지원 action parity, 타 학생 보존. harness metrics에서 지원 command와 receipt의 `storage_load_snapshot` 호출 0, 조회 rows/bytes 감소. 변경 전과 같은 fixture·횟수·환경으로 p50/p95 재측정하고 느려진 경로를 설명·수정한다. 읽기 timeout을 줄이거나 성공을 낙관 처리하여 속도를 개선하지 않는다. 완료 증거는 action→selector 표, parity 테스트, read 계수 및 전후 측정, 원장 불일치 0이다.

## 4단계 — 필수 배포 게이트

### S7. 실제 emitted Node ESM 기동 테스트

파일: 신규 `dev/verifyServerRuntime.mjs` 또는 동일 책임의 runner, `src/lib/vercelFunctionImports.test.ts`, `tests/storage/httpHarness.ts` 및 별도 emitted harness test.

현재 정규식 import 검사에 추가하여 모든 API와 transitive server dependencies를 격리 임시 디렉터리에 실제 `.js` ESM으로 emit한다. 원래 import specifier를 변경하지 않고 package type을 ESM으로 둔다. tsx/loader/실험적 extension resolver 없이 별도 `node` process가 모든 handler를 import하고 default 함수 shape를 검사한다. 같은 emitted handler로 localhost HTTP 서버를 기동하고 fixture API 요청을 보낸다. source tsx import 성공만으로 통과시키지 않는다. missing extension/export 등 의도적으로 깨진 작은 fixture가 gate에서 실패하는지 검증한다.

검증: 전체 handler import 수 자동 탐지, 비인증 거절, teacher/student scoped read, legacy write 거절, 실제 격리 정상 명령, duplicate/receipt와 reconcile. child process 종료코드/실제 Node 버전/모듈 수 기록. 임시 결과에 credentials를 저장하지 않는다.

### S8. 단일 release 검증 명령과 운영 절차 연결

파일: `package.json`, 신규 release runner, `STORAGE_CUTOVER.md`, `tests/storage/FOLLOWUP_EVIDENCE.md`. 요청 범위를 넘는 CI 공급자 연결은 하지 않는다.

`npm run verify:release` 하나로 lint → npm test → server/dev 추가 단위 테스트 → SQL/실제 DB·HTTP integration → emitted runtime → Vite build를 실행하도록 만든다. 필요한 PostgreSQL 환경이 없으면 release gate는 skip/pass 대신 actionable nonzero로 종료한다. 기존 가벼운 개발 테스트는 사용할 수 있다. Vercel build와 region `icn1`, protocol 2, bundle/CSP 확인을 배포 전후 체크리스트에 연결한다. 실제 배포 승인/환경이 없으면 `로컬 release gate 통과, 운영 미배포`로 구분한다.

권장 기존 명령: `npm run lint`, `npm test`, `node --import tsx --test src/server/storageV2Repository.test.ts dev/storageCutover.test.ts tests/storage/httpHarness.test.ts`, `node --import tsx src/server/storageV2.integration.test.mjs`, `node tests/storage/run-rewards-v2.mjs`, `node tests/storage/classword-concurrency.mjs`, `npm run build`. 각 DB runner의 실제 실행 전제와 격리 DB 정책을 먼저 확인한다. 테스트 개수는 실행 결과에서 가져온다.

완료 증거: 단일 명령 성공, 누락된 driver/DB와 의도적 runtime 결함에서 nonzero, 환경·source hash·검사 결과 기록. 운영 배포가 승인되었다면 immutable deployment ID, 실제 응답 `icn1`, read-only API 확인을 추가한다.

## 5단계 — 반복 가능한 격리 백업 복원 훈련

### S9. 운영 후 v2 백업·manifest 검증 계약

파일: 신규 `dev/storageBackup.ts`/테스트 또는 전환 CLI에서 순수 공통 helper만 추출, `STORAGE_CUTOVER.md`.

원래 전환 백업과 운영 후 v2 백업 형식을 구분한다. v2 형식은 원본·전용 테이블 및 resources/scopes/wallet_accounts/wallet_ledger/storage_receipts/storage_reward_claims/storage_control/필요 backup metadata를 포함한다. schema/protocol version, canonicalization version, primary-key 정렬, 건수, SHA-256, 전체 manifest hash, 일관된 snapshot 기준시각을 기록한다. 순차 REST 조회는 자동으로 일관된 백업이 되지 않으므로 read-only snapshot export 또는 승인된 유지보수 절차를 명시한다. 생성은 새 경로 0700/0600, 원문 로그 금지, 기존 파일 덮어쓰기 금지다.

검증: manifest/row hash 불일치, 누락 테이블, 잘못된 protocol/schema, 부분 export, duplicate primary key, filename traversal을 모두 거절한다. 기존 전환 백업 형식은 깨지지 않는다.

### S10. 새 disposable DB에 복원하고 release gate 연결

파일: 신규 `dev/storageRestoreDrill.mjs` 또는 `tests/storage/restoreDrill.mjs`, 관련 테스트, release runner, `tests/storage/RESTORE_EVIDENCE.md`.

runner는 localhost 및 새 이름의 비어 있는 disposable DB만 허용하고 운영 host/기존 DB를 거절한다. 운영 DB 삭제·truncate·overwrite 기능은 넣지 않는다. 합성 23명 fixture에서 실제 command로 보상·이력·메일·receipt를 만든 뒤 백업한다. 별도 신규 DB에 schema와 자료를 복원하고 table별 canonical hash/건수/PK, 23 balances와 opening balances, history 원문·순서, claim/receipt, wallet reconcile 0을 비교한다. 복원 DB에서만 동일 request ID 재확인/재실행으로 추가 지급이 없음을 확인한다. receipt 재확인 및 새 정상 거래도 검증한다. 실패한 fixture DB는 진단을 위해 남기며 삭제는 별도 사용자 승인 없이는 수행하지 않는다.

서로 다른 새 DB 2개에 같은 백업을 복원하여 반복성을 증명한다. 변조 백업이 복원 전 거절되고, 복원 중 오류가 success manifest를 만들지 않는지도 검사한다. 테스트 인증 정보는 합성 값만 사용한다. 실제 운영 백업을 활용한 훈련은 명시적 접근 승인과 비공개 경로가 갖춰졌을 때만 추가하며, synthetic 훈련을 운영 실자료 복원 성공이라고 표현하지 않는다.

완료 증거: 2회 source/restore hash, 23 balances/history/receipt 비교, 원장 불일치 0, 소요시간·Node/PostgreSQL 버전·schema hash·비공개 backup 위치(내용 제외), 실패 주입 결과. 이 명령을 최종 release gate에 추가하고 운영 복구는 forward-recovery 검토 대상이라는 문서를 유지한다.

## 종료 기준과 체크포인트

S2/S4/S6/S8/S10마다 해당 테스트와 `npm run lint`를 통과하고, 공통 저장 경계 변경 후 전체 `npm test`/build를 실행한다. 이미 통과한 동일 검증은 새 변경·실패·미해결 위험이 없으면 불필요하게 반복하지 않는다. 최종 S10 이후 전체 release gate와 변경된 화면 최종 QA를 수행한다. 검증 불가능한 환경은 원인·실행 명령·남은 작업을 기록하며 완료로 표시하지 않는다.

각 단계는 별도 동작 증거가 필요하다. 보상 감사 0건만으로 지급 완전성을 증명하지 않고, 테스트 통과만으로 운영 배포를 주장하지 않으며, 백업 파일 존재만으로 복원 성공을 주장하지 않는다. 사용자 최종 보고는 구현 파일, 검증 결과, 운영 적용 여부·남은 승인만 짧게 제시한다.

## Team Staffing Recommendation

```yaml
total_atomic_steps: 10
file_independent_steps: 1
cross_file_dependent_steps: 9
per_step_assignment:
  - {step_id: S1, assigned_to: unspecified-low, blockedBy: [], rationale: "감사 근거·지급 ID·SQL consistency를 함께 판단"}
  - {step_id: S2, assigned_to: unspecified-low, blockedBy: [S1], rationale: "확정 감사 모델에 API·교사 표시·polling 연결"}
  - {step_id: S3, assigned_to: unspecified-low, blockedBy: [S2], rationale: "1단계 완료 후 공통 오류 분류와 전용 경로 통합"}
  - {step_id: S4, assigned_to: unspecified-low, blockedBy: [S3], rationale: "오류 계약과 초안·요청 identity에 의존"}
  - {step_id: S5, assigned_to: unspecified-low, blockedBy: [S4], rationale: "3단계 순서 유지, SQL·타입·부분 mutation 안전성 필요"}
  - {step_id: S6, assigned_to: unspecified-low, blockedBy: [S5], rationale: "범위 계약을 전체 action·캐시에 일관 적용"}
  - {step_id: S7, assigned_to: unspecified-low, blockedBy: [S6], rationale: "최종 서버 graph를 실제 emit·기동"}
  - {step_id: S8, assigned_to: unspecified-low, blockedBy: [S7], rationale: "runtime·DB·HTTP 검증을 실패 전파되는 단일 게이트로 통합"}
  - {step_id: S9, assigned_to: unspecified-low, blockedBy: [S8], rationale: "현재 v2 전체 persistence와 일관된 백업 계약"}
  - {step_id: S10, assigned_to: unspecified-low, blockedBy: [S9], rationale: "manifest 검증 후 실제 복원·idempotency·게이트 연결"}
dispatch_path_recommendation: legacy
rationale: "사용자가 순차 적용을 요청했고 핵심 단계는 schema/repository/client 계약을 공유한다. 독립 실행 가능한 시작 단계는 1개뿐이므로 team 병렬 구현 기준 3개 미만이다. 단계당 단일 실행 소유자로 진행하고 읽기 전용 검토는 별도 허용 범위 내에서 수행한다. 기계적 편집보다 의미 보존·거래 안전성 판단이 중심이어서 quick 배정은 없다."
```

## 실행 완료 기록

2026-09-08: S1–S10 완료. 최종 10단계 release gate 통과(소스 불변), unit/API 1,047개 통과, 실제 HTTP/PostgreSQL 및 emitted Node 런타임 검증, 합성 백업 2회 새 DB 복원 통과. 운영 배포 dpl_2qAzBSXykPxiWGiH7t4HqnPxJBAm 전환 완료, icn1 응답 확인, 운영 원장 불일치0. 상세: `.omo/evidence/storage-followup-deployment.json`. 미완료 단계 없음.
