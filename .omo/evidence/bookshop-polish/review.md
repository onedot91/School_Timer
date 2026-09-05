# 책방 시각·이동 수정 독립 코드 검토

판정: **PASS (코드 및 관련 회귀 테스트)**. 아래 해시의 현재 파일에서 미해결 P1/P2 사항을 찾지 못했습니다. 이 판정은 실제 브라우저 검수를 대체하지 않습니다.

## 발견 및 해결 확인

- **P1, 해결됨:** 책 배열 변경으로 room과 RAF effect가 재생성될 때 RAF cleanup이 mountedRef를 false로 만들어 이후 배치 완료 처리와 pending 해제를 건너뛰는 회귀. `CanvasLibraryGame.tsx:465`의 RAF cleanup에서 mountedRef 변경을 제거했고, `:487`의 mount-only effect가 true/false 수명을 함께 소유하도록 수정된 것을 확인했습니다. 실제 두 권 연속 배치 및 저장 실패 후 재시도는 실행 담당자의 브라우저 검수 항목입니다.
- **P2, 해결됨:** 화분 두 번째 조작 leaves가 먼 actionPoint에 손을 뻗어 새 12px 도달 검사에서 거절되는 회귀. 현재 Pose는 leaves에 짧은 별도 손 위치를 사용하며, 전체 동작 시간 샘플 회귀가 통과합니다.

## 확인한 경계

- 출입문은 선택적 정의이며 아래 방향 입력과 문 폭/문턱을 함께 검사합니다. requestExit는 모달, 비활성, 배치 pending, 책/생활 동작/접근 중에 차단되고 finishExit의 once ref는 콜백 중복을 막습니다.
- 운반 확인 취소는 초안과 위치를 유지하고 입력을 비우며 기존 StudentConfirmDialog/useModalFocus를 통해 Canvas 초점을 돌립니다. 나가기 버튼과 문턱은 같은 처리입니다.
- 100개 슬롯의 ID/행/열은 유지하며 책별 4–7px 및 1px 간격을 적용합니다. 게임 대상 판정과 렌더러/책 이동은 같은 packed slot 정의를 사용합니다. 선반 홈 너비는 슬롯 너비와 독립입니다.
- 양 화분은 받침까지 같은 높이입니다. 게시판 하단은94이고 바닥 시작104로 벽면10px가 남습니다. 램프 이외 책상 발광은 제거되었습니다.
- 트로피의 곰 충돌은 하단 받침, 고양이 내비게이션은 전체 표시 영역입니다. 트로피/진열대/그림자는 같은 레이어에서28%로 합성합니다.
- 소파는 등받이→앉은 곰→팔걸이 순서, 벤치는 앉은 곰보다 먼저 그립니다. 어깨-손은12px로 제한하고 도달 불가 시 안내를 표시합니다. 차 도구는 pose.hand에서 그립니다.
- 고양이 세로 보행 연결부 및 접근22px를 검사했으며 모든 네 디딤 연결과 양옆 쓰다듬기 손 도달 회귀가 통과합니다.

## 실제 실행 결과

`node --import tsx --test src/lib/canvasLibraryWorld.test.ts src/lib/canvasLibraryPose.test.ts src/lib/canvasLibraryCat.test.ts src/lib/canvasLibraryAmbient.test.ts`

- 최종 관련 테스트: **78/78 PASS**, 실패0, 약7.7초.
- 로그: `/private/tmp/bookshop-polish-review-final-tests.log`
- 검토 대상 tracked 파일의 `git diff --check`: PASS.
- 전체 테스트/타입/빌드 및 실제1280×800 브라우저·영상 검수는 실행 담당자의 별도 결과를 참조해야 합니다. 이 검토자가 실행했다고 주장하지 않습니다.

## 최종 출구 재입력 검토

- 취소 후 RAF에서 빈 입력만 보고 재무장하던 코드를 제거한 변경을 확인했습니다. 아래키/S의 keyup 또는 새로운 non-repeat keydown만 출구를 재무장하므로 계속 누르는 키 반복은 확인창을 다시 열지 않습니다. 새 입력은 정상적으로 다시 퇴장을 요청할 수 있습니다.
- 실행 담당자는 같은 방문 두 권 배치, 저장 실패 후 재시도·초점 복귀, 운반 중 문 취소·확인을 실제 브라우저에서 확인했다고 보고했습니다. 해당 실행 증거는 root QA 기록을 참조합니다.

## 검토 파일 SHA-256

- `src/components/student/library/CanvasLibraryGame.tsx`: `77fc5c1aaa4f47a2720fba2d6643409bf3c2ca7667190db23b5a74d699e86911`
- `src/components/student/library/CanvasLibraryRenderer.ts`: `fdb3252ca6ca5a642fd0024fcbd2d286c557626ecf1d33e2ce780752702e60a5`
- `src/lib/canvasLibraryWorld.ts`: `68c043b2c47c65ccae29c32377b58a02dfa90fbaaa010b30f8123b88cc621737`
- `src/lib/canvasLibraryPose.ts`: `0f233ac576812a40976b1b09387b15fe6aca1e1a6cacb0943100c306a98fa022`
- `src/lib/canvasLibraryCat.ts`: `acfcd120ef5483f00fe3b2203f98921acf2f323a2d5ba247d3723b36a45a5717`
- `src/components/student/library/CanvasLibraryCharacter.ts`: `665f37d86789f09b0f14afd88aa29436414bc306e5d5f9cecd9bd9c03d72d50b`
- `src/components/student/library/CanvasLibraryAmbient.ts`: `4d19df5dc017fa28c50c307c3bf2789c71092b18d4118420849eca189a238cb0`
- `src/components/student/library/CanvasLibraryCat.ts`: `6e45c510473be080bbf4a88b884b8dac2bc22feeb8f05547e8dd2e4cf12f17af`
