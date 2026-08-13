# Student confirmation visual QA — Pass B

- recommendation: REJECT
- visualVerdict: REVISE
- reviewType: Read-only Visual QA Pass B — visual fidelity and CJK precision

## originalIntent

초등학교 3학년 학생 화면에서 고마 사용 또는 책 쌓기 실행 전에, 학생이 행동과 금액/내용을 다시 이해할 수 있는 명확하고 큰 확인 모달을 보여 준다.

## desiredOutcome

1280×800 실제 학생 화면에서 모달이 화면 중앙에 안정적으로 배치되고, 한국어 문구가 자연스럽게 줄바꿈되며, 제목·설명·버튼이 충분히 크고 대비가 명확하고, CJK 글리프 잘림·겹침·오버플로가 없다.

## userOutcomeReview

지정 캡처를 원본 크기로 직접 열어 확인했다. 렌더된 상점 구매 모달은 화면 중앙에 놓이고 배경 scrim으로 주변 화면과 분리된다. `연필`, `10 고마를 사용할까요?`, `구매할 내용과 금액을 한 번 더 확인해 주세요.`, `취소`, `구매하기`는 모두 완전한 한글 글리프로 보이며 획·받침·문장부호가 잘리지 않는다. 제목은 1행, 설명은 1행, 두 버튼도 각각 1행으로 유지되고, 모달 경계 및 닫기 버튼과 충돌하지 않는다. 제목의 시각적 위계, 설명 대비, 초록색 주 행동 버튼 대비, 수평·수직 중앙 정렬은 초3 대상의 명확한 재확인 의도에 부합한다.

소스도 캡처와 일치한다. `StudentConfirmDialog.tsx`는 제목/설명/동작을 실제 DOM 텍스트로 렌더하고, `src/index.css:15136-15146`은 25rem 폭, 중앙 grid 배치, 1.75rem 제목, 1.05rem 설명, 최소 3rem 버튼을 지정한다. 책 쌓기 호출부 역시 `이 책을 쌓을까요?`, 페이지 수 설명, `책 쌓기` 확인 라벨을 같은 모달에 전달한다. 다만 이번 Pass B에 제공된 실제 화면은 상점 구매 상태 하나뿐이므로 책 쌓기의 렌더된 CJK/오버플로는 직접 캡처로 검증되지 않았다.

제품 화면에는 차단 결함이 없지만, 제공 파일은 `.png` 확장자와 달리 실제 JPEG(JFIF) 데이터다. Visual QA 캡처 위생 기준은 파일 서명이 확장자와 일치해야 하므로 현재 증거는 승인 가능한 PNG 캡처가 아니다.

## blockers

1. violatedCriterion: `CAPTURE-SIGNATURE — 실제 1280×800 캡처의 파일 서명이 확장자와 일치해야 함`
   - observation: `student-confirm-shop-1280x800.png`는 PNG가 아니라 JPEG/JFIF 데이터다.
   - evidencePointer: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/student-confirm-shop-1280x800.png` (`file`: `JPEG image data ... 1280x800`)

## notes

- `[product]` 차단 사항 없음. 한국어 줄바꿈, 텍스트 크기, 대비, 중앙 정렬, 오버플로, CJK 정밀도는 제공된 상점 상태에서 모두 양호하다.
- 캡처 크기는 정확히 1280×800이며 검은 영역이나 부분 합성 흔적은 보이지 않는다.
- `.tsx` 직접 검토에서 `any`, 타입 억제, 불필요한 파싱/정규화, 단일 화면을 이미지로 가장하는 구현은 발견하지 못했다.
- slop/overfit 직접 검토에서 삭제만 검증하는 테스트, 요청 제거만 고정하는 테스트, tautological/implementation-mirroring 테스트, 불필요한 production extraction은 발견하지 못했다. 공용 확인 모달 추출은 상점·은행·책 쌓기·개요 행동에서 재사용되는 실제 UI 경계다.
- `src/index.css`의 stock dialog와 confirm dialog 규칙 중복은 유지보수 NOTE이나, 명시된 시각 성공 기준 위반은 아니다.
- 독립 하위 리뷰 도구가 현재 제공되지 않아 Pass B를 직접 수행했다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/student-confirm-shop-1280x800.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentConfirmDialog.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentShopPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentLibraryPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-confirm-visual-qa-gate-review.md`

## exactEvidenceGaps

- 올바른 PNG 서명을 가진 1280×800 상점 구매 모달 캡처.
- 책 쌓기 확인 상태를 실제 렌더한 캡처. 이는 책 쌓기 상태까지 시각 검증 범위에 포함하려면 필요하지만, 현재 사용자가 명시한 단일 상점 캡처의 제품 판정 자체를 뒤집는 추가 제품 결함은 아니다.

## final

VERDICT: REVISE

BLOCKING: `[evidence]` 캡처 확장자/파일 서명 불일치. 동일 1280×800 화면을 진짜 PNG로 다시 저장한 뒤 재검토해야 한다.
