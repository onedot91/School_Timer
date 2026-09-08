# 운영 보상 점검 오탐 / 일정 헤더 (2026-09-08)

계획: 운영 경고 31건 분류 → 보상 연결 회귀 테스트와 최소 수정 → 헤더 수정 통합 → 테스트/빌드/실제 화면 확인 → 승인된 범위 배포.

운영 읽기 전용 확인: 2026-36 개인 질문 23명 모두 기본 지급 + correction-5 지급 합계가 기대액 15와 일치. 기존 감사는 21명의 추가 지급을 누락한다. 전체 감사 재현 31건: 개인 질문 21, 과거 게임 금액 불일치 4, 7월 지급 원장 부재 6. 잔액 대사 불일치 0.

실제 학생 데이터 변경/경고 확인 처리 없음. 회귀 테스트는 합성 데이터만 사용한다.

Red: `node --import tsx --test tests/api/rewardAudit.test.ts` → 1 failed (expected [], actual amount_mismatch paidAmount 10).
Red: `node --import tsx --test tests/api/rewardAuditActivities.test.ts` → 1 failed (expected [10,15], actual [5,20]).
Green: 두 파일 14 tests passed. 추가 5 지급을 제거하면 paidAmount 10 경고가 재현된다. 과거 완료 시각을 현재로 바꾸면 현행 [5,20] 기준을 적용한다. 실제 누락 6개 및 각 정책 경계 직전/정각 회귀 테스트도 포함.

운영 보상 읽기 재현: 471건 대조, 수정 전31 / 후6, 잔액 대사 불일치0. 남은 6개는 2026-29/30 과거 지급 확인 대상이며 삭제/확인 처리하지 않음.
Code review: incident_fix_review, baseline 98c14b58f53dc98dfe63089b2095fe25342c879d, APPROVE / blockers0; 경계 테스트 보강 권고 반영.
Final release gate: 10/10 PASS, sourceHash 41c9ffc79226b592f1f57eaaab3b21ddd3d613213c11203d63751d001d01df16, artifact /var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/school-release-CJbixi/manifest.json.
Manual UI: root CUA로 합성 좁은/넓은 헤더 직접 확인. 날짜 비절단, 저장오류6/보상점검31/설정 각44px. Worker 실제 mock 1280×600/650/800, 설정 열기/닫기 확인. 증적 `.omo/evidence/teacher-schedule-header-layout-20260908/manual-qa.md`.

운영 반영: dpl_G1qMT3UPQPnSBWcva885281RwVdc, 2026-09-08 18:57 KST, school-timer-five.vercel.app. READY / sourceHash 일치 / API 인증 없는 요청401 / icn1 확인.
운영 Manual QA: Aside 기존 교사 세션 새 탭에서 날짜 전체 표시, 저장오류6, 보상점검6 확인. 실제 보상 점검 대화상자는 18:59:17 KST 기준471건 대조 및 2026-29/30의 6건만 표시. 학생 세션 별도 브라우저 정상 로드, 콘솔 오류0. 검사용 새 탭 종료.
잔액·보상·알림 원본 변경 없음. SQL 마이그레이션 없음. Git 커밋/푸시 없음.
