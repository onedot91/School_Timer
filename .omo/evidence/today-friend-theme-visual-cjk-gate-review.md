# Today Friend Theme Visual/CJK Gate Review

- recommendation: REJECT
- reviewType: VISUAL FIDELITY AND CJK PRECISION
- surface: web
- reviewedViewport: 1280×800

## originalIntent

각 일러스트의 팔레트와 재질 콘셉트에 맞춰 `오늘의 친구` 5개 섹션을 서로 구별되는 웹디자인으로 표현한다. 원본은 전체 페이지의 픽셀 타깃이 아니라 정확한 삽화 자산이자 팔레트/재질 아트 디렉션 기준이다.

## desiredOutcome

1280×800에서 인터뷰, 공통점 찾기, 추천하기, 칭찬하기, 감정 찾기 탭이 각각 원본의 장르 세계를 이어받으면서도 동일한 왼쪽 친구 카드로 안정적인 구조를 유지한다. 모든 한국어 문구는 잘림, 어색한 줄바꿈, 넘침 없이 읽혀야 하고 비활성 상태도 WCAG 가독 대비를 유지해야 한다.

## successCriteria

- C1: 5개 예상 탭과 정확한 일러스트 자산이 모두 제공된다.
- C2: 각 탭은 지정된 팔레트/재질 콘셉트를 화면 구성 요소까지 확장한다.
- C3: 1280×800에서 문서와 뷰포트가 1280×800이며 잘림, 겹침, 의도치 않은 스크롤 또는 첫 화면 overflow가 없다.
- C4: 모든 한국어 텍스트와 비활성 상태가 읽을 수 있는 대비, 간격, 계층을 유지한다 (`DESIGN.md` 오늘의 친구 계약).
- C5: 왼쪽 친구 카드는 다섯 테마 사이에서 중립적이고 일관된 앵커로 남는다.

## userOutcomeReview

5개 원본과 5개 최신 캡처를 모두 직접 열어 비교했다. 일러스트는 정확한 2:1 자산으로 표시되고, 인터뷰는 노랑/검정 하프톤과 오프셋 그림자, 공통점은 라벤더 기술 격자, 추천은 하늘색·꽃분홍 포스터광, 칭찬은 코럴·분홍 방사광, 감정은 숲색·앤티크 골드의 야간 분위기를 각각 이어받는다. 왼쪽 파트너 카드는 모든 캡처에서 동일한 크림색 구조로 안정적인 앵커 역할을 한다. 한국어 본문에는 잘림, 겹침, 어색한 줄바꿈이 보이지 않는다.

그러나 연습 탭에서는 제출 버튼이 `disabled`이며, 다섯 캡처 모두 `선생님께 제출` 글자가 테마색 배경 위에서 매우 낮은 대비로 렌더링된다. 특히 공통점/추천/칭찬/감정 상태에서 즉시 읽기 어렵다. 이는 `DESIGN.md:383`의 “disabled states retain WCAG-readable contrast” 명시 계약을 위반하므로 승인할 수 없다.

## metricsConsumption

- `capturedAt`: 2026-08-31T12:18:00.652Z; 관련 소스 수정 시각 이후라 최신이다.
- `expectedPages`: 5; 실제 캡처 5개와 일치한다.
- `viewport`: [1280, 800]; 모든 페이지의 `viewport` 및 `documentSize`도 [1280, 800]이다.
- `referenceMode`: palette-and-material contract; 원본 1774×887과 실제 1280×800 사이 image diff를 요구하지 않는 검토 방식으로 적용했다.
- 모든 페이지의 `imageRatio`: 2; 실제 상단 일러스트도 2:1로 보인다.
- 인터뷰: genre interview, accent #e2a900, ink #2a1a08, paper #fffaf0, guide rgb(255,250,240), active-tab color(srgb 1 0.956471 0.741726), submit rgb(226,169,0).
- 공통점: genre commonality, accent #6d35bd, ink #3d1d69, paper #fbf8ff, guide rgb(251,248,255), active-tab color(srgb 0.939059 0.898431 1), submit rgb(109,53,189).
- 추천: genre recommendation, accent #087daf, ink #164c67, paper #fff9f2, guide rgb(255,249,242), active-tab color(srgb 0.907137 0.965176 1), submit rgb(8,125,175).
- 칭찬: genre compliment, accent #c93472, ink #6e2048, paper #fff7eb, guide rgb(255,247,235), active-tab color(srgb 1 0.910039 0.933255), submit rgb(201,52,114).
- 감정: genre emotion, accent #075d48, ink #063a30, paper #fff9e5, guide rgb(255,249,229), active-tab color(srgb 0.936157 0.910039 0.796863), submit rgb(7,93,72).
- 위 토큰들은 서로 구별되며 캡처의 활성 탭, 패널, 필드 규칙과 제출 배경에 반영된다. metrics에는 비활성 버튼의 최종 글자색/대비 수치가 없어 C4를 증명하지 못한다.

