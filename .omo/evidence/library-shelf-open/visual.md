# 책장 열기 독립 Visual/CJK QA

## Recommendation

**PASS**

제품 동작과 제출 증거 모두 요청한 결과를 충족한다. 차단 이슈 없음.

## Original intent / desired outcome

- 책장 가장자리에서 가까운 대상이 `shelf` 또는 이미 꽂힌 책(`placed-book`)이어도 cue를 항상 `책장 열기`로 표시한다.
- E, ㄷ, Enter, cue 클릭 모두 개별 책 상세가 아니라 해당 책장의 전체 slots modal을 먼저 연다.
- 열린 책장 안에서 꽂힌 책을 선택하면 기존 책 상세 modal로 이어진다.
- 기존 시각 스타일을 유지하며 1280×800에서 한국어 잘림, 겹침, 화면 밖 overflow가 없어야 한다.
- modal을 닫은 뒤 keyboard focus가 game canvas로 복귀해야 한다.

## Product review

- `src/components/student/library/CanvasLibraryGame.tsx:405-409`: `shelf`와 `placed-book`이 동일한 `slots` modal 분기를 사용한다.
- `src/components/student/library/CanvasLibraryGame.tsx:595-596`: 두 target kind의 cue가 동일한 `가까운 곳 살펴보기: 책장 열기`로 계산된다.
- `src/components/student/library/CanvasLibraryGame.tsx:635-637`: 화면 cue는 계산된 label을 그대로 사용하고 클릭도 동일한 `interact` 경로를 사용한다.
- `src/components/student/library/CanvasLibraryGame.tsx:719-794`: 먼저 전체 책장/slot grid가 렌더링된다.
- `src/components/student/library/CanvasLibraryGame.tsx:801-824`: 점유 슬롯 선택 후 기존 책 상세 dialog가 렌더링된다.
- 변경 범위의 통합 분기는 요청에 직접 필요한 최소 변경이다. 불필요한 새 추출·정규화·파서·삭제 검증·구현 미러링 테스트 등 remove-ai-slops/programming 관점의 차단성 과잉은 확인되지 않았다.

## Evidence review

- 현재 production source SHA-256: `7864220e9a6f11f67f043386446759a59fa6d0de2b28b54b01152af2c0ee204a`.
- `.omo/evidence/library-shelf-open/after.json`의 `sourceStart`와 `sourceEnd`가 현재 해시와 일치한다.
- `after.json`은 네 책장 모두 label=`가까운 곳 살펴보기: 책장 열기`, `openedShelf=true`, `errors=[]`를 기록한다.
- `.omo/evidence/library-shelf-open/fixture.tsx`는 production `CanvasLibraryGame`과 `createFullLibraryRoom()`을 mount하며, 각 shelf 첫 slot의 interaction point와 합성 책만 주입한다. 정적 이미지/대체 UI가 아니다.
- `.omo/evidence/library-shelf-open/qa.mjs`는 E, Enter, ㄷ(`key=ㄷ`, `code=KeyE`), cue click, 내부 책 선택, Escape 후 canvas focus 복귀를 실제 브라우저에서 수행한다.
- 24개 `after-shelf-{0..3}-{cue,opened,selected-book,Enter,korean,click}.png`를 모두 원본으로 직접 열어 확인했다. 모두 1280×800이다.

## Scenario coverage

| 책장 | cue | E/opened | 내부 책 상세 | Enter | ㄷ | click | 시각/CJK |
|---|---|---|---|---|---|---|---|
| 0 (slots 1–24) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 1 (slots 31–50) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 2 (slots 51–70) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 3 (slots 71–94) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

책장별 world book 색상과 열린 modal의 점유 slot(1/31/51/71)이 일치한다. 전체 책장 frame, 모든 slot, 닫기 버튼이 viewport 안에 있으며 cue의 `책장 열기`, modal의 `책을 둘 자리`, 책 상세의 `책 정보` 및 metadata에 CJK clipping/overlap이 없다. 배경 dimming, focus outline, 기존 pixel-art/paper styling도 유지된다.

## Blockers

없음.

## Notes / exact evidence gaps

- PNG는 정지 화면이므로 focus 복귀 자체를 픽셀로 증명하지 않는다. 다만 동일 실행의 QA 스크립트가 매 modal Escape 직후 `document.activeElement === canvas`를 assertion하며 `after.json`의 오류가 0이다.
- `before.json`/8개 before PNG는 과거 `책 정보` 동작의 재현 증거로만 사용했고, 새 UI의 pixel reference로 사용하지 않았다.
- 전체 suite/type/build 통과 주장은 이 좁은 visual QA에서 재실행하지 않았다. 본 판정은 production source, actual-component fixture, 24개 브라우저 PNG 및 실행 manifest에 근거한다.

## Checked artifacts

- `.omo/plans/library-shelf-open.md`
- `.omo/evidence/library-shelf-open/after.json`
- `.omo/evidence/library-shelf-open/before.json`
- `.omo/evidence/library-shelf-open/fixture.tsx`
- `.omo/evidence/library-shelf-open/qa.mjs`
- `.omo/evidence/library-shelf-open/report.md`
- `.omo/evidence/library-shelf-open/after-shelf-{0..3}-{cue,opened,selected-book,Enter,korean,click}.png` (24 files, individually opened)
- `src/components/student/library/CanvasLibraryGame.tsx`

