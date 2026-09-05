# 책방 시각·이동 개선 검수

2026-09-05. 사용자 제공11개 이미지가 수정 전 기준. 개발 검수는 메모리 mock 책만 사용했으며 서버/학생 데이터는 변경하지 않았다.

## 변경·검증

| 항목 | 확인 결과 | 증거 |
| --- | --- | --- |
| 화분/벽게시판/모서리 | 두 받침 높이 동일, 게시판 아래10논리px 벽 여백, 좌우 연속 벽·걸레받이 | final-1280x800.png |
| 책등 | 100개 ID/행/열 유지,4–7px 너비+실제1px 간격, 책장 내부는 전체 폭 유지 | full-100-books.png, World 회귀 |
| 조명 | 스탠드 E로 false→true 전환, 독립 책상 발광 없음 | lamp-off.png, lamp-on.png |
| 착석 | 소파에서 얼굴/몸/무릎 책/발 노출, 벤치 E착석 후 Escape해제 | seated-canvas.png, sit0/450/900ms |
| 팔·도구 | 물 주기/재조작, 따르기→마시기, 책 펼치기, 동적 고양이 쓰다듬기 실제 성공 | 생활 동작21개 PNG, pet-live.png |
| 고양이 | 네 방향 네 보행 프레임 연결부, 몸체 픽셀 연결 및 도달 검사 | cat-walk16개 PNG, Pose 회귀 |
| 트로피 | 뒤 y295에서 x106→81.10→106 왕복, 하단 받침만 곰 충돌, 전체 합성 반투명 | trophy-final.png, World/Cat 회귀 |
| 출입문 | 문 앞에서 아래250ms로 onBack 실행, 운반 중 확인 창, 취소 시 x328/y351과 책 유지·Canvas focus 복귀, 확인하면 퇴장 | exit-confirm.png, 실제 DOM 관찰 |
| 연속 저장 | 첫 책51번 배치 후 재마운트 없이 등록대로 복귀, 다른 책52번 저장 실패→성공 재시도. 두 권 유지, 모달0, Canvas focus 복귀 | placement-failure.png, placement-live.webm |

등록/책 배치/생활 동작 검수는 실제 Game 입력 드라이버가 Canvas keydown/keyup을 전달했다. 위치 선택은 각 독립 시나리오 초기화에만 사용했으며 두 권 연속 배치 사이에는 재시작하지 않았다. 운반 중 E에서 기존 제한 안내와 책 유지도 확인했다.

## 자동 검사와 발견한 회귀

- 최종 전체 `npm test`:756/756 통과. `npm run lint`(tsc), `npm run build`, `git diff --check` 통과. 마지막 입력 래치 수정 후 같은 명령을 다시 실행하여 모두 exit0을 확인했다. 병행 작업의 테스트 추가로 이전 실행753개보다 총수가 늘었다.
- 관련 World/Pose/Cat/Ambient78개 독립 검토 PASS. 최종 파일 해시는 review.md 참조.
- 발견 후 해결: 압축 슬롯을 기준으로 책장 내부까지 좁아지는 문제, 책 배열 갱신 시 mountedRef가 false로 남아 다음 저장 완료를 건너뛰는 문제, 화분 leaves 재조작이 팔 도달 제한에 걸리는 문제.
- 마지막 입력 래치 보완: 퇴장 취소 후 실제 아래 키가 계속 눌린 상태에서 repeat만으로 확인 창을 다시 열지 않는다. 아래 키 해제 또는 새 nonrepeat 입력에서 재무장한다. 이는 최종 코드 검토 항목이며 기존 영상은 이 입력 래치 보완 전 촬영했다.

## 실제 영상·화면

- watering-live.webm:19.566705초, 실제 물 주기/잎 반응. 브라우저 재생12.37초 지점 확인.
- placement-live.webm:43.900808초, 실제 책 운반/두 번째 배치 실패·재시도. 브라우저 재생10.39초 지점 확인.
- 영상은624×376 Canvas 원본이며 DOM 모달은 별도 이미지로 기록했다.
- 최종 실제 앱에서 viewport1280×800, document.scrollWidth1280/scrollHeight800 확인. final-1280x800.png에서 잘림/겹침/불필요한 문서 스크롤 없음. 임시 viewport 설정은 복원했다.
- 별도 개발 검수 탭은 호스트 창에 따라1075×672였으며 원본 Canvas PNG를 별도 저장했다. 개발 도구 페이지 자체의 긴 도안 목록은 제품 화면 스크롤 검수 대상이 아니다.
- 검수 탭 console error/warn 없음.

## 증거 주의

trophy-behind.png는 책장 내부 폭 회귀 발견 당시 기록이다. 완료 증거는 수정 후 trophy-final.png와 full-100-books.png를 사용한다. seated-after.png는 도구 페이지 화면이며 착석 원본은 seated-canvas.png다. OS 접근성 설정을 변경하지 않았고 동작 줄이기는 기존 미리보기/자동 회귀 경로로 검증했다.
