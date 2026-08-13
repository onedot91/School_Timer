# Gate Review: emotion calendar label position

- recommendation: REJECT
- verdict: REVISE

## originalIntent

감정 달력 셀에서 `분노하다` 문구가 하단 경계에 걸리는 문제를 위치 조정으로 해결한다.

## desiredOutcome

Chromebook 감정 달력에서 `분노하다` 전체 문자열이 셀 안에서 잘림이나 인접 셀과의 겹침 없이 읽히고, 페이지에 세로 오버플로가 생기지 않는다.

## userOutcomeReview

원본에서 문구가 하단 테두리에 걸리던 세로 문제는 수정본에서 해소됐다. 제공 측정값에서도 셀 Y 범위 `366.85–445.29`, 레이블 Y 범위 `403.84–420.64`로 세로 여유가 있고 문서 vertical overflow가 없다고 보고됐다.

그러나 수정 캡처를 원본 크기와 확대 크롭으로 직접 확인하면, 이미지+문구 가로 배치 후 `분노하다`의 마지막 글자 영역이 13일 셀의 오른쪽 경계에 닿아 잘려 보인다. 인접한 14일 셀 테두리와 시각적으로 충돌해 전체 한국어 문자열을 명확히 읽을 수 없다. 따라서 사용자 가시 결과는 아직 충족되지 않았다.

## blockers

1. violatedCriterion: `C1-감정 문구 전체가 셀 내부에서 잘림·겹침 없이 읽혀야 함`
   - observation: 수정본의 `분노하다` 마지막 글자가 13일 셀 오른쪽 경계에서 잘려 보이며 14일 셀 경계와 충돌한다.
   - evidencePointer: `/private/tmp/student-emotion-calendar-label-fixed.jpg`의 13일 셀; 검토용 확대 크롭 `/private/tmp/student-emotion-calendar-label-fixed-crop-4x.jpg`; 관련 CSS `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17091`

## notes

- 제공된 `clipped=false` 및 top/bottom 측정은 세로 위치 개선을 입증하지만, 가로 클리핑 여부를 입증하지 않는다.
- `.student-emotion-calendar-record`를 가로 2열로 바꾸고 텍스트 `overflow: visible`을 적용한 방식은 셀 폭보다 긴 CJK 문자열이 인접 셀 쪽으로 침범할 수 있다.
- 직접 slop/overfit 검토 결과, 이번 관련 CSS에는 테스트 추가·삭제, 구현 미러링 테스트, 불필요한 파서/정규화/추출은 없다. 다만 수정 범위의 가로 레이아웃 자체가 C1 회귀를 만들었다.
- 전체 `src/index.css` 작업 트리 diff에는 요청과 무관한 다수 변경이 섞여 있어 이번 단일 UI 수정의 독립 diff로 검증할 수 없었다. 이는 C1과 직접 연결되지 않는 NOTE다.

## checkedArtifacts

- 원본 캡처: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-64885039-71ad-4764-ada4-6b508d426c3e.png`
- 수정 캡처: `/private/tmp/student-emotion-calendar-label-fixed.jpg`
- 확대 검토 크롭: `/private/tmp/student-emotion-calendar-label-fixed-crop-4x.jpg`
- 변경 CSS: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css` (`.student-emotion-calendar-record`, calendar grid/cell Chromebook rules)
- ULW 상태: `omo` 명령을 현재 환경에서 찾을 수 없어 활성 attempt 경로를 조회하지 못함; fallback 경로 사용
- skill criteria: `omo:remove-ai-slops`, `omo:programming`

## exactEvidenceGaps

- 레이블의 X 좌표(left/right)와 셀의 X 좌표 측정값이 제공되지 않았다.
- 현재 수정만 분리한 diff, executor evidence, code review report, manual QA matrix, notepad path가 입력에 없었다.
- 수정 캡처 자체가 C1 실패를 직접 보여 주므로 위 누락은 이번 REJECT의 근거가 아니라 별도 증거 공백이다.

