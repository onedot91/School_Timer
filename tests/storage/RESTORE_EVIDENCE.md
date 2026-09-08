# Storage v2 백업·복원 훈련

이 문서는 **합성 데이터의 로컬 복원** 증거다. 운영 학생 자료의 백업·복원이나 운영 배포 성공을 의미하지 않는다.

## 실행

```sh
node --import tsx --test dev/storageBackup.test.ts
node --import tsx dev/storageRestoreDrill.ts --help
node --import tsx dev/storageRestoreDrill.ts --output /tmp/new-storage-restore-evidence.json
```

격리 PostgreSQL이 `127.0.0.1:55439`에 필요하다. pg 드라이버는 `STORAGE_TEST_PG_MODULE` 또는 개발용 `/tmp/school-storage-runtime/node_modules/pg`를 사용한다. 드라이버·DB가 없으면 종료코드 1이며 검증을 건너뛰지 않는다. CLI는 합성 학급만 생성한다. 운영 연결·자격증명을 읽지 않는다.

## 백업 계약

`dev/storageBackup.ts`는 반드시 단일 전용 PostgreSQL 연결로 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`를 실행한다. 테이블을 순차 읽더라도 모든 행은 동일 MVCC snapshot이다. 실제 훈련에서는 첫 테이블을 읽은 직후 별도 연결로 보상을 추가 지급하고, 이 변경이 이후 읽은 지갑·원장·receipt에도 섞이지 않는지 확인한다.

형식은 `school-storage-v2-backup`, version/schemaVersion/protocolVersion 2, canonicalVersion 1, encoding `postgres-json-text-v1`이다. 기존 전환용 version 1 백업은 변경하지 않는다. public 21개 테이블과 실제 PK·컬럼 타입·nullability·identity가 정확히 일치해야 한다. `storage_receipts.scope`, `today_friend_planning_records`, 원본 app_settings와 storage_backups metadata도 포함한다.

행은 PK tuple의 canonical JSON 문자열로 정렬한다. bigint/numeric은 decimal 문자열이며 JSON/JSONB는 PostgreSQL JSON text 문자열이다. 따라서 2^53보다 큰 identity, JSONB `null`과 SQL NULL, 역사 원장 내 알 수 없는 필드를 손실 없이 구분한다. 파일당 건수·SHA-256, SQL 파일집합 schema hash, 전체 manifest hash, snapshot ID/시각/PostgreSQL 버전을 기록한다.

PostgreSQL sequence 값은 MVCC 대상이 아니므로 행을 읽은 뒤 관측한 `last_value`/`is_called`를 `observed-after-mvcc-rows`로 명시한다. 백업 최대 ID보다 작거나 호출상태가 모순이면 거절한다. 복원 시 동일 sequence 상태를 설정한다. 행 데이터의 snapshot 일관성과 sequence의 비트랜잭션 특성을 혼동하지 않는다.

새 디렉터리는 0700, 파일은 0600/`wx`다. 테이블 파일을 모두 쓴 뒤에만 manifest를 생성한다. 기존 파일·폴더를 덮어쓰지 않는다. 누락·추가 파일, 해시 변조, schema/protocol 불일치, duplicate PK, 컬럼 누락, traversal, symlink/공개 권한을 거절한다. 행 원문은 로그에 출력하지 않는다.

## 복원 제한

복원 대상은 loopback 주소와 `storage_http_test_restore_*` 이름을 가진 **존재하지 않는 DB**만 허용한다. 실제 연결된 서버 주소도 loopback인지 확인한다. `template0`에서 신규 DB를 만들며 기존 DB의 DELETE/TRUNCATE/overwrite 경로는 없다.

schema를 만든 뒤 단일 트랜잭션으로 FK 순서에 맞춰 INSERT한다. identity는 `OVERRIDING SYSTEM VALUE`, sequence는 `setval`로 복원한다. 유일한 UPDATE는 신규 schema가 생성한 `storage_control` 고정 seed의 원래 값 복구다. 트랜잭션 실패 시 rollback하며 success 파일을 생성하지 않는다. 생성한 정상·실패 fixture DB와 백업은 진단을 위해 남긴다. 삭제는 별도 승인 대상이다.

운영 복구는 별도 승인·비공개 경로·forward-recovery 검토가 필요하다. 이 도구의 합성 훈련을 운영 복구 절차의 자동 실행 허가로 해석하지 않는다.

## 2026-09-08 검증 결과

- Node `v24.16.0`, PostgreSQL `18.4`.
- 단위 검증 7개 통과: exact table/PK/manifest, bigint, row 변조, protocol/schema/canonical version, traversal, 누락 파일·컬럼, sequence, 0700/0600/`wx`, missing driver/DB 종료코드.
- 실제 교사 설정·23학생 편지·퀴즈 명령과 보상·오늘의 친구 승인으로 합성 데이터 생성.
- 모든 21개 테이블에 데이터 포함. 지갑 23, 원장 26(역사 기록 1 포함), receipt 51, claim 25. bigint identity `9007199254740994`도 실제 DB에서 복원.
- 같은 백업을 신규 DB 2개에 복원하여 테이블별 PK/컬럼/건수/hash, 잔액/opening balance, 역사 원문·정렬, receipt.scope/claim/sequence 전부 동일.
- 복원 후 동일 request ID 재확인·재실행은 추가 지급/원장 0. 각 복원 DB의 새 정상 거래는 원장 1개. 지갑-원장 대조 불일치 0.
- 실제 동시 보상 commit을 백업에 주입해 동일 MVCC snapshot 유지 확인.
- 변조 백업은 DB 생성 전 거절. 원격·기존 DB 거절. 복원 중 division-by-zero 주입은 rollback, success 파일 없음.
- 훈련 소요 1,158ms. 전체 TypeScript 검사 통과.

증거 파일: `/tmp/school-restore-drill-final.json`.

비공개 백업: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/school-private-restore-VF76yK/backup`.

원본 DB: `storage_http_test_restore_source_4502_1788856046729`.
복원 DB: `storage_http_test_restore_copy1_4502_1788856046729`, `storage_http_test_restore_copy2_4502_1788856046729`.

Schema hash: `b96aeddfd5ba712d9dfe6495807a90eafc816f4754d95d6b36bb52674d99d318`.
Source manifest hash: `6dd236f8f7f7159075d1e2f69bfe140b3fd1a2fe4ebd7b4df26114c5a8251392`.
두 복원 결과의 동일한 21개 table hash는 증거 JSON의 `sourceTables`와 각 `restores[].tables`에 기록되어 있다.
