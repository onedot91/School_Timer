# Number Baseball Final Gate Review A

- recommendation: REJECT
- originalIntent: 숫자야구 우측 기록판을 1회부터 9회까지 시간순으로 읽히는 보상 구간형 기록판으로 정리하고, 반복 범위 제목과 굵은 구분선을 제거하면서 결과와 빈 회차를 명확히 표시한다.
- desiredOutcome: 1024/1280/1366 데스크톱에서는 스크롤 없이 전체 기록판이 보이고, 200% 상당의 좁은 폭에서는 기록판이 잘림이나 가로 넘침 없이 한 열로 쌓인다. 보상 구간은 +15/+10/+5 고마로 구분되며 접근 가능한 이름을 유지한다.
- userOutcomeReview: 데스크톱 3개 캡처와 현재 소스는 의도에 부합한다. 그러나 200% 대응 캡처는 좌측 완료 카드까지만 보이고 검토 대상인 기록판을 전혀 포함하지 않아 좁은 화면 결과를 실제 렌더링 증거로 확인할 수 없다.

## Blockers

1. violatedCriterion: `QA-200%-VISIBLE-HISTORY`
   - observation: `history-effective-512.jpg`가 기록판 영역에 도달하기 전에 끝나며 1~9회 카드, 보상 밴드, 좁은 폭 한 열 배치를 한 픽셀도 보여주지 않는다.
   - evidencePointer: `.omo/evidence/number-baseball-final/history-effective-512.jpg`
   - requiredEvidence: 동일 빌드의 512 CSS px 상당 뷰포트에서 아래로 스크롤하여 기록판 전체 또는 기록판 상·중·하단을 빠짐없이 담은 새 캡처.

## Verified Product Evidence

- `.omo/evidence/number-baseball-final/history-1024.jpg`: 1~9회가 1,2,3 / 4,5 / 6,7 / 8,9 순서로 보이며 문서/내부 스크롤바와 가로 넘침이 없다.
- `.omo/evidence/number-baseball-final/history-1280.jpg`: 모든 회차와 +15/+10/+5 보상 밴드가 한 화면에 보인다.
- `.omo/evidence/number-baseball-final/history-1366.jpg`: 1~5회가 한 행, 6~7회와 8~9회가 각각 한 행으로 보이고 밀도와 계층이 안정적이다.
- `src/components/student/StudentNumberBaseballHistory.tsx`: DOM 순서가 1~9이며, 범위 제목은 렌더링하지 않고 각 보상 구간 `section`에 회차 범위와 보상 `aria-label`을 제공한다. 미완료 상태의 다음 회차는 `is-current`, `aria-current="step"`, `다음 입력`으로 구분한다. 완료 또는 9회 소진 시 다음 회차 표시가 없다.
- `src/lib/numberBaseball.ts`: 보상 구간은 1~5회 15, 6~7회 10, 8~9회 5다. `OUT`은 `strikes === 0 && balls === 0`일 때만 숫자 접두사 없이 생성된다.
- `src/components/student/StudentNumberBaseballResult.tsx`: S/B/OUT에 한국어 보조 라벨과 접근 가능한 이름이 있다.
- `src/index.css`: 보상 밴드는 조용한 톤 배경만 사용하며 기존 4px 세로선과 밴드 외곽선을 제거했다. 결과는 solid/double/dashed로 색 외 구분을 유지하며, 빈 슬롯은 dashed, 현재 슬롯은 억제된 배경·테두리로 구분한다. `max-width: 32rem`에서 기록 카드는 한 열로 선언돼 있다.

## Capture Integrity

- 모든 캡처는 JPEG 서명과 `.jpg` 확장자가 일치한다.
- 캡처 시각은 변경된 `StudentNumberBaseballHistory.tsx`와 `src/index.css`보다 약 1분 뒤여서 최신이다.
- 검은 프레임이나 미합성 영역은 보이지 않는다.

## Slop / Programming Review

- 새 의존성, 이미지 대체 UI, 불필요한 추상화, 테스트 전용 생산 코드, 삭제 문구만 고정하는 테스트는 없다.
- 현재 회차 계산은 컴포넌트 안의 짧은 파생 상태이며 단일 사용 helper를 만들지 않았다.
- 변경된 TSX는 readonly prop 타입을 유지하고 `any`, 타입 억제, non-null assertion을 추가하지 않았다.
- `DESIGN.md` 변경은 실제 상태 규칙을 설명하며 자연어 문구 고정 테스트를 추가하지 않았다.

## Checked Artifacts

- `.omo/evidence/number-baseball-final/history-1024.jpg`
- `.omo/evidence/number-baseball-final/history-1280.jpg`
- `.omo/evidence/number-baseball-final/history-1366.jpg`
- `.omo/evidence/number-baseball-final/history-effective-512.jpg`
- `src/components/student/StudentNumberBaseballHistory.tsx`
- `src/components/student/StudentNumberBaseballResult.tsx`
- `src/components/student/StudentNumberBaseballPage.tsx`
- `src/lib/numberBaseball.ts`
- `src/index.css`
- `DESIGN.md`

## Exact Evidence Gaps

- 좁은 폭에서 실제 렌더링된 우측 기록판 전체가 보이는 캡처가 없다. 소스의 미디어 쿼리는 올바르지만 최종 시각 게이트는 소스 추론만으로 대체할 수 없다.
