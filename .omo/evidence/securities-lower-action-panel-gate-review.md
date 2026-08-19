# Securities lower action panel gate review

- recommendation: **APPROVE**
- originalIntent: 하단 증권 거래 패널에서 선택 종목을 금액 입력 바로 왼쪽에 표시하고, 금액 입력 폭을 줄이되 기존 투자/회수 동작과 상단 증권 카드의 시각 언어를 유지한다.
- desiredOutcome: `선택 종목 | 투자할 고마 | 투자하기·투자금 찾기` 순서의 안정적인 3열 배치가 1024/1280/1366 대상 환경에서 겹침이나 가로 오버플로 없이 보이고, 버튼의 기존 상태 기반 활성/비활성 조건이 유지된다.

## User outcome review

- PASS — DOM 순서는 선택 종목, 금액 입력, 동작 버튼 순서다 (`src/components/student/StudentInvestmentActionPanel.tsx:105-117`).
- PASS — 기본/64rem 이상 레이아웃 모두 `stock amount actions`이며, 금액 열은 전체의 약 24~27%로 제한된다 (`src/index.css:15310`, `src/index.css:15617-15623`). 제공된 읽기 전용 geometry 결과도 inner width 860/1075/1148에서 input ratio `.269/.244/.249`, overlap/overflow 없음으로 일치한다.
- PASS — `투자하기`와 `투자금 찾기`가 유지되며, `canInvest`/`canWithdraw`는 기존의 휴장·저장 중·정수/최소/최대·보유 포지션 조건을 그대로 사용한다 (`src/components/student/StudentInvestmentActionPanel.tsx:77-81`, `:114-116`).
- PASS — 패널은 상단 카드와 같은 `--apple-*` border/radius/surface/shadow 토큰을 쓰며 선택 종목 필드도 같은 control 토큰을 사용한다 (`src/index.css:15308`, `:15312-15314`, `:15463-15470`).

## Direct programming / slop pass

- 핵심 UI 변경에 `any`, 타입 억제, 새 의존성, 디버그 출력, 불필요한 파싱/정규화가 없다.
- 상태 메시지 helper/test는 이번 배치에 함께 존재하지만, 상태 우선순위라는 관찰 가능한 계약을 검증한다. 삭제 전용·tautological·구현 미러링 테스트는 아니다.
- 기존 code-review report (`.omo/evidence/student-securities-cjk-accessibility-code-review.md`)도 `omo:programming` 및 `omo:remove-ai-slops` 관점을 명시하고 동일한 과적합 범주를 점검했다.

## Checked artifacts

- `src/components/student/StudentInvestmentActionPanel.tsx`
- `src/index.css`
- `src/lib/investmentUiState.test.ts`
- `.omo/evidence/student-securities-cjk-accessibility-code-review.md`
- `.omo/evidence/student-securities-dedup-final-gate-review.md`
- `.omo/evidence/student-securities-action-layout-1024.png`
- supplied read-only DOM geometry summary

## Verification evidence

- supplied automation: `npm test -- --run` PASS (99/99), `npm run lint` PASS, `npm run build` PASS.
- No page mount/navigation/control click was performed, per live student data constraint.

## Blockers

없음.

## Exact evidence gaps / notes

- `omo ulw-loop status --json`은 현재 셸에서 `omo: command not found`여서 fallback report path를 사용했다.
- `.omo/evidence/student-securities-action-layout-1024.png`는 증권 화면이 아니라 YouTube 화면을 담고 있어 이 캡처는 증거로 사용할 수 없다. 다만 성공 기준은 소스와 별도로 제공된 3개 폭의 읽기 전용 DOM geometry 결과가 직접 뒷받침하므로 blocker가 아닌 evidence hygiene NOTE로 기록한다.
- 이번 하단 패널 변경 전용 manual-QA matrix/notepad 경로는 제공되지 않았다. 이는 명시된 성공 기준의 필수 산출물이 아니다.
