# Gate review: student stock trade 4-column layout at 1280

## recommendation

APPROVE

## blockers

None.

## originalIntent

학생 증권사 `종목 고르기` 화면의 네 종목을 Chromebook 1280×800 기준에서 이전처럼 한 행의 4열로 배치하고, 학생용 텍스트를 14px 이상으로 유지하며, 가로·세로 넘침과 한국어 잘림을 없애는 것.

## desiredOutcome

- 네 종목 카드가 동일 폭과 동일 간격의 한 행으로 정렬된다.
- 카드 내부 정보 위계가 종목/보유 상태 → 추세 → 오늘 소식 → 가격 → 거래 행동 순으로 명확하다.
- 모든 학생용 텍스트가 14px 이상이며 한국어가 잘리거나 고아 글자로 남지 않는다.
- 콘텐츠 viewport에서 문서 가로·세로 overflow가 없다.

## userOutcomeReview

요청 결과를 충족한다. 직접 연 캡처에서 네 카드가 x=12/329/646/963, 각 305px 폭으로 동일하게 배치되어 12px 간격의 단일 행을 형성한다. 카드의 좌우 외곽 여백도 12px로 균형이 맞는다. 헤더는 아이콘과 종목명을 먼저 보여주고, 추세를 전체 폭으로 분리한 뒤 소식·가격·주 행동을 수직으로 쌓아 좁아진 카드에서도 정보 위계가 유지된다.

한국어는 `해삼문구`, `새싹식품`, `구름운수`, `별빛미디어`, `아직 가지고 있지 않아요`, `오늘 등록된 시장 소식이 없어요.`, `지난 소식 보기`를 포함해 모두 완전한 음절/어절로 표시된다. 말줄임표, 글리프 절단, 한 글자만 남는 고아 줄, 버튼 텍스트 충돌은 보이지 않는다. 실제 측정의 `documentOverflowX=false`, `documentOverflowY=false`, `clippedElements=[]`, `minFontSize=14`와 캡처가 일치한다.

## criteriaTrace

| criterion | result | evidence |
|---|---|---|
| C1: 네 종목을 한 행 4열로 배치 | PASS | 캡처 카드 4개/행 1개; `src/index.css:15114`의 `repeat(4, minmax(0, 1fr))` |
| C2: Chromebook 1280×800 기준 | PASS | 브라우저 툴바 제외 콘텐츠 viewport 1280×720 캡처; 파일 픽셀 크기 1280×720 |
| C3: 학생용 텍스트 14px 미만 금지 | PASS | 측정 `minFontSize=14`; 관련 CSS 최솟값 `.875rem` |
| C4: 가로/세로 넘침 금지 | PASS | 측정 `documentOverflowX=false`, `documentOverflowY=false`; 캡처에서 외곽 잘림 없음 |
| C5: 한국어 잘림 금지 | PASS | 측정 `clippedElements=[]`; 직접 시각 검사에서 잘림·고아 글자·말줄임 없음 |

## directSlopAndProgrammingPass

- `remove-ai-slops`: 검토 범위에 과잉/무용 테스트, 삭제만 확인하는 테스트, 구현 미러링 테스트, 불필요한 파싱·정규화·추상화가 추가된 흔적은 없다. 핵심은 기존 CSS grid 선언과 카드 내부 배치 규칙이다.
- `programming`: 이번 범위는 CSS와 문서이며 타입 회피, 새 의존성, 불필요한 런타임 분기, 유지보수성 저하를 유발하는 생산 코드 추출이 없다. `minmax(0, 1fr)`와 카드 `min-width: 0`은 4열 overflow 방지를 직접 지원한다.
- 기존 코드 리뷰 보고서 `third-grade-stock-simplification-code-review.md`에는 두 스킬 관점과 slop/overfit 기준 검토가 명시되어 있다. 다만 해당 보고서는 이전 증권 로직 목표를 다루므로, 이 판정은 보고서 결론이 아니라 현재 캡처와 현재 CSS에 대한 직접 검토를 근거로 한다.

## findings

### product

None.

### evidence

- NOTE: `/private/tmp/student-stock-trade-4-column-1280.png`은 확장자와 달리 실제 JPEG/JFIF 형식이다. 픽셀 크기 1280×720이고 디코딩 및 직접 시각 검사가 가능하므로, PNG 형식을 요구하지 않은 현재 성공 기준에는 비차단이다.
- NOTE: 과거 `.omo/evidence/student-securities-manual-qa.md` 및 `student-securities-clone-fidelity.md`는 이전 1075/1076px 캡처와 구 UI를 대상으로 하므로 현재 1280px 4열 판정의 반증으로 사용하지 않았다.

## checkedArtifactPaths

- `/private/tmp/student-stock-trade-4-column-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/third-grade-stock-simplification-code-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-manual-qa.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-securities-clone-fidelity.md`

## exactEvidenceGaps

- 캡처는 브라우저 툴바를 제외한 1280×720 콘텐츠 viewport이므로, 물리 화면 전체 1280×800의 하단 80px 자체는 이미지에 포함되지 않는다. 요청에서 이 차이를 명시했고 문서 overflow 측정이 false이므로 비차단이다.
- 보유 종목/매도 상태나 펼친 지난 소식 상태는 이 캡처에 포함되지 않는다. 이번 기준은 기본 `종목 고르기` 화면의 4열, 텍스트 크기, overflow, 한국어 잘림이며 해당 상태 검증을 요구하지 않아 비차단이다.

