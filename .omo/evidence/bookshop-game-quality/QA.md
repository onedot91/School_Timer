# 책방 게임 완성도 검수

2026-09-06. 공간·시점 → 조작 → 연출의 세 단계를 적용하고 동일한 실제 CanvasLibraryGame을 개발 전용 mock 화면에서 조작했다. 데이터는 개발 화면의 메모리 안에만 존재한다.

## 구현과 증거

| 범위 | 구현 | 검증 |
|---|---|---|
| 가구 시점·재질 | 공통 상판/앞면/오른쪽 면, 따뜻한 접촉 그림자, 낮춘 바닥·벽 대비 | before-0/30/100.png ↔ after-0/30/100.png |
| 서가·책 | 14px 상단 여백, 21px 책 칸, 공유 슬롯 그림/클릭/착지 | canvasLibraryWorld·Pose·Renderer 회귀 검사, 100권 최종 화면 |
| 보행·운반 | 이동 거리 기반 4프레임, 1px 몸통 압축, 접지 발, 손과 책 동행 | character-atlas.png 40개 자세, 실제 이동 영상 |
| E 선택 | 3px 이내 이전 대상 유지, 방향 우선/범위 이탈 즉시 전환, 이동 좌표 갱신 | 경계·방향·삭제·좌표 회귀 검사, 등록대 옆 E 및 두 서가 E 실조작 |
| 안내 | 책 동작 중 중복 E 숨김, 140ms 등장, 프레임 안 배치, 벤치 얼굴 회피 | receiveCueVisible=0, bench-final.png, slot-dialog.png |
| 전달·배치 | 기존 준비/전달/삽입/완료 흐름에 안정된 손·책 표현과 안내 적용 | 직원 책 받기 → 71번 배치 → Canvas focus 복귀; route-original.webm |
| 직원·고양이 | 가까운 방문객 시선, 조용한 책 정리, 한적한 휴식 후보 선호 | 손/책 위치 및 reduced-motion 회귀 검사; long-run cat simulation; 쓰다듬기 반응 1 확인 |
| 조명 | 연속된 창문 채광, 스탠드 아래 낮은 빛 | off→on 실조작, 오른쪽 바라보기 확인, 최종 전체 화면 |
| 생활·읽기 | 기존 물/차/착석 기능 유지 | wateredPlantIds=[wall-plant-west], teaFull false→true→false, 벤치 앉기/일어나기, 독서책 1→2 전환 |
| 일시 정지·초점 | 모달/비활성화 계약 유지, reduced-motion 안정 자세 | blur 뒤 고양이 JSON과 곰 X 불변; 취소/배치 뒤 application focus. reduced-motion.png는 개발 자세 미리보기이며 OS 설정 변경은 하지 않았다. |
| 가림 | 서가+책 50권과 트로피 전체 28%, 출입문 55% 유지 | shelf-occlusion.png, trophy-occlusion.png, 합성·캐시 회귀 검사 |
| 출입문 | 정지/옆 이동 통과, 아래쪽 벽 접촉 확인창, 운반 취소/확인 | 문 위 dialog=0, 옆으로 X375.01 이동 dialog=0; 아래로 이동 후 확인창. 머물기 시 책/Canvas focus 유지; 확인 후 개발 미리보기로 퇴장 |
| 호환성 | 100 슬롯 ID, 저장/서버/가구 충돌 유지 | 전체 회귀 검사; 변경 파일에 API/저장 계층/의존성 변경 없음 |

## 화면 및 성능

- 변경 전/최종 실제 `innerWidth=1280`, `innerHeight=800`, `scrollWidth=1280`, `scrollHeight=800`을 읽었다. 게임과 15열 모달의 문서 스크롤·잘림 없음.
- 벤치 안내가 귀를 가리는 문제를 실제 스크린샷에서 발견해 수정했다. `bench.png`는 발견 당시, `bench-final.png`는 수정 후이다.
- 100권 장면의 관측한 1초 구간: 60 FPS, frame p95 18.6ms. 전체 세션의 성능 보장은 아니며 개발 PC의 관측값이다.
- 최종 검수 탭 console warn/error: [] (0건). 임시 viewport override는 복구했다.

## 명령

- `npm test`: 775/775 통과, 실패 0. tests.log.
- `npm run lint`: tsc --noEmit 통과 (exec session 61288, exit 0).
- `npm run build`: 성공, build.log.
- `git diff --check`: 통과.

## 영상

- route-original.webm: 실제 키보드/버튼 조작으로 캡처한 215초 Canvas 원본. 모달/DOM 안내는 녹화 대상 밖이므로 별도 스크린샷으로 검증했다.
- bookshop-walkthrough.mp4: 원본의 실제 동작 구간을 추린 70초, 1248×752, 30fps H.264 영상. 프레임 보간/가짜 커서/재구성 동작 없음. 출력 2100프레임을 끝까지 디코딩했으며 썸네일과 원본 접촉 시트를 확인했다.
- ffprobe가 설치되어 있지 않아 OpenCV 전체 디코딩, 프레임 시각과 메타데이터로 확인했다. video-metadata.json, walkthrough-verification.json 참고.
- 개발 화면의 향후 캡처 설정은 60fps로 올렸다. 제공한 기존 조작 영상의 실제 캡처 빈도는 약30fps이며 재생 FPS와 게임 FPS를 혼동하지 않는다.

## 완료 감사

세 단계의 각 항목에 구현 파일·명령 결과·실제 화면 증거가 있다. 공유 슬롯/충돌/12px 팔 제한과 저장 계약을 유지하며, 실패하거나 미완료인 구현 항목은 없다. 수정 전후 캡처, 실제 조작 영상, DESIGN.md 계약을 남겼다. 최종 소스의 SHA-256은 source-hashes.json에 기록했다. 커밋/푸시는 하지 않았다.
