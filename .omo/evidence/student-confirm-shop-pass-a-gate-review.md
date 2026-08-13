# Student confirmation shop — Visual QA Pass A gate review

- recommendation: REJECT
- visualVerdict: REVISE
- reviewType: Read-only design-system, accessibility, and functional-integrity review

## originalIntent

초등학교 3학년 학생 화면에서 실제 고마를 사용하는 버튼과 책 쌓기는 실행 전에 항상 한 번 확인 모달을 띄우고, 이미 확인창이 있는 경매·증권·기부에는 중복 확인을 추가하지 않는다.

## desiredOutcome

1280×800 학생 화면에서 공용 확인 모달이 기존 학생 디자인 시스템과 일관되게 표시되고, 확인 전에는 작업이 실행되지 않으며, 키보드·스크린리더 사용자가 모달 진입·취소·확인·복귀를 안정적으로 수행한다. 경매·증권·기부는 기존 확인 흐름 한 번만 유지한다.

## userOutcomeReview

지정 캡처를 직접 열어 판독했다. 상점 모달은 1280×800 화면 중앙에 안정적으로 배치되고, scrim이 배경과 현재 맥락을 함께 보존하며, 제목·설명·취소·구매 버튼에 겹침이나 잘림이 없다. 초3 대상 문구와 터치 표적도 명확하다. 소스는 공용 `StudentConfirmDialog`와 기존 Apple/student 토큰을 재사용하며 정적 이미지가 아닌 실제 DOM이다.

기능 추적 결과 상점 구매·스킨 뽑기·집/쿠폰 구매, 은행의 예금 맡기기·적금 넣기·대출 갚기, 책 쌓기, 펫 먹이기는 확인 후 실행된다. 잔액을 늘리거나 상태만 선택하는 은행 찾기·대출 빌리기·보유 스킨/집 선택·집 디자인 적용은 추가 확인 대상에서 제외되어 의도와 맞는다. 경매·증권·기부에는 공용 확인 모달이 추가되지 않아 중복 확인도 없다.

하지만 펫 먹이기에서는 기존 펫 모달 위에 공용 확인 모달이 중첩된다. 공용 모달을 취소하면 `useModalFocus`가 다른 열린 모달을 감지해 포커스 복귀를 생략하고, `StudentConfirmDialog`에도 `returnFocusRef`가 전달되지 않는다. 결과적으로 제거된 자식 모달의 포커스가 부모 펫 모달의 먹이기 버튼으로 복구되지 않아 키보드 접근성 기준을 충족하지 못한다. 또한 `.png`로 제공된 캡처의 실제 서명은 JPEG여서 PNG 증거 무결성 조건을 충족하지 않는다.

## blockers

1. violatedCriterion: `A11Y-1 키보드·스크린리더 접근성 무결성`
   - observation: 중첩된 펫 먹이기 확인창을 취소한 뒤 부모 펫 모달의 호출 버튼으로 포커스를 복귀시킬 참조가 없고, 열린 부모 모달이 있으면 훅이 기본 복귀도 생략한다.
   - evidencePointer: `src/components/student/StudentOverviewPage.tsx:189`, `src/components/student/StudentOverviewPage.tsx:276`, `src/components/student/StudentConfirmDialog.tsx:28`, `src/lib/useModalFocus.ts:101`

2. violatedCriterion: `CAPTURE-1 실제 1280×800 PNG 캡처를 직접 열어 검토`
   - observation: 파일은 1280×800으로 열리지만 PNG가 아니라 JFIF JPEG 데이터가 `.png` 확장자로 저장되어 있다.
   - evidencePointer: `tmp/student-confirm-shop-1280x800.png` (`file`: `JPEG image data, JFIF standard 1.01`; `sips`: 1280×800)

## notes

- 캡처에서 모달 중심 정렬, 배경 dim, 한글 클리핑, 버튼 겹침, 명암 대비 문제는 발견되지 않았다.
- 공용 확인 모달 추출은 상점·은행·책방·펫 네 경로에서 재사용되므로 불필요한 production extraction이 아니다.
- 직접 수행한 remove-ai-slops/programming 관점에서 삭제만 확인하는 테스트, 요청 제거만 고정하는 테스트, tautological/implementation-mirroring 테스트, 불필요한 파싱·정규화, 범위 밖 production 추출은 발견하지 못했다.
- 증권 모달과 공용 확인 모달 CSS 중복은 유지보수 NOTE이나 명시된 성공 기준의 blocker는 아니다.
- 기존 보고서 `.omo/evidence/student-confirm-visual-qa-gate-review.md`는 과거의 다른 캡처 경로 누락을 전제로 하므로 이번 증거를 대체하지 못한다. 다만 해당 보고서는 자체 slop/overfit 검토를 명시하고 있다.
- `omo` 실행 파일이 현재 환경에 없어 ULW attempt 경로를 조회할 수 없었고 fallback 증거 경로를 사용했다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/student-confirm-shop-1280x800.png`
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
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-confirm-visual-qa-gate-review.md`

## exactEvidenceGaps

- 올바른 PNG 서명을 가진 1280×800 재캡처가 없다.
- 펫 부모 모달 → 확인 모달 → 취소/완료 → 부모 호출 버튼 포커스 복귀를 재현한 키보드 증거가 없다.
- 상점 이외의 은행·책방·펫 확인 모달 렌더 캡처는 제공되지 않았다. 이는 화면별 시각 완전성의 증거 공백이지만, 이번 요청이 지정한 단일 상점 캡처 범위를 넘어 blocker로 추가하지 않았다.
