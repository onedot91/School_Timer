# 학생 시작 화면 최신 변경 수동 QA

- 실행일: 2026-08-13
- 대상: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer`
- viewport: CSS `1280×800`, devicePixelRatio `2`
- attemptDir: `.omo/evidence/student-emotion-start-qa` (로컬 셸에서 `omo ulw-loop status --json` 명령이 없어 caller evidence directory 사용)
- 범위 제한: 감정 구슬 선택, 댓글 입력, 저장/확인, 잔액·구매·기록 변경을 실행하지 않음
- 전체 verdict: **PASS**

## manualQa

### surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1 | C1 감정 카드 제거 | 학생 시작 화면 | `http://127.0.0.1:3001/`에서 학생 1번 시작 화면을 열고 viewport `1280×800` 설정 후 새로고침. `.student-emotion-summary`, `.student-pet-card` 존재 여부를 DOM으로 확인 | PASS | A1, A2 |
| S1 | C2 16:9 캔버스 최대화 | 학생 시작 화면 | 동일 화면에서 `.student-character-stage-card`의 bounding rect와 computed `aspect-ratio`를 읽고 화면 캡처 | PASS | A1, A2 |
| S2 | C3 우측 상단 감정 표시 크기·클릭 이동 | 학생 시작 화면 → 감정 선택 화면 | `button.student-home-emotion-sun`(ARIA: `오늘의 감정 분노하다. 감정 바꾸기`)만 클릭하고 DOM snapshot·URL hash·캡처 확인. 구슬/댓글/저장 컨트롤은 조작하지 않음 | PASS | A1, A3, A4 |

### adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV1 | C2 | tight-height / aspect-ratio overflow | 1280×800의 제한된 높이에서도 캔버스가 정확한 16:9를 유지하고 페이지 스크롤·클리핑 없이 표시되어야 함 | PASS | A1, A2 |
| ADV2 | C1 | removed-component regression | 기존 감정 카드가 다시 렌더링되지 않고, 시작 화면에는 단일 대형 캔버스가 남아야 함 | PASS | A1, A2 |
| ADV3 | C3 | pre-existing emotion state | 이미 오늘 감정이 있는 상태에서도 우측 상단 표시가 실제 감정 아트로 보이고 클릭 가능한 button이어야 함 | PASS | A1, A3 |
| ADV4 | C3 | read-only mutation guard | 감정 표시 클릭은 감정 선택 화면 이동만 수행하며 감정 선택·댓글·저장·잔액/구매/기록 변경을 일으키지 않아야 함 | PASS | A3, A4 |
| ADV5 | C1, C3 | Korean text / viewport overflow | 두 화면 모두 한국어 라벨이 잘리지 않고 body/document scroll 크기가 viewport를 초과하지 않아야 함 | PASS | A1, A3, A4 |

### observed evidence

- S1 캡처에서 감정 카드 영역은 보이지 않고, 학생 번호/잔액 헤더 아래에 16:9 홈 캔버스가 단일 대형 surface로 렌더링됨.
- S1 DOM metrics: `.student-emotion-summary = null`, `.student-pet-card = null`.
- S1 캔버스 rect: `1024×576`, observed ratio `1.7777777778`, computed `aspect-ratio: 16 / 9`, hero rect `1256×576`; 캔버스가 hero 높이를 채우고 16:9 폭 제약을 받음.
- S1 감정 표시 rect: `128×128 CSS px`, stage 기준 `top 5%`, `right 7%`, visible red emotion art.
- S2 클릭 후 URL hash는 `#student-emotions`, 시작 화면은 제거되고 heading `감정 구슬`, tab `선택하기`, 45개 감정 option이 표시됨.
- S2 클릭 후 `dialogOpen=false`, `textareaCount=0`, 저장/확인 텍스트 button 없음. 금지된 감정 구슬·댓글·저장 조작은 실행하지 않음.
- S1/S2 모두 viewport와 document scroll size가 `1280×800`으로 일치함.

### artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | 1280×800 학생 시작 화면 fresh capture; 캔버스·감정 표시·카드 제거 시각 증거 | `.omo/evidence/student-emotion-start-qa/s1-student-start-1280x800-valid.png` |
| A2 | parsed-data | S1 viewport, rect, aspect ratio, DOM absence, overflow metrics | `.omo/evidence/student-emotion-start-qa/s1-metrics.json` |
| A3 | screenshot | 감정 표시 클릭 후 1280×800 감정 선택 화면 fresh capture | `.omo/evidence/student-emotion-start-qa/s2-emotion-selection-after-click-1280x800-valid.png` |
| A4 | action-log | 클릭 invocation, pre-click 128×128 rect, URL/hash 전환, 금지 조작 목록, no-dialog/no-textarea/no-save 결과 | `.omo/evidence/student-emotion-start-qa/s2-click-action-log.json` |

## 검증 한계

시각 QA 스킬의 독립 oracle 2개 dispatch는 현재 세션에 subagent 도구가 노출되지 않아 실행하지 못했습니다. 대신 실제 브라우저 surface, fresh screenshot, DOM metrics, action log를 직접 확보했으며, 초기 JPEG 바이트/`.png` 확장자 불일치 증거는 PNG로 변환·서명 검증한 A1/A3만 최종 참조했습니다.
