# Final Investment Integrity Review — Gate Review

- recommendation: **REJECT**
- verdict: **REVISE**
- blockers:
  - violatedCriterion: `SC-3`
    evidencePointer: `/private/tmp/school-timer-investment-flow/student-investment-1366x800.jpg` (`file` reports `1280x800`; visual inspection shows both edges/card content cut off)
  - violatedCriterion: `SC-2`
    evidencePointer: `src/pages/AuctionPage.tsx:1458` together with `src/components/student/StudentStorePage.tsx:62-63`

## originalIntent

`내 투자` 현황과 `투자하기`를 별도 페이지가 아닌 하나의 읽기 쉬운 학생 화면으로 합치고, 현황 바로 아래에 네 투자 카드를 둔다. 기존 링크 호환을 위해 `#student-store-securities-trade`도 동일한 화면과 정상적인 실제 동작을 제공한다.

## desiredOutcome

- `SC-1`: canonical 투자 hash에서 현황 → `골라서 투자하기` → 네 종목 카드가 하나의 연속 화면에 나타난다.
- `SC-2`: legacy `#student-store-securities-trade`가 canonical과 같은 제목, 본문, 실제 탐색 동작을 제공한다.
- `SC-3`: Chromebook 기준 1024, 1280, 1366 CSS px에서 네 카드와 실제 입력/버튼이 수평 잘림이나 overflow 없이 읽힌다.
- `SC-4`: 한 화면을 합친 뒤에도 일일 투자 정산 요청의 owner는 하나뿐이며 중복 정산 side effect가 없다.
- `SC-5`: 변경 범위가 단일 투자 흐름/호환 route/style/documentation에 머물고 typecheck, tests, production build가 통과한다.

## userOutcomeReview

핵심 합성은 구현되었다. `StudentStorePage`는 두 securities section을 같은 React 트리로 보내고, `StudentSecuritiesPage` 다음에 `StudentStockMarketPage`와 네 실제 카드/입력/버튼을 렌더한다. 정산 effect도 `StudentStockMarketPage` 한 곳에만 남아 중복 요청 문제는 해소되었다. 1024와 1280 캡처, legacy 1280 캡처는 이 결과를 보여 준다.

다만 최종 제출 상태는 승인할 수 없다. 1366 캡처는 실제 1280×800 파일이고 화면 좌우 및 카드가 잘린 상태여서 필수 responsive 판정을 충족하지 못한다. 또한 legacy route의 헤더는 `광장`으로 돌아간다고 표시하지만 전달된 `onBack`은 `store-securities`로 이동한다. 즉 동일 화면 호환 route에서 보이는 실제 버튼 동작이 canonical과 같지 않으며 레이블과도 모순된다.

## Findings

- `[product]` PASS (`SC-1`): `StudentStorePage.tsx:77-88`에서 portfolio/status 다음에 `골라서 투자하기`와 `StudentStockMarketPage`가 같은 흐름으로 합성된다.
- `[product]` PASS (`SC-4`): `StudentSecuritiesPage`에는 effect/onAction이 없고, `settle_investments` mount effect는 `StudentStockMarketPage.tsx:40-46` 한 곳뿐이다.
- `[product]` REVISE (`SC-2`): `StudentStorePage`는 legacy에서도 back label/text를 `광장`으로 표시하지만 `AuctionPage.tsx:1458`은 legacy section일 때 `store-securities`로 보낸다. 같은 화면으로 다시 이동할 뿐 광장으로 가지 않는다.
- `[evidence]` PASS (`SC-3` 일부): 1024×800, 1280×800, legacy 1280×800 JPEG에서 한 흐름, 네 카드, 실제 control, 겹침 없는 레이아웃을 직접 확인했다.
- `[evidence]` REVISE (`SC-3`): 이름이 `student-investment-1366x800.jpg`인 파일은 JPEG metadata상 1280×800이고 시각적으로 좌우가 잘렸다. 1366px responsive 증거가 없다.
- `[evidence]` PASS (`SC-5`): 직접 실행한 `npm test`는 80/80 통과, `npm run lint` 통과, `npm run build` 통과, `git diff --check` 통과했다. Vite 500kB chunk 경고는 기존 비차단 경고다.

## Direct remove-ai-slops / programming Pass

- 변경 diff에 새 테스트가 없어 삭제-only, requested-removal-only, tautological, prose pinning, implementation-mirroring 테스트가 추가되지 않았다.
- `StudentSecuritiesPage`에서 중복 effect와 불필요해진 `onAction` prop을 함께 제거한 것은 root cause에 맞는 최소 변경이다. 새 parser, normalizer, wrapper, dependency 또는 speculative abstraction은 없다.
- `StudentStorePage`의 `isSecurities` 분기는 두 legacy/canonical route가 같은 UI를 공유하게 하는 직접적인 재사용이며 과도한 추출이 아니다.
- 대상 TSX는 각각 93/56/104 pure LOC로 이번 변경이 oversized module을 만들지 않았다. 대형 기존 `index.css`는 새 성공 기준 위반이 아닌 NOTE다.
- 기존 `grade-3-investment-system-code-review.md`는 programming/remove-ai-slops 관점과 overfit/slop 기준을 명시적으로 다루지만, 이번 후속 단일화 diff의 1366 잘림 증거 및 legacy back mismatch는 다루지 않는다. 보고서 승인 문구는 이번 직접 판정을 대체하지 않는다.

## Checked Artifact Paths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStorePage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentSecuritiesPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/grade-3-investment-system-code-review.md`
- `/private/tmp/school-timer-investment-flow/student-investment-1024x800.jpg`
- `/private/tmp/school-timer-investment-flow/student-investment-1280x800.jpg`
- `/private/tmp/school-timer-investment-flow/student-investment-1366x800.jpg`
- `/private/tmp/school-timer-investment-flow/student-investment-legacy-trade-1280x800.jpg`

## Exact Evidence Gaps

- 유효한 1366×800 캡처와 해당 viewport의 `innerWidth/clientWidth/scrollWidth` 측정값이 없다.
- 이번 후속 diff 전용 executor evidence, manual QA matrix, notepad path는 입력되지 않았다.
- `omo ulw-loop status --json`은 현재 PATH에서 `omo: command not found`라 fallback 보고서 경로를 사용했다.
- 실제 금융 mutation은 안전 규칙에 따라 실행하지 않았다. 투자/회수 action domain 테스트는 기존 자동화로 검증했고, UI에서는 control 연결만 읽기 전용으로 확인했다.

## Required Revisions

1. legacy route의 `onBack`을 표시된 `광장` 동작과 일치시키거나, canonical과 legacy에서 동일한 탐색 의미가 되도록 한 곳에서 정규화한다.
2. 실제 1366×800 viewport로 다시 캡처하고 네 카드 전체가 보이며 `scrollWidth <= clientWidth`임을 기록한다.
