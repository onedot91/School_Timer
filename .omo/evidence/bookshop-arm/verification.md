# 공통 상호작용 팔과 전등 옆면 스위치 검수

- 팔 외곽선 전체 → 몸통 주황색 내부 전체 → 앞발 순서. 기존 팔 길이와 캐릭터 비율 유지.
- 전등 접근 (535,263), 오른쪽 방향, 스위치와 손 목표 (551,251), 450ms 유지.
- 회귀 검사: 수평·수직·대각선 팔 내부와 연결부 색상, 450ms 전 구간 12px 제한, 중간 스위치 접촉, 접근 가능성.
- 관련 테스트 78개, 전체 테스트 768개 통과. npm run lint, npm run build, git diff --check 통과.
- 실제 mock 게임에서 전등 끄기/켜기 왕복 및 오른쪽 손 자세 확인: lamp-action.png.
- 등록대에서 책을 받은 뒤 직접 전등까지 이동. E 입력 시 “책을 먼저 꽂아 주세요”, 생활 동작 없음, lampOn true 유지: carrying-blocked.png.
- 생활 동작 검수 화면 pet/water/pour/drink 각각 0/450/900ms 이미지 저장. 중간 자세의 주황색 팔 연결 확인.
- 동작 줄이기는 브라우저 개발 검수 토글로 확인: 0ms에서 lampOn false, action null. OS 접근성 설정 자체는 변경하지 않았다.
- 실제 사용자 화면 innerWidth 1280, innerHeight 800, document scrollWidth 1280, scrollHeight 800 확인. 잘림·문서 스크롤 없음: room-1280x800.png.
- 두 탭 warning/error 로그 없음. 임시 viewport 설정 초기화.
- before-*-reference.png는 사용자가 제공한 수정 전 이미지다.