## blockers

1. violatedCriterion: C4
   observation: 5개 연습 탭 모두 비활성 제출 버튼의 `선생님께 제출` 문구가 테마색 배경 위에서 지나치게 흐려 WCAG-readable contrast 계약을 충족하지 못한다.
   evidencePointer: `tmp/visual-qa/today-friend-theme/{interview,commonality,recommendation,compliment,emotion}-1280x800.jpg` 하단 제출 버튼; `src/components/student/TodayFriendMissionForm.tsx`의 `disabled={isSaving || isPreview}`; `src/index.css:25691`의 전역 disabled ink override; `DESIGN.md:383`.

## findings

- [product] BLOCKING — 비활성 제출 라벨 대비가 약하다. 실제 연습 모드에서 5개 상태 모두 동일한 문제를 재현한다.
- [product] NOTE — 테마 재질은 단순 배경색 교체가 아니라 패턴, 그림자, 필드 선, 활성 탭까지 확장되어 있으며 각 장르 구분이 명확하다.
- [product] NOTE — 공통점/칭찬은 입력 카드 아래 여백이 크지만, 하단 제출 행동을 고정하고 쓰기와 제출 사이를 분리한다는 명시 계약과 부합하므로 결함이 아니다.
- [product] NOTE — 한국어 제목, 탭, 라벨, 안내문은 잘림·겹침·부자연스러운 줄바꿈 없이 표시된다.
- [evidence] NOTE — `src/lib/todayFriendIllustrationPresentation.test.ts`는 프로덕션 소스 문자열과 CSS selector/token 존재를 검사하는 구현 미러링형 테스트다. 실제 자산 로드, computed theme, 1280×800 overflow, CJK clipping, disabled contrast를 검증하지 않아 시각 성공의 증거로 신뢰할 수 없다.
- [evidence] NOTE — 별도 code review report, manual QA matrix, notepad는 이 시도 경로에서 발견되지 않았다. 직접 이미지/소스/metrics 검토로 핵심 판정은 가능하지만, 비활성 대비의 수치형 contrast 측정은 정확한 증거 gap으로 남는다.

## remove-ai-slops / programming direct pass

- 과잉 추출·불필요한 파싱/정규화·삭제 전용 테스트는 해당 시각 변경 범위에서 발견하지 못했다.
- 프레젠테이션 테스트 2개는 소스 문자열을 그대로 미러링하여 거짓 확신을 준다. 이 문제는 C4 회귀를 놓쳤지만 테스트 자체가 사용자 시각 결과를 악화시키지는 않으므로 NOTE로 분류한다.
- 프로덕션 구현은 장르별 토큰 맵과 공통 필드 primitive를 재사용한다. 이미지로 전체 UI를 위장하지 않으며 실제 DOM 폼이다.

## checkedArtifactPaths

- `/Users/ibyeonghyeon/Downloads/[인터뷰하기.png`
- `/Users/ibyeonghyeon/Downloads/[공통점찾기.png`
- `/Users/ibyeonghyeon/Downloads/[추천하기.png`
- `/Users/ibyeonghyeon/Downloads/칭찬하기.png`
- `/Users/ibyeonghyeon/Downloads/[감정찾기.png`
- `tmp/visual-qa/today-friend-theme/interview-1280x800.jpg`
- `tmp/visual-qa/today-friend-theme/commonality-1280x800.jpg`
- `tmp/visual-qa/today-friend-theme/recommendation-1280x800.jpg`
- `tmp/visual-qa/today-friend-theme/compliment-1280x800.jpg`
- `tmp/visual-qa/today-friend-theme/emotion-1280x800.jpg`
- `tmp/visual-qa/today-friend-theme/metrics.json`
- `src/components/student/StudentTodayFriendPage.tsx`
- `src/components/student/TodayFriendMissionForm.tsx`
- `src/index.css`
- `DESIGN.md`
- `src/lib/todayFriendIllustrationPresentation.test.ts`

## exactEvidenceGaps

- 비활성 제출 글자의 computed color 및 WCAG contrast ratio가 metrics.json에 없다.
- 이 변경을 대상으로 한 별도 code review report, manual QA matrix, notepad가 없다.
- 정적 캡처만 제공되어 키보드 focus와 대형 텍스트에서의 field-group scroll 동작은 이번 판정에서 재현하지 않았다.
