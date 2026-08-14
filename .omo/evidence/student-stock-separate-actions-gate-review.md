# UI Gate Review: Student Stock Separate Actions

- recommendation: APPROVE
- blockers: []
- originalIntent: 학생 주식 거래 화면에서 사기와 팔기를 별도 고정 동작으로 제공한다.
- desiredOutcome: 1280×720 Chromebook 화면에서 네 종목 카드가 한 줄로 온전히 보이고, 각 카드의 사기/팔기 버튼이 명확하며 보유 상태에 따라 올바른 동작만 활성화된다.
- userOutcomeReview: PASS. 네 카드와 132×50px 버튼이 잘림 없이 표시되고, 사기/팔기 순서와 색상 계층이 카드마다 일관된다. 무보유 상태에서 사기는 활성, 팔기는 저채도·낮은 불투명도로 비활성임이 분명하다. 초등학교 3학년이 이해하기 쉬운 짧은 동사와 가격 표현을 사용한다.

## Criteria checked

- C1 fixed action semantics: `is-buy`는 항상 `buy_stock`, `is-sell`은 항상 `sell_stock` 초안을 생성한다.
- C2 hierarchy: 종목명 → 현재 변화 → 사는 값 → 거래 버튼 순서가 일관되고 주요 행동이 명확하다.
- C3 clipping/integrity: 1280×720 PNG에서 네 카드가 한 행에 완전히 표시되며 텍스트와 버튼 잘림이 없다.
- C4 disabled affordance: 무보유 시 팔기는 `disabled`; CSS `opacity: .42`와 `cursor: not-allowed`가 적용된다.
- C5 third-grade readability: `사는 값`, `사기`, `팔기`, `고마`처럼 짧고 직접적인 한국어를 사용하며 글자 크기와 대비가 판독 가능하다.

## Checked artifacts

- `/private/tmp/student-stock-separate-actions-1280.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `git diff -- src/components/student/StudentStockMarketPage.tsx src/index.css`

## Direct slop/programming pass

- 별도 버튼 구현은 기존 거래 초안 흐름을 재사용하며 불필요한 추출·정규화·파싱을 추가하지 않는다.
- 삭제만 검증하거나 구현을 그대로 복제하는 신규 테스트는 없다.
- 요청 범위의 변경에서 과도한 추상화, 죽은 코드, 타입 억제, 의미 없는 방어 코드가 발견되지 않았다.

## Evidence gaps

- 별도 code review report, manual QA matrix, executor report, notepad path는 입력되지 않았다. 다만 C1–C5는 제공 PNG와 실제 TSX/CSS 및 diff를 직접 확인해 판정 가능하므로 blocker가 아니다.
