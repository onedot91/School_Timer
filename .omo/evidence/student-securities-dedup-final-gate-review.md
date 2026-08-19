# Securities dedup final gate review

- recommendation: **APPROVE**
- originalIntent: 하단 투자 거래 패널에서 상단 카드와 중복되는 선택 종목명 표시를 제거해 등락 사유 카드에 시선을 집중시키되, 실제 투자 입력·투자·회수 기능과 접근성 문맥은 유지한다.
- desiredOutcome: 하단 패널에는 금액 입력과 `투자하기`/`투자금 찾기` 동작만 남고, 보조기술은 어떤 종목의 거래 패널인지 알 수 있으며, 1024/1280/1366 대상 캡처에서 카드 사유와 거래 컨트롤이 잘리거나 겹치지 않는다.

## User outcome review

요청한 중복 종목명 블록은 제거되었다. 하단 패널은 금액 입력과 두 거래 버튼으로 간결해졌고, 섹션의 `aria-label`에는 선택 종목명이 유지된다. 세 캡처 모두 4개 등락 사유 카드와 하단 거래 패널이 한 화면에 들어오며, 겹침이나 가로 잘림이 보이지 않는다. 긴 첫 번째 사유는 카드 내부 스크롤 영역에 제한되어 레이아웃을 밀어내지 않는다.

## Criteria

| Criterion | Result | Evidence |
|---|---|---|
| C1. 하단 패널의 중복 선택 종목명 제거 | PASS | `src/components/student/StudentInvestmentActionPanel.tsx:104-115`; `student-investment-stock-choice`가 소스/CSS에서 검색되지 않음 |
| C2. 금액 입력, 투자, 투자금 찾기 유지 | PASS | `src/components/student/StudentInvestmentActionPanel.tsx:106-113` |
| C3. 선택 종목 접근성 문맥 유지 | PASS | `src/components/student/StudentInvestmentActionPanel.tsx:104`의 ``aria-label={`${selectedStock.name} 투자 거래`}``; 입력 라벨은 `:108` |
| C4. 등락 사유 가독성과 오버플로 안전성 | PASS | `src/index.css:15371`, `src/index.css:15573-15603`; 세 캡처 직접 검사 |
| C5. 1024/1280/1366 대상 화면에서 클리핑/겹침 없음 | PASS | 아래 세 캡처 직접 검사. 파일 자체 픽셀 크기는 브라우저 도구 UI를 제외한 860x672, 1075x672, 1147x672임 |
| C6. 정적·회귀 검증 | PASS | 리뷰 중 `npm test -- --run` 99/99, `npm run lint` 성공, `git diff --check` 성공 |

## Checked artifacts

- `src/components/student/StudentInvestmentActionPanel.tsx`
- `src/index.css`
- `.omo/evidence/student-securities-dedup-final-1024.jpg`
- `.omo/evidence/student-securities-dedup-final-1280.jpg`
- `.omo/evidence/student-securities-dedup-final-1366.jpg`
- `src/lib/investmentUiState.test.ts`
- `omo:programming` skill and TypeScript reference
- `omo:remove-ai-slops` skill

## Direct slop / programming pass

- 이번 핵심 변경은 기존 중복 DOM 및 전용 CSS 제거로, 불필요한 추상화·파싱·정규화·의존성을 추가하지 않았다.
- 삭제 문구 자체만 고정하는 deletion-only/tautological 테스트는 추가되지 않았다.
- 기존 거래 상태 테스트는 사용자 관찰 가능한 상태 우선순위를 검증하며 구현 문자열 검색이나 DOM 삭제만 미러링하지 않는다.
- 입력·버튼 이벤트, 확인 다이얼로그, 공개 컴포넌트 API는 유지된다.
- `any`, 타입 억제, 디버그 출력, 새 의존성은 이 핵심 변경에서 발견되지 않았다.

## Blockers

없음.

## Exact evidence gaps / notes

- `omo ulw-loop status --json`은 현재 셸에서 `omo: command not found`라서 계획별 attempt 경로를 확인할 수 없었다. 지침에 따라 이 fallback 경로에 보고서를 기록했다. 이는 사용자 성공 기준의 실패가 아니다.
- 별도 code-review report/manual-QA matrix/notepad 경로는 입력으로 제공되지 않았다. 소스, 캡처, 직접 slop/programming 검토와 재실행한 검증이 각 성공 기준을 직접 뒷받침하므로 blocker로 보지 않는다.
- 캡처 파일명은 요청 viewport를 뜻하지만 실제 이미지 파일 폭은 브라우저 도구 UI를 제외한 860/1075/1147px이다. 제공된 각 대상 캡처에서의 레이아웃 결과는 직접 확인했다.
