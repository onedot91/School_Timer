# Failure Exhibition UI — Final Gate Review

- recommendation: APPROVE
- blockers: []
- originalIntent: 최종 narrow-header 수정 뒤 실패 자랑소 화면이 warm mint/coral/lavender 종이 카드 디자인, 자연스러운 한국어 조판, 고정 폭 탐색/작성 레일, 겹침 없는 헤더, 좁은 화면 내부 스크롤 계약을 충족하는지 독립적으로 검증한다.
- desiredOutcome: 1280×800, 1024×800, 1366×800에서 3×2 카드 그리드와 문서 스크롤 없는 화면이 보이고, 640×800에서는 단일 열 및 내부 피드 스크롤이 동작하며 헤더·배너·캐치프레이즈와 한국어 문구가 겹치거나 부자연스럽게 분절되지 않는다.

## User outcome review

APPROVE. 네 PNG를 원본 크기로 직접 열어 확인했다. 데스크톱 세 화면은 모두 3열×2행 카드, 좌측 정렬 IBM Plex Korean 계열 조판, 회전/과도한 자간 없음, 우측의 라벨 있는 이전/다음 레일과 작성 버튼, 겹침 없는 헤더/연습 모드 배너/캐치프레이즈를 보여 준다. 640×800 화면은 단일 열이며 피드 자체의 세로 스크롤 표시가 있고 문서 영역은 화면 안에 고정되어 있다. 이전 결함인 `한 / 입이라도` 분절은 없고 1024 캡처에서 `한 입이라도`가 한 덩어리로 유지된다. 640 화면의 연습 모드 배너는 `연습 모드`만 시각적으로 표시되어 컴팩트하며, 상세 문장은 DOM에 남고 CSS로 시각적으로만 숨겨 접근성 트리에 유지된다.

## Checked artifacts

- `.omo/evidence/failure-exhibition-ui-20260829/primary-1280x800.png` — 직접 원본 확인; 1280×800 PNG
- `.omo/evidence/failure-exhibition-ui-20260829/secondary-1024x800.png` — 직접 원본 확인; 1024×800 PNG
- `.omo/evidence/failure-exhibition-ui-20260829/secondary-1366x800.png` — 직접 원본 확인; 1366×800 PNG
- `.omo/evidence/failure-exhibition-ui-20260829/effective-640x800.png` — 직접 원본 확인; 640×800 PNG
- `src/index.css` — 토큰, 5.25rem 레일, 3×2/단일 열 반응형, 내부 overflow, 좁은 화면 배너 상세의 시각적 숨김 확인
- `src/RootApp.tsx` — `연습 모드` 상세 문장이 DOM에 유지됨을 확인
- `src/components/student/StudentFailureExhibitionPage.tsx` — 헤더 제목/캐치프레이즈 구조 확인

## Freshness and capture integrity

- `src/index.css`: 2026-08-29 00:28:52
- 네 최종 PNG: 2026-08-29 00:29:33
- 모든 파일은 8-bit RGB non-interlaced PNG이며 요청된 픽셀 크기와 일치한다.
- 하단 중앙 검은 pill은 제공된 계약에 따라 브라우저 미리보기 도구로 판정에서 제외했다.

## Direct slop / programming pass

- UI는 실제 DOM/React 구성과 CSS 토큰으로 구현되어 있으며 래스터 화면 대체가 아니다.
- 요청 범위에서 과잉 테스트, 삭제만 검증하는 테스트, 구현 미러링/동어반복 테스트, 불필요한 파싱·정규화·추상화는 관찰되지 않았다.
- `--failure-*` 토큰과 공통 카드/레일 선택자가 색상·타이포그래피·치수 계약을 일관되게 구동한다.
- NOTE: `src/index.css` 전체 크기는 크지만 이번 시각 성공 기준을 위반한다는 증거가 아니므로 blocker가 아니다.

## Evidence gaps

- 없음. 제공된 fresh metrics의 정확한 scrollHeight/clientHeight 수치는 이번 읽기 전용 육안 패스에서 재계측하지 않았으나, 640 캡처의 피드 내부 스크롤바와 화면 고정 구조가 요구된 사용자-visible 결과를 직접 입증한다.
- `omo ulw-loop status --json`은 로컬에서 `omo: command not found`로 실행할 수 없어 지시된 fallback 경로에 이 보고서를 기록했다.
