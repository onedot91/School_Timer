# 저장 검토 후 개선

- storageResponseOrder.ts: +00/+09 단축 시간대의 소수초 비교 보존. 이전500 이후 오래된400 응답을 거부하는 회귀 테스트: 수정 전 실패, 수정 후 통과.
- weeklyMissionClient.ts: 공유 도메인에서 브라우저 전송 분리. 공통 저장 진행/오류보고, 45초 응답 대기 한도, mock/readonly 쓰기 차단 유지. 정상 미완료 결과는 오류 알림 없음. 동일 요청을 자동 재전송하지 않음.
- saveFailure.ts: 주간 미션 오류 코드와 두 API 경로만 진단 허용 목록에 추가.
- 테스트:1059/1059, tsc --noEmit, vite build, git diff --check 통과.
- 브라우저 합성 QA: 요청 중 role=status '요청 처리 중'; 성공 뒤 상태 해제/보고0건; 네트워크 실패 뒤 상태 해제/보고1건; 콘솔 오류0건. 실제 StudentActionProgress 컴포넌트와 수정 클라이언트 연결. 실제 학생 데이터와 운영 쓰기 미사용.
- 임시 브라우저 탭 종료 및 3041 테스트 서버 종료. 임시 fixture 파일 제거.
- Git 커밋/푸시/운영 배포 미수행. SQL 변경 없음.
