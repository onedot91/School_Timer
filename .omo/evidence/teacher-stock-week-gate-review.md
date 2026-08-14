# Teacher stock week final gate review

- recommendation: APPROVE
- verdict: PASS
- confidence: 0.93
- blockers: []

## originalIntent

교사 증권 설정에서 현재 주의 네 종목 × 월~금 결과를 한눈에 보고, 20칸을 한 번에 저장하며, 자주 고치는 주간 결과를 장기 운영 규칙보다 위에 두고, 이후 텍스트/붙여넣기 importer가 같은 draft와 저장 경로를 사용할 수 있게 한다.

## desiredOutcome

1. 1280×800 설정 화면 상단에 4×5 주간 결과 matrix가 가로 넘침 없이 보인다.
2. 각 날짜/종목 결과와 선택 날짜의 이유를 draft로 편집하고 `이번 주 저장` 한 번으로 등록된 칸을 저장한다.
3. 빈칸은 기존 데이터에 잘못 덮어쓰지 않고 저장 대상에서 제외한다.
4. 이전 주/이번 주/다음 주 및 포함 날짜가 올바른 월~금 묶음을 선택한다.
5. 소스 순서는 주간 결과, 선택 날짜 이유, 학생 문구 안내, 학생 현황, 운영 규칙이며 draft는 날짜와 종목으로 키가 지정된다.

## userOutcomeReview

PASS. 네 캡처를 원본 크기로 직접 확인했다. 기본 화면에는 헤더 포함 5행, 20개 select, 네 종목과 월~금 날짜가 한 화면에 있고 텍스트 겹침이나 가로 잘림이 없다. 선택 화면은 `+20%`가 빨간 상승 셀과 `▲ 올랐어요`로 함께 바뀌며 저장 전 draft 상태를 명확히 보인다. 이어지는 캡처는 선택 날짜의 네 이유 입력과 학생 문구 안내를 보여주고, 마지막 캡처는 학생별 현황 다음에 장기 운영 규칙이 배치됨을 보여준다.

코드에서 `stockMarketWeekDrafts[dateKey][stockId]`가 결과와 comment를 함께 보유한다. `saveStockMarketWeek`는 현재 월~금과 네 종목을 순회해 `returnPercent !== ''`인 항목만 모아 한 번의 `setStudentStockMarket` 갱신에서 `upsertStudentStockMarketEntry`로 저장한다. 빈칸은 명시 문구와 동일하게 저장하지 않아 기존 값을 삭제하거나 0%로 덮어쓰지 않는다. 주 이동은 현재 표시 주의 월요일에서 ±7일, `이번 주`는 한국 로컬 날짜, 날짜 input은 해당 날짜가 포함된 월~금 배열을 계산한다. 이 draft shape와 단일 save 함수는 후속 importer가 값을 주입할 수 있는 깨끗한 연결 지점이다.

## Findings

- LOW [product]: 이전/다음 주로 이동하면 `stockMarketWeekStartDateKey` effect가 `stockMarketWeekDrafts` 전체를 저장 데이터로 다시 구성하므로 미저장 입력이 조용히 사라진다. 현재 주에서 편집 후 바로 일괄 저장하는 명시 기준은 충족하므로 blocker는 아니다. 후속 개선 시 주별 draft를 병합 보존하거나 dirty 상태에서 이동 확인을 제공한다. Evidence: `src/pages/TimerPage.tsx:3685-3700`, `src/pages/TimerPage.tsx:8706-8711`.
- NOTE [evidence]: 최종 캡처에 실제 저장 클릭 상태는 없으며 요청도 저장 버튼을 클릭하지 않았다고 명시한다. 저장 경로는 소스와 domain tests로 확인했지만 browser에서 persistence round trip을 수행한 증거는 없다. 실데이터 변경 금지 원칙상 blocker가 아니다.
- NOTE [evidence]: read-only review이므로 `npm run build`는 `dist/`를 쓰는 명령이라 재실행하지 않았다. 제공된 build PASS는 독립 검증으로 간주하지 않았고, 직접 재실행한 `npm test`와 `npm run lint`가 통과했다.

## What is good

- 가장 자주 편집하는 20칸 matrix가 최상단이며 네 종목 라벨과 월~금이 동시에 보인다.
- 상승/하락/보합은 색뿐 아니라 부호와 학생 문구를 함께 사용한다.
- 선택 날짜 헤더가 이유 입력의 대상 날짜를 명확하게 결정한다.
- 빈칸 의미를 화면에서 직접 설명하고 저장 코드도 같은 의미를 따른다.
- 학생 현황과 장기 운영 규칙이 아래로 내려가 편집 우선순위가 분명하다.
- 날짜×종목 draft 및 단일 batch reducer 구조는 별도 parser UI 없이 후속 import를 연결하기 쉽다.

## Direct remove-ai-slops / programming pass

- production diff와 `src/lib/studentEconomy.test.ts`를 직접 검토했다.
- deletion-only test, 요청 제거 문구만 검증하는 test, prose/snapshot pin, tautology, output으로 expected를 재계산하는 test, 과도한 mock은 발견하지 못했다.
- 날짜 계산, 퍼센트 단계 변환, 저장 경계 normalization은 실제 UI/저장/정산에서 사용되며 불필요한 extraction·parsing·normalization이 아니다.
- 새 의존성, type suppression, dead debug code는 없다. 큰 `TimerPage.tsx`는 기존 구조이며 이번 명시 criterion 위반이 아니므로 blocker가 아니다.
- `.omo/evidence/grade-3-investment-system-code-review.md`도 두 skill 관점과 deletion-only/requested-removal-only/tautological/implementation-mirroring test 검사를 명시한다. 다만 현재 weekly matrix 전용 보고서는 아니므로 직접 pass가 주 근거다.

## Verification reproduced

- `npm test`: PASS, 80 passed, 0 failed.
- `npm run lint`: PASS, `tsc --noEmit` exit 0.
- `git diff --check`: PASS.
- 모든 캡처: 1280×800 확인.
- 제공 DOM evidence와 캡처/소스가 일치: 20 selects, header 포함 5 rows, table `clientWidth=scrollWidth=1042`, page horizontal overflow 0, weekly region y=226..726, 네 종목 라벨 표시, `+20` 선택 시 `value=20`, `▲ 올랐어요`, `is-up`.

## Checked artifact paths

- `/private/tmp/school-timer-stock-week-final-1280x800.jpg`
- `/private/tmp/school-timer-stock-week-selected-1280x800.jpg`
- `/private/tmp/school-timer-stock-comments-1280x800.jpg`
- `/private/tmp/school-timer-stock-rules-bottom-1280x800.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.test.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/grade-3-investment-system-code-review.md`
- current scoped working-tree diff

## Exact evidence gaps

- `omo ulw-loop status --json` 실행 파일이 없어 currentAttemptDir를 조회하지 못했다. 지침에 따라 fallback `.omo/evidence/teacher-stock-week-gate-review.md`를 사용했다.
- 이 weekly matrix 전용 executor report, manual QA matrix, notepad path는 제공되거나 발견되지 않았다.
- 저장 버튼을 누른 browser persistence round trip 캡처/로그는 없다. 요청상 실제 저장은 금지되었고 소스 저장 경로와 domain tests로 기능을 확인했다.
- `npm run build`는 read-only 범위에서 `dist/`를 변경하므로 재실행하지 않았다.

## Blocking

없음.
