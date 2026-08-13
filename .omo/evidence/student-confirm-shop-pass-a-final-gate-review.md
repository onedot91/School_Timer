# Student confirmation — final read-only visual QA Pass A

- recommendation: APPROVE
- visualVerdict: PASS
- reviewType: Final read-only design-system, accessibility, and functional-integrity review

## originalIntent

초등학교 3학년 학생 화면에서 실제 고마를 사용하는 행동과 책 쌓기 실행 전에 한 번 확인 모달을 표시하고, 이미 자체 확인창이 있는 경매·증권·기부에는 중복 확인을 추가하지 않는다.

## desiredOutcome

1280×800 학생 화면에서 확인 모달이 기존 학생 디자인 시스템과 일관되고 읽기 쉽게 표시되며, 확인 전에는 작업이 실행되지 않는다. 중첩 펫 확인창을 취소하면 부모 펫 모달의 `먹이기` 버튼으로 포커스가 돌아가고, 경매·증권·기부는 기존 확인 흐름을 한 번만 유지한다.

## userOutcomeReview

지정 캡처를 원본 크기로 직접 열어 판독했다. 파일은 실제 PNG, 1280×800, RGB 비인터레이스 이미지이며 완전 합성되어 있다. 상점 구매 모달은 화면 중앙에 안정적으로 배치되고 배경 scrim으로 맥락과 전경이 분리된다. `연필`, `10 고마를 사용할까요?`, 설명, `취소`, `구매하기`가 겹침·잘림·부자연스러운 CJK 줄바꿈 없이 선명하다. 제목·설명·버튼의 크기와 대비도 초3 대상 확인 흐름에 적합하다.

최신 소스에서 확인 모달은 정적 캡처가 아닌 실제 DOM이며 `role="dialog"`, `aria-modal`, 제목/설명 연결, Escape/외부 클릭 취소, 포커스 순환, pending 중 닫기·중복 실행 방지를 제공한다. 상점 구매·스킨 뽑기·집/쿠폰 구매, 은행의 예금 맡기기·적금 넣기·대출 갚기, 책 쌓기, 펫 먹이기는 확인 후에만 실행된다. 잔액을 늘리는 찾기·빌리기와 비지출 상태 선택에는 불필요한 확인을 추가하지 않았다.

이전 차단점이던 중첩 펫 모달 포커스 복귀는 `feedButtonRef`를 공용 모달의 `returnFocusRef`로 전달하고, `useModalFocus`가 열린 부모 모달 내부의 해당 타깃을 허용하도록 구현되어 있다. 사용자가 제공한 실제 DOM 확인 결과에서도 취소 후 `먹이기` 버튼이 active였으므로 기준을 충족한다. `StudentConfirmDialog` 사용처는 상점·은행·책방·펫 네 곳뿐이며, 경매·증권·기부의 기존 자체 확인 경로에는 추가되지 않아 중복 확인이 없다.

## blockers

- 없음.

## remove-ai-slops / programming direct pass

- 공용 확인 모달은 네 실제 소비자가 공유하는 UI/접근성 경계이므로 불필요한 production extraction이 아니다.
- 삭제만 검증하는 테스트, 요청된 제거만 고정하는 테스트, tautological test, 구현 미러링 테스트, 불필요한 파싱·정규화는 확인되지 않았다.
- 새 컴포넌트와 호출부에 `any`, 타입 억제, non-null assertion, 불필요한 예외 삼키기, 죽은 코드가 없다.
- `src/index.css`의 증권 모달과 공용 확인 모달 규칙 중복은 유지보수 NOTE이나 명시된 성공 기준 위반은 아니다.
- 전용 code-review 보고서는 제공되지 않았지만, 기존 `.omo/evidence/student-confirm-shop-pass-a-gate-review.md`와 `.omo/evidence/student-confirm-visual-cjk-gate-review.md`가 각각 직접 slop/overfit 기준과 programming 관점을 명시적으로 다룬다. 보고서 내용은 이번 직접 검토를 대체하지 않았다.

## verification

- PNG 서명/치수: PASS — `PNG image data, 1280 x 800, 8-bit/color RGB, non-interlaced`.
- 직접 이미지 판독: PASS — 중앙 정렬, scrim, 대비, CJK 글리프, 버튼/텍스트 겹침 및 클리핑 이상 없음.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm test`: PASS (71 passed, 0 failed).
- 중첩 모달 포커스: PASS — 최신 소스 경로 확인 + 제공된 실제 DOM 취소 후 active-element 증거.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/student-confirm-shop-1280x800-true.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentConfirmDialog.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBankPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/useModalFocus.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-confirm-shop-pass-a-gate-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-confirm-visual-cjk-gate-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-confirm-visual-qa-gate-review.md`

## exactEvidenceGaps

- 별도 notepad와 전용 manual-QA matrix 경로는 입력에 포함되지 않았다. 다만 명시된 성공 기준은 지정 PNG, 최신 소스, 중복 경로, 실제 DOM 포커스 증거로 직접 재현되어 승인에 필요한 공백은 없다.
- 캡처 시각은 최신 `StudentConfirmDialog.tsx`/`StudentOverviewPage.tsx` 저장 시각보다 약 20초 빠르다. 후속 변경은 `returnFocusRef` 포커스 복귀 경로이며 지정 상점 모달의 렌더 구조·문구·CSS를 바꾸지 않는다. 최신 소스와 캡처의 시각 상태가 직접 일치하므로 NOTE로 기록하며 blocker로 보지 않는다.

## final

VERDICT: PASS

BLOCKING: 없음.
