# 저장 구조 v2 운영 전환

운영 실행 담당자가 각 단계를 명시적으로 실행한다. 코드 검증과 격리된 PostgreSQL 동시 저장 검증을 먼저 완료한다. 실제 학생 데이터로 시험 거래·보상 지급·취소를 실행하지 않는다.

## 연결과 백업

운영 DB는 이미 연결된 Supabase MCP를 사용한다. 로컬 실행용 CLI는 기존에 제공된 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`만 읽으며 키를 출력하지 않는다. CLI 실행을 위해 배포 환경에서 비밀키를 추출하지 않는다. 자동 승인 검토가 거절한 자격 증명 추출을 다른 경로로 우회하지 않는다.

`dev/storageCutover.ts`의 `buildBootstrapRequest(sourceRow)`와 `validateCutoverSnapshot(sourceRow, snapshot, ledgerDifferences)`는 네트워크나 환경 변수를 읽지 않는 함수다. MCP로 조회한 원본을 같은 함수로 인코딩·검증할 수 있다. `buildBootstrapRequest` 반환값은 `storage_bootstrap`의 인자 이름과 일치한다.

백업은 저장소 바깥의 새 절대 경로에 만든다. 디렉터리 권한은 `0700`, JSON 파일은 `0600`이다. `manifest.json`에는 원본 시각, SHA-256, 파일별 건수가 들어간다. 원본 학생 내용과 키는 콘솔에 출력하지 않는다. 백업 디렉터리를 Git에 추가하지 않는다.

백업 대상은 다음과 같다.

- `app_settings`의 `school-timer-main` 원본 전체
- `weekly_mission_rewards`, `today_friend_rewards`, `class_donation_requests`
- `today_friend_settings`, `today_friend_submissions`
- `library_competition_archives`
- `classword_rounds`, `classword_entries`, `classword_quiz_completions`, `classword_quizzes`
- `announcement_notes`

각 테이블은 기본키 순서로 1,000행씩 조회한다. 백업 중 원본이나 위 테이블이 바뀌면 백업을 유효하다고 표시하지 않는다. 이중 조회는 변경 탐지 수단이며 저장 중지 장치를 대신하지 않는다.

## 실행 순서

1. 로컬/격리 DB에서 테스트·타입 검사·빌드·HTTP 및 화면 검증을 완료한다. 배포 산출물에 필요한 환경 변수와 `icn1` 리전을 확인한다.
2. Supabase MCP로 `supabase/storage_v2.sql`을 설치한다. 이 단계의 기본값은 `active=false`, `maintenance=false`다.
3. `storage_set_maintenance(p_maintenance=>true,p_active=>null)`을 실행한다. 기존 진행 중인 트랜잭션이 끝난 뒤 저장을 차단한다. 활성화 값은 바꾸지 않는다.
4. 유지보수 중 `storage_today_friend_v2.sql`, `storage_rewards_v2.sql`, `storage_classword_v2.sql` 순으로 설치한다. 원래 Today Friend 계획과 제출 ID, 보상 ID, 기존 Classword 행을 보존한다. 전용 테이블의 구버전 쓰기도 차단되었는지 확인한다.
5. 최종 원본과 관련 테이블을 비공개 백업한다. 원본 `updated_at`과 JSON 해시를 기록한다. 이후 원본이 바뀌면 다시 검토하며 이전 백업으로 덮어쓰지 않는다.
6. `buildBootstrapRequest`로 생성한 인자를 `storage_bootstrap`에 전달한다. 이 RPC는 유지보수 중·비활성 상태에서 한 번만 실행되며 원본 시각과 원본 JSON을 DB에서 재검증한다. 기존 보상·복구 기록 ID를 그대로 보존하고 잔액을 현재 잔액의 시작점으로 삼는다.
7. `storage_load_snapshot` 및 `storage_reconcile_wallets`를 조회한다. `validateCutoverSnapshot`으로 원본 전체와 동일한 JSON, 학생 23명의 잔액, 원장 불일치 0건을 확인한다. 관련 테이블의 기본키·행 수·기존 필드도 백업과 대조한다. 새로 추가된 스키마 필드는 허용하지만 기존 필드 삭제·변경은 허용하지 않는다.
8. 유지보수를 유지한 채 `storage_set_maintenance(p_maintenance=>true,p_active=>true)`로 v2를 활성화한다.
9. 서버·클라이언트를 배포하고 운영 환경 `STORAGE_PROTOCOL_VERSION=2`를 확인한다. 구버전 저장 차단, 읽기 응답 및 새 클라이언트 표시를 확인한다. 실제 거래로 시험하지 않는다.
10. 7단계 대조를 다시 통과한 뒤에만 `storage_set_maintenance(p_maintenance=>false,p_active=>null)`로 저장을 재개한다. 배포 응답의 실제 리전도 확인한다.

직접 환경이 이미 제공된 격리 환경에서는 아래 CLI가 같은 순서를 수행한다. 운영 MCP 실행에서도 각 단계의 전제와 검증은 같다.

```sh
node --import tsx dev/storageCutover.ts --help
node --import tsx dev/storageCutover.ts inspect
node --import tsx dev/storageCutover.ts pause --execute
# 전용 기능 SQL을 설치한 뒤 새 비공개 백업 경로 사용
node --import tsx dev/storageCutover.ts backup --backup-dir /private/tmp/school-storage-final-backup
node --import tsx dev/storageCutover.ts migrate --backup-dir /private/tmp/school-storage-final-backup --execute
node --import tsx dev/storageCutover.ts reconcile --backup-dir /private/tmp/school-storage-final-backup
node --import tsx dev/storageCutover.ts activate --backup-dir /private/tmp/school-storage-final-backup --execute
# 배포 및 확인을 완료한 뒤
node --import tsx dev/storageCutover.ts reopen --backup-dir /private/tmp/school-storage-final-backup --execute
```

## 실패·불확실한 응답

- CLI는 쓰기 요청을 자동 재전송하지 않는다. 응답을 잃으면 `inspect`와 `reconcile`로 커밋 여부부터 확인한다. `storage_bootstrap`은 이미 이관된 데이터에 다시 적용되지 않는다.
- 잔액·원본 JSON·보상 ID·기록 수가 하나라도 다르면 활성화·재개를 중단한다. 유지보수는 자동 해제하지 않는다.
- 새 거래가 발생한 뒤에는 과거 백업으로 덮어쓰지 않는다. 저장을 다시 중지하고 새 원장과 기록을 보존한 채 수정한다. 도구에는 삭제나 롤백 명령이 없다.
- 이 도구의 `reconcile`은 전환 직전 동등성 검증이다. 정상 운영 후에는 원본과 현재 값이 달라지는 것이 정상이다. 정상 운영 중에는 `storage_reconcile_wallets`로 현재 잔액과 새 원장을 대조한다.

## 검증 명령

```sh
node --import tsx --test dev/storageCutover.test.ts
npm run lint
```

CLI 테스트는 가짜 fetch와 임시 파일만 사용한다. 실제 PostgreSQL 트랜잭션·락·마이그레이션 검증은 별도 `src/server/storageV2.integration.test.mjs`에서 수행한다.
