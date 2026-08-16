# Manual QA — teacher Shop skin catalog

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA-B-001 | teacher Shop에 `고마 스킨 도감`과 56종 count가 보여야 함 | Web — 교사 설정 모달 > 상점, 938×703 | `view_image({path: "/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-skins.png"})`; `file .omo/evidence/teacher-shop-skins/teacher-shop-skins.png` | PASS | A1, A2, A4 |
| QA-B-002 | 스킨 카드가 3열로 배치되고 내부 스크롤이 가능해야 함 | Web — `고마 스킨 도감` 카드 목록 | 동일 screenshot invocation; source inspection `sed -n '17095,17118p' src/index.css` | PASS | A1, A3 |
| QA-B-003 | CJK 라벨/본문에 부자연스러운 줄바꿈, 글리프 누락, baseline clipping이 없어야 함 | Web — 스킨 카드 라벨 및 도감 헤더 | 동일 screenshot invocation; source inspection `sed -n '8679,8693p' src/pages/TimerPage.tsx` | PASS | A1, A2 |
| QA-B-004 | 설정 모달 navigation이 모든 탭에서 읽혀야 함 | Web — 설정 헤더/8개 navigation 탭 | 동일 screenshot invocation; source inspection `sed -n '11054,11225p' src/pages/TimerPage.tsx` | PASS | A1, A2 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-B-001 | CJK precision | long Korean label width | `오리너구리 고마`, `카멜레온 고마`, `배드민턴 고마`가 카드 안에서 한 줄로 읽히고 잘리지 않아야 함 | PASS | A1, A3, A4 |
| ADV-B-002 | CJK precision | heading/subtitle wrapping | `고마 스킨 도감` 및 `학생이 인형 뽑기에서 얻을 수 있는 스킨`이 orphan glyph 없이 자연스럽게 표시되어야 함 | PASS | A1, A2 |
| ADV-B-003 | scroll behavior | content overflow | 56종 중 일부만 보이는 상태에서 하단 부분 카드가 더 많은 콘텐츠와 내부 스크롤을 암시해야 하며 dialog 밖으로 넘치지 않아야 함 | PASS | A1, A3 |
| ADV-B-004 | navigation legibility | dense tab strip | 8개 한글 탭(`과목`, `경매`, `상점`, `증권`, `시간표`, `추첨`, `감정`, `편지`)이 서로 겹치거나 잘리지 않아야 함 | PASS | A1, A2 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Fresh teacher Shop skin catalog capture, valid RGB PNG 938×703 | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/teacher-shop-skins/teacher-shop-skins.png` |
| A2 | source | Shop catalog render, heading/count/card mapping | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/TimerPage.tsx:8679` |
| A3 | source | Skin grid, max-height, overflow, card/text layout rules | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:17105` |
| A4 | source | 56 `STUDENT_CHARACTER_PRIZES` entries and Korean names/assets | `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/lib/studentEconomy.ts:29` |

## verdict

PASS. The requested skin catalog is visually legible: the `고마 스킨 도감` heading and `56종` count are visible, cards form three columns, long Korean labels remain intact, and the clipped next row provides an internal-scroll affordance without escaping the dialog. No product or evidence defect found in this pass.
