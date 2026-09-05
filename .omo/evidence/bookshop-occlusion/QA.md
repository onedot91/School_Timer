# 책방 가림·충돌 수정 검증

- 책장 전체와 꽂힌 책을 한 레이어로 합쳐28% 불투명도로 표시한다. 캐릭터 주변 사각형 클리핑은 제거했다.
- 책장 이외 가구는 visualRect로 진입을 막는다. 독립 소품인 스탠드와 고양이도 통과하지 않는다. 바닥 러그는 계속 통행 가능하다.
- 테이블 책은 왼쪽 가장자리로 조금 옮기고 접근 지점을 바깥으로 이동했다. 책상/테이블 동작의 손은 상판 위에 그린다.

## 검증

- 타입 검사, 전체724개 테스트, 빌드, diff whitespace 검사 통과. `tests.txt`, `build.txt` 참조.
- 신규 회귀 테스트: 비책장 가구의 측면/뒤쪽 진입 차단, 책장 뒤 진입 허용과 기존 발판 충돌 유지.
- 기존 충돌 기반 경로 탐색 테스트로 빈 책방/100권 책방의 전체 상호작용 접근 가능성 통과.
- 실제 브라우저에서100권 책장 뒤로 걸어 들어가 전체 반투명 상태 확인 (`shelf-behind.png`).
- 책상, 테이블, 벤치, 의자, 스탠드, 고양이 방향으로1초간 이동해 경계에서 멈추는 것을 확인 (`checks.json`, `desk-blocked.png`).
- 새 접근 지점에서 차 따르기, 책 펼치기, 벤치 앉기, 스탠드 끄기, 고양이 쓰다듬기 완료 상태 확인 (`checks.json`). 상판 위 손 연결도 확인 (`book-hand.png`).
- 최종 사용자 앱1280×800, document scrollWidth1280/scrollHeight800. 모달이나 저장 계약은 변경하지 않았다.

주요 파일: `src/lib/canvasLibraryWorld.ts`, `src/components/student/library/CanvasLibraryRenderer.ts`, `CanvasLibraryCharacter.ts`, `CanvasLibraryAmbient.ts`.
