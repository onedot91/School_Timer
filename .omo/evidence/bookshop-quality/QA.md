# 책방 품질 개선 최종 검수

2026-09-05 · mock 데이터 · macOS의 실제 Chromium 브라우저

## 결과

합의한 캐릭터, 책 동작, 공간, 책방 UI, 효과음 개선을 구현했다. 코드 검토는 APPROVE(차단 결함 없음), 독립 시각 검토는 PASS다. 커밋·푸시는 수행하지 않았다.

## 변경

- `CanvasLibraryCharacter.ts`: 네 방향 실루엣, 4단계 보행, 일관된 마늘 가방, 운반과 앉기 자세, 공통 손 위치.
- `canvasLibraryPose.ts`: 받기 500ms, 꽂기 준비→이동→삽입→완료, 후면 가림, 운반부터 배치까지 같은 책 색상과 형태. 모든 100슬롯에서 삽입 마지막 위치 연결.
- `CanvasLibraryRenderer.ts`, `CanvasLibraryPalette.ts`, `canvasLibraryWorld.ts`: 따뜻한 책장 내부, 조용한 바닥, 발 그림자, 국소 가림, 은은한 창가 빛, 중앙 책장과 등록대 사이 동선.
- `CanvasLibraryGame.tsx`, `canvasLibraryAudio.ts`: 접지 발걸음, 받기/꽂기/페이지 효과음, 기본 음소거와 사용자 입력 후 활성화, 비활성·숨김·해제 시 정리. 저장 확인 후 완료 표시, 실패 시 책 유지.
- `src/index.css`, `LibraryCompetitionPanel.tsx`: 책방 내부 모달·실패 게시판·챌린지의 종이/민트 색상, 입력·버튼·초점·로딩·오류 상태.
- `dev/library-review.html`, `dev/library-review.tsx`: 실제 렌더러/컴포넌트를 사용하는 개발 전용 도안, 시간 조절, 임시 데이터, 입력 드라이버, PNG와 Canvas 녹화. 프로덕션 진입점에 포함하지 않음.
- `DESIGN.md`: 최종 캐릭터·팔레트·동작·검수 기준 기록.

## 자동 검증

최종 소스에서 `npm run lint && npm test && npm run build && git diff --check`가 exit 0으로 완료됐다. 테스트 708개 통과, 실패 0개. 자세 14개, 오디오 5개, 빈/100권 방의 시설 접근 및 슬롯 보존을 포함한다. 기존 API·저장·보상 경로를 변경하지 않았다.

## 실제 화면 검증

| 시나리오 | 관찰 결과 | 증거 |
|---|---|---|
| 변경 전후 1280×800 | 문서 scrollWidth/Height 모두 1280×800. 최종 Canvas 1248×752, 좌표16,24, 2배 정수 확대 | before.png, baseline.json, full-room-final.png |
| 등록→운반→꽂기→이동 | 실제 키 이벤트 처리와 E 상호작용으로 완료. 배치 후 운반 해제, 책 1권 유지 | gameplay-final.webm |
| 저장 실패 | 오류 표시, 운반 책 유지, Escape로 돌아오면 Canvas 초점 | save-failure.png |
| 저장 지연 | 대기 중 선택 비활성, Escape로 중복 동작 불가, 완료 후 Canvas 복귀 | save-pending.png, placed.png |
| 최종 방향/동작 | 40자세 도안, 후면/오른쪽 받기·꽂기 0/100/250/300/390/400/500ms 28프레임 검토 | atlas-final.png, receive-*.png, place-*.png |
| 꽂기 연결 | 마지막 프레임에서 색·형태·위치 유지. 후면 책이 등 위에 그려지지 않음 | visual-review-final.md |
| 100권 | 모든 책장 표시, 중앙 동선과 화면 경계 유지 | full-room-final.png |
| 독서 | 앉기, 다른 책 펼치기, 일어나기와 초점 복귀 | reading-final.png |
| 실패 자랑소 | 목록과 작성 창, 단일 aria-modal, Escape 복귀 | failure-board-final.png, failure-compose.png |
| 챌린지 | mock 목록 로딩 후 정상 표시, 닫기 후 Canvas 초점 | competition-final.png |
| 긴 텍스트 | 제목50자/저자30자 운반 상태가 버튼과 겹치지 않으며 전체 제목은 접근성 텍스트에 유지 | long-title-final.png |
| 동작 줄이기 | 실제 렌더러 reducedMotion 상태에서 0/500ms PNG가 같은 SHA256 | reduced-0.png, reduced-500.png |
| 최종 런타임 | 마지막 실제 조작 구간의 브라우저 로그에서 error/warn 없음, 화면 계측 약60FPS | CUA 실행 기록 |

## 영상

`gameplay-final.webm`은 최종 소스의 실제 Canvas MediaRecorder 녹화다. 브라우저가 624×376, 30.70초로 읽었고 9.02초까지 정상 재생하는 것을 관찰했다(`video-playback-final.png`). 캡처는 Canvas만 포함하며 DOM 모달과 소리는 포함하지 않는다. 모달 검수는 별도 스크린샷으로 남겼다. 초기 `gameplay.webm` 및 그 metadata는 이전 중간 버전의 133초 영상으로 최종 결과를 대체하지 않는다.

## 검토 및 제한

- `code-review.md`: 최종 Renderer/Character/Pose/Test SHA256과 일치, 차단 결함 없음. 오디오 테스트 fake의 이중 타입 단언은 유지보수 개선 의견으로 남아 있으며 제품 동작 차단 항목은 아니다.
- `visual-review-final.md`: 최종 소스 및 28프레임/도안 PASS. 이후 root가 같은 최종 소스로 full-room-final/reading-final을 다시 촬영했다.
- 실물 Chromebook이 없어 해당 기기의 성능은 검증하지 못했다. 약60FPS는 macOS 브라우저 관찰값이다.
- 효과음의 활성화·정리·동시 발성 제한은 테스트했지만 사람이 직접 듣는 음질 평가는 수행하지 않았다. OS 자체의 reduced-motion 설정 전환 대신 렌더러의 실제 reducedMotion 분기를 검수했다.
- `.omo/evidence`는 검수 산출물이다. `atlas-first.png`, `full-room.png` 등 이름에 final이 없는 중간 자료는 최종 시각 판정에 사용하지 않는다.
