# 학생 시작 화면 UI clone-fidelity 재검토

- 재검토일: 2026-08-13 (Asia/Seoul)
- 범위: `1280×800` 학생 개요, 16:9 홈 캔버스 확대, 감정 카드 제거, 하늘의 선택/미선택 감정 컨트롤, 접근성, 텍스트·이미지 크기, 오버플로.
- 사용자 명시 스펙: **오늘 선택한 감정 이미지만** 오른쪽 위 하늘에 태양처럼 배치한다. 감정명 텍스트를 추가하지 않는다.
- 검토 방식: 현재 소스·worktree diff·소스 변경 뒤 생성된 실행 캡처/DOM 측정/클릭 로그를 직접 확인했다. 데이터 변경 동작은 실행하지 않았다.
- 권고: **APPROVE**

## 재판정

기존의 `REQUEST_CHANGES`는 철회한다.

당시 차단 근거였던 실행 증거 공백은 최신 QA artifact로 해소됐다. 유효 PNG 두 장은 실제 `1280×800` 캡처이며, `s1-metrics.json`은 `.student-emotion-summary = null`, `.student-pet-card = null`, stage `1024×576`, 하늘 감정 컨트롤 `128×128`, 문서 스크롤 `1280×800`을 기록한다. 선택된 감정 컨트롤 클릭은 `#student-emotions`로만 이동했고, 감정/댓글/저장/잔액·구매·기록 변경은 실행하지 않았다.

또한 이전의 “선택 감정명 시각 텍스트를 추가해야 한다”는 MEDIUM finding은 사용자 스펙과 직접 충돌하므로 무효다. 이 화면의 의도는 상태 요약 카드가 아니라, 선택한 감정의 **이미지 하나**를 하늘에 배치하는 것이다. 한국어 정보는 선택 상태에서 `aria-label` 및 `title`로 제공되고, 미선택 상태에도 구체적인 accessible name과 키보드 focus 표시가 있다.

## 성공 기준 판정

| 기준 | 판정 | 직접 확인 근거 |
| --- | --- | --- |
| 1280×800에서 확대된 16:9 캔버스 | PASS | hero `1256×576`, stage `1024×576`, observed ratio `1.7777777778`, computed `16 / 9`; 캔버스가 hero 높이를 채움. [s1-metrics.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-metrics.json) |
| 기존 감정 카드 제거 | PASS | live DOM 측정에서 `.student-emotion-summary = null`, `.student-pet-card = null`; 캡처에도 우측 카드 영역 없음. [s1-metrics.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-metrics.json), [S1 capture](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-student-start-1280x800-valid.png) |
| 선택 감정: 하늘 오른쪽 위의 이미지 컨트롤 | PASS | selected `button.student-home-emotion-sun`은 `128×128` at `(951.46, 117.70)`; stage의 top `5%`, right `7%`, z-index `2` 토큰과 일치하며 클릭은 감정 화면으로 이동. [s1-metrics.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-metrics.json), [s2-click-action-log.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s2-click-action-log.json) |
| 미선택 감정 컨트롤 | PASS (구조/스타일) | `todayEmotion` null일 때 같은 live button에 `.is-empty`를 부여하고 dashed control + `CircleDashed`를 렌더한다. accessible name은 `오늘의 감정 고르기`다. [StudentPetStage.tsx:138](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:138), [index.css:12084](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12084) |
| 접근성 및 클릭 동작 | PASS | selected/unselected 모두 의미 있는 `aria-label`, selected `title`, `:focus-visible` 3px outline을 제공한다. selected 상태 클릭 후 `#student-emotions`, dialog/textarea/save button 없음, 페이지/document overflow 없음이 실제 로그에 기록됐다. [StudentPetStage.tsx:138](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:138), [index.css:12095](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12095), [s2-click-action-log.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s2-click-action-log.json) |
| 실제 재사용 컴포넌트, screenshot 대체 없음 | PASS | overview는 `StudentBalanceSummary`, `StudentPetStage`, `StudentSectionCard`, `StudentPurchaseCard`를 합성한다. 하늘 컨트롤은 native `<button>`이고 `StudentEmotionOrbVisual`을 재사용한다. 배경 삽화는 canvas 안의 bounded asset일 뿐 UI/버튼 대체물이 아니다. [StudentOverviewPage.tsx:102](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx:102), [StudentPetStage.tsx:130](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:130), [StudentEmotionOrb.tsx:12](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionOrb.tsx:12) |
| 토큰 기반 레이아웃 | PASS | 16:9, 하늘 top/right/size가 명명 custom property로 구현되고 `DESIGN.md`에 문서화됐다. [index.css:12034](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:12034), [DESIGN.md:75](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:75) |

## Findings

### CRITICAL

없음.

### HIGH

없음.

### MEDIUM

1. **`DESIGN.md`의 서술 두 곳이 현재 승인된 구조와 맞지 않는다.**
   - [DESIGN.md:143](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:143) 및 [DESIGN.md:147](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:147)은 overview의 “dedicated daily-emotion card”와 `StudentEmotionSummary`를 현재 계약처럼 설명한다. 현재 JSX는 그 카드를 제거하고 하늘 button으로 이동시켰다.
   - 영향: 이후 구현자가 문서를 따라 카드를 되살릴 위험이 있는 design-system 문서 부채다.
   - 권고: 다음 문서 정리 시 두 문장을 현재 “선택 감정 이미지 하나를 하늘 오른쪽 위에 배치” 계약으로 갱신한다. 사용자 명시 스펙을 위반하지 않는 문서 정리이며, 이번 승인 차단 항목은 아니다.

### LOW

없음.

## 검증 결과

- 유효 캡처 signature/dimensions 확인:
  - [S1 PNG](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-student-start-1280x800-valid.png): PNG, `1280×800`, SHA-256 `d3105be6…306c3d3`.
  - [S2 PNG](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s2-emotion-selection-after-click-1280x800-valid.png): PNG, `1280×800`, SHA-256 `b56caa8a…55a430b`.
- Freshness: UI source의 latest mtime `18:21:04`보다 S1/S2 manual QA evidence mtime `18:28:56`이 뒤다.
- `git diff --check`: 통과.
- `npm run lint` (`tsc --noEmit`): 통과.

## Evidence inspected

1. 실행 QA: [student-emotion-start-manual-qa.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/student-emotion-start-manual-qa.md), [s1-metrics.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s1-metrics.json), [s2-click-action-log.json](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-emotion-start-qa/s2-click-action-log.json), S1/S2 valid PNGs.
2. 현재 소스·diff: [StudentOverviewPage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx), [StudentPetStage.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx), [StudentEmotionOrb.tsx](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentEmotionOrb.tsx), [index.css](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css), [DESIGN.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md).
3. Notepad: [.omo/ulw-loop/notepad.md](/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/ulw-loop/notepad.md) — 관련 없는 과거 storage-debug 기록으로, 본 판정에 사용하지 않았다.

## Blockers

없음.
