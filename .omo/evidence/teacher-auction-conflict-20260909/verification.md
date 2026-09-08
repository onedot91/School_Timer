# 경매 물품 TEACHER_SETTING_CONFLICT 수정

사용자가 경매 물품 변경 직후 409 경고를 보고함.

- 기존 설정 비교의 JSON.stringify는 JSON 속성 순서 차이를 변경으로 간주했다.
- 저장된 구버전 경매 물품의 생략된 기본값과 UI 정규화 데이터도 서로 다르다고 판단했다.
- 실제 오류를 재현한 회귀 테스트는 수정 전 TEACHER_SETTING_CONFLICT로 실패했다.
- 기존 canonicalStorageJson을 사용하고, 경매 필드에 한해 normalizeAuctionItems의 기본값 표현도 비교한다. 진짜 값이 바뀌면 409를 유지한다.
- 신규 경매 설정, 키 순서 변경, 이미 반영된 요청 재전송, 다른 교사 변경 거절 테스트 통과.
- 로컬 PostgreSQL 실제 JSONB 왕복 -> UI 정규화 -> 수정 저장 -> JSONB 재조회 -> 재전송을 직접 실행. 잔액 보존 및 진짜 충돌 거절 확인.
- 전체 1074 tests, tsc, Vite build, git diff --check 통과.
- 소스: src/lib/teacherStorageCommand.ts, src/server/teacherStorageCommands.ts, tests/api/teacherStorageCommands.test.ts.
- 운영 데이터/SQL 변경 없음. 커밋/푸시/배포 전.

## 배포 완료

사용자 승인 후 수정 3개 파일을 8bf744948a3f0cdb65915843f8720bdb042d4664로 커밋·푸시. Vercel Deployment has completed 확인. 운영 / 200, /api/shared-settings 비인증 401, 서울 icn1 확인. 학생 데이터 변경이나 SQL 적용 없음.
