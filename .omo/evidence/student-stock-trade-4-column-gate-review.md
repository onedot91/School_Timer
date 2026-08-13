# Gate review: student stock trade four-column layout

## recommendation

APPROVE

## blockers

None.

## originalIntent

학생 증권사 `종목 고르기` 화면의 네 종목을 Chromebook 기준 화면에서 이전처럼 한 행의 4열 실제 카드로 표시하고, 학생용 글자를 14px 미만으로 줄이지 않으면서 가로·세로 넘침 및 한국어 잘림을 만들지 않는 것.

## desiredOutcome

1280×800 Chromebook에서 학생이 네 종목의 보유 상태, 오늘 추세와 소식, 가격, 매수·매도 동작을 한 화면에서 읽고 사용할 수 있으며, 카드가 한 행에 유지되고 문서 스크롤이나 잘린 텍스트가 없어야 한다.

## userOutcomeReview

- PASS: 제공 캡처 `/private/tmp/student-stock-trade-4-column-1280.png`를 원본 해상도로 직접 열어 확인했다. 네 카드가 한 행에 배치되고, 카드 제목·보유 상태·추세·소식·가격·거래 버튼·지난 소식 버튼이 시각적으로 잘리지 않는다.
- PASS: 제공된 런타임 측정은 콘텐츠 viewport `1280×720`, `cardCount=4`, `rowCount=1`, 카드 x=`12/329/646/963`, 각 width=`305`, `documentOverflowX=false`, `documentOverflowY=false`, `clippedElements=[]`, `minFontSize=14`이다. 캡처와 소스 구조가 이 측정과 일치한다.
- PASS: `src/components/student/StudentStockMarketPage.tsx`에서 `getDailyStockQuotes(...).map(...)`이 네 개의 실제 `<article className="student-market-card">`를 렌더링한다. 이미지로 합성한 카드가 아니다.
- PASS: `src/index.css:15114-15127`은 시장 grid를 `repeat(4, minmax(0, 1fr))`로 유지하고 카드 `min-width: 0`, 2열 header, 추세 전체 폭, 가격/거래 세로 배치를 적용한다. 관련 학생 텍스트 최솟값은 `.875rem`(14px)이며 주요 행동은 `1rem`이다.
- PASS: 색상, 반경, 표면, 구분선, 그림자는 기존 `--apple-*` 토큰을 재사용하고, 상승/하락은 문서화된 `--student-stock-up/down` semantic token을 사용한다. 별도 컴포넌트 체계를 만들지 않았다.
- PASS: 레이아웃 변경은 CSS와 디자인 문서에 국한된다. 실제 카드의 거래 버튼은 `setTradeDraft(...)`, 확인 버튼은 `confirmTrade()`, 최종적으로 기존 `onAction({ type, stockId, dateKey })`를 호출한다. 지난 소식 disclosure의 `aria-expanded`, dialog의 `role="dialog"`, `aria-modal`, Escape 닫기, 명시적 button type도 보존된다.
- PASS: `npm run lint`를 직접 실행해 `tsc --noEmit` 통과를 확인했고 `git diff --check`도 통과했다.

## remove-ai-slops and programming pass

- 직접 diff와 production code를 검사했다. 요청 제거만 확인하는 test, deletion-only test, tautological assertion, 구현 미러링 test, 불필요한 parser/normalizer/extraction, 신규 추상화 또는 dependency는 이 변경 범위에 없다.
- 변경은 기존 DOM과 기능 경로를 유지한 채 CSS grid와 카드 내부 layout을 조정하는 최소 구현이다. TypeScript escape hatch나 type suppression 추가가 없다.
- 기존 `.omo/evidence/third-grade-stock-simplification-code-review.md`는 `programming` 및 `remove-ai-slops` 관점을 명시하지만 현재 4열 레이아웃만을 대상으로 한 보고서는 아니다. 따라서 해당 보고서를 승인 근거로 대체하지 않고 직접 pass를 수행했다.

## checkedArtifactPaths

- `/private/tmp/student-stock-trade-4-column-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockTrend.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStorePage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/dom-and-logic-evidence.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-qa/browser-action-log.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/third-grade-stock-simplification-code-review.md`

## exactEvidenceGaps

- NOTE: 제공 캡처의 파일 픽셀 크기는 1280×720이고, 사용자는 앱 내 브라우저 툴바를 제외한 콘텐츠 viewport가 1280×720이라고 명시했다. Chromebook 외곽 화면 1280×800 전체를 캡처한 증거는 아니지만, 요구된 앱 콘텐츠 surface를 직접 검증하므로 성공 기준을 위반하지 않는다.
- NOTE: 1024px/1366px 별도 캡처는 이번 입력에 없다. 현재 요청의 명시적 기준은 1280×800이며, 1280 콘텐츠 측정은 완전하다. 더 좁은 폭에서도 4열을 유지하므로 장문 시장 소식과 확장 history에 대한 별도 visual QA는 잔여 위험이다.
- NOTE: dialog는 초점 진입과 Escape 닫기를 제공하지만 완전한 focus trap/닫힌 뒤 초점 복귀는 소스에서 확인되지 않는다. 이번 변경으로 생긴 회귀가 아니고 명시 성공 기준에도 포함되지 않아 blocker가 아니다.

