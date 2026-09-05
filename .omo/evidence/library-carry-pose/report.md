# 책 운반 자세·스카프 방향 수정

## 변경

실제 소스 변경은 `src/components/student/library/CanvasLibraryRenderer.ts`의 `drawBear`에 한정했다.

- 책 운반 중에는 일반 걷기 팔 대신 책을 받치는 팔 자세를 그린다. 책 양옆 손을 추가 팔처럼 보이게 하던 중복을 없앴다.
- 뒷모습에서는 가슴 앞 책이 몸에 가려지며 등 위에 표시되지 않는다.
- 옆모습에서는 가방이 책을 잡은 손과 겹치지 않도록 반대쪽 엉덩이에 둔다.
- 스카프 끝은 왼쪽을 볼 때 오른쪽, 오른쪽을 볼 때 왼쪽으로 향한다. 정면·후면의 위치는 유지했다.
- 빈손 기본 캐릭터는 요청된 스카프 끝 영역을 제외하고 기준 렌더와 픽셀이 같다. 발 위치와 그림자 로직은 변경하지 않았다.

## 실패 먼저 확인

- `before.json`: 원본 네 방향 × 빈손/운반 정지/걷기 두 단계/감소 모션 = 20개 화면. 후면 책 가림 검사는 false.
- 스카프 검사 추가 후 원본 방향에 대해 `Left-facing scarf trails to the right` assertion 실패를 확인했다.

## 검증

- `final.json`: 최종 20개 실제 렌더러 화면, backBookOccluded / unladenPreserved / holdingArmsStable / scarfTrailsBehind 모두 true, 페이지 오류 0.
- `play-qa.json`: 실제 앱에서 등록·운반·배치·빈손 이동·책장 가림·독서·실패 자랑소·감소 모션 등 52개 화면 통과. 격리된 연습 데이터만 사용했다.
- 총 최종 72개 PNG, 1280×800, 현재 소스 해시 일치. `detail-*.png`는 원본에서 nearest-neighbor로 확대한 진단용 crop이며 화면 레이아웃 증거가 아니다.
- `npm run lint`, 전체 테스트 669/669, `npm run build`, `git diff --check` 통과.
- 첫 실제 이동 QA는 모서리에 너무 가까운 자동 경로 때문에 멈췄다. QA 경로에만 4px 여유를 추가한 뒤 전체를 재실행했다. 게임 이동 코드는 수정하지 않았다.

## 정리·독립 검토

각 QA의 격리 Chrome은 finally에서 종료했다. 검증 전용 Vite3045(PID69409)는 SIGTERM으로 종료했고 소유 실행 세션의 종료 코드143을 확인했다. 사용자3000 서버 및 기존 데이터/작업은 변경하지 않았다.

독립 기능·구조 검토 `integrity.md`와 직접 픽셀 시각 검토 `visual.md` 모두 PASS, 제품/증거 차단 이슈 없음. 최종 화면 판정 GOOD. 책 운반 자세, 방향별 가림, 스카프 방향, 빈손 보존, 실제 앱 흐름 모두 최종 소스 기준으로 확인했다.
