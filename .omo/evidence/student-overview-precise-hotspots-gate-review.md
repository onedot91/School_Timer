# Student overview precise hotspots gate review

- recommendation: **APPROVE**
- user-facing verdict: **PASS**
- review mode: read-only, 1280×800 student overview
- blockers: none

## originalIntent

제공된 스크린샷에서 지나치게 크게 보이던 알 둥지, 우편함, 책방의 포커스/터치 영역을 실제 그림 외곽에 더 정확히 맞추되 접근성과 기존 이동 동작을 유지한다.

## desiredOutcome

1280×800의 학생 개요 화면에서 세 hotspot이 각각 보이는 알 둥지, 우편함, 책방을 정밀하게 덮고, 각 축이 최소 44 CSS px 이상이며, 서로 겹치거나 문서 overflow를 만들지 않는다. 네이티브 키보드 접근성과 기존 `onClick` 목적지는 유지되고, 위치 값은 디자인 토큰으로 구현되어야 한다.

## userOutcomeReview

PASS. fresh capture는 1280×800이며 1159.1×652 stage에서 세 영역이 실제 그림에 맞는다. 알 영역은 둥지와 흰 알을 감싸면서 주변 나뭇가지·수관을 크게 포함하지 않고, 우편함 영역은 빨간 본체와 기둥을 포함하면서 좌우 수풀/나무로 과도하게 퍼지지 않으며, 책방 영역은 지붕·건물·계단을 포함하면서 하늘과 앞마당을 과도하게 포함하지 않는다.

제시된 실측값은 모두 44×44 기준을 넘는다: egg `144.63×91`, mailbox `161.99×208`, library `312.41×247`. 세 사각형은 서로 분리되어 있고 캡처에 clipping이나 문서 overflow가 없다. CSS의 비율 토큰을 stage 크기에 적용한 계산값도 실측과 반올림/보더 오차 범위에서 일치한다: egg 약 `144.89×91.28`, mailbox 약 `162.27×208.64`, library 약 `312.96×247.76`.

상호작용 계약은 유지된다. 세 요소는 `StudentPetStage.tsx`의 네이티브 `<button type="button">`이며 egg는 `onOpenEgg`, mailbox는 `onOpenMailbox`, library는 `onOpenLibrary`를 그대로 호출한다. 각각 상태를 설명하는 `aria-label`이 있고, CSS는 `:focus-visible`의 3px 고대비 outline과 흰 border를 유지한다. 축소된 outline은 실제 타깃 외곽을 표시하므로 포커스 가시성을 제거하지 않는다.

## criteria

| id | criterion | result | evidencePointer |
| --- | --- | --- | --- |
| C1 | 세 touch/focus 영역이 보이는 artwork에 정밀하게 정렬 | PASS | `.omo/evidence/student-overview-precise-hotspots-final.jpg`; `src/index.css:12034-12078` |
| C2 | 모든 타깃이 최소 44×44 | PASS | supplied live metrics: egg `144.63×91`, mailbox `161.99×208`, library `312.41×247`; `src/index.css:12058-12059` |
| C3 | hotspot 간 겹침 없음 | PASS | supplied metrics 및 capture의 분리된 좌/우 배치 |
| C4 | 1280×800 문서 overflow 0 | PASS | supplied fresh-capture runtime result; 1280×800 JPEG visual inspection |
| C5 | 키보드·접근성 유지 | PASS | native buttons and descriptive labels at `src/components/student/StudentPetStage.tsx:130-137`; focus style at `src/index.css:12113-12119` |
| C6 | design-token implementation | PASS | named custom properties at `src/index.css:12035-12046`, consumption at `12065-12077`, documentation in `DESIGN.md:76-78` |
| C7 | mailbox/egg/library interaction regression 없음 | PASS | unchanged direct handlers at `StudentPetStage.tsx:130-137`; geometry-only CSS refinement does not alter pointer or keyboard semantics |

## findings

- [product] PASS: 세 타깃은 물체 중심뿐 아니라 실제 클릭 가능한 시각 외곽을 충분히 포함하면서 이전처럼 주변 장면까지 덮지 않는다.
- [product] PASS: 최소 타깃 크기, 포커스 가시성, 네이티브 버튼 semantics, 목적지 handler가 모두 유지된다.
- [evidence] PASS: fresh 1280×800 캡처와 supplied DOM metrics가 CSS 토큰 계산과 일치하며 overlap/overflow가 없다.
- [evidence] NOTE: 이 precise-hotspot 조정만을 위한 별도 executor report, code-review report, manual-QA matrix, notepad path는 발견되지 않았다. 직접 artifact 검토가 모든 stated criterion을 충족하므로 blocker가 아니다.

## direct remove-ai-slops / overfit pass

관련 CSS diff, production component, DESIGN.md를 직접 검토했다. hotspot 조정은 기존 요소에 비율 기반 named custom properties를 적용한 최소 변경이다. 불필요한 helper/extraction/parser/normalizer, speculative abstraction, broad catch, type suppression, debug code는 없다. 이 조정을 위해 추가된 테스트가 없으므로 deletion-only test, 제거 자체만 검증하는 test, tautological test, implementation-mirroring test, 과도한 fixture/test도 없다. 좌표 CSS를 문자열로 고정하는 테스트보다 현재 visual/DOM evidence가 사용자-visible contract에 더 직접적이다.

## direct programming pass

기존 typed React props와 직접 handler 연결을 유지한다. 새 dependency, API, state path, side effect가 없고 hotspot CSS는 한 semantic owner인 `.student-character-stage-card`에 모여 있다. 전체 `src/index.css` 및 공유 working-tree에는 이번 요청 외 변경이 많지만, 이 검토는 hotspot token/selector와 해당 버튼 계약으로 범위를 제한했다. 파일 크기와 광범위한 dirty diff는 이 요청의 stated criterion 실패가 아니므로 NOTE다.

## report coverage check

현재 precise-hotspot 작업에 정확히 대응하는 code-review report에서 동일한 `remove-ai-slops`/`programming` 및 overfit 기준을 명시한 기록은 발견되지 않았다. 과거 egg hotspot gate report는 해당 관점을 포함하지만 이전 좌표를 검토한 것이므로 현재 좌표 승인 근거로 대체하지 않았다. 본 gate에서 두 관점을 직접 적용했고 명시 기준 전부가 artifact로 확인되므로 coverage gap은 blocker가 아니다.

## checked artifact paths

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-precise-hotspots-final.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-egg-gate-review.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/.omo/evidence/student-overview-egg-hotspot-clone-fidelity.md`

## exact evidence gaps

- `omo ulw-loop status --json` 실행 시 `omo: command not found`여서 ULW attempt directory를 확인할 수 없었다. 지침에 따라 `.omo/evidence/` fallback report path를 사용했다.
- 현재 precise-hotspot 변경 전용 executor report, code-review report, manual-QA matrix, notepad path는 제공되거나 발견되지 않았다.
- 이번 리뷰는 supplied fresh capture와 supplied live metrics를 검증했으며 새 브라우저 세션에서 세 버튼을 실제 활성화하지 않았다. 실제 학생 상태 변경을 피하기 위해 interaction regression은 네이티브 버튼/handler/ARIA 소스 계약으로 확인했다.
- 별도 static/security scanner는 프로젝트에 설정되어 있지 않아 N/A다.

## BLOCKING

없음.
