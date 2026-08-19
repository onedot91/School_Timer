# Sudoku keypad completed-digit gate review

- recommendation: APPROVE
- blockers: []
- originalIntent: 보드에 같은 숫자가 9개 모두 채워지면 해당 숫자를 자판에서 시각적으로 제거하고, 나머지 자판 위치는 유지하며, 하나를 지우면 숫자가 다시 나타나게 한다. 물리 키 입력도 완료 숫자를 다시 넣지 못해야 한다.
- desiredOutcome: 7이 8개일 때는 7 키가 정상 표시·활성 상태이고, 9개가 되는 즉시 해당 grid slot만 보이지 않되 주변 키의 기하가 변하지 않는다. 삭제 후 8개가 되면 키가 다시 표시·활성화된다. 1024/1280/1366 CSS px에서 한국어와 주요 조작이 잘리거나 가로 넘침이 없다.

## User outcome review

사용자가 기대한 결과를 충족한다. `getSudokuCompletedDigits`는 각 1~9 숫자의 출현 횟수가 9 이상인지 계산한다. `StudentSudokuPage`는 같은 집계를 버튼의 `is-complete`, `disabled`, `aria-hidden`, `tabIndex=-1` 및 `enterDigit` guard에 공통 사용한다. CSS의 `visibility:hidden`은 grid item의 슬롯을 보존한다. 8개/9개 JPEG 비교에서 7 위치만 비고 8·9 및 지우기 위치가 유지된다. 제공된 실제 DOM 관측에는 삭제 후 count=8에서 다시 visible/enabled가 되는 결과와 물리 7 키 차단 결과가 포함된다.

## Checked artifacts

- `DESIGN.md`
- `src/lib/sudoku.ts`
- `src/lib/sudoku.test.ts`
- `src/components/student/StudentSudokuPage.tsx`
- `src/index.css`
- `.omo/evidence/sudoku-keypad-complete/current/seven-count-8.jpg`
- `.omo/evidence/sudoku-keypad-complete/current/seven-count-9-hidden.jpg`
- `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1024.jpg`
- `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1280.jpg`
- `.omo/evidence/sudoku-keypad-complete/current/seven-hidden-1366.jpg`

## Per-image trace

- `seven-count-8.jpg`: 7이 8개인 상태에서 7 키가 3×3 자판의 좌하단 슬롯에 표시되고 선택 강조도 정상이다.
- `seven-count-9-hidden.jpg`: 아홉 번째 7 입력 후 같은 슬롯만 빈 상태이며 8·9는 기존 행과 열 위치를 유지한다. 보드/상태 문구/지우기 조작의 시각적 손상이 없다.
- `seven-hidden-1024.jpg`: 보드와 자판이 나란히 완전히 보이고 한국어 제목·저장 상태·안내·지우기 텍스트에 잘림이나 겹침이 없다. 7 슬롯이 유지된다.
- `seven-hidden-1280.jpg`: 기준 Chromebook 폭에서 전체 작업 영역의 계층, 키 간격, 빈 7 슬롯 및 CJK 렌더링이 정상이다.
- `seven-hidden-1366.jpg`: 넓은 Chromebook 폭에서도 자판이 과도하게 늘어나지 않고 슬롯/간격이 안정적이며 텍스트 잘림이 없다.

## Reproduced verification

- `npm test`: PASS, 112/112.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS. 기존 Vite 500 kB chunk-size warning만 있음.
- Supplied runtime DOM evidence: count 8 visible/enabled; count 9 hidden/disabled/`aria-hidden=true`/`tabIndex=-1`; key 8 rect byte-identical; physical 7 blocked; delete restores visible/enabled; console warning/error empty; horizontal overflow false at effective 512.

## Skill-perspective checks

- remove-ai-slops direct pass: 새 helper는 UI와 테스트가 소비하는 단일 도메인 집계 seam이므로 불필요한 추출이 아니다. 테스트는 삭제 여부나 CSS 문자열을 고정하지 않고 집계 결과를 검증한다. tautology, production 구현 복제, deletion-only assertion, 불필요한 parsing/normalization은 발견되지 않았다.
- programming direct pass: 새 로직은 타입 억제나 `any`, 비정상 assertion, 새 의존성, 예외 삼키기를 추가하지 않는다. UI와 키보드 경로가 동일한 완료 숫자 집계를 사용한다.

## Findings

- [product] PASS — 9개 완료 시 숨김, grid geometry 보존, 물리 키 차단, 삭제 시 복귀가 코드와 실제 DOM 증거로 일치한다.
- [product] PASS — 1024/1280/1366에서 CJK clipping, 텍스트 겹침, 가로 overflow가 보이지 않는다.
- [evidence] NOTE — 자동화된 unit test는 9개 집계의 양성 사례만 직접 고정한다. 8개 경계, DOM 접근성 속성, 삭제 복귀는 실제 런타임 증거로 검증되어 이번 성공 기준의 blocker는 아니다.
- [evidence] NOTE — reference는 구조 예시이므로 pixel diff/metric은 N/A이다.

## Evidence gaps

- 코드 리뷰 보고서/수동 QA matrix의 별도 경로는 입력에 제공되지 않았다. 그러나 지정된 소스, 5개 권위 JPEG, 구체적 실제 DOM 관측 및 독립 재실행 결과가 모든 명시 성공 기준을 직접 뒷받침한다.
- `omo ulw-loop status --json`은 로컬에서 `command not found`여서 attempt directory를 조회할 수 없었다. 따라서 지시된 fallback 경로에 이 보고서를 작성했다.

## BLOCKING

없음.
