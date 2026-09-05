# 등록대 강아지 직원 코드 검토

검토일: 2026-09-05. 판정: **PASS (코드·도메인 검증 범위)**.

## 확인 결과

- 전달 접근 중 초안은 `receiveApproachRef`에 보존하고, 도착한 뒤에만 운반 상태와 700ms 받기 동작을 시작한다. 대기 중 재등록과 다른 상호작용은 차단되어 초안이 덮어써지지 않는다.
- 접근이 막히면 책을 유지한 채 수동 이동과 직원 재조작을 허용한다. 대기 중 퇴장은 기존 확인창을 거치며, 자동 접근·전달 중에는 퇴장을 막는다.
- 반복 입력과 두 번 확정은 ref 가드로 차단된다. 새 동작의 별도 타이머는 없으며, unmount 시 RAF와 접근 ref가 정리된다.
- blur 동안 접근·직원 시간·고양이를 정지하고 전달 시작 시간을 복귀 시 보정한다. reduced motion은 전달 결과를 즉시 적용한다.
- 직원 없는 작은 방은 기존 500ms 받기를 유지한다. 책 꽂기 시간·서버 저장 경로는 바뀌지 않는다.
- 직원 몸체 → 책상 → 손, 단일 전달 책 레이어가 연결되어 있다. 코드 기반 크림색 얼굴·처진 귀·산호색 꽃 두건·앞치마를 확인했다.
- `clerk-idle.png`를 직접 열어 직원 얼굴과 두건이 중앙 책장 아래에 노출되며 등록부·차 세트와 겹치지 않음을 확인했다.

## 발견 후 해결

1. 직원 표시 영역을 그대로 장애물로 추가하면서 책상과 5px 겹쳐 기존 무겹침 테스트가 실패했다. 직원 장애물을 책상 상단까지 잘라 두 영역의 합집합은 유지하고 중복을 제거한 수정 확인.
2. 신규 접근 테스트의 112px/s 가정이 기존 100px/s 이동과 달랐다. 실제 기존 속도에 맞춘 기대값 수정 확인.

## 실행한 검증

`node --import tsx --test src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryPose.test.ts src/lib/canvasLibraryCat.test.ts src/lib/canvasLibraryAmbient.test.ts src/lib/canvasLibraryRouteState.test.ts`

최종 **82/82 통과**. 로그: `/private/tmp/clerk-review-tests.log`. `npm run lint`와 `git diff --check` 통과.

실제 전달·모달·창 비활성화·등록/배치 연속 조작과 최종 화면 QA는 부모 에이전트의 브라우저 검수 범위이며 이 보고서의 자동 테스트 결과로 대체하지 않는다.

## 검토한 SHA-256

| 파일 | SHA-256 |
|---|---|
| CanvasLibraryGame.tsx | `398171cba07fb969d0b3d4010c924209dd7c43dbc784b8593aceb3e90eb93a5e` |
| CanvasLibraryClerk.ts | `ea0b8957b7d49f9dc546b64b23d878c5c2ecf744baffcbcc619ef0b8868d16c9` |
| CanvasLibraryRenderer.ts | `191d36932506e5b68c867185b7ba79bf98b4fdd18cc93a1149d8d61fb3ebc016` |
| canvasLibraryWorld.ts | `8d429db8cb4edb90937ef851caca5dcd502ed12e320a16ab5702f7a9c8807c18` |
| canvasLibraryPose.ts | `8c6162789c1210b09a9961c2c22c3b41b677f536ca79d7c6ee7b727d91d783e0` |
| clerk-idle.png | `79a187b20d81c0e518109706eb89dff8005bb0adcf8689714200f37114d3c0d4` |
