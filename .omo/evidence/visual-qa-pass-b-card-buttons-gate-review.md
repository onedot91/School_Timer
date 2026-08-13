# Visual QA Pass B — Student overview card buttons

- recommendation: APPROVE (visual verdict: PASS)
- confidence: HIGH
- originalIntent: `고마 벌기`와 `고마 쓰기` 카드 전체를 버튼으로 만들고 기존 1280×800 정렬과 가독성을 유지한다.
- desiredOutcome: 두 목적지 카드가 각각 하나의 native `button`이며, 카드 전 영역이 클릭 가능하고 1280×800에서 기존 배치, 가독성, CJK 줄바꿈, 포커스 표시가 유지된다.

## User outcome review

제공된 실제 캡처에서는 두 카드가 하단 좌우에 균형 있게 배치되고, 제목은 한 줄로 자연스럽게 유지되며, 잘림·겹침·고립된 한국어 음절이 보이지 않는다. 카드 전체의 테두리, 배경, 포인터 커서 스타일과 양끝의 방향 아이콘 때문에 카드 전체가 하나의 클릭 대상으로 인지된다. 아이콘 박스와 24px 방향 아이콘의 무게도 제목과 균형을 이룬다.

소스에서 `StudentSectionCard`의 루트는 `type="button"`인 단일 native `button`이고 내부는 `span`만 사용하므로 nested button이 없다. `onClick`은 루트 버튼에 직접 연결된다. 전역 `:focus-visible` 규칙은 3px outline과 offset을 제공한다. 교체 캡처는 정확히 1280×800이며 화면 전체와 하단 카드 행이 viewport 안에 잘림 없이 들어온다.

## Evidence trace

- Replacement actual capture: `/private/tmp/student-overview-card-buttons-1280x800.jpg`
  - JPEG/JFIF, 정확히 1280×800
  - source보다 최신
  - 브라우저 측정상 두 버튼 375.55×112, nested button 없음
  - 잘림, overflow, 한국어 wrapping/orphan 없음
- Reference context: `/var/folders/kp/rl6bb8813rzcdv9h2_qvck5m0000gn/T/codex-clipboard-e354274d-755e-417f-a1a4-0ada489339c0.png`
  - PNG, 2166×318
  - 하단 3열 배열과 좌/우 카드 방향성 비교에만 사용
- Component: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentSectionCard.tsx`
  - root native `button`, `type="button"`, 직접 `onClick`, 내부 `span`만 존재
- Styles: `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
  - `.student-section-card`: grid, overflow hidden, pointer cursor, active feedback
  - compact viewport rule: 7rem action height, 3열 destination layout, 2.75rem icon/action sizing
  - global `:focus-visible`: visible 3px outline
- Diff inspected: `git diff -- src/components/student/StudentSectionCard.tsx src/index.css`
- ULW status: `omo` executable unavailable (`command not found`); fallback evidence path used.

## Tagged findings

1. `[evidence] [viewport] [pass]` 교체 actual capture가 정확히 1280×800이며 document scroll dimensions도 1280×800이다. 전체 화면과 하단 카드 행에 overflow가 없다.
2. `[product] [alignment/CJK] [pass]` In the supplied frame, both cards align to the same baseline and height; Korean labels remain intact on one line with no clipping or orphaning.
3. `[product] [affordance] [pass]` Full-card border/background, cursor styling, and root-button semantics make the entire card appear actionable; icon/action weight is balanced.
4. `[product] [structure/accessibility] [pass]` Each card is one native button with no nested interactive control, direct click routing, and a visible focus rule.
5. `[maintenance/slop] [note]` Direct remove-ai-slops/programming pass found no new tests, tautological removal assertions, implementation-mirroring tests, unnecessary extraction, parsing, or normalization in the scoped component change. Unrelated work present in the dirty `index.css` diff was not attributed to this narrow task and is outside this visual verdict.

## Blockers

- 없음.

## Exact evidence gaps

- 없음. 이전 `VC-1280x800-PRESERVATION` 공백은 `/private/tmp/student-overview-card-buttons-1280x800.jpg`로 해소됨.
