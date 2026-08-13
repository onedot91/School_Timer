# Student confirmation visual QA gate review

- recommendation: REJECT
- visualVerdict: REVISE
- reviewType: Read-only Visual QA Pass A

## originalIntent

초등학교 3학년 학생 화면에서 실제 고마 지출 버튼과 책 쌓기 실행 전에 항상 한 번 확인 모달을 표시하고, 이미 자체 확인창이 있는 경매·증권·기부에는 중복 확인을 추가하지 않는다.

## desiredOutcome

1280×800 실제 학생 상점 화면에서 확인 모달이 디자인 시스템과 조화롭게 보이고, 키보드·스크린리더 접근성이 유지되며, 모든 신규 확인 대상은 확인 후에만 실행되고 기존 확인 대상은 한 번만 확인된다.

## userOutcomeReview

소스 추적 결과 상점 구매, 스킨 뽑기, 집/쿠폰 구매, 은행 지출 거래, 펫 먹이기, 책 쌓기는 확인 모달을 거친다. 경매, 증권, 기부는 기존 자체 확인 흐름을 그대로 사용해 공용 확인 모달과 중복되지 않는다. 공용 모달은 기존 Apple/student 토큰을 재사용하며 실제 DOM으로 구성되고, `role="dialog"`, `aria-modal`, label/description 연결, 외부 영역 inert 처리, 포커스 순환·복귀, Escape 취소, pending 중 닫기/중복 실행 방지를 제공한다.

그러나 사용자가 지정한 실제 캡처 `/private/tmp/student-confirm-shop-1280x800.png`가 검토 시점에 존재하지 않아 이미지 서명, 1280×800 치수, 합성 완전성, 실제 모달의 정렬·대비·텍스트 겹침을 직접 확인할 수 없었다. 따라서 시각 QA Pass A는 승인할 수 없다.

## blockers

1. violatedCriterion: `CAPTURE-1 직접 캡처와 소스를 읽고 디자인 시스템·접근성·기능 무결성을 검토`
   - observation: 지정된 실제 1280×800 캡처가 없어 렌더링 결과를 직접 판독할 수 없다.
   - evidencePointer: `/private/tmp/student-confirm-shop-1280x800.png` (`file`, `sips`, `stat` 모두 ENOENT; `/private/tmp` 파일 검색 결과 없음)

## notes

- `StudentConfirmDialog`는 필요한 공용 동작 경계로서 과도한 추출이 아니다.
- 관련 diff와 production code에서 삭제만 검증하는 테스트, 요청 문구만 고정하는 테스트, 구현을 그대로 복제하는 테스트, 불필요한 파싱·정규화는 발견하지 못했다.
- 증권 모달 CSS와 공용 확인 모달 CSS의 구조적 중복은 유지보수 메모이지만 사용자 성공 기준 위반은 아니다.
- UI 확인 경로를 직접 고정하는 컴포넌트 테스트는 없으나, 명시된 성공 기준이 테스트 파일을 요구하지 않으므로 blocker가 아니다.
- 독립 Pass A 하위 리뷰 도구는 현재 도구 목록에 제공되지 않아 직접 검토로 수행했다.

## checkedArtifactPaths

- `/private/tmp/student-confirm-shop-1280x800.png` (missing)
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentConfirmDialog.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentBankPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentStockMarketPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentDonationPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/useModalFocus.ts`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`

## verification

- `npm run lint`: PASS (`tsc --noEmit`)
- `npm test`: PASS (71 passed, 0 failed)
- `npm run build`: PASS; pre-existing/non-blocking Vite chunk-size warning only

## exactEvidenceGaps

- 실제 상점 구매 모달의 1280×800 렌더 캡처
- 캡처의 PNG 서명·치수·완전 합성 확인
- 캡처 기반 텍스트 클리핑, 버튼 겹침, 배경 scrim, 모달 중심 정렬, 시각 대비 판독

