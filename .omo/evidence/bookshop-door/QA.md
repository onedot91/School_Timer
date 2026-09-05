# 출입문 디자인·확인창 검수

- 기존 출입구 판정 좌표를 유지하고 표시 영역을 확장했다. 옆으로 열린 패널 문짝, 황동 문고리, 경첩, 나무 문틀과 작은 매트로 구분했다.
- 빈손으로 문턱까지 아래로 걸으면 “책방 밖으로 나갈까요?”가 열린다. 취소 시 Canvas 초점 복귀, 자동 재열림 없음. 문턱에서 오른쪽 이동은 확인창을 열지 않는다.
- 기존 나가기 버튼도 같은 확인창을 연다. 확인하면 개발 게임이 종료되어 검수 시작 화면으로 돌아왔다.
- mock 기존 책을 직원에게 받은 뒤 실제 이동으로 문턱에 접근했다. 운반 취소 경고가 열렸고, 취소 전후 위치 (353.00,351.33)와 운반 책이 동일했다. 새 아래 방향 입력으로 다시 열어 확인하자 게임이 종료됐다.
- 사용자 책방 1280×800에서 document scrollWidth1280, scrollHeight800. 문·문고리 노출과 전체 배치 확인. 확인창에서 Escape 취소 시 Canvas 초점 복귀. 최종 error/warn 로그 없음. 임시 viewport 설정 복원.
- npm run lint 통과. npm test 762/762 통과. npm run build 통과. git diff --check 통과. 로그: /private/tmp/bookshop-door-tests.log, /private/tmp/bookshop-door-build.log.

자료: door-1280x800.png, exit-confirm-1280x800.png, carry-confirm.png. 실데이터 등록이나 저장 없이 개발 mock에서 운반·퇴장을 검수했다.
